'use strict';
/*
  Kaishi Quest Journey 11.16.3
  This is an additive compatibility layer. It keeps the large app.js learning
  engine intact while changing the Journey presentation and adding the
  required side-quest/retry flow around its existing route objects.
*/
(() => {
  const $=s=>document.querySelector(s);
  const meta=()=>{
    try{return JSON.parse(localStorage.getItem('kq-meta')||'{}')}catch{return {}}
  };
  const progress=()=>{
    try{return JSON.parse(localStorage.getItem('kq-progress')||'{}')}catch{return {}}
  };
  const saveMeta=m=>{try{localStorage.setItem('kq-meta',JSON.stringify(m))}catch{}};
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

  function timelineItems(){
    const r=route()||{steps:[],completed:[]};
    const completed=new Set(r.completed||[]);
    const past=history().slice(0,3).map((entry,i)=>({type:'past',id:`history-${entry.id}`,icon:'✓',title:entry.title||'Completed lesson',detail:`${(entry.wordIds||[]).length} lesson words recorded · ${entry.attempts||0} tested answers${entry.attempts?` · ${Math.round((entry.correct||0)/entry.attempts*100)}%`:''}`,done:true,date:entry.completedAt}));
    const routeRows=r.steps.map(s=>({type:s.kind==='activity'?'side':(s.retryOf?'retry':'lesson'),id:s.id,icon:s.icon,title:s.title,detail:s.detail,done:completed.has(s.id),current:!completed.has(s.id)}));
    const future=[...document.querySelectorAll('#journeyPathAhead .path-ahead-item')].slice(0,4).map((el,i)=>({type:'future',id:`future-${i}`,icon:el.querySelector('.path-ahead-icon')?.textContent||'→',title:el.querySelector('.path-ahead-title')?.textContent||'Upcoming lesson',detail:'On your guided learning path',future:true}));
    const seen=new Set();
    return [...past,...routeRows,...future].filter(x=>{if(seen.has(x.id))return false;seen.add(x.id);return true}).slice(0,12);
  }

  function renderUnifiedTimeline(){
    const track=$('#journeyHistoryTrack');if(!track)return;
    const items=timelineItems();
    if(!items.length){track.innerHTML='<p class="muted">Your lessons will appear here as you progress.</p>';return;}
    const currentIndex=items.findIndex(x=>x.current&&!x.done);
    track.innerHTML=`<div class="kq-timeline-spine" aria-hidden="true"></div>`+items.map((x,i)=>{
      const cls=`kq-timeline-item ${x.done?'done':''} ${x.current?'current':''} ${x.type==='side'?'side-quest':''} ${x.type==='retry'?'retry':''} ${x.future?'future':''}`;
      const eyebrow=x.type==='past'?'Completed':x.type==='side'?'Required side quest':x.type==='retry'?'Retry this lesson':x.current?'Current lesson':'Coming up';
      return `<article class="${cls}" data-timeline-id="${esc(x.id)}"><div class="kq-timeline-marker">${esc(x.icon||'•')}</div><div class="kq-timeline-card"><span class="eyebrow">${eyebrow}</span><strong>${esc(x.title||'Lesson')}</strong><p>${esc(x.detail||'')}</p>${x.type==='side'&&!x.done?'<small class="side-quest-required">Required before you continue</small>':''}</div></article>`;
    }).join('');
    if(currentIndex>=0)requestAnimationFrame(()=>{const cur=track.querySelector('.kq-timeline-item.current');if(cur&&track.dataset.kqAutoCenter!=='1'){track.dataset.kqAutoCenter='1';track.scrollTo({top:Math.max(0,cur.offsetTop-track.clientHeight*.35),behavior:'auto'})}});
  }

  function cleanJourneyCopy(){
    const replacements=[
      [/Today’s route complete!/g,'Lesson complete'],
      [/Today's route complete!/g,'Lesson complete'],
      [/today’s recommended route/gi,'guided lesson path'],
      [/today's recommended route/gi,'guided lesson path'],
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
    const obs=new MutationObserver(()=>{
      if($('#journey')?.classList.contains('active')){
        cleanJourneyCopy();
        hideRedundantJourneyControls();
        normaliseLegacyHistory();
        renderUnifiedTimeline();
      }
    });
    obs.observe(target,{subtree:true,childList:true,characterData:true});
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
      } else if(/route complete|mission complete|today/i.test(title)) {
        $('#missionSummaryTitle').textContent='Lesson complete';
        if(content)content.innerHTML='<p>Nice work. This lesson is now part of your learning history. Your next lesson is waiting on the Journey timeline.</p>';
      }
      cleanJourneyCopy();
    });
    obs.observe(dialog,{subtree:true,childList:true,characterData:true,attributes:true});
  }

  function init(){
    normaliseLegacyHistory();
    observe();
    watchCheckpoint();
    hideRedundantJourneyControls();
    setInterval(()=>{
      normaliseLegacyHistory();
      if($('#journey')?.classList.contains('active')){
        cleanJourneyCopy();
        hideRedundantJourneyControls();
        renderUnifiedTimeline();
      }
    },1200);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
