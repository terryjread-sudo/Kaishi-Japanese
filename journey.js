'use strict';

/*
 * Kaishi Quest — Unified Journey
 * v11.21.0
 *
 * Single-owner Journey surface.
 *
 * app.js remains responsible for learning, scoring, SRS and lesson execution.
 * This file is responsible only for rendering and interacting with the Journey.
 *
 * Deliberately NOT used:
 *   - MutationObserver on the Journey
 *   - a second Journey renderer
 *   - DOM polling loops
 *   - rebuilding the timeline in response to its own DOM mutations
 */

(() => {
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const metaSafe = () => {
    try {
      const key = typeof profileStorageKey === 'function' ? profileStorageKey('kq-meta') : 'kq-meta';
      return JSON.parse(localStorage.getItem(key) || '{}');
    } catch { return {}; }
  };

  const progressSafe = () => {
    try {
      const key = typeof profileStorageKey === 'function' ? profileStorageKey('kq-progress') : 'kq-progress';
      return JSON.parse(localStorage.getItem(key) || '{}');
    } catch { return {}; }
  };

  const routeSafe = () => {
    const route = metaSafe().dailyJourneyRoute;
    return route && Array.isArray(route.steps)
      ? route
      : {steps: [], completed: []};
  };

  const CHAPTER_SIZE = 3;
  const CHAPTER_SCENES = [
    {id:'riverside', image:'media/journey-scenes/riverside-path.png', label:'Riverside path'},
    {id:'lantern', image:'media/journey-scenes/lantern-market.png', label:'Lantern market'},
    {id:'shrine', image:'media/journey-scenes/shrine-forest.png', label:'Shrine forest'},
    {id:'coast', image:'media/journey-scenes/coastal-path.png', label:'Coastal path'}
  ];

  function chapterScene(chapter) {
    return CHAPTER_SCENES[Math.abs(Number(chapter) || 0) % CHAPTER_SCENES.length];
  }

  function lessonWords(chapter) {
    try {
      if (typeof chapterWords === 'function') {
        const words = chapterWords(Number(chapter));
        if (Array.isArray(words) && words.length) return words;
      }
    } catch (_) {}

    try {
      const start = Number(chapter) * CHAPTER_SIZE;
      return Array.isArray(vocab) ? vocab.slice(start, start + CHAPTER_SIZE) : [];
    } catch (_) {
      return [];
    }
  }

  function lessonCount() {
    try {
      if (typeof wordChapterCount === 'function') {
        const count = Number(wordChapterCount());
        if (count > 0) return count;
      }
    } catch (_) {}

    try {
      return Math.ceil((Array.isArray(vocab) ? vocab.length : 0) / CHAPTER_SIZE);
    } catch (_) {
      return 0;
    }
  }

  function chapterFromId(id) {
    const match = String(id || '').match(/(?:lesson|chapter)[-_](\d+)/i);
    return match ? Number(match[1]) : null;
  }

  function currentChapter() {
    const route = routeSafe();
    const completed = new Set(Array.isArray(route.completed) ? route.completed : []);

    const currentStep = route.steps.find(step =>
      step &&
      step.kind === 'chapter' &&
      !step.retryOf &&
      !completed.has(step.id)
    );

    const fromRoute = chapterFromId(currentStep?.id);
    if (fromRoute != null) return Math.max(0, fromRoute);

    // v11.25.5: this fallback used to re-derive "which chapter is
    // current" from progress data directly, checking a p.reps field
    // that isn't actually part of the progress model (the app tracks
    // practice attempts under p.skills[skill].attempts — see
    // wordPracticeCount in app.js). That mismatch under-counted
    // "introduced" words and could get permanently stuck on the same
    // chapter right after the daily route's single lesson step was
    // completed (before a new one is generated) — exactly the "lesson
    // 2 stays greyed out after finishing lesson 1" symptom. Deferring
    // to the app's own authoritative currentWordChapterIndex() (which
    // chapterUnlocked()/chapterStats() already agree with everywhere
    // else in the app) fixes the mismatch at the source instead of
    // maintaining a second, drifting implementation here.
    try {
      if (typeof currentWordChapterIndex === 'function') {
        return Math.max(0, Math.min(currentWordChapterIndex(), Math.max(0, lessonCount() - 1)));
      }
    } catch (_) {}

    const allProgress = progressSafe();
    for (let chapter = 0; chapter < lessonCount(); chapter++) {
      const words = lessonWords(chapter);
      if (!words.length) break;
      const introduced = words.every(word => {
        const p = allProgress[word?.id];
        return p && (Number(p.stage || 0) > 0 || Number(p.reps || 0) > 0);
      });
      if (!introduced) return chapter;
    }

    return Math.max(0, lessonCount() - 1);
  }

  function wordScore(word) {
    const p = progressSafe()[word?.id] || {};
    const skills = p.skills || {};
    const values = Object.values(skills)
      .map(metric => Number(metric?.strength))
      .filter(value => Number.isFinite(value) && value > 0);

    if (values.length) {
      return Math.round(values.reduce((a,b) => a + b, 0) / values.length * 100);
    }

    if (Number(p.stage || 0) > 0) {
      return Math.min(100, Number(p.stage || 0) * 25);
    }

    return 0;
  }

  function lessonStats(chapter) {
    const words = lessonWords(chapter);
    const scores = words.map(wordScore);
    const introduced = scores.filter(score => score > 0).length;
    const percent = scores.length
      ? Math.round(scores.reduce((a,b) => a + b, 0) / scores.length)
      : 0;

    return {
      words,
      introduced,
      percent,
      complete: Boolean(words.length && introduced === words.length)
    };
  }

  function topicFor(words) {
    try {
      return words[0] && typeof topicForWord === 'function'
        ? topicForWord(words[0])
        : null;
    } catch (_) {
      return null;
    }
  }

  function lessonTitle(chapter, words) {
    const meanings = words.slice(0, 2).map(word => word?.meaning).filter(Boolean);
    if (meanings.length) {
      return `Lesson ${chapter + 1}: ${meanings.join(' + ')}`;
    }

    const routeStep = routeSafe().steps.find(step =>
      chapterFromId(step?.id) === chapter && step?.kind === 'chapter'
    );

    return routeStep?.title || `Lesson ${chapter + 1}`;
  }

  function journeyRows() {
    const total = lessonCount();
    if (!total) return [];

    const current = Math.min(currentChapter(), total - 1);
    const from = Math.max(0, current - 4);
    const to = Math.min(total, current + 5);
    const route = routeSafe();
    const completed = new Set(Array.isArray(route.completed) ? route.completed : []);
    const output = [];

    for (let chapter = from; chapter < to; chapter++) {
      const stats = lessonStats(chapter);
      const topic = topicFor(stats.words);
      const done = chapter < current || stats.complete;
      const isCurrent = chapter === current && !done;
      const future = chapter > current;
      const immersiveStep = route.steps.find(step => step?.kind === 'activity' && String(step?.sideQuestFor || '') === `lesson-${chapter}`);

      output.push({
        type: done ? 'past' : isCurrent ? 'current' : 'future',
        id: `lesson-${chapter}`,
        chapter,
        icon: topic?.icon || '👋',
        title: lessonTitle(chapter, stats.words),
        detail: done
          ? `Completed · ${stats.percent || 100}%`
          : isCurrent
            ? `Current lesson${topic?.title ? ` · ${topic.title}` : ''}`
            : `Coming up${topic?.title ? ` · ${topic.title}` : ''}`,
        done,
        current: isCurrent,
        future,
        scene: chapterScene(chapter),
        immersiveMission: immersiveStep?.mission || null
      });

      route.steps
        .filter(step => {
          const target = String(step?.sideQuestFor || step?.retryOf || '');
          return target === `lesson-${chapter}` ||
                 target === `journey-lesson-${chapter}`;
        })
        .forEach(step => {
          if (step.retryOf) {
            output.push({
              type: 'retry',
              id: step.id,
              chapter,
              icon: step.icon || '🔄',
              title: step.title || `Retry · Lesson ${chapter + 1}`,
              detail: step.detail || 'Try this lesson again.',
              done: completed.has(step.id),
              current: false,
              future
            });
          } else if (step.kind === 'activity') {
            output.push({
              type: 'side',
              id: step.id,
              activityId: step.activityId,
              chapter,
              icon: step.icon || '⚔️',
              title: step.title || 'Side Quest',
              detail: step.detail || 'Extra practice on your Journey.',
              done: completed.has(step.id),
              current: chapter === current && !completed.has(step.id),
              future,
              required: Boolean(step.required),
              scene: chapterScene(chapter)
            });
          }
        });
    }

    return output;
  }

  function addStyles() {
    if ($('#kqUnifiedJourneyStyles')) return;

    const style = document.createElement('style');
    style.id = 'kqUnifiedJourneyStyles';
    style.textContent = `
      #journey .daily-route,
      #journey .journey-path-ahead,
      #journey > .journey-section > .eyebrow,
      #journey > .journey-section > h2,
      #journey > .journey-section > p,
      #journey > .journey-section > #journeyStats,
      #journey > .journey-section > #journeyUnlockNotice {
        display:none!important;
      }

      #journeyHistoryTimeline {
        display:block!important;
        margin-top:0!important;
      }

      #journeyHistoryTrack {
        max-height:none;
        min-height:0;
        overflow:visible;
        touch-action:pan-y;
      }

      .kq-unified-timeline {
        position:relative;
        padding:12px 4px 28px;
      }

      .kq-unified-timeline:before {
        content:"";
        position:absolute;
        left:27px;
        top:34px;
        bottom:34px;
        width:3px;
        border-radius:3px;
        background:currentColor;
        opacity:.12;
      }

      .kq-unified-node {
        position:relative;
        display:flex;
        gap:13px;
        align-items:flex-start;
        padding:8px 2px 17px;
      }

      .kq-unified-marker {
        position:relative;
        z-index:1;
        flex:0 0 46px;
        width:46px;
        height:46px;
        border-radius:50%;
        display:grid;
        place-items:center;
        background:var(--card-bg,#fff);
        border:2px solid currentColor;
        box-shadow:0 2px 8px rgba(0,0,0,.08);
        font-size:1.05rem;
      }

      .kq-unified-node.side .kq-unified-marker {
        border-style:dashed;
      }

      .kq-unified-card {
        flex:1;
        min-width:0;
        border:1px solid rgba(0,0,0,.1);
        border-radius:17px;
        padding:15px;
        background:var(--card-bg,#fff);
        box-shadow:0 2px 7px rgba(0,0,0,.04);
        overflow:hidden;
      }

      .kq-chapter-scene {
        position:absolute;
        inset:0;
        background-image:linear-gradient(90deg,rgba(255,255,255,.93),rgba(255,255,255,.72)),var(--kq-scene);
        background-size:cover;
        background-position:center;
        opacity:.86;
        pointer-events:none;
      }

      .kq-unified-card > :not(.kq-chapter-scene) { position:relative; z-index:1; }
      .kq-unified-node.future .kq-chapter-scene { filter:saturate(.42) brightness(1.08); }
      .kq-unified-node.done .kq-chapter-scene { filter:saturate(.82); }
      .kq-activity-badge { display:inline-flex; align-items:center; gap:6px; width:max-content; max-width:100%; margin-top:9px; padding:5px 9px; border:1px solid rgba(14,116,144,.28); border-radius:999px; background:rgba(236,254,255,.88); color:#155e75; font-size:.75rem; font-weight:800; }
      .kq-activity-badge span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .kq-mission-detail { margin:10px 0 0; padding:10px; border-radius:12px; background:rgba(255,255,255,.78); font-size:.84rem; }
      .kq-mission-detail p { margin:.35rem 0 0; }

      .kq-unified-node.current .kq-unified-card {
        border-width:2px;
      }

      .kq-unified-node.future {
        opacity:.72;
      }

      .kq-unified-label {
        font-size:.76rem;
        font-weight:800;
        letter-spacing:.04em;
        opacity:.75;
      }

      .kq-unified-title {
        display:block;
        font-size:1.04rem;
        margin:.25rem 0;
      }

      .kq-unified-detail {
        margin:.3rem 0 0;
        opacity:.78;
      }

      .kq-unified-event {
        display:inline-flex;
        align-items:center;
        gap:5px;
        margin-top:9px;
        padding:4px 10px;
        border-radius:999px;
        font-size:.74rem;
        font-weight:800;
        background:rgba(234,179,8,.14);
        color:#92400e;
      }

      .kq-unified-actions {
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        margin-top:11px;
      }

      .kq-unified-actions button {
        margin:0;
      }

      .kq-unified-expand {
        margin-top:11px;
        padding-top:11px;
        border-top:1px solid rgba(0,0,0,.1);
      }

      .kq-unified-expand[hidden] {
        display:none;
      }

      .kq-result-summary {
        display:flex;
        flex-wrap:wrap;
        gap:7px;
        margin-bottom:9px;
      }

      .kq-result-summary span {
        padding:6px 9px;
        border-radius:999px;
        background:rgba(37,99,235,.08);
        font-size:.8rem;
        font-weight:800;
      }

      .kq-word-result {
        display:flex;
        justify-content:space-between;
        gap:10px;
        padding:8px 10px;
        margin-top:6px;
        border-radius:10px;
        background:rgba(0,0,0,.035);
      }

      .kq-word-result small {
        opacity:.7;
        text-align:right;
      }

      .kq-preview-list {
        margin:.5rem 0 0;
        padding-left:1.1rem;
      }

      .kq-milestone {
        display:flex;
        gap:11px;
        align-items:center;
        margin:3px 2px 13px 49px;
        padding:12px 13px;
        border:2px solid rgba(234,179,8,.45);
        border-radius:15px;
        background:rgba(234,179,8,.07);
      }

      .kq-milestone strong {
        display:block;
      }

      .kq-milestone small {
        opacity:.75;
      }

      @media(max-width:560px) {
        .kq-unified-actions {
          display:grid;
        }
        .kq-unified-actions button {
          width:100%;
        }
        .kq-milestone {
          margin-left:48px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function hideLegacyJourneySurface() {
    const root = $('#journey');
    if (!root) return;

    addStyles();

    root.querySelectorAll(
      '.journey-section > .eyebrow,' +
      '.journey-section > h2,' +
      '.journey-section > p,' +
      '.journey-section > #journeyStats,' +
      '.journey-section > #journeyUnlockNotice,' +
      '.daily-route,' +
      '.journey-path-ahead'
    ).forEach(element => {
      element.hidden = true;
      element.setAttribute('aria-hidden', 'true');
    });

    const timeline = $('#journeyHistoryTimeline');
    if (timeline) timeline.hidden = false;

    const eyebrow = timeline?.querySelector('.journey-history-timeline-heading .eyebrow');
    const heading = $('#journeyHistoryTimelineTitle');

    if (eyebrow) eyebrow.textContent = 'Past · Present · Future';
    if (heading) heading.textContent = 'Your Journey';
  }

  const JOURNEY_RETURN_KEY = 'kq-journey-return-v1';

  function markJourneyReturn() {
    try {
      sessionStorage.setItem(JOURNEY_RETURN_KEY, JSON.stringify({
        returnScreen: 'journey',
        at: Date.now()
      }));
    } catch (_) {}
    try { window.activityReturnScreen = 'journey'; } catch (_) {}
  }

  function clearJourneyReturn() {
    try { sessionStorage.removeItem(JOURNEY_RETURN_KEY); } catch (_) {}
  }

  function journeyReturnPending() {
    try {
      const value = JSON.parse(sessionStorage.getItem(JOURNEY_RETURN_KEY) || 'null');
      return Boolean(value && value.returnScreen === 'journey');
    } catch (_) {
      return false;
    }
  }

  function returnToJourneySoon() {
    clearJourneyReturn();
    try { window.activityReturnScreen = 'journey'; } catch (_) {}
    try {
      const button = $('#continueJourney');
      if (button) {
        button.click();
        return true;
      }
    } catch (_) {}
    try {
      if (typeof showScreen === 'function') {
        showScreen('journey');
        renderAfterNavigation();
        return true;
      }
    } catch (_) {}
    return false;
  }

  function installRedoReturnGuard() {
    if (document.documentElement.dataset.kqRedoReturnGuard === '1') return;
    document.documentElement.dataset.kqRedoReturnGuard = '1';

    document.addEventListener('click', event => {
      if (!journeyReturnPending()) return;
      const target = event.target.closest?.('button,[role="button"],a');
      if (!target) return;
      const text = String(target.textContent || '').trim().toLowerCase();
      if (!text) return;

      // Cancelling a redo/practice flow must return to the Journey, not the
      // generic Learning History screen from which the flow was implemented.
      if (text === 'not now' || text === 'cancel') {
        setTimeout(returnToJourneySoon, 0);
      }
    }, true);

    window.addEventListener('pageshow', () => {
      if (journeyReturnPending()) setTimeout(returnToJourneySoon, 0);
    });
  }

  function launchCurrentLesson() {
    try {
      if (typeof resumeSavedMission === 'function' && resumeSavedMission()) return true;
    } catch (_) {}

    try {
      // The route owns the next lesson. Starting a whole topic here can select
      // a different lesson (and made the Continue button appear unresponsive).
      const routeButton = $('#startNextMission');
      if (routeButton && !routeButton.disabled && !routeButton.hidden) {
        routeButton.click();
        return true;
      }
    } catch (_) {}

    try {
      const chapter = currentChapter();
      if (typeof startJourneyChapter === 'function' && Number.isInteger(chapter)) {
        startJourneyChapter(chapter);
        return true;
      }
    } catch (_) {}

    return false;
  }

  function retryLesson(chapter) {
    const words = lessonWords(chapter).filter(Boolean);
    const ids = words.map(word => word?.id).filter(Boolean);
    if (!ids.length) return false;

    markJourneyReturn();

    try {
      if (typeof makeTargetedMasterySession === 'function') {
        // Some versions of the learning engine reset activityReturnScreen while
        // constructing a session, so set it both before and after the call.
        window.activityReturnScreen = 'journey';
        makeTargetedMasterySession(ids, 'meaning');
        window.activityReturnScreen = 'journey';
        return true;
      }
    } catch (_) {}

    return false;
  }


  const MASTERY_KEY = 'kq-mastery-challenges-v1';
  const MASTERY_GAP_MS = 24 * 60 * 60 * 1000;

  function masteryStore() {
    try {
      const key = typeof profileStorageKey === 'function'
        ? profileStorageKey(MASTERY_KEY)
        : MASTERY_KEY;
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch (_) {
      return {};
    }
  }

  function saveMasteryStore(store) {
    try {
      const key = typeof profileStorageKey === 'function'
        ? profileStorageKey(MASTERY_KEY)
        : MASTERY_KEY;
      localStorage.setItem(key, JSON.stringify(store));
    } catch (_) {}
  }

  function wordStateSafe(word) {
    try {
      if (window.KaishiLearning?.wordState) return window.KaishiLearning.wordState(word);
    } catch (_) {}
    return null;
  }

  function masteryEligible(chapter) {
    const stats = lessonStats(chapter);
    if (!stats.complete || !stats.words.length) return false;

    // The challenge is earned from the existing learning model, not from a
    // second percentage/mastery algorithm. Requiring Usable evidence for every
    // word plus repeated exposure prevents an immediate post-lesson exam.
    const allUsable = stats.words.every(word => wordStateSafe(word) === 'Usable');
    const repeated = stats.words.every(word => {
      const p = progressSafe()[word?.id] || {};
      return Number(p.reps || 0) >= 2;
    });
    return allUsable && repeated;
  }

  function masteryState(chapter) {
    const store = masteryStore();
    const id = String(chapter);
    const existing = masteryResult(chapter) || store[id];
    if (existing?.passedAt) return {status:'passed', ...existing};

    if (!masteryEligible(chapter)) return {status:'locked'};

    if (!existing?.earnedAt) {
      const earnedAt = Date.now();
      store[id] = {
        earnedAt,
        availableAt: earnedAt + MASTERY_GAP_MS,
        attempts: 0
      };
      saveMasteryStore(store);
      return {status:'pending', ...store[id]};
    }

    return Date.now() >= Number(existing.availableAt || 0)
      ? {status:'ready', ...existing}
      : {status:'pending', ...existing};
  }


  function masteryResult(chapter) {
    const store = masteryStore();
    const state = store[String(chapter)];
    if (!state || !state.lastStartedAt || state.passedAt) return state;

    const words = lessonWords(chapter).filter(Boolean);
    if (!words.length) return state;
    const baseline = state.baseline || {};
    let attempted = 0;
    let correct = 0;
    let complete = true;

    words.forEach(word => {
      const before = baseline[word.id] || {attempts:0, correct:0};
      const metric = progressSafe()[word.id]?.skills?.production || {};
      const da = Math.max(0, Number(metric.attempts || 0) - Number(before.attempts || 0));
      const dc = Math.max(0, Number(metric.correct || 0) - Number(before.correct || 0));
      if (da < 1) complete = false;
      attempted += da;
      correct += Math.min(da, dc);
    });

    if (!complete || attempted < Math.min(words.length, 3)) return state;

    // A delayed production challenge passes only when the learner shows strong
    // recall across the new production attempts. The existing skill model remains
    // authoritative; this is merely a challenge-level interpretation of evidence.
    const ratio = attempted ? correct / attempted : 0;
    if (ratio >= 0.8) {
      store[String(chapter)] = {...state, passedAt: Date.now(), result: {attempted, correct, ratio}};
      saveMasteryStore(store);
      return store[String(chapter)];
    }

    return state;
  }

  function masteryHTML(chapter) {
    const state = masteryState(chapter);
    if (state.status === 'locked') return '';

    if (state.status === 'passed') {
      return `
        <div class="kq-mastery-card passed">
          <div class="kq-mastery-icon">🏆</div>
          <div><strong>Mastery demonstrated</strong><p>Your delayed recall challenge has been completed. Normal review will keep these words strong.</p></div>
        </div>
      `;
    }

    if (state.status === 'pending') {
      const remaining = Math.max(0, Number(state.availableAt || 0) - Date.now());
      const hours = Math.max(1, Math.ceil(remaining / (60 * 60 * 1000)));
      return `
        <div class="kq-mastery-card pending">
          <div class="kq-mastery-icon">⏳</div>
          <div><strong>Mastery Challenge earned</strong><p>Come back after a recall gap. It will be ready in about ${hours} hour${hours === 1 ? '' : 's'}.</p></div>
        </div>
      `;
    }

    return `
      <div class="kq-mastery-card ready">
        <div class="kq-mastery-icon">🏆</div>
        <div class="kq-mastery-copy"><strong>Mastery Challenge ready</strong><p>Prove you can still retrieve these words without the lesson prompts.</p></div>
        <button type="button" class="primary" data-kq-action="mastery" data-kq-chapter="${chapter}">Take mastery challenge</button>
      </div>
    `;
  }

  function startMasteryChallenge(chapter) {
    const state = masteryState(chapter);
    if (state.status !== 'ready') return false;

    const ids = lessonWords(chapter).map(word => word?.id).filter(Boolean);
    if (!ids.length || typeof makeTargetedMasterySession !== 'function') return false;

    const store = masteryStore();
    const key = String(chapter);
    const baseline = {};
    ids.forEach(id => {
      const metric = progressSafe()[id]?.skills?.production || {};
      baseline[id] = {
        attempts: Number(metric.attempts || 0),
        correct: Number(metric.correct || 0)
      };
    });
    store[key] = {
      ...store[key],
      attempts: Number(store[key]?.attempts || 0) + 1,
      lastStartedAt: Date.now(),
      baseline
    };
    saveMasteryStore(store);
    markJourneyReturn();

    try {
      window.activityReturnScreen = 'journey';
      // Production is intentionally used for the challenge: it asks the
      // learner to retrieve Japanese rather than recognise an answer.
      makeTargetedMasterySession(ids, 'production');
      window.activityReturnScreen = 'journey';
      return true;
    } catch (_) {
      return false;
    }
  }

  function addMasteryStyles() {
    if ($('#kqMasteryStyles')) return;
    const style = document.createElement('style');
    style.id = 'kqMasteryStyles';
    style.textContent = `
      #home .dashboard-priority-actions{display:none!important}
      .kq-mastery-card{display:flex;gap:10px;align-items:center;margin-top:12px;padding:12px 13px;border-radius:14px;border:1px solid rgba(234,179,8,.4);background:rgba(234,179,8,.07)}
      .kq-mastery-card.pending{border-color:rgba(100,116,139,.28);background:rgba(100,116,139,.06)}
      .kq-mastery-card.passed{border-color:rgba(22,163,74,.32);background:rgba(22,163,74,.06)}
      .kq-mastery-icon{font-size:1.5rem;flex:0 0 auto}.kq-mastery-copy{flex:1;min-width:0}.kq-mastery-card strong{display:block}.kq-mastery-card p{margin:.2rem 0 0;opacity:.78;font-size:.86rem}.kq-mastery-card button{margin-left:auto;white-space:nowrap}
      @media(max-width:560px){.kq-mastery-card{align-items:flex-start;flex-wrap:wrap}.kq-mastery-card button{width:100%;margin-left:0}}
    `;
    document.head.appendChild(style);
  }

  function resultsHTML(chapter) {
    const stats = lessonStats(chapter);
    const percent = stats.percent || (stats.complete ? 100 : 0);

    return `
      <div class="kq-result-summary">
        <span>${stats.words.length} word${stats.words.length === 1 ? '' : 's'}</span>
        <span>${percent}% strength</span>
      </div>
      ${stats.words.map(word => `
        <div class="kq-word-result">
          <b lang="ja">${esc(word.word)}</b>
          <small>${esc(word.meaning || '')} · ${wordScore(word)}%</small>
        </div>
      `).join('') || '<p class="muted">No word-level results are available yet.</p>'}
      ${missionDetail(missionForChapter(chapter))}
    `;
  }

  function missionForChapter(chapter) {
    return routeSafe().steps.find(step => step?.kind === 'activity' && String(step?.sideQuestFor || '') === `lesson-${chapter}`)?.mission || null;
  }

  function lessonExplanationHTML(chapter) {
    const stats = lessonStats(chapter);
    const current = currentChapter();
    const remaining = Math.max(0, stats.words.length - stats.introduced);
    const state = chapter < current
      ? 'This lesson is complete; its words will return through spaced review.'
      : chapter === current
        ? remaining ? `${remaining} word${remaining === 1 ? '' : 's'} still need to be introduced before this lesson is complete.` : 'The words are introduced; one more focused review will strengthen them.'
        : 'Complete the earlier lesson first so this vocabulary has the context it needs.';
    return `<strong>Sensei’s route note</strong><p>${esc(state)}</p><p><b>Current progress:</b> ${stats.introduced}/${stats.words.length} words introduced.</p>${missionDetail(missionForChapter(chapter))}`;
  }

  function previewHTML(chapter) {
    const words = lessonWords(chapter);
    const topic = topicFor(words);

    return `
      <strong>What you’ll learn</strong>
      <ul class="kq-preview-list">
        ${words.slice(0,4).map(word =>
          `<li><b lang="ja">${esc(word.word)}</b> — ${esc(word.meaning || '')}</li>`
        ).join('') || '<li>Lesson content will appear here when it is unlocked.</li>'}
      </ul>
      ${topic?.title ? `<p><b>Topic:</b> ${esc(topic.title)}</p>` : ''}
      <p><b>Why it’s next:</b> complete the previous lesson first; this lesson then introduces its connected words before they return for spaced practice.</p>
      ${missionDetail(missionForChapter(chapter))}
    `;
  }

  function missionBadge(mission) {
    if (!mission) return '';
    return `<div class="kq-activity-badge" title="${esc(mission.objective)}"><b>${esc(mission.icon)}</b><span>${esc(mission.purpose)} · ${esc(mission.label)}</span></div>`;
  }

  function missionDetail(mission) {
    if (!mission) return '';
    return `<div class="kq-mission-detail"><strong>${esc(mission.icon)} ${esc(mission.label)}</strong><p>${esc(mission.objective)}${mission.vocabulary ? ` Reinforces ${esc(mission.vocabulary)}.` : ''}</p></div>`;
  }

  function nodeHTML(item) {
    const classes = [
      'kq-unified-node',
      item.done ? 'done' : '',
      item.current ? 'current' : '',
      item.future ? 'future' : '',
      item.type === 'side' ? 'side' : ''
    ].filter(Boolean).join(' ');

    const label =
      item.type === 'past' ? 'Completed' :
      item.type === 'retry' ? 'Retry this lesson' :
      item.type === 'side' ? (item.required ? 'Required side quest' : 'Optional side quest') :
      item.current ? 'Current lesson' :
      'Coming up';

    let actions = '';

    if (item.type === 'past') {
      actions = `
        <div class="kq-unified-actions">
          <button type="button"
                  data-kq-action="results"
                  data-kq-chapter="${item.chapter}"
                  aria-expanded="false">
            View lesson results
          </button>
          <button type="button"
                  class="primary"
                  data-kq-action="retry"
                  data-kq-chapter="${item.chapter}">
            Practice lesson
          </button>
        </div>
        <div class="kq-unified-expand"
             data-kq-details="${item.chapter}"
             hidden></div>
        ${masteryHTML(item.chapter)}
      `;
    } else if (item.type === 'current') {
      actions = `
        <div class="kq-unified-actions">
          <button type="button"
                  class="primary"
                  data-kq-action="continue"
                  data-kq-chapter="${item.chapter}">
            Continue lesson
          </button>
          <button type="button"
                  data-kq-action="explain"
                  data-kq-chapter="${item.chapter}"
                  aria-expanded="false">
            Why this route?
          </button>
        </div>
        <div class="kq-unified-expand"
             data-kq-details="${item.chapter}"
             hidden></div>
      `;
    } else if (item.type === 'future') {
      actions = `
        <div class="kq-unified-actions">
          <button type="button"
                  data-kq-action="preview"
                  data-kq-chapter="${item.chapter}"
                  aria-expanded="false">
            Preview lesson
          </button>
        </div>
        <div class="kq-unified-expand"
             data-kq-details="${item.chapter}"
             hidden></div>
      `;
    } else if (item.type === 'retry' && !item.done) {
      actions = `
        <div class="kq-unified-actions">
          <button type="button"
                  class="primary"
                  data-kq-action="retry"
                  data-kq-chapter="${item.chapter}">
            Practice lesson
          </button>
        </div>
      `;
    } else if (item.type === 'side' && !item.done && item.activityId) {
      actions = `
        <div class="kq-unified-actions">
          <button type="button"
                  class="primary"
                  data-kq-action="activity"
                  data-kq-activity="${esc(item.activityId)}"
                  data-kq-chapter="${item.chapter}">
            Start side quest
          </button>
        </div>
      `;
    }

    return `
      <article class="${classes}" data-kq-id="${esc(item.id)}" data-kq-scene="${esc(item.scene?.id || '')}">
        <div class="kq-unified-marker">${item.done ? '✓' : esc(item.icon || '•')}</div>
        <div class="kq-unified-card"${item.scene ? ` style="--kq-scene:url('${esc(item.scene.image)}')"` : ''}>
          ${item.scene ? '<div class="kq-chapter-scene" aria-hidden="true"></div>' : ''}
          <span class="kq-unified-label">${label}</span>
          <strong class="kq-unified-title">${esc(item.title)}</strong>
          <p class="kq-unified-detail">${esc(item.detail)}</p>
          ${missionBadge(item.immersiveMission)}
          ${actions}
        </div>
      </article>
    `;
  }

  function render() {
    const root = $('#journey');
    const track = $('#journeyHistoryTrack');

    if (!root || !track || !root.classList.contains('active')) return;

    hideLegacyJourneySurface();

    const data = journeyRows();
    const oldScrollTop = track.scrollTop;

    if (!data.length) {
      track.innerHTML = '<p class="muted">Your lessons will appear here as you progress.</p>';
      return;
    }

    let markup = '<div class="kq-unified-timeline">';

    data.forEach(item => {
      markup += nodeHTML(item);
    });

    markup += '</div>';

    /*
     * One DOM write for the whole timeline. Nothing watches this subtree.
     * That is the key stability guarantee for v11.20.0.
     */
    track.innerHTML = markup;

    if (track.dataset.kqUserScrolled === '1') {
      track.scrollTop = oldScrollTop;
    } else {
      const current = track.querySelector('.kq-unified-node.current');
      if (current) {
        requestAnimationFrame(() => {
          if (track.dataset.kqUserScrolled !== '1') {
            track.scrollTop = Math.max(
              0,
              current.offsetTop - Math.max(80, track.clientHeight * 0.18)
            );
          }
        });
      }
    }
  }

  function bind() {
    const track = $('#journeyHistoryTrack');
    if (!track) return;

    if (track.dataset.kqUnifiedScrollBound !== '1') {
      track.dataset.kqUnifiedScrollBound = '1';
      track.addEventListener('scroll', () => {
      track.dataset.kqUserScrolled = '1';
      }, {passive:true});
    }

    if (document.documentElement.dataset.kqUnifiedActionsBound === '1') return;
    document.documentElement.dataset.kqUnifiedActionsBound = '1';

    // app.js can replace this track while rendering legacy history. Delegate
    // from a stable ancestor so desktop rerenders never orphan Journey buttons.
    document.addEventListener('click', event => {
      const button = event.target.closest?.('[data-kq-action]');
      const activeTrack = button?.closest?.('#journeyHistoryTrack');
      if (!button || !activeTrack) return;

      event.preventDefault();
      event.stopPropagation();

      const action = button.dataset.kqAction;
      const chapter = Number(button.dataset.kqChapter);
      if (!Number.isFinite(chapter)) return;

      if (action === 'continue') {
        if (!launchCurrentLesson()) alertUnavailable('The next lesson is still loading. Please try again in a moment.');
        return;
      }

      if (action === 'retry') {
        if (!retryLesson(chapter)) alertUnavailable('That lesson could not be prepared. Please try again.');
        return;
      }

      if (action === 'activity') {
        const activityId = String(button.dataset.kqActivity || '');
        try {
          if (typeof launchPathMilestone === 'function' && activityId) {
            launchPathMilestone(activityId, true);
            return;
          }
        } catch (_) {}
        alertUnavailable('That side quest is still loading. Please try again in a moment.');
        return;
      }

      if (action === 'mastery') {
        startMasteryChallenge(chapter);
        return;
      }

      if (action === 'results' || action === 'preview' || action === 'explain') {
        const details = activeTrack.querySelector(`[data-kq-details="${chapter}"]`);
        if (!details) return;

        const opening = details.hidden;

        if (opening) {
          details.innerHTML =
            action === 'results'
              ? resultsHTML(chapter)
              : action === 'preview'
                ? previewHTML(chapter)
                : lessonExplanationHTML(chapter);
        }

        details.hidden = !opening;
        button.setAttribute('aria-expanded', String(opening));
      }
    }, true);
  }

  function renderAfterNavigation() {
    requestAnimationFrame(() => requestAnimationFrame(render));
  }

  // Exposed so roadmap-engine.js can ask for a resync after it finishes
  // its first computation (render() itself is a safe no-op when the
  // Journey screen isn't the active one — see the guard at its top).
  window.KaishiJourneyRender = render;

  function alertUnavailable(message) {
    try { if (typeof toast === 'function') { toast(message); return; } } catch (_) {}
    console.warn(message);
  }

  function init() {
    addStyles();
    addMasteryStyles();
    installRedoReturnGuard();
    bind();
    window.dispatchEvent(new Event('kaishi-journey-ready'));

    /*
     * Capture-phase navigation hook: app.js handles the same buttons, then our
     * two-frame render runs after the screen transition has settled.
     */
    document.addEventListener('click', event => {
      if (event.target.closest?.('#continueJourney,#journeyBack')) {
        renderAfterNavigation();
      }
    }, true);

    window.addEventListener('pageshow', renderAfterNavigation);
    window.addEventListener('kaishi-roadmap-updated', renderAfterNavigation);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) renderAfterNavigation();
    });

    renderAfterNavigation();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {once:true});
  } else {
    init();
  }
})();
