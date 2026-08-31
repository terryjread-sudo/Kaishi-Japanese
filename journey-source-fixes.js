'use strict';

/*
 * Kaishi Quest — Journey source fixes
 * v11.25.22
 *
 * Normal source module (not a numbered patch overlay).
 *
 * Fixes three Journey issues that can otherwise disagree with the learning
 * engine after a lesson is completed:
 *  - lesson strength can remain visually stuck below 100%;
 *  - the next lesson can remain unavailable when the daily route has not yet
 *    generated its next chapter step;
 *  - standalone Key Events must not create a second mobile column.
 */
(() => {
  const VERSION = '11.25.22';
  const META_KEY = 'kq-meta';
  const PROGRESS_KEY = 'kq-progress';

  const storageKey = key => {
    try { return typeof profileStorageKey === 'function' ? profileStorageKey(key) : key; }
    catch (_) { return key; }
  };

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(storageKey(key)) || 'null') ?? fallback; }
    catch (_) { return fallback; }
  };

  const write = (key, value) => {
    try { localStorage.setItem(storageKey(key), JSON.stringify(value)); return true; }
    catch (_) { return false; }
  };

  const wordsFor = chapter => {
    try {
      const words = typeof chapterWords === 'function' ? chapterWords(Number(chapter)) : [];
      return Array.isArray(words) ? words.filter(Boolean) : [];
    } catch (_) { return []; }
  };

  const countLessons = () => {
    try {
      const n = Number(typeof wordChapterCount === 'function' ? wordChapterCount() : 0);
      if (n > 0) return n;
    } catch (_) {}
    try { return Math.ceil((Array.isArray(vocab) ? vocab.length : 0) / 3); }
    catch (_) { return 0; }
  };

  const wordIntroducedSafe = word => {
    try {
      if (typeof wordIntroduced === 'function') return Boolean(wordIntroduced(word));
    } catch (_) {}
    const p = read(PROGRESS_KEY, {})?.[word?.id] || {};
    if (Number(p.stage || 0) > 0) return true;
    return Object.values(p.skills || {}).some(metric => Number(metric?.attempts || 0) > 0);
  };

  const lessonComplete = chapter => {
    const words = wordsFor(chapter);
    return Boolean(words.length && words.every(wordIntroducedSafe));
  };

  const chapterTitle = chapter => {
    const words = wordsFor(chapter);
    const meanings = words.slice(0, 2).map(word => word?.meaning).filter(Boolean);
    return meanings.length
      ? `Lesson ${chapter + 1}: ${meanings.join(' + ')}`
      : `Lesson ${chapter + 1}`;
  };

  /*
   * The Journey renderer normally follows dailyJourneyRoute. Immediately after
   * completing a lesson there can be a short window where the route still only
   * contains the completed lesson. Add the next chapter as a derived route step
   * so the existing renderer can promote it to the current lesson naturally.
   */
  const ensureNextChapterRoute = () => {
    const meta = read(META_KEY, {});
    const route = meta.dailyJourneyRoute;
    if (!route || !Array.isArray(route.steps)) return false;

    const completed = new Set(Array.isArray(route.completed) ? route.completed : []);
    let changed = false;
    let highestCompleted = -1;

    for (let chapter = 0; chapter < countLessons(); chapter++) {
      if (completed.has(`lesson-${chapter}`) || lessonComplete(chapter)) highestCompleted = chapter;
      else break;
    }

    if (highestCompleted < 0) return false;
    const next = highestCompleted + 1;
    if (next >= countLessons()) return false;

    const already = route.steps.some(step =>
      step && step.kind === 'chapter' && String(step.id) === `lesson-${next}`
    );
    if (!already) {
      route.steps.push({
        id: `lesson-${next}`,
        kind: 'chapter',
        title: chapterTitle(next),
        required: true,
        generatedBy: 'journey-source-fixes-11.25.22'
      });
      changed = true;
    }

    if (changed) {
      meta.dailyJourneyRoute = route;
      write(META_KEY, meta);
      try { window.dispatchEvent(new Event('kaishi-roadmap-updated')); } catch (_) {}
    }
    return changed;
  };

  const normaliseTimelineLayout = () => {
    const track = document.getElementById('journeyHistoryTrack');
    if (!track) return;
    track.style.display = 'block';
    track.style.width = '100%';
    track.style.minWidth = '0';
    track.style.maxWidth = '100%';

    const timeline = track.querySelector('.kq-unified-timeline');
    if (timeline) {
      timeline.style.display = 'block';
      timeline.style.width = '100%';
      timeline.style.minWidth = '0';
    }

    track.querySelectorAll('.kq-journey-key-event').forEach(event => {
      if (timeline && event.parentElement !== timeline) timeline.appendChild(event);
      event.style.maxWidth = '100%';
      event.style.boxSizing = 'border-box';
    });
  };

  const repairDisplayedCompletion = () => {
    const track = document.getElementById('journeyHistoryTrack');
    if (!track) return;

    for (let chapter = 0; chapter < countLessons(); chapter++) {
      if (!lessonComplete(chapter)) continue;
      const node = track.querySelector(`[data-kq-id="lesson-${chapter}"]`);
      if (!node) continue;
      const detail = node.querySelector('.kq-unified-detail');
      if (!detail) continue;
      if (/^Completed\s*[·•]/.test(detail.textContent || '')) {
        detail.textContent = 'Completed · 100%';
      }
    }
  };

  const startExactLesson = chapter => {
    const words = wordsFor(chapter);
    const ids = words.map(word => word?.id).filter(Boolean);
    if (!ids.length) return false;

    try { window.activityReturnScreen = 'journey'; } catch (_) {}

    try {
      if (typeof startJourneyChapter === 'function') {
        startJourneyChapter(Number(chapter));
        return true;
      }
    } catch (_) {}

    /*
     * Current learning engine fallback. It targets exactly this lesson's word
     * IDs rather than jumping to the broader topic queue, so tapping Lesson 2
     * cannot accidentally start Lesson 1 again.
     */
    try {
      if (typeof makeTargetedMasterySession === 'function') {
        makeTargetedMasterySession(ids, 'retain', `Lesson ${Number(chapter) + 1}`);
        return true;
      }
    } catch (_) {}

    return false;
  };

  const repairCurrentLessonButton = () => {
    const track = document.getElementById('journeyHistoryTrack');
    if (!track) return;

    const completedChapters = [];
    for (let chapter = 0; chapter < countLessons(); chapter++) {
      if (lessonComplete(chapter)) completedChapters.push(chapter);
      else break;
    }
    if (!completedChapters.length) return;

    const next = completedChapters[completedChapters.length - 1] + 1;
    if (next >= countLessons()) return;

    const node = track.querySelector(`[data-kq-id="lesson-${next}"]`);
    if (!node) return;

    /* If the unified renderer has already promoted it, leave its native button. */
    if (node.classList.contains('current')) return;

    node.classList.remove('future');
    node.classList.add('current');
    const label = node.querySelector('.kq-unified-label');
    if (label) label.textContent = 'Current lesson';
    const detail = node.querySelector('.kq-unified-detail');
    if (detail) detail.textContent = 'Current lesson';

    const actions = node.querySelector('.kq-unified-actions');
    if (!actions) return;
    actions.innerHTML = '';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'primary';
    button.textContent = `Start Lesson ${next + 1}`;
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      startExactLesson(next);
    }, {capture:true});
    actions.appendChild(button);
  };

  const repair = () => {
    ensureNextChapterRoute();
    normaliseTimelineLayout();
    repairDisplayedCompletion();
    repairCurrentLessonButton();
  };

  const install = () => {
    if (document.documentElement.dataset.kqJourneySourceFixesInstalled === '1') return;
    document.documentElement.dataset.kqJourneySourceFixesInstalled = '1';

    const run = () => requestAnimationFrame(() => requestAnimationFrame(repair));
    run();
    window.addEventListener('kaishi-roadmap-updated', run, {passive:true});
    document.addEventListener('visibilitychange', () => { if (!document.hidden) run(); }, {passive:true});
    document.addEventListener('click', event => {
      if (event.target?.closest?.('#continueJourney,#journeyBack,#journey button')) run();
    }, {capture:true, passive:true});

    /* Bounded boot retries cover the initial async Journey/module load. */
    let tries = 0;
    const boot = () => {
      repair();
      if (++tries < 20) setTimeout(boot, 150);
    };
    boot();
  };

  window.KaishiJourneySourceFixes = {
    version: VERSION,
    repair,
    lessonComplete,
    startExactLesson
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, {once:true});
  } else {
    install();
  }
})();
