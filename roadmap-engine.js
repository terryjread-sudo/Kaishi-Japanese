'use strict';

/*
 * Kaishi Quest — Roadmap Engine
 * v11.25.16
 *
 * The roadmap is read-only and reports the actual lesson schedule.
 * Scheduled side quests and milestones are first-class timeline items.
 */
(() => {
  const HORIZON = 10;
  const SCHEMA_VERSION = 3;

  const safeNum = (v,f=0) => {
    const n=Number(v); return Number.isFinite(n)?n:f;
  };

  const hasCore = () =>
    typeof wordChapterCount==='function' &&
    typeof chapterWords==='function' &&
    typeof currentWordChapterIndex==='function' &&
    typeof chapterStats==='function' &&
    typeof topicForWord==='function';

  const fallbackSchedule = (chapterIndex, current, words) => {
    const scenes = words.some(w => {
      try { return Boolean(memoryScenes?.[sceneKey(w)]?.file); } catch (_) { return false; }
    });
    const audio = words.some(w => Boolean(w?.wordAudio));
    const core = [];
    if (scenes && chapterIndex % 3 === 1) core.push('picture');
    if (audio) core.push('listening');
    return {
      core,
      sideQuests: [],
      available: [
        ...(scenes?['picture']:[]),
        ...(audio?['listening']:[])
      ]
    };
  };

  const schedule = (chapterIndex,current,words) => {
    try {
      if (window.KaishiActivitySchedule?.scheduleForLesson) {
        // Do not freeze the count at zero: the roadmap is a forecast, so the
        // scheduler must project introductions into each future lesson.
        return window.KaishiActivitySchedule.scheduleForLesson(
          chapterIndex,current,words,{forceFirst:false}
        );
      }
    } catch (_) {}
    return fallbackSchedule(chapterIndex,current,words);
  };

  const rule = id => {
    try { return window.KaishiActivitySchedule?.ruleFor?.(id) || null; } catch (_) { return null; }
  };

  const milestoneRules = {
    picture:{words:5},
    conversation:{words:12,note:'also needs 5 correct listening answers'},
    grammar:{words:15,note:'also needs 15 tested answers'},
    manga:{words:25,note:'also needs 30 tested answers'},
    battle:{words:20,note:'also needs 40 tested answers'}
  };

  const estimateMilestones = (chapterSize,start,end) => {
    const estimates={};
    if(typeof PATH_MILESTONES==='undefined'||typeof pathUnlocked!=='function') return estimates;

    PATH_MILESTONES.forEach(m=>{
      const r=milestoneRules[m.id];
      if(!r) return;
      let unlocked=false;
      try { unlocked=pathUnlocked(m.id); } catch (_) {}
      if(unlocked) return;

      for(let c=start;c<=end;c++){
        if((c+1)*chapterSize>=r.words){
          estimates[m.id]={chapterIndex:c,milestone:m,note:r.note||null};
          break;
        }
      }
    });
    return estimates;
  };

  const compute = () => {
    if(!hasCore()) return null;

    const chapterSize =
      typeof WORD_CHAPTER_SIZE==='number' && WORD_CHAPTER_SIZE>0
        ? WORD_CHAPTER_SIZE : 3;

    const current=Math.max(0,safeNum(currentWordChapterIndex(),0));
    const total=Math.max(1,safeNum(wordChapterCount(),1));
    const end=Math.min(total-1,current+HORIZON);

    const milestoneEstimates=estimateMilestones(chapterSize,current,end);
    const milestoneByChapter={};
    Object.values(milestoneEstimates).forEach(e=>{
      milestoneByChapter[e.chapterIndex]=e;
    });

    let previousTopicId=null;
    try {
      const w=chapterWords(current);
      previousTopicId=w[0]?topicForWord(w[0]).id:null;
    } catch (_) {}

    const lessons=[];

    for(let chapter=current;chapter<=end;chapter++){
      const words=chapterWords(chapter);
      if(!words.length) break;

      const topic=words[0]?topicForWord(words[0]):null;
      let stats=null;
      try { stats=chapterStats(chapter); } catch (_) {}

      const s=schedule(chapter,current,words);
      const distinctive=(s.core||[]).find(id=>rule(id)?.roadmap);
      const sideQuestEvent=(s.sideQuests||[]).find(id=>rule(id)?.roadmap);
      const milestone=milestoneByChapter[chapter];

      let event=null;

      if(milestone){
        event={
          type:'milestone',
          id:milestone.milestone.id,
          icon:milestone.milestone.icon||'🏆',
          label:milestone.milestone.activity||milestone.milestone.title,
          estimated:true,
          note:milestone.note,
          separateTimelineItem:true
        };
      } else if(distinctive){
        const r=rule(distinctive);
        event={
          type:'activity',
          id:distinctive,
          icon:r?.icon||'✨',
          label:r?.label||distinctive,
          estimated:false,
          separateTimelineItem:false,
          source:'lesson-scheduler'
        };
      } else if(sideQuestEvent){
        const r=rule(sideQuestEvent);
        event={
          type:'sideQuest',
          id:sideQuestEvent,
          icon:r?.icon||'🎮',
          label:r?.label||sideQuestEvent,
          estimated:true,
          separateTimelineItem:false,
          source:'side-quest',
          note:r?.note||null
        };
      } else if(topic && previousTopicId!==null && topic.id!==previousTopicId){
        event={
          type:'topic',
          id:topic.id,
          icon:topic.icon||'🗺️',
          label:topic.title,
          estimated:false,
          separateTimelineItem:false
        };
      }

      lessons.push({
        lessonNumber:chapter+1,
        chapterIndex:chapter,
        topicId:topic?.id||null,
        topicTitle:topic?.title||null,
        topicIcon:topic?.icon||null,
        wordCount:words.length,
        wordMeanings:words.slice(0,2).map(w=>w.meaning).filter(Boolean),
        completed:Boolean(stats?.complete),
        contentActivities:(s.available||[]).map(id=>{
          const r=rule(id);
          return {
            id,
            icon:r?.icon||'✨',
            label:r?.label||id,
            eligible:true,
            core:r?.core===true,
            roadmapHighlight:r?.roadmap===true,
            reason:r?.note||''
          };
        }),
        coreActivities:s.core||[],
        sideQuests:s.sideQuests||[],
        event
      });

      if(topic) previousTopicId=topic.id;
    }

    /*
     * Only actual milestone events become Key Events. This preserves SRS Battle
     * from PATH_MILESTONES while preventing a lesson activity such as Picture
     * Matching from masquerading as a Journey Key Event.
     */
    const keyEvents=lessons
      .filter(l=>l.event?.type==='milestone')
      .map(l=>({
        lessonNumber:l.lessonNumber,
        chapterIndex:l.chapterIndex,
        ...l.event
      }));

    return {
      schemaVersion:SCHEMA_VERSION,
      horizon:HORIZON,
      currentLesson:current,
      totalLessons:total,
      lessons,
      events:lessons.filter(l=>l.event).map(l=>({
        lessonNumber:l.lessonNumber,...l.event
      })),
      keyEvents,
      generatedAt:Date.now()
    };
  };

  let cached=null;

  const persist=roadmap=>{
    try {
      if(typeof meta!=='object'||typeof save!=='function') return;
      meta.journeyRoadmap={
        schemaVersion:roadmap.schemaVersion,
        horizon:roadmap.horizon,
        currentLesson:roadmap.currentLesson,
        totalLessons:roadmap.totalLessons,
        events:roadmap.events,
        keyEvents:roadmap.keyEvents,
        generatedAt:roadmap.generatedAt
      };
      save(false);
    } catch (_) {}
  };

  const refresh=()=>{
    const r=compute();
    if(!r) return null;
    cached=r;
    persist(r);
    try { window.renderJourneyPathAhead?.(); } catch (_) {}
    try { window.KaishiJourneyKeyEvents?.render?.(); } catch (_) {}
    try { window.dispatchEvent(new Event('kaishi-roadmap-updated')); } catch (_) {}
    return r;
  };

  const get=()=>cached||refresh();

  window.KaishiRoadmap={get,refresh};
  refresh();
})();
