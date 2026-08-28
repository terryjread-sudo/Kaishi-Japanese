'use strict';

/*
 * Kaishi Quest v11.9.0 — Adaptive Reinforcement Update
 *
 * - One word, many ways: see → hear → recognise → read → context → recall → use
 * - Skill-profile-driven activity selection (not random repetition)
 * - Recognition → recall → context → production progression
 * - Surprise reviews woven into missions without labelling them
 * - Delayed within-session reinforcement (spacing, not rapid repeats)
 * - Forgotten-word rescue sequences
 * - Mistake-driven reinforcement with a different skill retest
 * - Mission cap preserved; existing card renderers reused
 */
(() => {
  const RELEASE_VERSION=window.APP_VERSION;
  const MIN_WORD_GAP=3;
  const REPAIR_DELAY=5;
  const MISSION_CAP=15;
  const recentRepairKeys=new Set();
  const sessionWordLastIndex=new Map();

  const PROFILE_DIMS={
    meaning:{skill:'meaning',label:'Meaning'},
    listening:{skill:'listening',label:'Listening'},
    reading:{skill:'reading',label:'Reading'},
    recall:{skill:'production',label:'Recall'},
    context:{skill:'sentence',label:'Context'},
    production:{skill:'production',label:'Production'}
  };

  const RESCUE_SKILLS=['meaning','listening','meaning','sentence','production'];

  meta.reinforcement=meta.reinforcement||{rescue:{},strengthenedToday:[],rescuedToday:[]};
  if(typeof day==='function' && meta.reinforcement.date!==day()){
    meta.reinforcement.date=day();
    meta.reinforcement.strengthenedToday=[];
    meta.reinforcement.rescuedToday=[];
  }

  function skillMetric(word,skill){
    return progress?.[word.id]?.skills?.[skill]||{attempts:0,correct:0,strength:0};
  }

  function skillAvailable(word,skill){
    if(skill==='kanji') return word.word!==word.reading;
    if(skill==='picture') return Boolean(memoryScenes?.[sceneKey?.(word)]);
    if(skill==='components') return (wordComponentRecords?.(word)||[]).length>0;
    if(skill==='sentence') return Boolean(word.sentence||ankiRecordFor?.(word)?.sentence);
    if(skill==='listening') return Boolean(word.wordAudio);
    if(skill==='reading') return word.word!==word.reading;
    return true;
  }

  function profileStatus(strength,attempts){
    if(!Number(attempts)) return 'Untested';
    if(Number(strength)>=0.65) return 'Strong';
    if(Number(strength)>=0.40) return 'Developing';
    return 'Weak';
  }

  function skillProfile(word){
    const profile={};
    Object.entries(PROFILE_DIMS).forEach(([key,{skill,label}])=>{
      const metric=skillMetric(word,skill);
      profile[key]={
        skill,label,
        attempts:Number(metric.attempts||0),
        strength:Number(metric.strength||0),
        status:profileStatus(metric.strength,metric.attempts)
      };
    });
    return profile;
  }

  function progressionPhase(word){
    const p=progress?.[word.id];
    if(!p || Number(p.stage||0)<=0) return 'introduction';

    const profile=skillProfile(word);
    const recognition=['meaning','listening','reading'].filter(s=>skillAvailable(word,s));
    const recognitionStrong=recognition.filter(skill=>{
      const metric=skillMetric(word,skill);
      return Number(metric.attempts||0)>=2 && Number(metric.strength||0)>=0.45;
    }).length;

    if(recognitionStrong<Math.min(2,recognition.length)) return 'recognition';

    const recall=skillMetric(word,'production');
    if(Number(recall.attempts||0)<2 || Number(recall.strength||0)<0.52) return 'recall';

    const context=skillMetric(word,'sentence');
    if(skillAvailable(word,'sentence') && (Number(context.attempts||0)<2 || Number(context.strength||0)<0.50)){
      return 'context';
    }
    return 'production';
  }

  function phaseSkills(phase){
    switch(phase){
      case 'introduction': return ['meaning','listening','reading'];
      case 'recognition': return ['meaning','listening','reading','picture'];
      case 'recall': return ['production','meaning','listening'];
      case 'context': return ['sentence','reading','meaning'];
      case 'production': return ['production','sentence','kanji','components'];
      default: return ['meaning','listening','reading','production','sentence'];
    }
  }

  function rescueActive(word){
    return Boolean(meta.reinforcement?.rescue?.[word.id]?.active);
  }

  function nextRescueSkill(word){
    const state=meta.reinforcement.rescue[word.id];
    if(!state?.active) return null;
    const sequence=state.sequence||RESCUE_SKILLS;
    while(state.step<sequence.length){
      const skill=sequence[state.step];
      state.step++;
      if(skillAvailable(word,skill)) return skill;
    }
    state.active=false;
    if(!meta.reinforcement.rescuedToday.includes(word.id)){
      meta.reinforcement.rescuedToday.push(word.id);
    }
    document.dispatchEvent(new CustomEvent('kaishi:reinforcement-rescue-complete',{detail:{wordId:word.id}}));
    return null;
  }

  function detectForgotten(word){
    if(rescueActive(word)) return false;
    const p=pFor(word.id);
    const skills=['meaning','listening','reading','production','sentence'];
    for(const skill of skills){
      const metric=p.skills?.[skill];
      if(!metric || !Number(metric.attempts)) continue;
      const peak=Number(metric.peakStrength||metric.strength||0);
      if(peak>=0.65 && Number(metric.strength||0)<0.35) return true;
    }
    return Number(p.lapses||0)>=2 && Number(p.interval||0)<3 && Number(p.reps||0)>=4;
  }

  function beginRescue(word){
    const filtered=RESCUE_SKILLS.filter(skill=>skillAvailable(word,skill));
    meta.reinforcement.rescue[word.id]={
      active:true,
      step:0,
      sequence:filtered.length?filtered:['meaning'],
      startedAt:Date.now()
    };
    if(typeof save==='function') save(false);
  }

  function weakestSkillForWord(word,preferredSkills){
    const pool=(preferredSkills||phaseSkills(progressionPhase(word)))
      .filter(skill=>skillAvailable(word,skill) && SKILLS.includes(skill));

    if(!pool.length) return 'meaning';

    return pool
      .map(skill=>{
        const metric=skillMetric(word,skill);
        const attempts=Number(metric.attempts||0);
        const strength=Number(metric.strength||0);
        let priority=(1-strength)*(attempts?1:1.35);
        if(skill==='production' && progressionPhase(word)==='recall') priority*=1.25;
        if(skill==='sentence' && progressionPhase(word)==='context') priority*=1.25;
        if(skill==='listening' && profileStatus(strength,attempts)==='Weak') priority*=1.3;
        priority*=skillPreferenceWeight?.(skill)||1;
        priority*=.85+Math.random()*.3;
        return {skill,priority};
      })
      .sort((a,b)=>b.priority-a.priority)[0].skill;
  }

  function buildNewWordSkillQueue(word){
    const unknownKana=unknownKanaFor?.(word)?.slice(0,1)||[];
    const queue=[
      ...(unknownKana.length?['kanaUnlock']:[]),
      'firstEncounter',
      'intro',
      ...(ankiRecordFor?.(word)?.sentence?['example']:[]),
      'meaning',
      ...(skillAvailable(word,'listening')?['listening']:[]),
      ...(skillAvailable(word,'reading')?['reading']:[]),
      ...(skillAvailable(word,'sentence')?['sentence']:[]),
      ...(skillAvailable(word,'production')?['production']:[])
    ];
    return queue.filter(skill=>skill!=='picture'||memoryScenes?.[sceneKey?.(word)]);
  }

  function buildReviewSkillQueue(word){
    if(rescueActive(word)){
      const skill=nextRescueSkill(word);
      return skill?[skill]:[weakestSkillForWord(word)];
    }
    if(detectForgotten(word)){
      beginRescue(word);
      const skill=nextRescueSkill(word);
      return skill?[skill]:[weakestSkillForWord(word)];
    }
    return [weakestSkillForWord(word)];
  }

  function interleaveWithSpacing(queue){
    session=[];
    sessionWordLastIndex.clear();
    let guard=0;

    while(queue.some(item=>item.skills.length) && session.length<MISSION_CAP && guard<200){
      guard++;

      let active=queue
        .filter(item=>item.skills.length)
        .filter(item=>{
          const last=sessionWordLastIndex.get(item.v.id);
          return last===undefined || session.length-last>=MIN_WORD_GAP;
        })
        .slice(0,ACTIVE_WORD_MIX);

      if(!active.length){
        active=queue.filter(item=>item.skills.length).slice(0,ACTIVE_WORD_MIX);
      }
      if(!active.length) break;

      active.forEach(item=>{
        if(!item.skills.length || session.length>=MISSION_CAP) return;
        const skill=item.skills.shift();
        session.push({v:item.v,skill});
        sessionWordLastIndex.set(item.v.id,session.length-1);
      });

      queue.push(...queue.splice(0,Math.min(ACTIVE_WORD_MIX,queue.length)));
    }

    for(let i=1;i<session.length;i++){
      if(session[i].v.id===session[i-1].v.id){
        const swap=session.findIndex((item,j)=>j>i && item.v.id!==session[i-1].v.id);
        if(swap>i) [session[i],session[swap]]=[session[swap],session[i]];
      }
    }
  }

  function surpriseReviewCandidates(currentTopicId){
    return vocab
      .filter(word=>
        wordIntroduced(word) &&
        topicForWord(word).id!==currentTopicId &&
        (Number(progress[word.id]?.due||0)<=Date.now() ||
          ['meaning','listening','production'].some(skill=>Number(progress[word.id]?.skills?.[skill]?.strength||0)<0.45))
      )
      .sort((a,b)=>{
        const pa=pFor(a.id),pb=pFor(b.id);
        const aDue=Number(pa.due||0)<=Date.now()?0:1;
        const bDue=Number(pb.due||0)<=Date.now()?0:1;
        if(aDue!==bDue) return aDue-bDue;
        const aWeak=Math.min(
          Number(pa.skills?.meaning?.strength||0),
          Number(pa.skills?.listening?.strength||0)
        );
        const bWeak=Math.min(
          Number(pb.skills?.meaning?.strength||0),
          Number(pb.skills?.listening?.strength||0)
        );
        return aWeak-bWeak;
      })
      .slice(0,2);
  }

  function injectSurpriseReviews(topicId){
    const candidates=surpriseReviewCandidates(topicId);
    candidates.forEach(word=>{
      if(session.length>=MISSION_CAP) return;
      const skill=skillAvailable(word,'sentence')?'sentence':weakestSkillForWord(word,['listening','meaning','reading','production']);
      const insertAt=Math.min(
        session.length,
        Math.max(4,3+Math.floor(Math.random()*Math.max(1,session.length-3)))
      );
      session.splice(insertAt,0,{v:word,skill,surpriseReview:true});
    });
  }

  function adaptiveReinforcementPlan(topic){
    const due=(topic?.words||[]).filter(word=>{
      const p=progress?.[word.id];
      return p && Number(p.due||0)<=Date.now();
    }).length;
    let totalStrength=0,count=0;
    (topic?.words||[]).filter(wordIntroduced).forEach(word=>{
      ['meaning','listening','production'].forEach(skill=>{
        const metric=skillMetric(word,skill);
        if(Number(metric.attempts||0)>0){
          totalStrength+=Number(metric.strength||0);
          count++;
        }
      });
    });
    const average=count?totalStrength/count:0;

    if(due>=8 || average<0.38){
      return {newWords:1,reviews:9,support:1,legacy:2,label:'repair'};
    }
    if(average>=0.68 && due<=4){
      return {newWords:3,reviews:5,support:2,legacy:1,label:'stretch'};
    }
    return {newWords:2,reviews:6,support:2,legacy:2,label:'balanced'};
  }

  function composeReinforcementSession(topicId){
    const topic=journeyTopics().find(item=>item.id===topicId)||currentTopic();
    const plan=adaptiveReinforcementPlan(topic);

    const due=topic.words
      .filter(word=>progress[word.id]&&Number(progress[word.id].due||0)<=Date.now())
      .sort((a,b)=>pFor(a.id).due-pFor(b.id).due)
      .slice(0,plan.reviews);

    const unseen=topic.words
      .filter(word=>!progress[word.id]||Number(progress[word.id].stage||0)===0)
      .slice(0,plan.newWords);

    const support=topicSupportWords(topic,plan.support);

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
        topic.words.slice(0,Math.min(MISSION_CAP,topic.words.length)).map(word=>word.id),
        topicWeakestSkill(topic)
      );
      return false;
    }

    const queue=selected.map(v=>{
      const p=pFor(v.id);
      const skills=p.stage===0?buildNewWordSkillQueue(v):buildReviewSkillQueue(v);
      return {v,skills:[...skills]};
    });

    interleaveWithSpacing(queue);
    injectSurpriseReviews(topic.id);

    meta.lastAdaptiveMissionPlan={
      date:day(),
      topicId:topic.id,
      plan:plan.label,
      newWords:plan.newWords,
      reviews:plan.reviews,
      legacy:plan.legacy,
      reinforcement:true
    };
    save(false);
    clearMissionResume();
    index=0;
    current=null;
    show('study');
    renderCurrent();
    return true;
  }

  // Skill-aware selection replaces generic chooseSkill during missions.
  if(typeof chooseSkill==='function'){
    const baseChooseSkill=chooseSkill;
    chooseSkill=function(v){
      if(rescueActive(v)){
        const skill=nextRescueSkill(v);
        if(skill) return skill;
      }
      if(Number(progress?.[v.id]?.stage||0)===0) return baseChooseSkill(v);
      return weakestSkillForWord(v);
    };
  }

  if(typeof startTopicSession==='function'){
    startTopicSession=function(topicId=currentTopic().id){
      if(resumeSavedMission()) return;
      if(!composeReinforcementSession(topicId)){
        return;
      }
    };
  }

  function alternateSkill(word,failedSkill){
    const options=phaseSkills(progressionPhase(word))
      .filter(skill=>skill!==failedSkill && skillAvailable(word,skill) && SKILLS.includes(skill));
    return options[0]||weakestSkillForWord(word);
  }

  if(typeof grade==='function'){
    const previousGrade=grade;
    grade=function(v,skill,rating,ok,...rest){
      const before={};
      if(v?.id){
        SKILLS.forEach(s=>{
          before[s]=Number(progress?.[v.id]?.skills?.[s]?.strength||0);
        });
      }

      const result=previousGrade(v,skill,rating,ok,...rest);

      if(v?.id && SKILLS.includes(skill)){
        const metric=progress[v.id]?.skills?.[skill];
        if(metric){
          const strength=Number(metric.strength||0);
          metric.peakStrength=Math.max(Number(metric.peakStrength||0),strength);
        }

        if(!ok){
          const activeScreen=document.querySelector('.screen.active')?.id;
          const repairable=activeScreen==='study' && !activeQuickStep;
          const alt=alternateSkill(v,skill);
          const key=`${v.id}:${alt}`;

          if(repairable && alt!==skill && !recentRepairKeys.has(key)){
            recentRepairKeys.add(key);
            const insertAt=Math.min(session.length,index+REPAIR_DELAY);
            session.splice(insertAt,0,{v,skill:alt,reinforcementRepair:true});
          }

          document.dispatchEvent(new CustomEvent('kaishi:reinforcement-mistake',{
            detail:{wordId:v.id,skill,alternateSkill:alt}
          }));
        }else{
          SKILLS.forEach(s=>{
            const after=Number(progress?.[v.id]?.skills?.[s]?.strength||0);
            if(after-before[s]>=0.08 && !meta.reinforcement.strengthenedToday.includes(v.id)){
              meta.reinforcement.strengthenedToday.push(v.id);
              document.dispatchEvent(new CustomEvent('kaishi:reinforcement-strengthened',{detail:{wordId:v.id,skill:s}}));
            }
          });
        }

        if(detectForgotten(v) && !rescueActive(v)){
          beginRescue(v);
        }

        if(typeof save==='function') save(false);
      }
      return result;
    };
  }

  function ensureStyles(){
    if(document.getElementById('adaptiveReinforcementStyles')) return;
    const style=document.createElement('style');
    style.id='adaptiveReinforcementStyles';
    style.textContent=`
      .reinforcement-rescue-banner{
        margin:0 0 12px;padding:10px 12px;border-radius:14px;
        background:#fef3c7;border:1px solid #fcd34d;color:#92400e;font-size:.84rem
      }
      .reinforcement-rescue-banner strong{display:block;margin-bottom:2px}
      .today-journey-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:10px}
      .today-journey-grid article{padding:11px;border-radius:14px;background:#f8fafc;text-align:center}
      .today-journey-grid strong{display:block;font-size:1.25rem}
      .today-journey-grid span{font-size:.72rem;color:#64748b}
      @media(min-width:560px){.today-journey-grid{grid-template-columns:repeat(5,1fr)}}
    `;
    document.head.appendChild(style);
  }

  function rescueBannerHtml(word){
    if(!rescueActive(word)) return '';
    return `<div class="reinforcement-rescue-banner" role="status"><strong>You forgot this one — let's rebuild it.</strong> Meaning → audio → recognition → context → recall.</div>`;
  }

  if(typeof renderCurrentUnsafe==='function'){
    const baseRender=renderCurrentUnsafe;
    renderCurrentUnsafe=function(){
      baseRender();
      const card=document.getElementById('card');
      const item=session?.[index];
      if(!card||!item?.v||item.surpriseReview) return;
      if(rescueActive(item.v)){
        card.insertAdjacentHTML('afterbegin',rescueBannerHtml(item.v));
      }
    };
  }

  window.KaishiReinforcement={
    version:RELEASE_VERSION,
    skillProfile,
    progressionPhase,
    weakestSkillForWord,
    detectForgotten,
    rescueActive
  };

  function install(){
    ensureStyles();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',install,{once:true});
  }else{
    install();
  }
})();
