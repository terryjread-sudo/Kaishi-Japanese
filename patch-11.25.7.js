'use strict';
/*
 * Kaishi Quest v11.25.7
 * Journey activity scheduling + automatic lesson checkpoint feedback.
 * Designed as a drop-in patch for v11.25.6.
 */
(() => {
  const PATCH = '11.25.7';
  const log = (message) => { try { window.kaishiLog?.('patch', `[${PATCH}] ${message}`); } catch (_) {} };

  function sceneAvailable(word) {
    try { return Boolean(word && typeof memoryScenes === 'object' && memoryScenes[sceneKey(word)]?.file); }
    catch (_) { return false; }
  }

  function introducedCountAtChapter(chapterIndex, currentChapterIndex) {
    const base = Math.max(0, Number(vocab?.filter?.(wordIntroduced)?.length || 0));
    const currentWords = typeof chapterWords === 'function' ? chapterWords(currentChapterIndex).length : 3;
    const futureOffset = Math.max(0, chapterIndex - currentChapterIndex);
    return base + futureOffset * currentWords;
  }

  /*
   * Single activity policy. The same registry is used by lesson scheduling
   * and the roadmap, so an activity cannot be advertised in a different
   * lesson from the one in which the lesson engine actually places it.
   *
   * Core integration is intentionally conservative: picture matching is a
   * lesson activity because it directly reinforces the lesson's words.
   * Full immersive experiences remain side quests unless a future activity
   * explicitly opts into core integration here.
   */
  const ACTIVITY_RULES = [
    {
      id: 'picture', icon: '🌄', label: 'Picture Matching', unlockWords: 5,
      core: true, cadence: 1,
      eligible: words => words.some(sceneAvailable),
      note: 'uses mnemonic scene art from this lesson',
    },
    {
      id: 'listening', icon: '🎧', label: 'Listening', unlockWords: 8,
      core: true, cadence: 1,
      eligible: words => words.some(word => Boolean(word?.wordAudio)),
      note: 'uses audio from this lesson',
    },
    {
      id: 'karuta', icon: '🎴', label: 'Karuta Challenge', unlockWords: 12,
      core: false,
      eligible: words => words.some(word => Boolean(word?.wordAudio) && sceneAvailable(word)),
      note: 'available as an optional immersive side quest',
    },
    {
      id: 'theatre', icon: '🎭', label: 'Theatre', unlockWords: 12,
      core: false,
      eligible: () => true,
      note: 'available as an optional immersive side quest',
    },
    {
      id: 'manga', icon: '📖', label: 'Manga Stories', unlockWords: 25,
      core: false,
      eligible: () => true,
      note: 'available as an optional immersive side quest',
    },
    {
      id: 'battle', icon: '⚔️', label: 'Kotoba Colosseum', unlockWords: 20,
      core: false,
      eligible: () => true,
      note: 'available as an optional immersive side quest',
    },
  ];

  function ruleFor(id) { return ACTIVITY_RULES.find(rule => rule.id === id) || null; }

  function scheduleForLesson(chapterIndex, currentChapterIndex, words, opts = {}) {
    const introduced = opts.introduced ?? introducedCountAtChapter(chapterIndex, currentChapterIndex);
    const result = { chapterIndex, lessonNumber: chapterIndex + 1, core: [], sideQuests: [], available: [] };
    ACTIVITY_RULES.forEach(rule => {
      if (introduced < rule.unlockWords) return;
      if (!rule.eligible(words)) return;
      result.available.push(rule.id);
      if (rule.core) {
        /* Core activities recur deterministically. */
        const cadence = Math.max(1, Number(rule.cadence || 1));
        if ((chapterIndex - (currentChapterIndex + 1)) % cadence === 0 || opts.forceFirst) result.core.push(rule.id);
      } else {
        result.sideQuests.push(rule.id);
      }
    });
    return result;
  }

  const CORE_INJECTION = `(() => {
    const chapter = chapterMode ? chapterIndex : currentWordChapterIndex();
    const lessonWords = typeof chapterWords === 'function' ? chapterWords(chapter) : [];
    const hasScene = word => { try { return Boolean(word && memoryScenes[sceneKey(word)]?.file); } catch (_) { return false; } };
    const hasAudio = word => Boolean(word?.wordAudio);
    const existing = new Set(session.map(item => item?.skill));
    const additions = [];
    if (lessonWords.some(hasScene) && !existing.has('picture') && vocab.filter(wordIntroduced).length >= 5) {
      const target = lessonWords.find(hasScene);
      if (target) additions.push({ v: target, skill: 'picture', pictureMode: 'picture-word', activityScheduleId: 'picture' });
    }
    if (lessonWords.some(hasAudio) && !existing.has('listening') && vocab.filter(wordIntroduced).length >= 8) {
      const target = lessonWords.find(hasAudio);
      if (target) additions.push({ v: target, skill: 'listening', activityScheduleId: 'listening' });
    }
    const limit = typeof MISSION_CARD_LIMIT === 'number' ? MISSION_CARD_LIMIT : 15;
    additions.forEach(item => {
      if (session.length >= limit) session.pop();
      const position = Math.min(session.length, Math.max(0, Math.floor(session.length * .65)));
      session.splice(position, 0, item);
    });
  })();${marker}`;

  /* Patch makeSession at runtime so the patch remains drop-in and doesn't
     duplicate the large single-file application. */
  function patchMakeSession() {
    if (window.__kaishi11257MakeSessionPatched || typeof window.makeSession !== 'function') return Boolean(window.__kaishi11257MakeSessionPatched);
    const original = window.makeSession;
    const source = Function.prototype.toString.call(original);
    const marker = 'clearMissionResume();index=0;current=null;showJourneySessionPreview';
    if (!source.includes(marker)) { log('makeSession marker not found; lesson scheduler not installed'); return false; }
    const injection = CORE_INJECTION;
    const patchedSource = source.replace(marker, injection);
    try {
      const patched = (0, eval)(`(${patchedSource})`);
      window.makeSession = patched;
      window.__kaishi11257MakeSessionPatched = true;
      log('makeSession patched');
      return true;
    } catch (error) {
      log(`makeSession patch failed: ${error?.message || error}`);
      return false;
    }
  }

  function patchRoadmap() {
    const roadmap = window.KaishiRoadmap;
    if (!roadmap || roadmap.__kaishi11257Patched || typeof roadmap.refresh !== 'function') return false;
    const originalGet = roadmap.get;
    function build() {
      try {
        const current = Math.max(0, Number(currentWordChapterIndex?.() || 0));
        const total = Math.max(1, Number(wordChapterCount?.() || 1));
        const horizon = 10;
        const lessons = [];
        let previousTopicId = null;
        for (let chapter = current + 1; chapter < Math.min(total, current + 1 + horizon); chapter++) {
          const words = chapterWords(chapter);
          if (!words.length) break;
          const introduced = introducedCountAtChapter(chapter, current);
          const schedule = scheduleForLesson(chapter, current, words, { introduced });
          const topic = words[0] ? topicForWord(words[0]) : null;
          const stats = chapterStats(chapter);
          let event = null;
          if (schedule.core.length) {
            const id = schedule.core[0], rule = ruleFor(id);
            event = { type: 'activity', id, icon: rule.icon, label: rule.label, selectionBased: false, estimated: false };
          } else if (schedule.sideQuests.length) {
            const id = schedule.sideQuests[0], rule = ruleFor(id);
            event = { type: 'sideQuest', id, icon: rule.icon, label: rule.label, selectionBased: true, estimated: true, note: rule.note };
          } else if (topic && previousTopicId !== null && topic.id !== previousTopicId) {
            event = { type: 'topic', id: topic.id, icon: topic.icon || '🗺️', label: topic.title, selectionBased: false, estimated: false };
          }
          lessons.push({
            lessonNumber: chapter + 1, chapterIndex: chapter,
            topicId: topic?.id || null, topicTitle: topic?.title || null, topicIcon: topic?.icon || null,
            wordCount: words.length, wordMeanings: words.slice(0, 2).map(w => w.meaning).filter(Boolean),
            completed: Boolean(stats?.complete), contentActivities: schedule.available.map(id => ({
              id, icon: ruleFor(id)?.icon || '✨', label: ruleFor(id)?.label || id,
              eligible: true, core: ruleFor(id)?.core === true, reason: ruleFor(id)?.note || ''
            })), event,
            coreActivities: schedule.core, sideQuests: schedule.sideQuests,
          });
          if (topic) previousTopicId = topic.id;
        }
        return { schemaVersion: 2, horizon, currentLesson: current, totalLessons: total, lessons,
          events: lessons.filter(l => l.event).map(l => ({ lessonNumber: l.lessonNumber, ...l.event })), generatedAt: Date.now() };
      } catch (error) {
        log(`roadmap build failed: ${error?.message || error}`);
        return null;
      }
    }
    roadmap.get = () => roadmap.__kaishi11257Cache || build() || (typeof originalGet === 'function' ? originalGet() : null);
    roadmap.refresh = () => {
      const built = build();
      if (!built) return typeof originalGet === 'function' ? originalGet() : null;
      roadmap.__kaishi11257Cache = built;
      try { meta.journeyRoadmap = { schemaVersion: built.schemaVersion, horizon: built.horizon, currentLesson: built.currentLesson, totalLessons: built.totalLessons, events: built.events, generatedAt: built.generatedAt }; save(false); } catch (_) {}
      try { window.renderJourneyPathAhead?.(); } catch (_) {}
      return built;
    };
    roadmap.__kaishi11257Patched = true;
    roadmap.refresh();
    log('roadmap scheduler patched');
    return true;
  }

  function savingBubble() {
    let bubble = document.getElementById('kaishiSavingProgress');
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.id = 'kaishiSavingProgress';
      bubble.setAttribute('role', 'status');
      bubble.setAttribute('aria-live', 'polite');
      bubble.textContent = 'Saving progress';
      Object.assign(bubble.style, {
        position:'fixed', left:'50%', bottom:'24px', transform:'translateX(-50%)',
        zIndex:'2147483647', padding:'10px 16px', borderRadius:'999px',
        background:'rgba(15,23,42,.94)', color:'#fff', font:'600 14px system-ui,sans-serif',
        boxShadow:'0 8px 30px rgba(0,0,0,.22)', opacity:'0', transition:'opacity .18s ease',
        pointerEvents:'none'
      });
      document.body.appendChild(bubble);
    }
    bubble.textContent = 'Saving progress';
    bubble.style.opacity = '1';
    clearTimeout(bubble.__timer);
    bubble.__timer = setTimeout(() => { bubble.style.opacity = '0'; }, 1600);
  }

  function patchCheckpointDialog() {
    if (window.__kaishi11257CheckpointPatched) return true;
    if (!window.HTMLDialogElement?.prototype?.showModal) return false;
    const native = HTMLDialogElement.prototype.showModal;
    HTMLDialogElement.prototype.showModal = function(...args) {
      if (this.id === 'missionCheckpointDialog') {
        try { savingBubble(); } catch (_) {}
        /* saveMissionResume() has already run in next() immediately before
           this dialog is requested, so suppressing the dialog is safe. */
        return;
      }
      return native.apply(this, args);
    };
    window.__kaishi11257CheckpointPatched = true;
    return true;
  }

  function start() {
    if (window.__kaishi11257Started) return;
    window.__kaishi11257Started = true;
    patchCheckpointDialog();
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      const made = patchMakeSession();
      patchRoadmap();
      if ((made && window.KaishiRoadmap?.__kaishi11257Patched) || attempts > 120) clearInterval(timer);
    }, 50);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.KaishiActivitySchedule = {
    version: PATCH,
    rules: ACTIVITY_RULES,
    scheduleForLesson,
    ruleFor,
  };
})();
