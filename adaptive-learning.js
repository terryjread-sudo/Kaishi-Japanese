'use strict';

/*
 * Kaishi Quest v11.8.1 — Adaptive Learning Update
 *
 * Adds:
 * - New → Recognising → Recall → Usable word states
 * - performance-based Journey mission composition
 * - delayed same-session repair after a mistake
 * - old weak vocabulary mixed into later topics
 * - specific Sensei learning insight
 * - optional Campfire Recall / Kotoba Rain post-mission bonuses
 * - Classic Activity Landmarks as the only activity presentation
 */
(() => {
  const RELEASE_VERSION='11.8.16';
  const REPAIR_DELAY=4;
  const recentRepairKeys=new Set();

  function skillMetric(word,skill){
    return progress?.[word.id]?.skills?.[skill]||{attempts:0,correct:0,strength:0};
  }

  function wordState(word){
    const p=progress?.[word.id];
    if(!p || Number(p.stage||0)<=0) return 'New';

    const meaning=skillMetric(word,'meaning');
    const listening=skillMetric(word,'listening');
    const reading=skillMetric(word,'reading');
    const production=skillMetric(word,'production');
    const sentence=skillMetric(word,'sentence');

    const recognitionEvidence=[meaning,listening,reading]
      .filter(metric=>Number(metric.attempts||0)>=2 && Number(metric.strength||0)>=0.45)
      .length;

    const recallReady=
      Number(production.attempts||0)>=2 &&
      Number(production.strength||0)>=0.52;

    const usableReady=
      recallReady &&
      (
        (Number(sentence.attempts||0)>=2 && Number(sentence.strength||0)>=0.50) ||
        (
          Number(meaning.strength||0)>=0.72 &&
          Number(listening.strength||0)>=0.62
        )
      );

    if(usableReady) return 'Usable';
    if(recallReady) return 'Recall';
    if(recognitionEvidence>=1) return 'Recognising';
    return 'New';
  }

  function stateRank(state){
    return ({New:0,Recognising:1,Recall:2,Usable:3})[state]??0;
  }

  function wordsAtLeast(state='Recognising'){
    const rank=stateRank(state);
    return vocab.filter(word=>wordIntroduced(word) && stateRank(wordState(word))>=rank);
  }

  window.KaishiLearning={
    version:RELEASE_VERSION,
    wordState,
    stateRank,
    wordsAtLeast,
  };

  function averageTopicStrength(topic){
    const introduced=(topic?.words||[]).filter(wordIntroduced);
    if(!introduced.length) return 0;
    let total=0,count=0;
    introduced.forEach(word=>{
      ['meaning','listening','production'].forEach(skill=>{
        const metric=skillMetric(word,skill);
        if(Number(metric.attempts||0)>0){
          total+=Number(metric.strength||0);
          count++;
        }
      });
    });
    return count?total/count:0;
  }

  function adaptiveMissionPlan(topic){
    const due=(topic?.words||[]).filter(word=>{
      const p=progress?.[word.id];
      return p && Number(p.due||0)<=Date.now();
    }).length;
    const avg=averageTopicStrength(topic);

    if(due>=8 || avg<0.38){
      return {newWords:1,reviews:9,support:1,legacy:2,label:'repair'};
    }
    if(avg>=0.68 && due<=4){
      return {newWords:3,reviews:5,support:2,legacy:1,label:'stretch'};
    }
    return {newWords:2,reviews:6,support:2,legacy:2,label:'balanced'};
  }

  // Replace only the topic-session composer. It still uses Kaishi's existing
  // card renderers, SRS, skill selection and save/resume plumbing.
  const originalStartTopicSession=typeof startTopicSession==='function'?startTopicSession:null;
  if(originalStartTopicSession){
    startTopicSession=function(topicId=currentTopic().id){
      if(resumeSavedMission()) return;

      const topic=journeyTopics().find(item=>item.id===topicId)||currentTopic();
      const plan=adaptiveMissionPlan(topic);
      activityReturnScreen='journey';

      const due=topic.words
        .filter(word=>progress[word.id]&&Number(progress[word.id].due||0)<=Date.now())
        .sort((a,b)=>pFor(a.id).due-pFor(b.id).due)
        .slice(0,plan.reviews);

      const unseen=topic.words
        .filter(word=>!progress[word.id]||Number(progress[word.id].stage||0)===0)
        .slice(0,plan.newWords);

      const support=topicSupportWords(topic,plan.support);

      // Deliberately keep older vocabulary alive. Prefer due/weak words that
      // belong to a different topic.
      const legacy=vocab
        .filter(word=>
          wordIntroduced(word) &&
          topicForWord(word).id!==topic.id &&
          !support.includes(word)
        )
        .sort((a,b)=>{
          const pa=pFor(a.id),pb=pFor(b.id);
          const aWeak=Math.min(
            Number(pa.skills?.meaning?.strength||0),
            Number(pa.skills?.listening?.strength||0),
            Number(pa.skills?.production?.strength||0)
          );
          const bWeak=Math.min(
            Number(pb.skills?.meaning?.strength||0),
            Number(pb.skills?.listening?.strength||0),
            Number(pb.skills?.production?.strength||0)
          );
          const aDue=Number(pa.due||0)<=Date.now()?0:1;
          const bDue=Number(pb.due||0)<=Date.now()?0:1;
          return aDue-bDue || aWeak-bWeak;
        })
        .slice(0,plan.legacy);

      const selected=[...new Map(
        [...due,...unseen,...support,...legacy].map(word=>[word.id,word])
      ).values()];

      if(!selected.length){
        makeTargetedMasterySession(
          topic.words.slice(0,Math.min(MISSION_CARD_LIMIT,topic.words.length)).map(word=>word.id),
          topicWeakestSkill(topic)
        );
        return;
      }

      const queue=selected.map(v=>{
        const p=pFor(v.id);
        const unknownKana=unknownKanaFor(v).slice(0,1);
        let skills=p.stage===0
          ? [
              ...(unknownKana.length?['kanaUnlock']:[]),
              'firstEncounter',
              'intro',
              ...(ankiRecordFor(v)?.sentence?['example']:[]),
              'meaning'
            ]
          : [chooseSkill(v)];
        skills=skills.filter(skill=>skill!=='picture'||memoryScenes[sceneKey(v)]);
        return {v,skills};
      });

      session=[];
      while(queue.some(item=>item.skills.length)&&session.length<MISSION_CARD_LIMIT){
        const active=queue.filter(item=>item.skills.length).slice(0,ACTIVE_WORD_MIX);
        active.forEach(item=>{
          if(item.skills.length&&session.length<MISSION_CARD_LIMIT){
            session.push({v:item.v,skill:item.skills.shift()});
          }
        });
        queue.push(...queue.splice(0,Math.min(ACTIVE_WORD_MIX,queue.length)));
      }

      meta.lastAdaptiveMissionPlan={
        date:day(),
        topicId:topic.id,
        plan:plan.label,
        newWords:plan.newWords,
        reviews:plan.reviews,
        legacy:plan.legacy
      };
      save(false);
      clearMissionResume();
      index=0;
      current=null;
      show('study');
      renderCurrent();
    };
  }

  // Turn a failed normal-study answer into a delayed retest in the same
  // session. One repair insertion per word+skill avoids an endless loop.
  if(typeof grade==='function'){
    const baseGrade=grade;
    grade=function(v,skill,rating,ok,...rest){
      const result=baseGrade(v,skill,rating,ok,...rest);

      if(!ok && v?.id){
        meta.adaptiveRecentMistakes=Array.isArray(meta.adaptiveRecentMistakes)
          ? meta.adaptiveRecentMistakes
          : [];
        meta.adaptiveRecentMistakes.unshift({id:v.id,skill,time:Date.now()});
        meta.adaptiveRecentMistakes=meta.adaptiveRecentMistakes.slice(0,30);

        const activeScreen=document.querySelector('.screen.active')?.id;
        const repairable=activeScreen==='study' && SKILLS.includes(skill);
        const key=`${v.id}:${skill}`;

        if(repairable && !recentRepairKeys.has(key)){
          recentRepairKeys.add(key);
          const insertAt=Math.min(session.length,index+REPAIR_DELAY);
          session.splice(insertAt,0,{v,skill,adaptiveRepair:true});
        }
        save(false);
      }
      return result;
    };
  }

  function currentSessionWordIds(){
    const ids=[];
    const add=id=>{if(id&&!ids.includes(id))ids.push(id)};

    // New words first.
    session
      .filter(item=>['firstEncounter','intro'].includes(item?.skill))
      .forEach(item=>add(item?.v?.id));

    // Then mistakes from the current/recent learning period.
    (meta.adaptiveRecentMistakes||[])
      .filter(item=>Date.now()-Number(item.time||0)<4*60*60*1000)
      .forEach(item=>add(item.id));

    // Then the rest of this session.
    session.forEach(item=>add(item?.v?.id));
    return ids;
  }

  function ensureBonusPanel(){
    const dialog=document.getElementById('missionSummaryDialog');
    const continueButton=document.getElementById('missionSummaryContinue');
    if(!dialog||!continueButton||document.getElementById('missionBonusPanel')) return;

    const ids=currentSessionWordIds();
    if(!ids.length) return;

    const panel=document.createElement('section');
    panel.id='missionBonusPanel';
    panel.className='mission-bonus-panel';
    panel.innerHTML=`
      <div class="mission-bonus-heading">
        <span class="eyebrow">Optional bonus · 約1分</span>
        <h3>Cement what you just learned</h3>
        <p>Finish now, or do one short retrieval challenge using today's words.</p>
      </div>
      <div class="mission-bonus-actions">
        <button id="bonusCampfire" type="button">🔥 Campfire Recall <small>No-choice memory check</small></button>
        <button id="bonusRain" type="button">🌧️ Kotoba Rain <small>Fast recognition challenge</small></button>
      </div>
    `;
    continueButton.insertAdjacentElement('beforebegin',panel);

    document.getElementById('bonusCampfire').onclick=()=>{
      dialog.close();
      window.KaishiCampfire?.start(ids.slice(0,4),{source:'mission'});
    };
    document.getElementById('bonusRain').onclick=()=>{
      dialog.close();
      window.KaishiWordRain?.start({wordIds:ids,source:'mission'});
    };
  }

  function learningInsight(){
    try{
      const topic=currentTopic();
      if(!topic?.words?.length) return '';
      const weak=topicWeakestSkill(topic);
      const labels={
        meaning:'recognising meanings',
        listening:'understanding words by ear',
        reading:'reading Japanese',
        picture:'picture association',
        sentence:'using words in sentences',
        production:'recalling Japanese from English',
        kanji:'recognising written forms'
      };
      const counts={New:0,Recognising:0,Recall:0,Usable:0};
      topic.words.filter(wordIntroduced).forEach(word=>counts[wordState(word)]++);
      if(!Object.values(counts).some(Boolean)) return '';
      return `Current focus: ${labels[weak]||weak}. ${counts.Recall+counts.Usable} words can be actively recalled and ${counts.Usable} are showing usable context knowledge.`;
    }catch{
      return '';
    }
  }

  function refreshSenseiInsight(){
    const guide=document.querySelector('.home-sensei');
    if(!guide) return;
    let insight=document.getElementById('adaptiveLearningInsight');
    const text=learningInsight();
    if(!text){
      insight?.remove();
      return;
    }
    if(!insight){
      insight=document.createElement('div');
      insight.id='adaptiveLearningInsight';
      insight.className='adaptive-learning-insight';
      guide.insertAdjacentElement('afterend',insight);
    }
    insight.innerHTML=`<span>🧠</span><p>${esc(text)}</p>`;
  }

  function installClassicOnly(){
    try{
      settings.activityVillageMode=false;
      save(false);
    }catch{}

    // Force the existing renderer to behave as Classic-only even after
    // Settings or Journey rerenders.
    if(typeof renderVillageMap==='function'){
      renderVillageMap=function(){
        try{settings.activityVillageMode=false;}catch{}
        const map=document.getElementById('activityVillageMap');
        const classic=document.getElementById('classicActivityView');
        const practice=document.querySelector('.practice-hub');
        if(map) map.hidden=true;
        if(classic) classic.hidden=false;
        if(practice) practice.hidden=false;
      };
    }

    if(typeof setActivityVillageMode==='function'){
      setActivityVillageMode=function(){
        settings.activityVillageMode=false;
        save();
        renderVillageMap();
        toast('Classic Activity Landmarks are now the standard view');
      };
    }

    // Apply the Classic-only state immediately after replacing the old
    // village renderer, including on upgrades from users who had Village on.
    try{ renderVillageMap(); }catch(error){
      console.warn('[Kaishi v11.8.1] Unable to apply Classic view immediately',error);
    }

    const settingsBack=document.getElementById('settingsBack');
    if(settingsBack){
      settingsBack.addEventListener('click',()=>{
        setTimeout(()=>{
          settings.activityVillageMode=false;
          save(false);
        },0);
      });
    }
  }

  function ensureBonusStyles(){
    if(document.getElementById('adaptiveLearningStyles')) return;
    const style=document.createElement('style');
    style.id='adaptiveLearningStyles';
    style.textContent=`
      .mission-bonus-panel{margin:16px 0;padding:14px;border-radius:18px;background:#fff7ed;border:1px solid #fed7aa}
      .mission-bonus-heading h3{margin:.2rem 0}
      .mission-bonus-heading p{margin:.25rem 0 .7rem}
      .mission-bonus-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .mission-bonus-actions button{text-align:left;padding:13px;border-radius:14px}
      .mission-bonus-actions small{display:block;margin-top:4px;opacity:.7}
      .adaptive-learning-insight{display:flex;gap:9px;align-items:flex-start;margin:8px 0 12px;padding:10px 12px;border-radius:14px;background:#eef2ff;color:#312e81}
      .adaptive-learning-insight p{margin:0;font-size:.86rem}
      @media(max-width:520px){.mission-bonus-actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function install(){
    ensureBonusStyles();
    installClassicOnly();

    const dialog=document.getElementById('missionSummaryDialog');
    if(dialog){
      new MutationObserver(()=>{
        if(dialog.hasAttribute('open')){
          document.getElementById('missionBonusPanel')?.remove();
          setTimeout(ensureBonusPanel,0);
        }
      }).observe(dialog,{attributes:true,attributeFilter:['open']});
    }

    const journey=document.getElementById('journey');
    if(journey){
      new MutationObserver(()=>requestAnimationFrame(refreshSenseiInsight))
        .observe(journey,{childList:true,subtree:true});
    }

    [300,1000,2500].forEach(ms=>setTimeout(refreshSenseiInsight,ms));
    window.addEventListener('pageshow',()=>{
      installClassicOnly();
      refreshSenseiInsight();
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',install,{once:true});
  }else{
    install();
  }
})();
