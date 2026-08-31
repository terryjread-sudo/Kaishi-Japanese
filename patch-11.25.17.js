'use strict';

/*
 * Kaishi Quest v11.25.21
 *
 * Existing lesson stability + automatic checkpoint save.
 * Also fixes lesson completeness getting stuck at low percentages after
 * repeated successful reviews.
 */
(() => {
  const VERSION = '11.25.21';

  function savingBubble() {
    let bubble = document.getElementById('kaishiSavingProgress');
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.id = 'kaishiSavingProgress';
      bubble.setAttribute('role', 'status');
      bubble.setAttribute('aria-live', 'polite');
      Object.assign(bubble.style, {
        position: 'fixed', left: '50%', bottom: '24px',
        transform: 'translateX(-50%)', zIndex: '2147483647',
        padding: '9px 15px', borderRadius: '999px',
        background: 'rgba(15,23,42,.94)', color: '#fff',
        font: '600 14px system-ui,sans-serif',
        boxShadow: '0 8px 30px rgba(0,0,0,.22)',
        opacity: '0', transition: 'opacity .18s ease',
        pointerEvents: 'none'
      });
      document.body.appendChild(bubble);
    }
    bubble.textContent = 'Saving progress';
    bubble.style.opacity = '1';
    clearTimeout(bubble.__kaishiTimer);
    bubble.__kaishiTimer = setTimeout(() => { bubble.style.opacity = '0'; }, 1600);
  }

  function installCheckpointHandler() {
    if (typeof window.showMissionCheckpoint !== 'function') return false;
    if (window.__kaishi112517CheckpointInstalled) return true;

    window.showMissionCheckpoint = function () {
      try { saveMissionResume(); } catch (_) {}
      savingBubble();
      try {
        index++;
        renderCurrent();
      } catch (error) {
        try {
          window.kaishiLog?.(
            'patch',
            `[${VERSION}] checkpoint advance failed: ${error?.message || error}`
          );
        } catch (_) {}
      }
    };

    window.__kaishi112517CheckpointInstalled = true;
    return true;
  }

  function hideDuplicateImmersiveNotice() {
    if (!document.getElementById('kaishi112517NoticeStyle')) {
      const style = document.createElement('style');
      style.id = 'kaishi112517NoticeStyle';
      style.textContent = `.kq-unified-next-event{display:none !important;}`;
      document.head.appendChild(style);
    }
  }

  /*
   * Lesson completeness:
   *
   * The old Journey renderer averaged every skill equally. A learner could
   * therefore repeatedly succeed in the lesson's core recognition/recall
   * skills while optional/unused skills kept the visible percentage low.
   *
   * This model uses meaningful evidence:
   *   - meaning + production are the core;
   *   - the stronger of listening/reading supplies supporting evidence;
   *   - successful review evidence moves the remaining gap quickly;
   *   - a perfect lesson/recall path reaches 100% after two strong reviews;
   *   - a developing path reaches 100% within four strong reviews.
   */
  const clamp = (n, lo = 0, hi = 100) =>
    Math.max(lo, Math.min(hi, Number(n) || 0));

  function lessonCompletionForWords(words) {
    if (!Array.isArray(words) || !words.length) {
      return { percent: 0, complete: false, introduced: 0 };
    }

    const progressMap = window.progress || {};
    let total = 0;
    let introduced = 0;

    for (const word of words) {
      const p = progressMap[word?.id] || {};
      const skills = p.skills || {};
      const metric = skill => skills[skill] || {};
      const strength = skill => clamp(Number(metric(skill).strength || 0) * 100);
      const attempts = skill => Number(metric(skill).attempts || 0);
      const correct = skill => Number(metric(skill).correct || 0);

      const meaning = strength('meaning');
      const production = strength('production');
      const listening = strength('listening');
      const reading = strength('reading');

      const coreAttempts =
        attempts('meaning') + attempts('production') +
        attempts('listening') + attempts('reading');

      const hasEvidence =
        Number(p.stage || 0) > 0 ||
        coreAttempts > 0;

      if (!hasEvidence) {
        total += 0;
        continue;
      }
      introduced++;

      const coreStrength =
        (meaning * 0.45) +
        (production * 0.40) +
        (Math.max(listening, reading) * 0.15);

      const perfectCore =
        meaning >= 90 &&
        production >= 90 &&
        (listening >= 80 || reading >= 80 || coreAttempts >= 4);

      /*
       * The app's review counter is not consistent across older progress
       * records, so do not depend solely on p.reps. Successful core answers
       * are also valid consolidation evidence.
       */
      const successfulCore = correct('meaning') + correct('production');
      const successfulSupport = Math.max(correct('listening'), correct('reading'));
      const reviewEvidence = Math.max(
        0,
        Number(p.reps || 0) - 2,
        Math.floor(Math.max(0, successfulCore - 2) / 2),
        Math.floor(Math.max(0, successfulSupport - 1) / 2)
      );

      const base = perfectCore
        ? 72
        : clamp(55 + coreStrength * 0.17);

      const targetReviews = perfectCore ? 2 : 4;
      const reviewProgress = targetReviews
        ? (Math.min(targetReviews, reviewEvidence) / targetReviews) * (100 - base)
        : 0;

      /*
       * Also allow the actual current strength to dominate when it is already
       * stronger than the historical review-derived estimate. This prevents
       * a legacy record with missing reps from getting stuck.
       */
      let score = Math.max(base + reviewProgress, coreStrength);

      /*
       * Once the learner has demonstrated strong core recall repeatedly,
       * close the remaining gap. This is the key fix for lessons that had
       * previously plateaued around 30–50%.
       */
      if (
        meaning >= 80 &&
        production >= 80 &&
        successfulCore >= 4
      ) {
        score = Math.max(score, 90);
      }

      if (
        meaning >= 90 &&
        production >= 90 &&
        successfulCore >= 6
      ) {
        score = 100;
      }

      total += clamp(score);
    }

    const percent = Math.round(total / words.length);

    return {
      percent: clamp(percent),
      complete: introduced === words.length && percent >= 100,
      introduced
    };
  }

  function patchChapterStats() {
    if (window.__kaishi112521ChapterStatsPatched) return true;
    const original = window.chapterStats;
    if (typeof original !== 'function') return false;

    window.chapterStats = function (...args) {
      const result = original.apply(this, args);

      try {
        const chapter = Number(args[0]);
        const words = typeof window.chapterWords === 'function'
          ? window.chapterWords(chapter)
          : [];

        if (!Array.isArray(words) || !words.length) return result;

        const completion = lessonCompletionForWords(words);

        return {
          ...result,
          ...completion,
          completeness: completion.percent,
          percent: completion.percent,
          progress: completion.percent
        };
      } catch (_) {
        return result;
      }
    };

    window.__kaishi112521ChapterStatsPatched = true;
    return true;
  }

  function refreshJourney() {
    try { window.KaishiRoadmap?.refresh?.(); } catch (_) {}
    try { window.renderJourney?.(); } catch (_) {}
    try { window.renderJourneyPathAhead?.(); } catch (_) {}
  }

  function installProgressRefresh() {
    if (window.__kaishi112521RefreshInstalled) return;
    window.__kaishi112521RefreshInstalled = true;

    [
      'kaishi:answer-recorded',
      'kaishi:session-complete',
      'kaishi:reinforcement-rescue-complete'
    ].forEach(name => document.addEventListener(name, refreshJourney));

    if (typeof window.save === 'function' && !window.__kaishi112521SaveWrapped) {
      const originalSave = window.save;
      window.save = function (...args) {
        const result = originalSave.apply(this, args);
        setTimeout(refreshJourney, 0);
        return result;
      };
      window.__kaishi112521SaveWrapped = true;
    }
  }

  function accelerateThreeSuccessfulReviews() {
    try {
      const adminMode = (() => {
        try { return sessionStorage.getItem('kq-admin-test-mode') === '1'; }
        catch (_) { return false; }
      })();

      const key = adminMode ? 'kq-admin-test-progress' : 'kq-progress';
      const raw = localStorage.getItem(key);
      if (!raw) return;

      const data = JSON.parse(raw);
      let changed = false;

      Object.values(data || {}).forEach(card => {
        const skills = card?.skills;
        if (!skills || typeof skills !== 'object') return;

        Object.values(skills).forEach(metric => {
          if (!metric || typeof metric !== 'object') return;

          const attempts = Number(metric.attempts || 0);
          const correct = Number(metric.correct || 0);

          if (attempts >= 3 && correct >= 3 && Number(metric.strength || 0) < 1) {
            metric.strength = 1;
            changed = true;
          }
        });
      });

      if (changed) localStorage.setItem(key, JSON.stringify(data));
    } catch (_) {}
  }

  function start() {
    hideDuplicateImmersiveNotice();

    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      const checkpointReady = installCheckpointHandler();
      const statsReady = patchChapterStats();
      installProgressRefresh();
      accelerateThreeSuccessfulReviews();

      if (checkpointReady && statsReady && attempts >= 10) {
        clearInterval(timer);
        refreshJourney();
      } else if (attempts >= 120) {
        clearInterval(timer);
        refreshJourney();
      }
    }, 50);

    setInterval(() => {
      accelerateThreeSuccessfulReviews();
      hideDuplicateImmersiveNotice();
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, {once:true});
  } else {
    start();
  }

  window.KaishiLessonCompletion = {
    version: VERSION,
    model: 'evidence-based-core-recall',
    perfectLessonReviewTarget: 2,
    developingLessonReviewTarget: 4,
    completionForWords: lessonCompletionForWords
  };
})();
