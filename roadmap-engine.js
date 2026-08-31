'use strict';

/*
 * Kaishi Quest — Roadmap Engine
 * v11.25.0
 *
 * Computes a rolling 10-lesson planning roadmap from the real lesson
 * sequence (chapterWords / wordChapterCount / currentWordChapterIndex).
 * This is a read-only planning layer only:
 *  - it never alters completion state, retry state, lesson ordering,
 *    the current lesson, or the daily Journey route
 *  - it does not rewrite or wrap the Journey renderer
 *  - it regenerates whenever the current lesson changes
 *
 * Consumed by:
 *  - app.js's renderJourneyPathAhead() ("Your journey ahead" list)
 *  - road-ahead.js (the floating Road Ahead bubble)
 *
 * Exposes: window.KaishiRoadmap.get() / .refresh()
 */
(() => {
  const HORIZON = 10;
  const SCHEMA_VERSION = 1;

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

  // ---- content eligibility for a lesson's own word set ----
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

  // Content-bound activities: only eligible when every word in THIS lesson
  // actually has the backing data the activity needs. Never invented.
  const evaluateContentActivities = (words) => {
    const results = [];
    if (!words.length) return results;

    const allScenes = words.every(wordHasScene);
    const allAudio = words.every(wordHasAudio);
    const anyKanji = words.some(wordHasKanji);

    results.push({
      id: 'picture', icon: '🌄', label: 'Picture Matching', eligible: allScenes,
      reason: allScenes ? 'all words have mnemonic scene art' : 'missing mnemonic scene art for one or more words',
    });
    results.push({
      id: 'listening', icon: '🎧', label: 'Listening', eligible: allAudio,
      reason: allAudio ? 'all words have audio' : 'missing audio for one or more words',
    });
    results.push({
      id: 'karuta', icon: '🎴', label: 'Karuta Challenge', eligible: allScenes && allAudio,
      reason: (allScenes && allAudio) ? 'audio and scene art available for every word' : 'karuta needs both audio and scene art for every word',
    });
    results.push({
      id: 'kanji', icon: '漢', label: 'Kanji Gate', eligible: anyKanji,
      reason: anyKanji ? 'at least one word contains kanji' : "no kanji in this lesson's words",
    });

    return results;
  };

  // Selection-based activities pull from a story/conversation library
  // rather than this lesson's specific words, so they are never matched
  // to lesson content directly — only ever surfaced as an upcoming event
  // tied to an estimated unlock point.
  const SELECTION_BASED = new Set(['manga', 'conversation', 'theatre']);
  const DIRECT_LAUNCH = new Set(['picture', 'listening', 'karuta', 'battle', 'kana', 'grammar', 'sentenceLab', 'kanji', 'builder']);

  // ---- milestone unlock estimation ----
  // Several PATH_MILESTONES unlock (partly or fully) on cumulative words
  // introduced. We estimate "introduced so far" as (lessonIndex+1) times
  // the chapter size — the app's own steady-state assumption, not an
  // invented number. Milestones that also require play-based metrics we
  // cannot predict (listening attempts, tested answers, conversations
  // completed) are only estimated on their word-count component, and
  // carry that caveat rather than silently guessing the rest.
  const WORD_THRESHOLDS = {
    picture: { words: 5 },
    conversation: { words: 12, note: 'also needs 5 correct listening answers' },
    grammar: { words: 15, note: 'also needs 15 tested answers' },
    manga: { words: 25, note: 'also needs 30 tested answers' },
    battle: { words: 20, note: 'also needs 40 tested answers' },
  };

  const estimateMilestoneLessons = (chapterSize, startChapter, endChapter) => {
    const estimates = {};
    if (typeof PATH_MILESTONES === 'undefined' || typeof pathUnlocked !== 'function') return estimates;
    PATH_MILESTONES.forEach((milestone) => {
      const rule = WORD_THRESHOLDS[milestone.id];
      if (!rule) return;
      let unlocked = false;
      try { unlocked = pathUnlocked(milestone.id); } catch (_) {}
      if (unlocked) return; // already available — not an "ahead" event
      for (let chapterIndex = startChapter; chapterIndex <= endChapter; chapterIndex++) {
        const estimatedIntroduced = (chapterIndex + 1) * chapterSize;
        if (estimatedIntroduced >= rule.words) {
          estimates[milestone.id] = { chapterIndex, milestone, note: rule.note || null };
          break;
        }
      }
    });
    return estimates;
  };

  const computeRoadmap = () => {
    if (!hasCore()) return null;

    const chapterSize = (typeof WORD_CHAPTER_SIZE === 'number' && WORD_CHAPTER_SIZE > 0) ? WORD_CHAPTER_SIZE : 3;
    const current = Math.max(0, safeNum(currentWordChapterIndex(), 0));
    const total = Math.max(1, safeNum(wordChapterCount(), 1));
    const horizonEnd = Math.min(total - 1, current + HORIZON);

    const milestoneEstimates = estimateMilestoneLessons(chapterSize, current + 1, horizonEnd);
    const milestoneByChapter = {};
    Object.values(milestoneEstimates).forEach((est) => { milestoneByChapter[est.chapterIndex] = est; });

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
      const eligibleContent = contentActivities.filter((item) => item.eligible && DIRECT_LAUNCH.has(item.id));
      const milestoneHere = milestoneByChapter[chapterIndex] || null;
      const topicBoundary = Boolean(topic && previousTopicId !== null && topic.id !== previousTopicId);

      // Priority for a lesson's single headline event, same order the
      // Road Ahead bubble uses: milestone > mapped activity > topic
      // boundary > nothing special.
      let event = null;
      if (milestoneHere) {
        event = {
          type: 'milestone',
          id: milestoneHere.milestone.id,
          icon: milestoneHere.milestone.icon || '🏆',
          label: milestoneHere.milestone.activity || milestoneHere.milestone.title,
          selectionBased: SELECTION_BASED.has(milestoneHere.milestone.id),
          estimated: true,
          note: milestoneHere.note,
        };
      } else if (eligibleContent.length) {
        const pick = eligibleContent[0];
        event = { type: 'activity', id: pick.id, icon: pick.icon, label: pick.label, selectionBased: false, estimated: false };
      } else if (topicBoundary) {
        event = { type: 'topic', id: topic.id, icon: topic.icon || '🗺️', label: topic.title, selectionBased: false, estimated: false };
      }

      lessons.push({
        lessonNumber: chapterIndex + 1,
        chapterIndex,
        topicId: topic ? topic.id : null,
        topicTitle: topic ? topic.title : null,
        topicIcon: topic ? topic.icon : null,
        wordCount: words.length,
        wordMeanings: words.slice(0, 2).map((w) => w.meaning).filter(Boolean),
        completed: Boolean(stats?.complete),
        contentActivities,
        event,
      });

      if (topic) previousTopicId = topic.id;
    }

    const events = lessons.filter((l) => l.event).map((l) => ({ lessonNumber: l.lessonNumber, ...l.event }));

    return {
      schemaVersion: SCHEMA_VERSION,
      horizon: HORIZON,
      currentLesson: current,
      totalLessons: total,
      lessons,
      events,
      generatedAt: Date.now(),
    };
  };

  const logDiagnostics = (roadmap) => {
    if (!roadmap) return;
    log('roadmap', `Roadmap generated — current lesson: ${roadmap.currentLesson + 1}, planning horizon: ${roadmap.horizon}, future lessons mapped: ${roadmap.lessons.length}, upcoming events: ${roadmap.events.length}`);
    roadmap.lessons.forEach((lesson) => {
      const eventText = lesson.event
        ? `${lesson.event.label} (${lesson.event.type}${lesson.event.estimated ? ', estimated' : ''}${lesson.event.note ? ` — ${lesson.event.note}` : ''})`
        : 'none';
      log('lesson-mapping', `Lesson ${lesson.lessonNumber} — topic: ${lesson.topicTitle || 'unknown'} — words: ${lesson.wordCount} — event: ${eventText}`);
      lesson.contentActivities.forEach((activity) => {
        log('activity', `Activity candidate: ${activity.label} — Lesson ${lesson.lessonNumber} — Eligible: ${activity.eligible} — Reason: ${activity.reason}`);
      });
    });
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
        generatedAt: roadmap.generatedAt,
      };
      save(false);
    } catch (_) {}
  };

  const refreshPathAheadList = () => {
    try {
      if (typeof window.renderJourneyPathAhead === 'function') window.renderJourneyPathAhead();
    } catch (_) {}
    try {
      if (typeof window.KaishiJourneyRender === 'function') window.KaishiJourneyRender();
    } catch (_) {}
  };

  let cached = null;

  const refresh = () => {
    const roadmap = computeRoadmap();
    if (!roadmap) return null;
    const changed = !cached || cached.currentLesson !== roadmap.currentLesson || cached.totalLessons !== roadmap.totalLessons;
    cached = roadmap;
    if (changed) {
      logDiagnostics(roadmap);
      persist(roadmap);
    }
    // Always resync the "Your journey ahead" list, not just on change: the
    // list may have rendered earlier with no roadmap available yet (e.g.
    // Journey opened before this script finished loading) and nothing
    // else re-triggers it once the data shows up.
    refreshPathAheadList();
    return roadmap;
  };

  const get = () => cached || refresh();

  window.KaishiRoadmap = { get, refresh };
})();
