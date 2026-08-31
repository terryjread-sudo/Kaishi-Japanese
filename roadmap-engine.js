'use strict';

/*
 * Kaishi Quest — Roadmap Engine
 * v11.25.11
 *
 * Read-only planning layer. The roadmap reports meaningful upcoming
 * events rather than routine lesson activities.
 *
 * Rules:
 *  - Key milestones are first-class events.
 *  - Routine activities such as Listening are never promoted as the
 *    headline roadmap indicator.
 *  - Distinctive content activities may be highlighted when eligible.
 *  - The lesson itself remains responsible for its actual card sequence.
 */
(() => {
  const HORIZON = 10;
  const SCHEMA_VERSION = 2;

  const safeNum = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const log = (category, message) => {
    try {
      if (typeof window.kaishiLog === 'function') window.kaishiLog(category, message);
    } catch (_) {}
  };

  const hasCore = () =>
    typeof wordChapterCount === 'function' &&
    typeof chapterWords === 'function' &&
    typeof currentWordChapterIndex === 'function' &&
    typeof chapterStats === 'function' &&
    typeof topicForWord === 'function';

  const sceneKeyFor = (word) => {
    try {
      return typeof sceneKey === 'function' ? sceneKey(word) : `${word.word}|${word.reading}`;
    } catch (_) {
      return `${word?.word}|${word?.reading}`;
    }
  };

  const wordHasScene = (word) => {
    try {
      return Boolean(typeof memoryScenes === 'object' && memoryScenes[sceneKeyFor(word)]?.file);
    } catch (_) {
      return false;
    }
  };

  const wordHasAudio = (word) => Boolean(word && word.wordAudio);

  const wordHasKanji = (word) => {
    try {
      return typeof kanjiCharacters === 'function' && kanjiCharacters(word).length > 0;
    } catch (_) {
      return false;
    }
  };

  const evaluateContentActivities = (words) => {
    if (!words.length) return [];

    const allScenes = words.every(wordHasScene);
    const allAudio = words.every(wordHasAudio);
    const anyKanji = words.some(wordHasKanji);

    return [
      {
        id: 'picture',
        icon: '🌄',
        label: 'Picture Matching',
        eligible: allScenes,
        reason: allScenes ? 'all words have mnemonic scene art' : 'missing mnemonic scene art',
        roadmapHighlight: true,
      },
      {
        id: 'listening',
        icon: '🎧',
        label: 'Listening',
        eligible: allAudio,
        reason: allAudio ? 'all words have audio' : 'missing audio',
        // Listening is routine and should not be promoted in the roadmap.
        roadmapHighlight: false,
      },
      {
        id: 'karuta',
        icon: '🎴',
        label: 'Karuta Challenge',
        eligible: allScenes && allAudio,
        reason: allScenes && allAudio ? 'audio and scene art available' : 'needs audio and scene art',
        roadmapHighlight: true,
      },
      {
        id: 'kanji',
        icon: '漢',
        label: 'Kanji Gate',
        eligible: anyKanji,
        reason: anyKanji ? 'kanji available' : 'no kanji in lesson words',
        roadmapHighlight: true,
      },
    ];
  };

  // Key milestones are separate Journey events, not lesson activities.
  const WORD_THRESHOLDS = {
    picture: { words: 5 },
    conversation: { words: 12, note: 'also needs 5 correct listening answers' },
    grammar: { words: 15, note: 'also needs 15 tested answers' },
    manga: { words: 25, note: 'also needs 30 tested answers' },
    battle: { words: 20, note: 'also needs 40 tested answers' },
  };

  const estimateMilestones = (chapterSize, startChapter, endChapter) => {
    const estimates = {};
    if (typeof PATH_MILESTONES === 'undefined' || typeof pathUnlocked !== 'function') return estimates;

    PATH_MILESTONES.forEach((milestone) => {
      const rule = WORD_THRESHOLDS[milestone.id];
      if (!rule) return;

      let unlocked = false;
      try { unlocked = pathUnlocked(milestone.id); } catch (_) {}
      if (unlocked) return;

      for (let chapterIndex = startChapter; chapterIndex <= endChapter; chapterIndex++) {
        const estimatedIntroduced = (chapterIndex + 1) * chapterSize;
        if (estimatedIntroduced >= rule.words) {
          estimates[milestone.id] = {
            chapterIndex,
            milestone,
            note: rule.note || null,
          };
          break;
        }
      }
    });

    return estimates;
  };

  const computeRoadmap = () => {
    if (!hasCore()) return null;

    const chapterSize =
      (typeof WORD_CHAPTER_SIZE === 'number' && WORD_CHAPTER_SIZE > 0)
        ? WORD_CHAPTER_SIZE
        : 3;

    const current = Math.max(0, safeNum(currentWordChapterIndex(), 0));
    const total = Math.max(1, safeNum(wordChapterCount(), 1));
    const horizonEnd = Math.min(total - 1, current + HORIZON);

    const milestoneEstimates =
      estimateMilestones(chapterSize, current + 1, horizonEnd);

    const milestoneByChapter = {};
    Object.values(milestoneEstimates).forEach((est) => {
      milestoneByChapter[est.chapterIndex] = est;
    });

    let previousTopicId = null;
    try {
      const currentWords = chapterWords(current);
      previousTopicId = currentWords[0] ? topicForWord(currentWords[0]).id : null;
    } catch (_) {}

    const lessons = [];

    for (let chapterIndex = current + 1; chapterIndex <= horizonEnd; chapterIndex++) {
      const words = chapterWords(chapterIndex);
      if (!words.length) break;

      const topic = words[0] ? topicForWord(words[0]) : null;
      let stats = null;
      try { stats = chapterStats(chapterIndex); } catch (_) {}

      const contentActivities = evaluateContentActivities(words);
      const distinctive = contentActivities.filter(
        activity => activity.eligible && activity.roadmapHighlight
      );

      const milestoneHere = milestoneByChapter[chapterIndex] || null;
      const topicBoundary =
        Boolean(topic && previousTopicId !== null && topic.id !== previousTopicId);

      // Priority:
      // 1. Key milestone
      // 2. Distinctive immersive/content activity
      // 3. Topic transition
      // 4. Nothing
      let event = null;

      if (milestoneHere) {
        event = {
          type: 'milestone',
          id: milestoneHere.milestone.id,
          icon: milestoneHere.milestone.icon || '🏆',
          label: milestoneHere.milestone.activity || milestoneHere.milestone.title,
          estimated: true,
          note: milestoneHere.note,
          separateTimelineItem: true,
        };
      } else if (distinctive.length) {
        const pick = distinctive[0];
        event = {
          type: 'activity',
          id: pick.id,
          icon: pick.icon,
          label: pick.label,
          estimated: false,
          separateTimelineItem: false,
        };
      } else if (topicBoundary) {
        event = {
          type: 'topic',
          id: topic.id,
          icon: topic.icon || '🗺️',
          label: topic.title,
          estimated: false,
          separateTimelineItem: false,
        };
      }

      lessons.push({
        lessonNumber: chapterIndex + 1,
        chapterIndex,
        topicId: topic ? topic.id : null,
        topicTitle: topic ? topic.title : null,
        topicIcon: topic ? topic.icon : null,
        wordCount: words.length,
        wordMeanings: words.slice(0, 2).map(w => w.meaning).filter(Boolean),
        completed: Boolean(stats?.complete),
        contentActivities,
        event,
      });

      if (topic) previousTopicId = topic.id;
    }

    const keyEvents = lessons
      .filter(lesson => lesson.event?.type === 'milestone')
      .map(lesson => ({
        lessonNumber: lesson.lessonNumber,
        chapterIndex: lesson.chapterIndex,
        ...lesson.event,
      }));

    return {
      schemaVersion: SCHEMA_VERSION,
      horizon: HORIZON,
      currentLesson: current,
      totalLessons: total,
      lessons,
      events: lessons
        .filter(lesson => lesson.event)
        .map(lesson => ({ lessonNumber: lesson.lessonNumber, ...lesson.event })),
      keyEvents,
      generatedAt: Date.now(),
    };
  };

  const persist = (roadmap) => {
    try {
      if (typeof meta !== 'object' || typeof save !== 'function') return;
      meta.journeyRoadmap = {
        schemaVersion: roadmap.schemaVersion,
        horizon: roadmap.horizon,
        currentLesson: roadmap.currentLesson,
        totalLessons: roadmap.totalLessons,
        events: roadmap.events,
        keyEvents: roadmap.keyEvents,
        generatedAt: roadmap.generatedAt,
      };
      save(false);
    } catch (_) {}
  };

  const refreshPathAheadList = () => {
    try {
      if (typeof window.renderJourneyPathAhead === 'function') {
        window.renderJourneyPathAhead();
      }
    } catch (_) {}
  };

  let cached = null;

  const refresh = () => {
    const roadmap = computeRoadmap();
    if (!roadmap) return null;

    const changed =
      !cached ||
      cached.currentLesson !== roadmap.currentLesson ||
      cached.totalLessons !== roadmap.totalLessons ||
      JSON.stringify(cached.keyEvents) !== JSON.stringify(roadmap.keyEvents);

    cached = roadmap;

    if (changed) persist(roadmap);
    refreshPathAheadList();
    return roadmap;
  };

  const get = () => cached || refresh();

  window.KaishiRoadmap = { get, refresh };
})();
