'use strict';

/*
 * Kaishi Quest — Journey source fixes
 * v11.25.23
 *
 * Normal source module (not a numbered patch overlay).
 * Fixes Journey timeline scrolling and prevents a locked SRS Battle key event
 * from falling through to the lesson-history navigation handler.
 */
(() => {
  const VERSION = '11.25.23';
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
    const meanings = wordsFor(chapter).slice(0, 2).map(word => word?.meaning).filter(Boolean);
    return meanings.length ? `Lesson ${chapter + 1}: ${meanings.join(' + ')}` : `Lesson ${chapter + 1}`;
  };

  const ensureNextChapterRoute = () => {
    const meta = read(META_KEY, {});
    const route = meta.dailyJourneyRoute;
    if (!route || !Array.isArray(route.steps)) return false;

    const completed = new Set(Array.isArray(route.completed) ? route.completed : []);
    let highestCompleted = -1;
    for (let chapter = 0; chapter < countLessons(); chapter++) {
      if (completed.has(`lesson-${chapter}`) || lessonComplete(chapter)) highestCompleted = chapter;
      else break;
    }

    const next = highestCompleted + 1;
    if (highestCompleted < 0 || next >= countLessons()) return false;

    const already = route.steps.some(step =>
      step && step.kind === 'chapter' && String(step.id) === `lesson-${next}`
    );
    if (already) return false;

    route.steps.push({
      id: `lesson-${next}`,
      kind: 'chapter',
      title: chapterTitle(next),
      required: true,
      generatedBy: `journey-source-fixes-${VERSION}`
    });
    meta.dailyJourneyRoute = route;
    write(META_KEY, meta);
    try { window.dispatchEvent(new Event('kaishi-roadmap-updated')); } catch (_) {}
    return true;
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
      if (detail && /^Completed\s*[·•]/.test(detail.textContent || '')) {
        detail.textContent = 'Completed · 100%';
      }
    }
  };

  const startExactLesson = chapter => {
    const ids = wordsFor(chapter).map(word => word?.id).filter(Boolean);
    if (!ids.length) return false;
    try { window.activityReturnScreen = 'journey'; } catch (_) {}

    try {
      if (typeof startJourneyChapter === 'function') {
        startJourneyChapter(Number(chapter));
        return true;
      }
    } catch (_) {}

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
    if (!node || node.classList.contains('current')) return;

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

  /*
   * journey-v3 has a compatibility renderer which can rebuild the timeline
   * through its MutationObserver. Rebuilding the DOM resets scrollTop to the
   * current lesson. Preserve the learner's position once they start scrolling
   * and restore it after any renderer mutation.
   */
  const installTimelineScrollGuard = () => {
    const track = document.getElementById('journeyHistoryTrack');
    if (!track || track.dataset.kqScrollGuardInstalled === '1') return;
    track.dataset.kqScrollGuardInstalled = '1';

    let savedTop = track.scrollTop;
    let userHasScrolled = false;
    let pointerActive = false;
    let restoreTimer = 0;

    const remember = () => {
      if (track.dataset.kqTimelineRestoring === '1') return;
      userHasScrolled = true;
      track.dataset.kq1710UserScrolled = '1';
      savedTop = track.scrollTop;
    };

    track.addEventListener('pointerdown', () => {
      pointerActive = true;
      userHasScrolled = true;
      track.dataset.kq1710UserScrolled = '1';
      savedTop = track.scrollTop;
    }, {capture:true, passive:true});

    track.addEventListener('pointermove', () => {
      if (!pointerActive) return;
      savedTop = track.scrollTop;
      userHasScrolled = true;
      track.dataset.kq1710UserScrolled = '1';
    }, {capture:true, passive:true});

    track.addEventListener('pointerup', () => {
      pointerActive = false;
      savedTop = track.scrollTop;
    }, {capture:true, passive:true});
    track.addEventListener('pointercancel', () => {
      pointerActive = false;
      savedTop = track.scrollTop;
    }, {capture:true, passive:true});
    track.addEventListener('scroll', remember, {passive:true});

    const restore = () => {
      if (!userHasScrolled || !document.body.contains(track)) return;
      clearTimeout(restoreTimer);

      const apply = () => {
        if (!document.body.contains(track)) return;
        track.dataset.kqTimelineRestoring = '1';
        const max = Math.max(0, track.scrollHeight - track.clientHeight);
        track.scrollTop = Math.min(Math.max(0, savedTop), max);
        requestAnimationFrame(() => { track.dataset.kqTimelineRestoring = '0'; });
      };

      requestAnimationFrame(() => requestAnimationFrame(apply));
      restoreTimer = setTimeout(apply, 80);
    };

    const observer = new MutationObserver(mutations => {
      if (!userHasScrolled) return;
      if (mutations.some(m => m.type === 'childList' || m.type === 'characterData')) restore();
    });
    observer.observe(track, {subtree:true, childList:true, characterData:true});
  };

  /*
   * SRS Battle is a roadmap Key Event. Before its unlock threshold it must be
   * inert; otherwise a click can bubble into the generic Journey/history click
   * handlers and briefly open Learning History.
   */
  const installLockedKeyEventGuard = () => {
    if (document.documentElement.dataset.kqLockedKeyEventGuard === '1') return;
    document.documentElement.dataset.kqLockedKeyEventGuard = '1';

    document.addEventListener('click', event => {
      const card = event.target?.closest?.('.kq-journey-key-event');
      if (!card) return;

      const title = card.querySelector('.kq-journey-key-event-title')?.textContent || '';
      if (!/srs\s+battle/i.test(title)) return;

      let unlocked = false;
      try {
        if (typeof pathUnlocked === 'function') unlocked = Boolean(pathUnlocked('battle'));
      } catch (_) {}

      if (!unlocked) {
        event.preventDefault();
        event.stopImmediatePropagation();
        event.stopPropagation();
      }
    }, {capture:true});
  };

  const repair = () => {
    ensureNextChapterRoute();
    normaliseTimelineLayout();
    repairDisplayedCompletion();
    repairCurrentLessonButton();
    installTimelineScrollGuard();
    installLockedKeyEventGuard();
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
