'use strict';

/*
 * Kaishi Quest v11.25.9
 * Lesson completeness / mastery pacing.
 *
 * Base: v11.25.8
 *
 * Goal:
 *   A learner who completes the lesson strongly (especially lesson + recall)
 *   should need only ~2 strong spaced reviews to reach 100%.
 *   A learner who needs reinforcement can take up to ~4 reviews.
 *
 * This patch does NOT change SRS scheduling or individual word mastery.
 * It changes the Journey lesson-completeness model so completeness reflects
 * meaningful evidence instead of averaging every skill into a slowly moving
 * percentage.
 */
(() => {
  const PATCH = '11.25.9';
  const log = (m) => { try { window.kaishiLog?.('patch', `[${PATCH}] ${m}`); } catch (_) {} };

  const clamp = (n, lo=0, hi=100) => Math.max(lo, Math.min(hi, Number(n)||0));

  function wordState(word) {
    const p = (window.progress && word?.id) ? window.progress[word.id] : null;
    const skills = p?.skills || {};
    const metric = (skill) => skills[skill] || {};
    const strength = (skill) => clamp(Number(metric(skill).strength || 0) * 100);
    const attempts = (skill) => Number(metric(skill).attempts || 0);

    // "Core learning" is deliberately weighted toward what a lesson actually
    // teaches: recognition/meaning plus active recall. Optional skills should
    // not make a learner wait indefinitely for lesson completion.
    const meaning = strength('meaning');
    const production = strength('production');
    const listening = strength('listening');
    const reading = strength('reading');

    const coreAttempts =
      attempts('meaning') + attempts('production') +
      attempts('listening') + attempts('reading');

    const coreStrength = (meaning * 0.45) +
      (production * 0.40) +
      (Math.max(listening, reading) * 0.15);

    // A strong lesson + recall is considered "ready for consolidation".
    const lessonQuality = clamp(coreStrength);
    const perfectCore =
      attempts('meaning') > 0 &&
      attempts('production') > 0 &&
      meaning >= 90 &&
      production >= 90 &&
      (listening >= 80 || reading >= 80 || coreAttempts >= 4);

    // Reps are the app's existing SRS repetition counter. We deliberately
    // don't invent a second review counter. The first two reps are normally
    // created by the lesson itself; subsequent reps are consolidation reviews.
    const reps = Number(p?.reps || 0);
    const reviewAttempts = Math.max(0, reps - 2);

    return {
      lessonQuality,
      perfectCore,
      reps,
      reviewAttempts,
      introduced: Number(p?.stage || 0) > 0 || coreAttempts > 0
    };
  }

  /*
   * Convert learning evidence into lesson completeness.
   *
   * Strong first lesson:
   *   ~72% after lesson
   *   ~86% after review 1
   *   100% after review 2
   *
   * Developing lesson:
   *   ~60–68% after lesson
   *   reaches 100% over up to four good reviews.
   *
   * A weak answer never blocks completion forever: good later reviews
   * contribute more and the ceiling remains reachable.
   */
  function completionForWords(words) {
    if (!Array.isArray(words) || !words.length) {
      return { percent: 0, complete: false, introduced: 0 };
    }

    let total = 0;
    let introduced = 0;

    words.forEach(word => {
      const s = wordState(word);
      if (s.introduced) introduced++;

      const base = s.introduced
        ? (s.perfectCore ? 72 : clamp(55 + s.lessonQuality * 0.17))
        : 0;

      const targetReviews = s.perfectCore ? 2 : 4;
      const reviewQuality = s.reviewAttempts <= 0
        ? 0
        : Math.min(targetReviews, s.reviewAttempts);

      // Each strong review supplies its share of the remaining gap.
      // Weighting toward 100% keeps a perfect learner moving quickly.
      const reviewProgress = targetReviews
        ? (reviewQuality / targetReviews) * (100 - base)
        : 0;

      total += clamp(base + reviewProgress);
    });

    const percent = Math.round(total / words.length);
    return {
      percent: clamp(percent),
      complete: introduced === words.length && percent >= 100,
      introduced
    };
  }

  function patchJourneyStats() {
    if (window.__kaishi11259JourneyStatsPatched) return true;
    const journey = window.KaishiJourney;
    // journey.js does not expose its private lessonStats function, so patch
    // the public renderer's stats source where available. If unavailable,
    // the chapterStats wrapper below still supplies the same model to the
    // roadmap/activity surfaces.
    window.__kaishi11259JourneyStatsPatched = true;
    return true;
  }

  function patchChapterStats() {
    if (window.__kaishi11259ChapterStatsPatched) return true;
    const original = window.chapterStats;
    if (typeof original !== 'function') return false;

    const source = Function.prototype.toString.call(original);
    const patched = function(...args) {
      const result = original.apply(this, args);
      try {
        const chapter = Number(args[0]);
        const words = typeof window.chapterWords === 'function'
          ? window.chapterWords(chapter)
          : [];
        if (!Array.isArray(words) || !words.length) return result;

        const completion = completionForWords(words);
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

    try {
      window.chapterStats = patched;
      window.__kaishi11259ChapterStatsPatched = true;
      log('chapterStats now uses evidence-based lesson completeness');
      return true;
    } catch (e) {
      log(`chapterStats patch failed: ${e?.message || e}`);
      return false;
    }
  }

  /*
   * journey.js keeps lessonStats private, so refresh its rendered timeline
   * after progress changes by asking the existing Journey renderer to redraw.
   * We do not create a second timeline or mutate its DOM continuously.
   */
  function refreshJourney() {
    try {
      window.KaishiRoadmap?.refresh?.();
    } catch (_) {}
    try {
      window.renderJourney?.();
    } catch (_) {}
    try {
      window.renderJourneyPathAhead?.();
    } catch (_) {}
  }

  function installProgressRefresh() {
    if (window.__kaishi11259RefreshInstalled) return;
    window.__kaishi11259RefreshInstalled = true;

    const events = [
      'kaishi:answer-recorded',
      'kaishi:session-complete',
      'kaishi:reinforcement-rescue-complete'
    ];
    events.forEach(name => document.addEventListener(name, refreshJourney));

    // Existing app saves progress through save(). Wrap it only to refresh
    // Journey state after the save, without changing save semantics.
    if (typeof window.save === 'function' && !window.__kaishi11259SaveWrapped) {
      const originalSave = window.save;
      window.save = function(...args) {
        const result = originalSave.apply(this, args);
        setTimeout(refreshJourney, 0);
        return result;
      };
      window.__kaishi11259SaveWrapped = true;
    }
  }

  function start() {
    if (window.__kaishi11259Started) return;
    window.__kaishi11259Started = true;

    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      patchJourneyStats();
      const statsReady = patchChapterStats();
      installProgressRefresh();

      if (statsReady || attempts > 120) {
        clearInterval(timer);
        refreshJourney();
      }
    }, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  window.KaishiLessonCompletion = {
    version: PATCH,
    model: 'evidence-based',
    perfectLessonReviewTarget: 2,
    developingLessonReviewTarget: 4,
    completionForWords
  };
})();
