'use strict';
/*
  Kaishi Quest Journey 11.16.7
  This is an additive compatibility layer. It keeps the large app.js learning
  engine intact while changing the Journey presentation and adding the
  required side-quest/retry flow around its existing route objects.
*/
(() => {
  const $=s=>document.querySelector(s);
  const storageKey=k=>{try{return typeof profileStorageKey==='function'?profileStorageKey(k):k}catch{return k}};
  const meta=()=>{
    try{return JSON.parse(localStorage.getItem(storageKey('kq-meta'))||'{}')}catch{return {}}
  };
  const progress=()=>{
    try{return JSON.parse(localStorage.getItem(storageKey('kq-progress'))||'{}')}catch{return {}}
  };
  const saveMeta=m=>{try{localStorage.setItem(storageKey('kq-meta'),JSON.stringify(m))}catch{}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const route=()=>meta().dailyJourneyRoute;
  const history=()=>{const m=meta();return(Array.isArray(m.sessionHistory)?m.sessionHistory:[]).slice().sort((a,b)=>Number(b.completedAt||0)-Number(a.completedAt||0));};

  // Old Journey history could record a whole chapter catalogue rather than
  // the words actually introduced/tested in the session. Keep the useful
  // history record but stop presenting 20+ catalogue items as "learned".
  function normaliseLegacyHistory(){
    const m=meta(); if(!Array.isArray(m.sessionHistory))return false;
    let changed=false;
    m.sessionHistory=m.sessionHistory.map(entry=>{
      if(entry?.journeyHistoryNormalised)return entry;
      const ids=Array.isArray(entry.wordIds)?entry.wordIds:[];
      if(ids.length>15){
        const p=progress();
        const meaningful=ids.filter(id=>{const x=p[id];return x && (Number(x.reps||0)>0 || Number(x.stage||0)>0)});
        const replacement=(meaningful.length?meaningful:ids).slice(0,15);
        if(replacement.length<ids.length){
          changed=true;
          return {...entry,wordIds:replacement,journeyHistoryNormalised:true,legacyWordCount:ids.length};
        }
      }
      return {...entry,journeyHistoryNormalised:true};
    });
    if(changed)saveMeta(m);
    return changed;
  }

  const skillLabels={listening:'listening',reading:'reading',picture:'picture memory',production:'active recall',sentence:'sentence understanding',kanji:'written Japanese',meaning:'meaning recall'};
  const activityFor=skill=>({listening:'listening',reading:'picture',picture:'picture',production:'conversation',sentence:'grammar',kanji:'builder',meaning:'listening'})[skill]||'listening';
  const activityName=id=>({listening:'Listening Challenge',picture:'Picture Recall',conversation:'Conversation Quest',grammar:'Grammar Challenge',builder:'Kanji Builder'})[id]||'Practice Challenge';
  const activityIcon=id=>({listening:'🎧',picture:'🖼️',conversation:'💬',grammar:'📐',builder:'漢'})[id]||'⚔️';

  function weakestSkill(wordIds){
    const p=progress(),skills=['listening','meaning','reading','production','picture','sentence','kanji'];
    let best={skill:'meaning',score:101,attempts:0};
    for(const skill of skills){
      let attempts=0,total=0;
      for(const id of wordIds||[]){const m=p[id]?.skills?.[skill];if(m?.attempts){attempts+=Number(m.attempts);total+=Number(m.strength||0)*Number(m.attempts)}}
      if(!attempts)continue;
      const score=total/attempts*100;
      if(score<best.score)best={skill,score,attempts};
    }
    return best;
  }

  function addRequiredSideQuest(){
    const m=meta(),r=m.dailyJourneyRoute;
    if(!r||!Array.isArray(r.steps))return false;
    const lesson=r.steps.find(s=>s.kind==='chapter'&&!r.completed?.includes(s.id)&&!s.retryOf);
    if(!lesson)return false;
    const recent=history().find(h=>Array.isArray(h.wordIds)&&h.wordIds.length);
    const weak=weakestSkill(recent?.wordIds||[]);
    const activity=activityFor(weak.skill);
    const sideId=`sidequest-${lesson.id}`;
    const retryId=`${lesson.id}-retry`;
    if(r.steps.some(s=>s.id===sideId))return true;
    const side={id:sideId,kind:'activity',activityId:activity,topicId:lesson.topicId,icon:activityIcon(activity),title:`Side Quest · ${activityName(activity)}`,detail:`Strengthen ${skillLabels[weak.skill]||'this skill'} before retrying the lesson.`,required:true,sideQuestFor:lesson.id};
    const retry={...lesson,id:retryId,title:`Retry · ${lesson.title}`,detail:'Return to the same lesson and show what you now remember.',retryOf:lesson.id,required:true};
    r.completed=Array.isArray(r.completed)?r.completed:[];
    r.completed=r.completed.filter(id=>id!==lesson.id);
    const at=r.steps.findIndex(s=>s.id===lesson.id);
    r.steps.splice(at+1,0,side,retry);
    r.pendingRepeat=null;
    r.explanation={chapter:r.chapter,sequence:'Extra practice is required before this lesson can be completed.'};
    saveMeta(m);
    return true;
  }

  // Side quests are also used for variety, not only remediation. Roughly every
  // third completed lesson gets an optional challenge when no required side quest
  // is pending. This keeps the Journey playful without interrupting mastery.
  function addVarietySideQuest(){
    const m=meta(),r=m.dailyJourneyRoute;
    if(!r||!Array.isArray(r.steps))return false;
    const completed=new Set(Array.isArray(r.completed)?r.completed:[]);
    const lessons=r.steps.filter(s=>s.kind==='chapter'&&!s.retryOf&&completed.has(s.id));
    if(!lessons.length || lessons.length%3!==0)return false;
    const lesson=lessons[lessons.length-1];
    if(r.steps.some(s=>s.kind==='activity'&&s.sideQuestFor===lesson.id))return false;
    const options=[
      {id:'conversation',title:'Conversation Quest',icon:'💬',detail:'Use this lesson’s Japanese in a short real-world conversation.'},
      {id:'listening',title:'Listening Challenge',icon:'🎧',detail:'Hear familiar Japanese in a different context.'},
      {id:'picture',title:'Picture Recall',icon:'🖼️',detail:'Connect the Japanese you know to a quick visual challenge.'},
      {id:'grammar',title:'Grammar Challenge',icon:'📐',detail:'Spot how this lesson’s Japanese works in a sentence.'}
    ];
    const hash=[...String(lesson.id||'')].reduce((n,c)=>n+c.charCodeAt(0),0);
    const choice=options[hash%options.length];
    const side={id:`variety-${lesson.id}`,kind:'activity',activityId:choice.id,topicId:lesson.topicId,icon:choice.icon,title:`Side Quest · ${choice.title}`,detail:choice.detail,required:false,varietySideQuest:true,sideQuestFor:lesson.id};
    const at=r.steps.findIndex(s=>s.id===lesson.id);
    if(at<0)return false;
    r.steps.splice(at+1,0,side);
    saveMeta(m);
    return true;
  }

  function fullJourneyTimelineItems(){
    // The old dailyJourneyRoute deliberately contains only today's/current lesson.
    // That is useful for launching a lesson, but it is NOT the Journey timeline.
    // Build the timeline from the persistent chapter curriculum instead.
    const total=typeof wordChapterCount==='function'?Number(wordChapterCount()||0):0;
    const current=typeof currentWordChapterIndex==='function'?Number(currentWordChapterIndex()||0):0;
    const from=Math.max(0,current-3);
    const to=Math.min(total,current+5); // current + four lessons ahead
    const r=route()||{steps:[],completed:[]};
    const routeSteps=Array.isArray(r.steps)?r.steps:[];
    const routeCompleted=new Set(Array.isArray(r.completed)?r.completed:[]);
    const rows=[];

    for(let chapter=from;chapter<to;chapter++){
      let words=[];
      let topic=null;
      try{
        words=typeof chapterWords==='function'?(chapterWords(chapter)||[]):[];
        topic=typeof topicForWord==='function'&&words[0]?topicForWord(words[0]):null;
      }catch{}
      let stats={complete:false,percent:0};
      try{stats=typeof chapterStats==='function'?(chapterStats(chapter)||stats):stats}catch{}
      const isCurrent=chapter===current&&!stats.complete;
      const complete=Boolean(stats.complete);
      const title=`Lesson ${chapter+1}: ${words.slice(0,2).map(w=>w.meaning).filter(Boolean).join(' + ')||topic?.title||`Lesson ${chapter+1}`}`;
      const detail=complete
        ? `Completed • ${Number(stats.percent||100)}% lesson progress`
        : isCurrent
          ? `Current lesson • ${words.length} connected word${words.length===1?'':'s'}${topic?.title?` from ${topic.title}`:''}`
          : `Upcoming lesson${topic?.title?` • ${topic.title}`:''}`;
      rows.push({
        type:isCurrent?'lesson':complete?'past':'future',
        id:`lesson-${chapter}`,
        chapter,
        icon:topic?.icon||'📖',
        title,detail,
        done:complete,
        current:isCurrent,
        future:chapter>current,
        locked:chapter>current
      });

      // Side quests and retries belong to the lesson they were inserted for.
      // They are read from the live route so a newly-triggered quest appears
      // immediately without creating a second Journey screen.
      const lessonId=`lesson-${chapter}`;
      routeSteps.filter(step=>{
        const target=String(step.sideQuestFor||step.retryOf||'');
        return target===lessonId;
      }).forEach(step=>{
        if(step.retryOf){
          rows.push({type:'retry',id:step.id,chapter,icon:step.icon||'🔄',title:step.title||`Retry · Lesson ${chapter+1}`,detail:step.detail||'Return to the same lesson and try again.',done:routeCompleted.has(step.id),current:false,future:chapter>current});
        }else if(step.kind==='activity'){
          rows.push({type:'side',id:step.id,chapter,icon:step.icon||'⚔️',title:step.title||'Side Quest',detail:step.detail||'A challenge added to your Journey.',done:routeCompleted.has(step.id),current:chapter===current&&!complete&&!routeCompleted.has(step.id),future:chapter>current,required:Boolean(step.required)});
        }
      });
    }

    // If the learner is on the first lesson there is no history node to invent.
    // Completed chapters above are the authoritative past; sessionHistory is
    // deliberately not used to manufacture lessons that the curriculum says
    // have not been completed.
    return rows;
  }

  function timelineItems(){
    const rows=fullJourneyTimelineItems();
    if(!rows.length){
      // Safe fallback for an early startup before vocabulary/chapter data exists.
      const r=route()||{steps:[],completed:[]};
      const completed=new Set(r.completed||[]);
      return (r.steps||[]).slice(0,8).map(s=>({
        type:s.kind==='activity'?'side':(s.retryOf?'retry':'lesson'),id:s.id,icon:s.icon,title:s.title,detail:s.detail,
        done:completed.has(s.id),current:false,future:false,required:Boolean(s.required)
      }));
    }
    return rows;
  }

  function renameTimelineHeading(){
    const track=$('#journeyHistoryTrack');
    const section=track?.closest('section,article,div');
    const roots=[section,$('#journeyHistoryTimeline'),$('#journey')].filter(Boolean);
    for(const root of roots){
      root.querySelectorAll('h1,h2,h3,h4,.eyebrow,strong').forEach(el=>{
        if(/your recent lessons|recent lessons/i.test(el.textContent||''))el.textContent='Your Journey';
      });
    }
  }

  let renderingTimeline=false;
  function renderUnifiedTimeline(){
    const track=$('#journeyHistoryTrack');if(!track)return;
    const items=timelineItems();
    renderingTimeline=true;
    try{
      if(!items.length){track.innerHTML='<p class="muted">Your lessons will appear here as you progress.</p>';return;}
      const currentIndex=items.findIndex(x=>x.current);
      track.innerHTML=`<div class="kq-timeline-spine" aria-hidden="true"></div>`+items.map(x=>{
        const cls=`kq-timeline-item ${x.done?'done':''} ${x.current?'current':''} ${x.type==='side'?'side-quest':''} ${x.type==='retry'?'retry':''} ${x.future?'future':''}`;
        const eyebrow=x.type==='past'?'Completed':x.type==='side'?(x.required?'Required side quest':'Side quest') :x.type==='retry'?'Retry this lesson':x.current?'Current lesson':'Coming up';
        return `<article class="${cls}" data-timeline-id="${esc(x.id)}"><div class="kq-timeline-marker">${esc(x.icon||'•')}</div><div class="kq-timeline-card"><span class="eyebrow">${eyebrow}</span><strong>${esc(x.title||'Lesson')}</strong><p>${esc(x.detail||'')}</p>${x.type==='side'&&!x.done?(x.required?'<small class="side-quest-required">Required before you continue</small>':'<small class="side-quest-required">Optional challenge</small>'):''}</div></article>`;
      }).join('');
      if(currentIndex>=0){
        requestAnimationFrame(()=>{
          const cur=track.querySelector('.kq-timeline-item.current');
          if(cur && !track.dataset.kqAutoCenter){track.dataset.kqAutoCenter='1';track.scrollTo({top:Math.max(0,cur.offsetTop-track.clientHeight*.35),behavior:'auto'});}
        });
      }
    }finally{renderingTimeline=false;}
  }

  function cleanJourneyCopy(){
    const replacements=[
      [/Today’s route complete!/g,'Lesson complete'],
      [/Today's route complete!/g,'Lesson complete'],
      [/today’s recommended route/gi,'guided lesson path'],
      [/today's recommended route/gi,'guided lesson path'],
      [/your one guided path/gi,'your Journey'],
      [/one guided path/gi,'Journey'],
      [/mandatory mission/gi,'required lesson'],
      [/mission complete/gi,'lesson complete'],
      [/mission/gi,'lesson'],
      [/activity village/gi,'extra practice'],
      [/village/gi,'journey'],
      [/enter village/gi,'continue journey'],
      [/restore meadow/gi,'start practice'],
      [/open listening station/gi,'start listening practice']
    ];
    const root=$('#journey');if(!root)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(n=>{let t=n.nodeValue;const old=t;replacements.forEach(([a,b])=>{t=t.replace(a,b)});if(t!==old)n.nodeValue=t});
    const sensei=root.querySelector('.sensei-block,.teacher-home-guide');
    if(sensei){const p=sensei.querySelector('p');if(p&&/game|village|activity/i.test(p.textContent))p.textContent='I’ll guide you through this lesson and send you to a side quest only if you need extra practice.'}
  }

  function hideRedundantJourneyControls(){
    $('#bonsaiQuickStep')?.setAttribute('hidden','true');
    document.querySelectorAll('#journey .journey-utility-actions,#journey .journey-path-ahead').forEach(el=>el.setAttribute('hidden','true'));
    const old=$('#journeyHistoryTimeline');if(old)old.hidden=false;
  }

  function observe(){
    const target=$('#journey')||document.body;
    const obs=new MutationObserver(mutations=>{
      if(renderingTimeline)return;
      if(mutations.length && mutations.every(m=>{
        const t=m.target?.nodeType===1?m.target:m.target?.parentElement;
        return t && t.closest?.('#journeyHistoryTrack');
      }))return;
      if($('#journey')?.classList.contains('active')){
        clearTimeout(window.__kqJourneyRefreshTimer);
        window.__kqJourneyRefreshTimer=setTimeout(()=>{
          cleanJourneyCopy();
          hideRedundantJourneyControls();
          normaliseLegacyHistory();
          renderUnifiedTimeline();
          renameTimelineHeading();
        },30);
      }
    });
    obs.observe(target,{subtree:true,childList:true});
  }

  function watchCheckpoint(){
    const dialog=$('#missionSummaryDialog');if(!dialog)return;
    const obs=new MutationObserver(()=>{
      if(!dialog.open)return;
      const title=$('#missionSummaryTitle')?.textContent||'';
      const content=$('#missionSummaryContent');
      if(/go over that again|needs a little more practice/i.test(title)){
        if(addRequiredSideQuest() && content){
          content.innerHTML=`<div class="mission-summary-stats"><article><strong>More practice needed</strong><span>Lesson checkpoint</span></article></div><p>This lesson is not secure enough to move on yet. Sensei has added a <strong>required side quest</strong> to strengthen the area that needs the most help.</p><div class="kq-v3-sidequest-note">⚔️ <strong>Side quest added to your journey</strong><br><span>Complete it, then the <strong>same lesson</strong> will return for another try.</span></div>`;
          const btn=[...dialog.querySelectorAll('button')].find(b=>/continue|next|see side/i.test(b.textContent||''));
          if(btn){btn.textContent='See side quest';btn.onclick=()=>{dialog.close();renderUnifiedTimeline();setTimeout(()=>$('#startNextMission')?.click(),30)}}
        }
        renderUnifiedTimeline();
      } else if(/route complete|mission complete|today|lesson complete/i.test(title)) {
        $('#missionSummaryTitle').textContent='Lesson complete';
        const added=addVarietySideQuest();
        if(content)content.innerHTML=added
          ? '<p>Nice work. This lesson is now part of your learning history.</p><div class="kq-v3-sidequest-note">✨ <strong>A side quest has appeared on your Journey</strong><br><span>It’s a change of pace to keep your learning varied.</span></div>'
          : '<p>Nice work. This lesson is now part of your learning history. Your next lesson is waiting on the Journey timeline.</p>';
      }
      cleanJourneyCopy();
    });
    obs.observe(dialog,{subtree:true,childList:true,characterData:true,attributes:true});
  }

  function hideLegacyPracticeEntry(){
    // The single-path Journey owns practice selection now. Older builds may still
    // leave a visible Activity Village / Practice entry on the dashboard.
    document.querySelectorAll('#home #openPracticeHub,#home .open-practice-hub,[data-open-practice-hub]').forEach(el=>{
      el.hidden=true;
      el.setAttribute('aria-hidden','true');
    });
  }

  function campaignMeta(){
    try{
      const m=meta();
      m.activeCampaign=m.activeCampaign||'journey';
      return m;
    }catch{return {activeCampaign:'journey'}}
  }

  function setCampaign(id,explicit=true){
    const m=campaignMeta();
    m.activeCampaign=id==='japan-ready'?'japan-ready':'journey';
    if(explicit) m.campaignSelectionExplicit=true;
    saveMeta(m);
    return m.activeCampaign;
  }

  function stabiliseDashboardCampaign(){
    const home=$('#home');
    if(!home?.classList.contains('active'))return;
    const m=campaignMeta();
    // Journey is the safe/default dashboard state. Japan Ready may remain selected
    // only after the learner has explicitly chosen it.
    if(m.activeCampaign!=='japan-ready' || !m.campaignSelectionExplicit){
      if(m.activeCampaign!=='japan-ready') setCampaign('journey',false);
      const journey=$('#journeyCampaignPreview'),japan=$('#japanReadyCampaignPreview');
      if(journey)journey.hidden=false;
      if(japan)japan.hidden=true;
      const title=$('#campaignChooserTitle');
      if(title)title.textContent='Full Japanese Journey';
      const text=$('#campaignChooserText');
      if(text)text.textContent='Follow one gradual path of small lessons. Practice activities appear when they help reinforce what you have learned.';
    }
    hideLegacyPracticeEntry();
  }

  function installDashboardCampaignGuard(){
    hideLegacyPracticeEntry();
    const home=$('#home');
    if(home){
      const obs=new MutationObserver(()=>{
        clearTimeout(window.__kqCampaignGuardTimer);
        window.__kqCampaignGuardTimer=setTimeout(stabiliseDashboardCampaign,0);
      });
      obs.observe(home,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});
    }
    document.addEventListener('click',event=>{
      const target=event.target.closest?.('#chooseJourneyCampaign,#chooseJapanReadyCampaign');
      if(!target)return;
      const id=target.id==='chooseJapanReadyCampaign'?'japan-ready':'journey';
      setCampaign(id,true);
    },true);
    window.addEventListener('pageshow',stabiliseDashboardCampaign);
    setTimeout(stabiliseDashboardCampaign,0);
  }

  function installTimelinePointerScroll(){
    const track=$('#journeyHistoryTrack'); if(!track || track.dataset.kqPointerScroll)return;
    track.dataset.kqPointerScroll='1';
    let down=false,startY=0,startTop=0;
    track.addEventListener('pointerdown',e=>{if(e.button!==0)return;down=true;startY=e.clientY;startTop=track.scrollTop;track.classList.add('dragging');track.setPointerCapture?.(e.pointerId);});
    track.addEventListener('pointermove',e=>{if(!down)return;track.scrollTop=startTop-(e.clientY-startY);});
    const end=e=>{down=false;track.classList.remove('dragging');try{track.releasePointerCapture?.(e.pointerId)}catch{}};
    track.addEventListener('pointerup',end); track.addEventListener('pointercancel',end);
    track.addEventListener('scroll',()=>{track.dataset.kqAutoCenter='1';},{passive:true});
  }

  function init(){
    normaliseLegacyHistory();
    installDashboardCampaignGuard();
    observe();
    watchCheckpoint();
    hideRedundantJourneyControls();
    const refresh=()=>{if($('#journey')?.classList.contains('active')){cleanJourneyCopy();hideRedundantJourneyControls();normaliseLegacyHistory();renderUnifiedTimeline();renameTimelineHeading();installTimelinePointerScroll();}};
    document.addEventListener('click',e=>{if(e.target.closest?.('#continueJourney,#startNextMission,[data-continue-journey]'))setTimeout(refresh,80);},{capture:true});
    window.addEventListener('pageshow',refresh);
    refresh();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
