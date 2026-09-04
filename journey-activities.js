'use strict';

/*
 * Kaishi Quest — Journey activity policy
 * v11.25.35
 *
 * Activity progression is vocabulary-led. XP and Adventure Points are
 * progression statistics only; they never gate an activity.
 *
 * Lesson rule:
 * - Picture Matching is the main immersive activity when the current lesson
 *   has suitable mnemonic scenes. It is inserted into the lesson itself.
 * - Listening remains a normal reinforcement skill when audio exists.
 * - Conversation, Karuta, Theatre, Manga, Grammar and Kanji activities are
 *   optional side quests. They never replace the core vocabulary lesson.
 * - SRS Battle and Kotoba Colosseum are separate side quests and never lesson content.
 *
 * This is a core module, not a patch overlay. It is loaded after app.js has
 * initialised, then replaces the old XP/AP gating functions with the
 * vocabulary-readiness policy.
 */
(() => {
  const VERSION = '11.26.0';
  const log = message => { try { window.kaishiLog?.('activity-policy', `[${VERSION}] ${message}`); } catch (_) {} };

  const safeArray = value => Array.isArray(value) ? value : [];
  const addStyles=()=>{
    if(document.getElementById('kqJourneyActivityPolicyStyles'))return;
    const style=document.createElement('style');style.id='kqJourneyActivityPolicyStyles';
    style.textContent='.kq-immersive-preview{margin-top:12px;padding:12px 14px;border:1px solid rgba(37,99,235,.18);border-radius:14px;background:rgba(37,99,235,.06)}.kq-immersive-preview strong{display:block}.kq-immersive-preview p{margin:.35rem 0 0;opacity:.8}';
    document.head.appendChild(style);
  };
  addStyles();
  const introduced = () => safeArray(vocab).filter(word => {
    try { return typeof wordIntroduced === 'function' ? wordIntroduced(word) : Boolean(progress?.[word.id]); } catch (_) { return Boolean(progress?.[word.id]); }
  });
  const supported = id => {
    const words = introduced();
    try {
      if (id === 'picture') return words.filter(word => Boolean(memoryScenes?.[sceneKey(word)]?.file));
      if (id === 'listening') return words.filter(word => Boolean(word?.wordAudio));
      if (id === 'karuta') return words.filter(word => Boolean(word?.wordAudio && memoryScenes?.[sceneKey(word)]?.file));
      if (id === 'sentenceLab') return words.filter(word => Boolean(word?._anki?.sentence || word?.exampleSentence));
      if (id === 'kanji' || id === 'builder') return words.filter(word => typeof kanjiCharacters === 'function' && kanjiCharacters(word).length);
    } catch (_) {}
    return words;
  };

  const requirements = {
    vocabulary: 0,
    kana: 0,
    picture: 5,
    listening: 8,
    karuta: 12,
    conversation: 12,
    grammar: 15,
    sentenceLab: 0,
    theatre: 20,
    kanji: 10,
    builder: 10,
    manga: 25,
    battle: 20,
    colosseum: 8,
    kotobaEcho: 5
  };

  const rules = [
    {id:'picture', icon:'🌄', label:'Picture Matching', core:true, immersive:true, roadmap:true, minWords:5, note:'Uses mnemonic scenes to reinforce the words from the lesson.'},
    {id:'listening', icon:'🎧', label:'Listening reinforcement', core:true, immersive:false, roadmap:false, minWords:8, note:'Routine listening practice using familiar words with audio.'},
    {id:'karuta', icon:'🎴', label:'Karuta Challenge', core:false, immersive:true, roadmap:true, minWords:12, note:'Optional side quest using familiar illustrated words and audio.'},
    {id:'conversation', icon:'💬', label:'Conversation Quest', core:false, immersive:true, roadmap:true, minWords:12, note:'Optional side quest that reuses familiar words in dialogue.'},
    {id:'grammar', icon:'助', label:'Grammar & Particles', core:false, immersive:false, roadmap:true, minWords:15, note:'Optional side quest; vocabulary remains the learning anchor.'},
    {id:'sentenceLab', icon:'文', label:'Sentence Lab', core:false, immersive:true, roadmap:false, minWords:0, note:'Guided side quest using real sentences built from familiar vocabulary.'},
    {id:'theatre', icon:'🎬', label:'Kaishi Theatre', core:false, immersive:true, roadmap:true, minWords:20, note:'Optional immersive listening side quest using familiar vocabulary.'},
    {id:'kanji', icon:'漢', label:'Kanji Recognition', core:false, immersive:false, roadmap:true, minWords:10, note:'Optional side quest focused on written forms of familiar words.'},
    {id:'builder', icon:'🧩', label:'Kanji Builder', core:false, immersive:true, roadmap:true, minWords:10, note:'Optional visual side quest using Kanji already encountered.'},
    {id:'manga', icon:'📖', label:'Manga Stories', core:false, immersive:true, roadmap:true, minWords:25, note:'Optional story side quest using familiar Japanese.'},
    {id:'battle', icon:'⚔️', label:'SRS Battle', core:false, immersive:true, roadmap:false, minWords:20, note:'Separate review side quest. It is never part of a lesson.'},
    {id:'colosseum', icon:'⚔️', label:'Kotoba Colosseum', core:false, immersive:true, roadmap:true, minWords:8, note:'Optional listening battle using familiar words. It never replaces a lesson.'},
    {id:'kotobaEcho', icon:'🎤', label:'Kotoba Echo', core:false, immersive:true, roadmap:true, minWords:5, note:'Optional karaoke speaking side quest using familiar words with audio.'}
  ];
  const JOURNEY_IMMERSIVE_ACTIVITY_IDS = new Set(['picture','karuta','conversation','theatre','builder','manga','battle','colosseum','kotobaEcho']);

  const ruleFor = id => rules.find(rule => rule.id === id) || null;
  const missionBrief = (id, words=[]) => {
    const rule = ruleFor(id);
    const vocabulary = safeArray(words).slice(0, 2).map(word => word?.meaning).filter(Boolean).join(' and ');
    const briefs = {
      picture: {objective:'Recognise the lesson words from their visual memory scenes.', purpose:'Picture memory mission'},
      karuta: {objective:'Catch familiar Japanese by sound before the cards disappear.', purpose:'Listening reflex mission'},
      conversation: {objective:'Choose a natural reply in a short Japanese exchange.', purpose:'Conversation mission'},
      theatre: {objective:'Follow a real-world scene and show what you understood.', purpose:'Listening scene mission'},
      builder: {objective:'Rebuild the Kanji components behind familiar lesson words.', purpose:'Kanji construction mission'},
      manga: {objective:'Read familiar Japanese in an illustrated story.', purpose:'Reading story mission'},
      colosseum: {objective:'Use familiar Japanese in a tactical listening battle.', purpose:'Battle mission'},
      kotobaEcho: {objective:'Say familiar Japanese from an English karaoke call card.', purpose:'Speaking karaoke mission'}
    };
    const brief = briefs[id] || {objective:rule?.note || 'Use these new words in a different kind of practice.', purpose:'Immersive practice mission'};
    return {...brief, activityId:id, icon:rule?.icon || '🗺️', label:rule?.label || 'Immersive activity', vocabulary};
  };
  const wordCount = id => id === 'picture' || id === 'listening' || id === 'karuta' || id === 'sentenceLab' || id === 'kanji' || id === 'builder'
    ? supported(id).length
    : introduced().length;

  function activityReadiness(id) {
    const rule = ruleFor(id);
    const cfg = ACTIVITY_VILLAGE_CONFIG?.[id] || {cost:0, words:requirements[id] ?? 0, action:'Practice', theme:'village'};
    const count = wordCount(id);
    const required = Number(requirements[id] ?? cfg.words ?? 0);
    const wordReady = isAdminTestMode() || count >= required;
    const purchased = isAdminTestMode() || safeArray(meta.pathOverrides).includes(id) || safeArray(meta.pathUnlocks).includes(id);
    return {
      cfg: {...cfg, cost:0, words:required},
      supported:count,
      wordReady,
      apReady:true,
      purchased,
      activity:rule
    };
  }

  function pathUnlocked(id) {
    return isAdminTestMode() || safeArray(meta.pathOverrides).includes(id) || safeArray(meta.pathUnlocks).includes(id);
  }

  function refreshPathUnlocks() {
    const unlocked = new Set(['vocabulary','kana','sentenceLab']);
    rules.forEach(rule => {
      if (activityReadiness(rule.id).wordReady) unlocked.add(rule.id);
    });
    // Do not carry forward legacy XP/AP unlock state. Explicit admin
    // overrides remain valid for testing, but normal learners are governed
    // solely by the current vocabulary requirements.
    safeArray(meta.pathOverrides).forEach(id => unlocked.add(id));
    meta.pathUnlocks = [...unlocked];
    try { save(false); } catch (_) {}
    return meta.pathUnlocks;
  }

  function lessonSchedule(chapterIndex, currentChapterIndex, words, opts={}) {
    const lesson = safeArray(words);
    const result = {chapterIndex, lessonNumber:chapterIndex+1, core:[], sideQuests:[], available:[]};
    const chapterSize=typeof WORD_CHAPTER_SIZE==='number'&&WORD_CHAPTER_SIZE>0?WORD_CHAPTER_SIZE:3;
    // Test Learner has every activity launchable from its header, but its
    // Journey should look like the selected lesson for realistic flow tests.
    const introducedCount=isAdminTestMode()
      ?Math.min(safeArray(vocab).length,(Number(chapterIndex)+1)*chapterSize)
      :introduced().length;

    const picture = ruleFor('picture');
    const hasPicture = lesson.some(word => { try { return Boolean(memoryScenes?.[sceneKey(word)]?.file); } catch (_) { return false; } });
    if (hasPicture && introducedCount >= picture.minWords) {
      result.available.push('picture');
      // Picture is the preferred immersive reinforcement, but not every lesson
      // needs it. Rotate it gently once the learner has enough vocabulary.
      const relative = Math.max(0, chapterIndex - Number(currentChapterIndex || 0));
      if (opts.forceFirst || relative % 2 === 0) result.core.push('picture');
    }

    if (lesson.some(word => Boolean(word?.wordAudio)) && introducedCount >= requirements.listening) {
      result.available.push('listening');
      result.core.push('listening');
    }

    rules.filter(rule => !rule.core && rule.id !== 'battle').forEach(rule => {
      if (introducedCount < rule.minWords) return;
      if (rule.id === 'karuta' && !lesson.some(word => { try { return Boolean(word?.wordAudio && memoryScenes?.[sceneKey(word)]?.file); } catch (_) { return false; } })) return;
      result.available.push(rule.id);
      result.sideQuests.push(rule.id);
    });

    // SRS Battle is deliberately independent of lessons.
    return result;
  }

  // Future lesson cards use this same scheduler so previews cannot promise
  // an activity that the Journey would not be able to offer.
  function previewMissionForLesson(chapterIndex, currentChapterIndex, words) {
    const schedule = lessonSchedule(chapterIndex, currentChapterIndex, words);
    const candidates = [...new Set([...schedule.core, ...schedule.sideQuests])];
    const activityId = candidates.find(id =>
      JOURNEY_IMMERSIVE_ACTIVITY_IDS.has(id) &&
      Boolean(ruleFor(id)?.immersive) &&
      activityReadiness(id).wordReady
    );
    return activityId ? missionBrief(activityId, words) : null;
  }

  function activityCard(id, words) {
    const candidates = safeArray(words);
    if (id === 'picture') {
      const target = candidates.find(word => { try { return Boolean(memoryScenes?.[sceneKey(word)]?.file); } catch (_) { return false; } });
      return target ? {v:target, skill:'picture', pictureMode:'picture-word', activityScheduleId:id} : null;
    }
    if (id === 'listening') {
      const target = candidates.find(word => Boolean(word?.wordAudio));
      return target ? {v:target, skill:'listening', activityScheduleId:id} : null;
    }
    return null;
  }

  window.KaishiActivitySchedule = {VERSION, rules, ruleFor, scheduleForLesson:lessonSchedule, previewMissionForLesson, buildCard:activityCard, activityReadiness, supported};

  // Neutralise the legacy AP prices in the shared config so no remaining
  // village renderer can accidentally reintroduce an XP/AP gate.
  try {
    Object.values(ACTIVITY_VILLAGE_CONFIG || {}).forEach(config => { if (config) config.cost = 0; });
  } catch (_) {}

  // Replace the legacy XP/AP policy with vocabulary-only readiness.
  try { window.activityReadiness = activityReadiness; } catch (_) {}
  try { window.pathUnlocked = pathUnlocked; } catch (_) {}
  try { window.refreshPathUnlocks = refreshPathUnlocks; } catch (_) {}

  function patchFunction(name, replacement) {
    try { window[name] = replacement; return true; } catch (error) { log(`${name} could not be replaced: ${error?.message || error}`); return false; }
  }

  // Journey route: one required vocabulary lesson plus at most one optional
  // side quest. Side quests never block the next lesson.
  patchFunction('ensureDailyJourneyRoute', function() {
    const chapter = currentWordChapterIndex();
    const topic = currentTopic();
    const words = chapterWords(chapter);
    const lesson = safeArray(words);
    const today = day();
    const previous = meta.dailyJourneyRoute;
    const same = previous?.date === today && previous?.chapter === chapter;
    if (previous?.date === today && previous?.chapter === chapter && previous?.schemaVersion === 10 && Array.isArray(previous.steps)) return previous;

    const schedule = lessonSchedule(chapter, chapter, words, {forceFirst:true});
    const lessonId = `lesson-${chapter}`;
    const steps = [{
      id:lessonId,
      kind:'chapter',
      chapter,
      topicId:topic.id,
      icon:topic.icon || '🗺️',
      title:`Lesson ${chapter+1}: ${words.slice(0,2).map(word=>word.meaning).join(' + ') || topic.title}`,
      detail:`Learn ${words.length} connected word${words.length===1?'':'s'} from ${topic.title}, then reinforce them before the next lesson.`
    }];

    // Prefer the most learner-relevant side quest rather than dumping a grid
    // of games into the lesson. One side quest at a time keeps the Journey
    // coherent and makes special activities feel earned through vocabulary.
    const lessonRelevant = id => {
      if (id === 'karuta') return lesson.some(word => Boolean(word?.wordAudio && memoryScenes?.[sceneKey(word)]?.file));
      if (id === 'conversation') return safeArray(conversations).some((item,index) => {
        const targets=typeof conversationTargets==='function'?conversationTargets(item):[];
        return Boolean(typeof conversationUnlocked==='function'&&conversationUnlocked(index)&&targets.length&&targets.every(word=>wordIntroduced(word))&&targets.some(word=>lesson.includes(word)));
      });
      if (id === 'theatre') return safeArray(theatreScenes).some(scene => scene.timeline?.some(line => lesson.some(word => word.word === line.targetWord || word.reading === line.targetWord)));
      if (id === 'manga') return safeArray(mangaStories).some(story => story.panels?.some(panel => lesson.some(word => `${word.word}|${word.reading}` === panel.targetKey)));
      if (id === 'battle') return dueWords().some(word => lesson.includes(word)) || lesson.some(word => wordIntroduced(word));
      if (id === 'colosseum') return lesson.some(word => wordIntroduced(word));
      if (id === 'grammar') return lesson.some(word => Boolean(word?._anki?.sentence || word?.exampleSentence));
      if (id === 'kanji' || id === 'builder') return lesson.some(word => typeof kanjiCharacters === 'function' && kanjiCharacters(word).length);
      return true;
    };
    const candidates=[...new Set([...schedule.core.filter(id=>ruleFor(id)?.immersive),...schedule.sideQuests])]
      .filter(id => JOURNEY_IMMERSIVE_ACTIVITY_IDS.has(id) && activityReadiness(id).wordReady && lessonRelevant(id));
    const ranked=candidates.sort((a,b) => {
      const score=id => (meta.pathVisits?.[id] ? 0 : 6) + (id==='battle' ? 1 : 0) + (id==='colosseum' ? 2 : 0) + (id==='karuta' && lesson.some(word => word.wordAudio && memoryScenes?.[sceneKey(word)]?.file) ? 5 : 0);
      return score(b)-score(a);
    });
    const side=ranked[0];
    if (side) {
      const rule=ruleFor(side);
      const shouldShow=!meta.pathVisits?.[side] || chapter % 3 === 0;
      if (shouldShow) {
        steps.push({
          id:`side-${side}-${chapter}`,
          kind:'activity',
          activityId:side,
          sideQuestFor:lessonId,
          optional:true,
          icon:rule.icon,
          title:`Real-world mission · ${rule.label}`,
          detail:missionBrief(side,lesson).objective,
          mission:missionBrief(side,lesson),
          required:false
        });
        steps[0].immersiveMission=missionBrief(side,lesson);
      }
    }

    meta.dailyJourneyRoute={
      schemaVersion:10,
      date:today,
      chapter,
      balanceKey:'vocabulary-gated',
      completed: same ? (previous.completed || []) : [],
      retries:same ? (previous.retries || {}) : {},
      explanation:{chapter,sequence:'One lesson at a time · optional side quests reinforce familiar words'},
      steps
    };
    try { save(); } catch (_) {}
    return meta.dailyJourneyRoute;
  });

  patchFunction('journeyRouteProgress', function() {
    const route = ensureDailyJourneyRoute();
    const completed = safeArray(route.completed);
    const required = route.steps.filter(step => !step.optional);
    const next = required.find(step => !completed.includes(step.id)) || null;
    return {route, completed, next};
  });

  // Replace the old activity dialog as well: XP/AP is informational legacy
  // state only and must never be presented as a requirement or unlock cost.
  patchFunction('openActivityUnlock', function(id) {
    const item=PATH_MILESTONES.find(entry=>entry.id===id); if(!item)return;
    const state=activityReadiness(id),dialog=$('#activityUnlockDialog'); if(!dialog)return;
    const required=Number(state.cfg.words||requirements[id]||0),remaining=Math.max(0,required-state.supported);
    const guided=id==='sentenceLab';
    $('#activityUnlockBuilding').textContent=item.icon;
    $('#activityUnlockName').textContent=item.title;
    $('#activityUnlockDescription').textContent=item.description;
    $('#activityWordProgress').textContent=guided?'Guided':`${Math.min(state.supported,required)} / ${required}`;
    $('#activityWordBar').style.width=`${required?Math.min(100,state.supported/required*100):100}%`;
    $('#activityWordNeed').textContent=guided?'Available from the beginning':state.wordReady?'Vocabulary requirement met':`${remaining} more familiar word${remaining===1?'':'s'} needed`;
    $('#activityApProgress').textContent='Not used';
    $('#activityApBar').style.width='100%';
    $('#activityApNeed').textContent='XP / Adventure Points do not gate activities';
    $('#activityLifetimeXp').textContent=lifetimeXp().toLocaleString();
    $('#activityAvailableAp').textContent='—';
    $('#activityContentPreview').innerHTML=`<strong>What opens here</strong><p>${esc(activityPreview(id,state.supported))}</p><small>This activity uses familiar vocabulary. Access is based on relevant words you have learned, not XP or Adventure Points.</small>`;
    const action=$('#activityUnlockAction');
    action.disabled=false;
    action.dataset.mode=state.wordReady?'practice':'learn';
    action.textContent=state.wordReady?'Practice':`Learn ${remaining} more familiar word${remaining===1?'':'s'}`;
    $('#activityTeacherMessage').textContent=state.wordReady
      ? `You have enough familiar Japanese for this activity. I will keep the practice focused on words you have already learned.`
      : `Keep learning familiar words. Once ${required} relevant words are available, this activity will open automatically.`;
    action.onclick=()=>{
      if(action.dataset.mode==='learn'){
        dialog.close();clearVillageFocus();openJourney('current');
        requestAnimationFrame(()=>document.querySelector('.word-chapter.current')?.scrollIntoView({behavior:'smooth',block:'center'}));
        return;
      }
      dialog.close();clearVillageFocus();launchVillageActivity(id);
    };
    $('#activityContinueJourney').onclick=()=>{dialog.close();clearVillageFocus()};
    $('#activityUnlockClose').onclick=()=>{dialog.close();clearVillageFocus()};
    if(!dialog.open)dialog.showModal();
  });

  // Re-render the daily route so optional side quests are visibly available
  // without becoming a blocker for the required lesson.
  patchFunction('renderDailyRoute', function() {
    const container=$('#dailyRoute'); if(!container)return;
    const route=ensureDailyJourneyRoute(), completed=safeArray(route.completed), requiredNext=route.steps.find(step=>!step.optional&&!completed.includes(step.id));
    const optional=route.steps.filter(step=>step.optional&&!completed.includes(step.id));
    const nextId=requiredNext?.id || null;
    const all=route.steps;
    container.innerHTML=all.map((step,index)=>{
      const done=completed.includes(step.id), available=done?false:(step.optional?true:step.id===nextId);
      const state=done?'complete':available?'available':'locked';
      const label=done?'✓ Complete':step.optional?'Optional side quest': 'Start';
      return `<article class="daily-mission ${state} ${step.optional?'side-quest':''}"><span class="mission-step">${done?'✓':step.optional?'★':index+1}</span><div><b>${esc(step.icon)} ${esc(step.title)}${step.optional?' <small class="optional-tag">Optional</small>':''}</b><p>${esc(step.detail)}</p></div><button data-journey-mission="${esc(step.id)}"${available?'':' disabled'}>${label}</button></article>`;
    }).join('');
    document.querySelectorAll('[data-journey-mission]').forEach(button=>button.onclick=()=>startJourneyMission(button.dataset.journeyMission));
    const start=$('#startNextMission');
    if(start){start.hidden=!requiredNext;start.textContent=requiredNext?requiredNext.title:'Today’s lesson complete ✓';start.disabled=!requiredNext;start.onclick=()=>requiredNext&&startJourneyMission(requiredNext.id)}
    renderJourneyUnlockNotice();
  });

  // Ensure the existing mission completion summary counts only required work
  // when deciding whether today's route is complete.
  const originalFinish = window.finishActiveJourneyMission;
  if (typeof originalFinish === 'function') {
    patchFunction('finishActiveJourneyMission', function() {
      const result = originalFinish.apply(this, arguments);
      try {
        const route=ensureDailyJourneyRoute(),completed=safeArray(route.completed),required=route.steps.filter(step=>!step.optional);
        if(required.every(step=>completed.includes(step.id))) save(false);
      } catch (_) {}
      return result;
    });
  }

  // Patch startTopicSession by replacing its function with the same Journey
  // selection logic plus a scheduled Picture Matching card when useful.
  patchFunction('startTopicSession', function(topicId=currentTopic().id) {
    if (typeof resumeSavedMission==='function' && resumeSavedMission()) return;
    const topic=journeyTopics().find(item=>item.id===topicId)||currentTopic();
    activityReturnScreen='journey';
    const due=topic.words.filter(word=>progress[word.id]&&Number(progress[word.id].due||0)<=Date.now()).sort((a,b)=>pFor(a.id).due-pFor(b.id).due).slice(0,DAILY_REVIEW_TARGET);
    const unseen=pickLinkedNewWords(topic.words,NEW_WORDS_PER_MISSION);
    const support=topicSupportWords(topic,2);
    const selected=[...new Map([...due,...unseen,...support].map(word=>[word.id,word])).values()];
    if(!selected.length){makeTargetedMasterySession(topic.words.slice(0,Math.min(MISSION_CARD_LIMIT,topic.words.length)).map(word=>word.id),topicWeakestSkill(topic));return}
    const queue=selected.map(v=>{const p=pFor(v.id),unknownKana=unknownKanaFor(v).slice(0,1);let skills=p.stage===0?[...(unknownKana.length?['kanaUnlock']:[]),'firstEncounter','intro',...(ankiRecordFor(v)?.sentence?['example']:[]),'meaning']:[chooseSkill(v)];skills=skills.filter(skill=>skill!=='picture'||memoryScenes[sceneKey(v)]);return{v,skills}});
    session=[];
    while(queue.some(item=>item.skills.length)&&session.length<MISSION_CARD_LIMIT){const active=queue.filter(item=>item.skills.length).slice(0,ACTIVE_WORD_MIX);active.forEach(item=>{if(item.skills.length&&session.length<MISSION_CARD_LIMIT)session.push({v:item.v,skill:item.skills.shift()})});queue.push(...queue.splice(0,Math.min(ACTIVE_WORD_MIX,queue.length)))}

    const schedule=lessonSchedule(currentWordChapterIndex(),currentWordChapterIndex(),topic.words,{forceFirst:true});
    const pictureScheduled=schedule.core.includes('picture');
    if(pictureScheduled){
      const card=activityCard('picture',topic.words);
      if(card){
        const duplicate=session.some(item=>item.v?.id===card.v.id&&item.skill==='picture');
        if(!duplicate){
          if(session.length>=MISSION_CARD_LIMIT)session.pop();
          const position=Math.max(1,Math.min(session.length,Math.floor(session.length*.65)));
          session.splice(position,0,card);
        }
      }
    }

    const bridge=sessionSentencePlan(selected);if(bridge){if(session.length>=MISSION_CARD_LIMIT)session.pop();session.push({v:bridge.target,skill:'sessionSentence',sentencePlan:bridge})}
    clearMissionResume();index=0;current=null;showJourneySessionPreview(`${topic.icon||'🗾'} ${topic.title}`)
  });

  // Surface the immersive reinforcement in the lesson preview so the
  // learner understands that the picture activity is part of the lesson,
  // not a separate XP-gated game.
  const originalPreview=window.showJourneySessionPreview;
  if(typeof originalPreview==='function' && !originalPreview.__kqActivityPreviewWrapped){
    const wrappedPreview=function(...args){
      const result=originalPreview.apply(this,args);
      try{
        const dialog=$('#journeySessionPreviewDialog'),content=$('#journeySessionPreviewContent');
        const hasPicture=safeArray(session).some(item=>item?.skill==='picture');
        if(dialog&&content&&hasPicture&&!content.querySelector('.kq-immersive-preview')){
          content.insertAdjacentHTML('beforeend','<section class="kq-immersive-preview"><strong>🌄 Immersive reinforcement</strong><p>Picture Matching is included because these lesson words have suitable memory scenes. It reinforces the same words you are learning.</p></section>');
        }
      }catch(_){}
      return result;
    };
    wrappedPreview.__kqActivityPreviewWrapped=true;
    patchFunction('showJourneySessionPreview',wrappedPreview);
  }

  // Make the Journey roadmap consume the same policy. This replaces the old
  // asset-only fallback and removes XP/AP assumptions from roadmap estimates.
  try {
    window.KaishiActivityPolicy = {requirements, rules, activityReadiness, pathUnlocked, refreshPathUnlocks, scheduleForLesson:lessonSchedule};
    window.KaishiActivityPolicy.refresh = refreshPathUnlocks;
    refreshPathUnlocks();
    try { window.KaishiRoadmap?.refresh?.(); } catch (_) {}
    try { if(typeof updateHome==='function') updateHome(); } catch (_) {}
    try { if(document.getElementById('journey')?.classList.contains('active') && typeof renderJourney==='function') renderJourney(); } catch (_) {}
  } catch (_) {}

  log('vocabulary-gated activity policy installed');
})();
