'use strict';

/*
 * Kaishi Quest v11.25.12
 *
 * Built against the repository's existing 11.25.7 activity/checkpoint patch.
 *
 * Changes:
 *  - One lesson activity registry is the source of truth for lesson scheduling
 *    and roadmap signalling.
 *  - Listening remains routine and is never the roadmap headline.
 *  - Picture Matching is a genuine lesson activity when eligible.
 *  - Kanji Gate is NOT advertised unless a real lesson adapter exists.
 *  - Sentence Understanding and Audio Reflex Match are registered as lesson
 *    activity candidates only when their real adapters are present. They are
 *    never fabricated as unsupported skill cards.
 *  - The old Lesson 5 milestone is removed.
 *  - The existing fifth-card checkpoint is a silent automatic save with a
 *    short "Saving progress" bubble.
 *
 * Important: this patch does not replace next() and does not use eval to
 * rewrite next(). It only intercepts the existing checkpoint dialog and
 * patches the existing makeSession scheduler in the same way the repository's
 * 11.25.7 patch does.
 */
(() => {
  const PATCH = '11.25.12';
  const log = message => {
    try { window.kaishiLog?.('patch', `[${PATCH}] ${message}`); } catch (_) {}
  };

  const sceneAvailable = word => {
    try {
      return Boolean(
        word &&
        typeof memoryScenes === 'object' &&
        memoryScenes[sceneKey(word)]?.file
      );
    } catch (_) { return false; }
  };

  const audioAvailable = word => Boolean(word?.wordAudio);

  const adapterAvailable = id => {
    try {
      const a = window.KaishiLessonActivities;
      if (!a) return false;
      if (id === 'sentence-understanding') {
        return typeof a.sentenceUnderstanding === 'function';
      }
      if (id === 'audio-reflex') {
        return typeof a.audioReflex === 'function';
      }
      if (id === 'kanji-gate') {
        return typeof a.kanjiGate === 'function';
      }
    } catch (_) {}
    return false;
  };

  /*
   * Single activity policy.
   *
   * `core` means the lesson scheduler is allowed to insert it.
   * `roadmap` means it is distinctive enough to headline the roadmap.
   */
  const ACTIVITY_RULES = [
    {
      id: 'picture',
      icon: '🌄',
      label: 'Picture Matching',
      unlockWords: 5,
      core: true,
      roadmap: true,
      cadence: 1,
      eligible: words => words.some(sceneAvailable),
      note: 'uses mnemonic scene art from this lesson'
    },
    {
      id: 'sentence-understanding',
      icon: '📝',
      label: 'Sentence Understanding',
      unlockWords: 5,
      core: true,
      roadmap: true,
      cadence: 2,
      eligible: words =>
        words.length > 0 && adapterAvailable('sentence-understanding'),
      note: 'uses the real Sentence Understanding lesson adapter'
    },
    {
      id: 'audio-reflex',
      icon: '🔊',
      label: 'Audio Reflex Match',
      unlockWords: 8,
      core: true,
      roadmap: true,
      cadence: 3,
      eligible: words =>
        words.some(audioAvailable) && adapterAvailable('audio-reflex'),
      note: 'uses the real Audio Reflex lesson adapter'
    },
    {
      id: 'listening',
      icon: '🎧',
      label: 'Listening',
      unlockWords: 8,
      core: true,
      roadmap: false,
      cadence: 1,
      eligible: words => words.some(audioAvailable),
      note: 'routine listening reinforcement'
    },
    {
      id: 'karuta',
      icon: '🎴',
      label: 'Karuta Challenge',
      unlockWords: 12,
      core: false,
      roadmap: true,
      eligible: words =>
        words.some(word => audioAvailable(word) && sceneAvailable(word)),
      note: 'optional immersive side quest'
    },
    {
      id: 'theatre',
      icon: '🎭',
      label: 'Theatre',
      unlockWords: 12,
      core: false,
      roadmap: true,
      eligible: () => true,
      note: 'optional immersive side quest'
    },
    {
      id: 'manga',
      icon: '📖',
      label: 'Manga Stories',
      unlockWords: 25,
      core: false,
      roadmap: true,
      eligible: () => true,
      note: 'optional immersive side quest'
    },
    {
      id: 'battle',
      icon: '⚔️',
      label: 'SRS Battle',
      unlockWords: 20,
      core: false,
      roadmap: false,
      eligible: () => true,
      note: 'separate Journey key event; not a lesson activity'
    },
    {
      id: 'kanji-gate',
      icon: '漢',
      label: 'Kanji Gate',
      unlockWords: 1,
      core: true,
      roadmap: true,
      cadence: 1,
      eligible: words =>
        words.some(word => {
          try {
            return typeof kanjiCharacters === 'function' &&
              kanjiCharacters(word).length > 0;
          } catch (_) { return false; }
        }) && adapterAvailable('kanji-gate'),
      note: 'only shown when a real Kanji Gate lesson adapter exists'
    }
  ];

  const ruleFor = id =>
    ACTIVITY_RULES.find(rule => rule.id === id) || null;

  const introducedCountAtChapter = (chapterIndex, currentChapterIndex) => {
    const base =
      Math.max(0, Number(vocab?.filter?.(wordIntroduced)?.length || 0));
    const currentWords =
      typeof chapterWords === 'function'
        ? chapterWords(currentChapterIndex).length
        : 3;
    const futureOffset =
      Math.max(0, chapterIndex - currentChapterIndex);
    return base + futureOffset * currentWords;
  };

  const scheduleForLesson = (
    chapterIndex,
    currentChapterIndex,
    words,
    opts = {}
  ) => {
    const introduced =
      opts.introduced ??
      introducedCountAtChapter(chapterIndex, currentChapterIndex);

    const result = {
      chapterIndex,
      lessonNumber: chapterIndex + 1,
      core: [],
      sideQuests: [],
      available: []
    };

    ACTIVITY_RULES.forEach(rule => {
      if (introduced < rule.unlockWords) return;
      if (!rule.eligible(words)) return;

      result.available.push(rule.id);

      if (rule.core) {
        const cadence = Math.max(1, Number(rule.cadence || 1));
        const relative = chapterIndex - (currentChapterIndex + 1);

        if (relative % cadence === 0 || opts.forceFirst) {
          result.core.push(rule.id);
        }
      } else {
        result.sideQuests.push(rule.id);
      }
    });

    /*
     * Keep lessons focused: one distinctive immersive activity plus the
     * routine Listening activity. Do not allow Kanji Gate/unsupported
     * candidates to displace real activities.
     */
    const distinctive = result.core.filter(id => {
      const rule = ruleFor(id);
      return rule?.roadmap;
    });

    if (distinctive.length > 1) {
      const keep = distinctive[0];
      result.core = result.core.filter(id =>
        id === 'listening' || id === keep
      );
    }

    return result;
  };

  /*
   * Lesson card insertion.
   *
   * We only inject activity cards whose renderer is known to exist:
   * picture/listening are already supported by the repository's lesson
   * renderer. New immersive adapters opt in through KaishiLessonActivities.
   */
  const buildActivityCard = (id, words) => {
    const rule = ruleFor(id);
    if (!rule) return null;

    const target =
      words.find(word =>
        id === 'picture' ? sceneAvailable(word) :
        id === 'listening' ? audioAvailable(word) :
        audioAvailable(word) || sceneAvailable(word)
      ) || words[0];

    if (!target) return null;

    if (id === 'picture') {
      return {
        v: target,
        skill: 'picture',
        pictureMode: 'picture-word',
        activityScheduleId: id
      };
    }

    if (id === 'listening') {
      return {
        v: target,
        skill: 'listening',
        activityScheduleId: id
      };
    }

    try {
      const adapter = window.KaishiLessonActivities;
      if (id === 'sentence-understanding' &&
          typeof adapter?.sentenceUnderstanding === 'function') {
        return adapter.sentenceUnderstanding(target, words);
      }

      if (id === 'audio-reflex' &&
          typeof adapter?.audioReflex === 'function') {
        return adapter.audioReflex(target, words);
      }

      if (id === 'kanji-gate' &&
          typeof adapter?.kanjiGate === 'function') {
        return adapter.kanjiGate(target, words);
      }
    } catch (error) {
      log(`${id} adapter failed: ${error?.message || error}`);
    }

    return null;
  };

  const patchMakeSession = () => {
    if (window.__kaishi112512MakeSessionPatched) return true;
    if (typeof window.makeSession !== 'function') return false;

    const original = window.makeSession;
    const source = Function.prototype.toString.call(original);

    const marker =
      'clearMissionResume();index=0;current=null;showJourneySessionPreview';

    if (!source.includes(marker)) {
      log('makeSession marker not found');
      return false;
    }

    /*
     * Do not add unsupported skills. The real adapter must return a complete
     * renderer-compatible card object.
     */
    const injection = `
      (() => {
        try {
          const chapter = chapterMode ? chapterIndex : currentWordChapterIndex();
          const lessonWords = typeof chapterWords === 'function'
            ? chapterWords(chapter)
            : [];

          const introduced =
            Number(vocab?.filter?.(wordIntroduced)?.length || 0);

          const activitySchedule =
            window.KaishiActivitySchedule?.scheduleForLesson?.(
              chapter,
              currentWordChapterIndex(),
              lessonWords,
              { introduced, forceFirst: true }
            );

          if (activitySchedule) {
            const existing = new Set(session.map(item => item?.activityScheduleId || item?.skill));
            const additions = [];

            /*
             * Prefer one distinctive activity. Listening may still be added
             * when it is not already present.
             */
            for (const activityId of activitySchedule.core) {
              if (existing.has(activityId)) continue;
              const card = window.KaishiActivitySchedule?.buildCard?.(
                activityId,
                lessonWords
              );
              if (card) additions.push(card);
            }

            additions.forEach(item => {
              const limit =
                typeof MISSION_CARD_LIMIT === 'number'
                  ? MISSION_CARD_LIMIT
                  : 15;

              if (session.length >= limit) session.pop();

              const position = Math.min(
                session.length,
                Math.max(0, Math.floor(session.length * .65))
              );

              session.splice(position, 0, item);
            });
          }
        } catch (error) {
          try {
            window.kaishiLog?.(
              'patch',
              '[11.25.12] activity injection failed: ' +
              (error?.message || error)
            );
          } catch (_) {}
        }
      })();
    ${marker}`;

    const patchedSource = source.replace(marker, injection);

    try {
      const patched = (0, eval)(`(${patchedSource})`);
      window.makeSession = patched;
      window.__kaishi112512MakeSessionPatched = true;
      log('makeSession patched');
      return true;
    } catch (error) {
      log(`makeSession patch failed: ${error?.message || error}`);
      return false;
    }
  };

  /*
   * Roadmap consumes the same scheduleForLesson() used by lesson injection.
   * It does not infer activities merely from assets.
   */
  const patchRoadmap = () => {
    const roadmap = window.KaishiRoadmap;
    if (!roadmap || roadmap.__kaishi112512Patched) return false;

    const originalGet = roadmap.get;

    const build = () => {
      try {
        const current =
          Math.max(0, Number(currentWordChapterIndex?.() || 0));
        const total =
          Math.max(1, Number(wordChapterCount?.() || 1));
        const horizon = 10;
        const lessons = [];
        let previousTopicId = null;

        for (
          let chapter = current + 1;
          chapter < Math.min(total, current + 1 + horizon);
          chapter++
        ) {
          const words = chapterWords(chapter);
          if (!words.length) break;

          const introduced =
            introducedCountAtChapter(chapter, current);

          const schedule =
            scheduleForLesson(chapter, current, words, { introduced });

          const topic =
            words[0] ? topicForWord(words[0]) : null;

          const stats = chapterStats(chapter);
          let event = null;

          /*
           * First priority is a real scheduled distinctive lesson activity.
           * Listening is deliberately excluded.
           */
          const distinctive =
            schedule.core.find(id => ruleFor(id)?.roadmap);

          if (distinctive) {
            const rule = ruleFor(distinctive);
            event = {
              type: 'activity',
              id: distinctive,
              icon: rule.icon,
              label: rule.label,
              selectionBased: false,
              estimated: false,
              source: 'lesson-scheduler'
            };
          } else if (schedule.sideQuests.length) {
            /*
             * Side quests are secondary roadmap items only. They are never
             * represented as if they were part of the lesson.
             */
            const id =
              schedule.sideQuests.find(candidate =>
                ruleFor(candidate)?.roadmap
              );

            if (id) {
              const rule = ruleFor(id);
              event = {
                type: 'sideQuest',
                id,
                icon: rule.icon,
                label: rule.label,
                selectionBased: true,
                estimated: true,
                note: rule.note,
                source: 'side-quest'
              };
            }
          } else if (
            topic &&
            previousTopicId !== null &&
            topic.id !== previousTopicId
          ) {
            event = {
              type: 'topic',
              id: topic.id,
              icon: topic.icon || '🗺️',
              label: topic.title,
              selectionBased: false,
              estimated: false,
              source: 'topic'
            };
          }

          lessons.push({
            lessonNumber: chapter + 1,
            chapterIndex: chapter,
            topicId: topic?.id || null,
            topicTitle: topic?.title || null,
            topicIcon: topic?.icon || null,
            wordCount: words.length,
            wordMeanings:
              words.slice(0, 2).map(w => w.meaning).filter(Boolean),
            completed: Boolean(stats?.complete),
            coreActivities: schedule.core,
            sideQuests: schedule.sideQuests,
            contentActivities:
              schedule.available.map(id => {
                const rule = ruleFor(id);
                return {
                  id,
                  icon: rule?.icon || '✨',
                  label: rule?.label || id,
                  eligible: true,
                  core: rule?.core === true,
                  roadmapHighlight: rule?.roadmap === true,
                  reason: rule?.note || ''
                };
              }),
            event
          });

          if (topic) previousTopicId = topic.id;
        }

        return {
          schemaVersion: 3,
          horizon,
          currentLesson: current,
          totalLessons: total,
          lessons,
          events: lessons
            .filter(lesson => lesson.event)
            .map(lesson => ({
              lessonNumber: lesson.lessonNumber,
              ...lesson.event
            })),
          generatedAt: Date.now()
        };
      } catch (error) {
        log(`roadmap build failed: ${error?.message || error}`);
        return null;
      }
    };

    roadmap.get = () =>
      roadmap.__kaishi112512Cache ||
      build() ||
      (typeof originalGet === 'function' ? originalGet() : null);

    roadmap.refresh = () => {
      const built = build();
      if (!built) {
        return typeof originalGet === 'function'
          ? originalGet()
          : null;
      }

      roadmap.__kaishi112512Cache = built;

      try {
        meta.journeyRoadmap = {
          schemaVersion: built.schemaVersion,
          horizon: built.horizon,
          currentLesson: built.currentLesson,
          totalLessons: built.totalLessons,
          events: built.events,
          generatedAt: built.generatedAt
        };
        save(false);
      } catch (_) {}

      try { window.renderJourneyPathAhead?.(); } catch (_) {}
      return built;
    };

    roadmap.__kaishi112512Patched = true;
    roadmap.refresh();

    log('roadmap now uses lesson activity schedule');
    return true;
  };

  /*
   * Fifth-card checkpoint:
   * saveMissionResume() is already performed by the application's checkpoint
   * path before the dialog is requested. We therefore suppress only the
   * decision UI and give the learner a transient confirmation.
   */
  const savingBubble = () => {
    let bubble = document.getElementById('kaishiSavingProgress');

    if (!bubble) {
      bubble = document.createElement('div');
      bubble.id = 'kaishiSavingProgress';
      bubble.setAttribute('role', 'status');
      bubble.setAttribute('aria-live', 'polite');
      Object.assign(bubble.style, {
        position: 'fixed',
        left: '50%',
        bottom: '24px',
        transform: 'translateX(-50%)',
        zIndex: '2147483647',
        padding: '10px 16px',
        borderRadius: '999px',
        background: 'rgba(15,23,42,.94)',
        color: '#fff',
        font: '600 14px system-ui,sans-serif',
        boxShadow: '0 8px 30px rgba(0,0,0,.22)',
        opacity: '0',
        transition: 'opacity .18s ease',
        pointerEvents: 'none'
      });
      document.body.appendChild(bubble);
    }

    bubble.textContent = 'Saving progress';
    bubble.style.opacity = '1';
    clearTimeout(bubble.__timer);
    bubble.__timer = setTimeout(() => {
      bubble.style.opacity = '0';
    }, 1600);
  };

  const patchCheckpointDialog = () => {
    if (window.__kaishi112512CheckpointPatched) return true;
    if (!window.HTMLDialogElement?.prototype?.showModal) return false;

    const native = HTMLDialogElement.prototype.showModal;

    HTMLDialogElement.prototype.showModal = function(...args) {
      if (this.id === 'missionCheckpointDialog') {
        savingBubble();
        return;
      }
      return native.apply(this, args);
    };

    window.__kaishi112512CheckpointPatched = true;
    log('checkpoint dialog converted to silent save');
    return true;
  };

  const start = () => {
    if (window.__kaishi112512Started) return;
    window.__kaishi112512Started = true;

    /*
     * Expose the registry before patching makeSession so the injected code
     * resolves the same scheduler object.
     */
    window.KaishiActivitySchedule = {
      version: PATCH,
      rules: ACTIVITY_RULES,
      ruleFor,
      scheduleForLesson,
      buildCard: buildActivityCard
    };

    patchCheckpointDialog();

    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;

      const sessionPatched = patchMakeSession();
      patchRoadmap();

      if (
        sessionPatched &&
        window.KaishiRoadmap?.__kaishi112512Patched
      ) {
        clearInterval(timer);
      }

      if (attempts > 160) clearInterval(timer);
    }, 50);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  window.Kaishi112512 = {
    version: PATCH,
    checkpoint: 'automatic-save',
    roadmapSource: 'lesson-scheduler',
    immersiveActivities: [
      'picture',
      'sentence-understanding',
      'audio-reflex',
      'listening',
      'karuta',
      'theatre',
      'manga'
    ]
  };
})();
