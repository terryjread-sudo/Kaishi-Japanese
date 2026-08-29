'use strict';
/* Kaishi Quest Journey V3 compatibility/adaptive side-quest patch.
   Loaded by version.js so it can be dropped into the live repo without
   replacing the large app.js file. */
(() => {
  const $ = s => document.querySelector(s);
  const bridge = () => window.KaishiJapanReadyBridge;
  const meta = () => bridge()?.getMeta?.();
  const save = () => bridge()?.save?.();
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function progressData(){ try { return JSON.parse(localStorage.getItem('kq-progress') || '{}'); } catch { return {}; } }
  function weakestSkill(wordIds){
    const p = progressData(), skills=['listening','meaning','reading','production','picture','sentence','kanji'];
    let best={skill:'meaning',score:101};
    for(const skill of skills){
      let n=0,total=0;
      for(const id of wordIds){ const m=p[id]?.skills?.[skill]; if(m?.attempts){n++;total+=Number(m.strength||0)*100;} }
      const score=n?total/n:50;
      if(score<best.score)best={skill,score};
    }
    return best.skill;
  }
  const activityFor = skill => ({listening:'listening',reading:'picture',picture:'picture',production:'conversation',sentence:'grammar',kanji:'builder',meaning:'listening'})[skill] || 'listening';
  const activityName = id => ({listening:'Listening Challenge',picture:'Picture Recall',conversation:'Conversation Quest',grammar:'Grammar Challenge',builder:'Kanji Builder'})[id] || 'Practice Challenge';
  const activityIcon = id => ({listening:'🎧',picture:'🖼️',conversation:'💬',grammar:'📐',builder:'漢'})[id] || '⚔️';

  function route(){ return meta()?.dailyJourneyRoute; }
  function injectSideQuest(){
    const m=meta(), r=route();
    if(!m || !r || !Array.isArray(r.steps)) return false;
    const lesson=r.steps.find(s=>s.kind==='chapter' && !r.completed?.includes(s.id));
    if(!lesson) return false;
    const history=Array.isArray(m.sessionHistory)?[...m.sessionHistory].sort((a,b)=>b.completedAt-a.completedAt):[];
    const last=history[0];
    const wordIds=last?.wordIds?.length ? last.wordIds : [];
    const activity=activityFor(weakestSkill(wordIds));
    const sideId=`sidequest-${lesson.id}`;
    const retryId=`${lesson.id}-retry`;
    if(r.steps.some(s=>s.id===sideId)) return true;
    const side={id:sideId,kind:'activity',activityId:activity,topicId:lesson.topicId,icon:activityIcon(activity),title:`Side Quest · ${activityName(activity)}`,detail:`Strengthen the skill that needs the most help before you retry ${lesson.title}.`,required:true,sideQuestFor:lesson.id};
    const retry={...lesson,id:retryId,title:`Retry · ${lesson.title}`,detail:`Your side quest is complete. Revisit the same lesson and show what you now remember.`,retryOf:lesson.id,required:true};
    r.completed=Array.isArray(r.completed)?r.completed:[];
    if(!r.completed.includes(lesson.id)) r.completed.push(lesson.id);
    const i=r.steps.findIndex(s=>s.id===lesson.id);
    r.steps.splice(i+1,0,side,retry);
    r.pendingRepeat=null;
    r.explanation={chapter:r.chapter,sequence:'Side quest required before retry'};
    save();
    return true;
  }

  function renderAdaptiveRoute(){
    const c=$('#dailyRoute'); if(!c) return;
    const r=route(); if(!r) return;
    const completed=new Set(r.completed||[]);
    const next=r.steps.find(s=>!completed.has(s.id));
    c.innerHTML=r.steps.map((s,i)=>{
      const done=completed.has(s.id), current=s.id===next?.id;
      const cls=`daily-route-step ${done?'complete':''} ${current?'current':''} ${s.kind==='activity'?'side-quest':''}`;
      const icon=s.icon|| (s.kind==='activity'?'⚔️':'📖');
      return `<article class="${cls}"><div class="daily-route-step-marker">${done?'✓':esc(icon)}</div><div class="daily-route-step-copy"><span class="eyebrow">${s.kind==='activity'?'Required side quest':done?'Completed lesson':'Next lesson'}</span><strong>${esc(s.title)}</strong><p>${esc(s.detail||'')}</p>${s.required&&!done?'<small class="side-quest-required">Required to continue</small>':''}</div></article>`;
    }).join('');
    const start=$('#startNextMission');
    if(start){ start.textContent=next ? (next.kind==='activity' ? `Start Side Quest · ${activityName(next.activityId)}` : next.retryOf ? 'Retry this lesson' : 'Start next lesson') : 'Journey complete'; start.disabled=!next; }
  }

  function observeCheckpoint(){
    const d=$('#missionSummaryDialog'); if(!d || d.dataset.kqV3) return;
    d.dataset.kqV3='1';
    const obs=new MutationObserver(()=>{
      const title=$('#missionSummaryTitle')?.textContent||'';
      if(d.open && /go over that again|needs a little more practice/i.test(title)){
        if(injectSideQuest()){
          const content=$('#missionSummaryContent');
          if(content) content.innerHTML=`<div class="mission-summary-stats"><article><strong>Needs practice</strong><span>Lesson checkpoint</span></article></div><p>That lesson isn't quite secure yet. Kakashi has added a <strong>required side quest</strong> to strengthen the area you found difficult. Complete it, then the same lesson will return for another try.</p><div class="kq-v3-sidequest-note">⚔️ <strong>Side quest unlocked</strong><br><span>${esc(activityName(route()?.steps?.find(s=>s.kind==='activity' && !route().completed?.includes(s.id))?.activityId||'listening'))}</span></div>`;
          const cont=$('#missionSummaryContinue');
          if(cont){cont.textContent='See Side Quest';cont.onclick=()=>{d.close();renderAdaptiveRoute();$('#startNextMission')?.click();};}
          renderAdaptiveRoute();
        }
      }
    });
    obs.observe(d,{childList:true,subtree:true,characterData:true,attributes:true});
  }

  function wireStart(){
    // The existing app listener is intentionally left in charge of starting
    // route missions. Our injected side-quest is a normal kind:'activity'
    // route step, so the existing launchPathMilestone() path is preserved.
  }

  function init(){
    observeCheckpoint(); wireStart();
    const old=$('#dailyRoute');
    if(old && route()?.steps?.some(s=>s.kind==='activity')) renderAdaptiveRoute();
    setInterval(()=>{observeCheckpoint();wireStart();},1000);
  }
  if(document.readyState==='loading') addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
