'use strict';

/*
 * Kaishi Quest — Road Ahead
 * v11.23.0
 *
 * Additive layer for the stable v11.22 Journey.
 * Does not replace or re-render the Journey timeline.
 * Does not use MutationObserver or DOM polling.
 *
 * Purpose:
 *   Show a compact indicator below the visible Journey telling the
 *   learner how many lessons remain until the next meaningful event.
 */

(() => {
  const ID = 'kqRoadAhead';
  const STYLE_ID = 'kqRoadAheadStyles';

  const $ = (s, root = document) => root.querySelector(s);

  const safeJSON = (key) => {
    try {
      const storageKey =
        typeof profileStorageKey === 'function'
          ? profileStorageKey(key)
          : key;
      return JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch (_) {
      return {};
    }
  };

  const route = () => {
    const r = safeJSON('kq-meta').dailyJourneyRoute;
    return r && Array.isArray(r.steps) ? r : {steps: [], completed: []};
  };

  const completedSet = () => new Set(
    Array.isArray(route().completed) ? route().completed : []
  );

  const chapterNumber = (id) => {
    const m = String(id || '').match(/(?:lesson|chapter)[-_](\d+)/i);
    return m ? Number(m[1]) : null;
  };

  const lessonCount = () => {
    try {
      if (typeof wordChapterCount === 'function') {
        const n = Number(wordChapterCount());
        if (n > 0) return n;
      }
    } catch (_) {}
    try {
      const size = 3;
      return Math.ceil((Array.isArray(vocab) ? vocab.length : 0) / size);
    } catch (_) {
      return 0;
    }
  };

  const currentLesson = () => {
    const r = route();
    const done = completedSet();

    const currentStep = r.steps.find(step =>
      step &&
      step.kind === 'chapter' &&
      !step.retryOf &&
      !done.has(step.id)
    );

    const fromRoute = chapterNumber(currentStep?.id);
    if (fromRoute != null) return Math.max(0, fromRoute);

    try {
      const progressKey =
        typeof profileStorageKey === 'function'
          ? profileStorageKey('kq-progress')
          : 'kq-progress';
      const progress = JSON.parse(localStorage.getItem(progressKey) || '{}');

      const count = lessonCount();
      for (let chapter = 0; chapter < count; chapter++) {
        const words = typeof chapterWords === 'function'
          ? chapterWords(chapter)
          : (Array.isArray(vocab) ? vocab.slice(chapter * 3, chapter * 3 + 3) : []);

        if (!words.length) break;

        const started = words.every(word => {
          const p = progress[word?.id];
          return p && (Number(p.stage || 0) > 0 || Number(p.reps || 0) > 0);
        });

        if (!started) return chapter;
      }
      return Math.max(0, count - 1);
    } catch (_) {
      return 0;
    }
  };

  const eventLabel = (step) => {
    const title = String(step?.title || '').trim();
    const id = String(step?.id || '').toLowerCase();

    if (/manga/.test(id + ' ' + title.toLowerCase())) return 'Manga Challenge';
    if (/conversation/.test(id + ' ' + title.toLowerCase())) return 'Conversation';
    if (/theatre|theater/.test(id + ' ' + title.toLowerCase())) return 'Theatre';
    if (/karuta/.test(id + ' ' + title.toLowerCase())) return 'Karuta Challenge';
    if (/battle|boss/.test(id + ' ' + title.toLowerCase())) return 'Battle Challenge';
    if (/mastery/.test(id + ' ' + title.toLowerCase())) return 'Mastery Challenge';
    if (/milestone/.test(id + ' ' + title.toLowerCase())) return title || 'Milestone';
    if (/challenge/.test(id + ' ' + title.toLowerCase())) return title || 'Challenge';

    return title || 'Special activity';
  };

  const findNextEvent = () => {
    const r = route();
    const done = completedSet();
    const current = currentLesson();
    const total = lessonCount();

    const candidates = r.steps
      .map((step, index) => ({step, index}))
      .filter(({step}) => {
        if (!step || done.has(step.id)) return false;
        if (step.kind === 'chapter') return false;

        const ch = chapterNumber(step?.id);
        const target = chapterNumber(step?.sideQuestFor || step?.retryOf);

        const lesson = ch != null ? ch : target;
        return lesson == null || lesson > current;
      })
      .map(({step}) => {
        const ch = chapterNumber(step?.id);
        const target = chapterNumber(step?.sideQuestFor || step?.retryOf);
        return {
          step,
          lesson: ch != null ? ch : target
        };
      })
      .filter(item => item.lesson == null || item.lesson >= current)
      .sort((a,b) => {
        const al = a.lesson == null ? Number.MAX_SAFE_INTEGER : a.lesson;
        const bl = b.lesson == null ? Number.MAX_SAFE_INTEGER : b.lesson;
        return al - bl;
      });

    if (candidates.length) {
      const candidate = candidates[0];
      const lesson = candidate.lesson;

      if (lesson != null) {
        return {
          lessons: Math.max(0, lesson - current),
          label: eventLabel(candidate.step),
          icon: candidate.step.icon || '✨'
        };
      }

      return {
        lessons: 1,
        label: eventLabel(candidate.step),
        icon: candidate.step.icon || '✨'
      };
    }

    // No explicit special event: use the next topic boundary when available.
    if (total > 1 && current < total - 1) {
      try {
        if (typeof chapterWords === 'function' && typeof topicForWord === 'function') {
          const currentWords = chapterWords(current) || [];
          const currentTopic = currentWords[0] ? topicForWord(currentWords[0]) : null;

          for (let n = current + 1; n < total; n++) {
            const words = chapterWords(n) || [];
            const topic = words[0] ? topicForWord(words[0]) : null;
            if (topic?.title && topic.title !== currentTopic?.title) {
              return {
                lessons: n - current,
                label: `New topic: ${topic.title}`,
                icon: topic.icon || '🌸'
              };
            }
          }
        }
      } catch (_) {}
    }

    // Last-resort checkpoint so the learner still sees a meaningful goal.
    if (total > 1) {
      const target = Math.min(total - 1, current + 5);
      if (target > current) {
        return {
          lessons: target - current,
          label: 'Progress checkpoint',
          icon: '🎯'
        };
      }
    }

    return null;
  };

  const addStyles = () => {
    if ($( '#' + STYLE_ID )) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ID} {
        margin: 2px 4px 20px;
        padding: 14px 15px;
        border: 1px solid rgba(0,0,0,.10);
        border-radius: 18px;
        background: var(--card-bg,#fff);
        box-shadow: 0 3px 10px rgba(0,0,0,.05);
        display:flex;
        align-items:center;
        gap:12px;
      }
      #${ID} .kq-ra-icon {
        flex:0 0 42px;
        width:42px;
        height:42px;
        border-radius:50%;
        display:grid;
        place-items:center;
        background:rgba(234,179,8,.10);
        font-size:1.15rem;
      }
      #${ID} .kq-ra-copy {
        min-width:0;
        flex:1;
      }
      #${ID} .kq-ra-eyebrow {
        margin:0 0 2px;
        font-size:.72rem;
        font-weight:800;
        letter-spacing:.05em;
        text-transform:uppercase;
        opacity:.65;
      }
      #${ID} .kq-ra-title {
        margin:0;
        font-weight:850;
        line-height:1.25;
      }
      #${ID} .kq-ra-detail {
        margin:3px 0 0;
        font-size:.86rem;
        opacity:.72;
      }
      #${ID} .kq-ra-count {
        flex:0 0 auto;
        padding:7px 10px;
        border-radius:999px;
        background:rgba(37,99,235,.08);
        font-weight:850;
        font-size:.78rem;
        white-space:nowrap;
      }
      @media(max-width:480px) {
        #${ID} { align-items:flex-start; }
        #${ID} .kq-ra-count { margin-left:auto; }
      }
    `;
    document.head.appendChild(style);
  };

  const render = () => {
    const journey = $('#journey');
    if (!journey) return;

    const host =
      $('#journeyHistoryTimeline', journey) ||
      $('#journeyHistoryTrack', journey);

    if (!host) return;

    const next = findNextEvent();

    let card = $('#' + ID, journey);

    if (!next) {
      if (card) card.remove();
      return;
    }

    addStyles();

    if (!card) {
      card = document.createElement('section');
      card.id = ID;
      card.setAttribute('aria-label', 'What is ahead on your Journey');
      host.parentNode.insertBefore(card, host.nextSibling);
    }

    const count = next.lessons === 1
      ? '1 lesson'
      : `${next.lessons} lessons`;

    card.innerHTML = `
      <div class="kq-ra-icon" aria-hidden="true">${next.icon}</div>
      <div class="kq-ra-copy">
        <p class="kq-ra-eyebrow">What’s ahead</p>
        <p class="kq-ra-title">${escapeHTML(next.label)}</p>
        <p class="kq-ra-detail">Keep going to unlock your next milestone.</p>
      </div>
      <div class="kq-ra-count">${count}</div>
    `;
  };

  const escapeHTML = (value) =>
    String(value ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));

  const scheduleAfterNavigation = () => {
    requestAnimationFrame(() => requestAnimationFrame(render));
  };

  const install = () => {
    if (document.documentElement.dataset.kqRoadAheadInstalled === '1') return;
    document.documentElement.dataset.kqRoadAheadInstalled = '1';

    addStyles();

    // Render once when the Journey is available.
    scheduleAfterNavigation();

    // Re-render after normal navigation clicks without observing the DOM.
    document.addEventListener('click', (event) => {
      const target = event.target?.closest?.(
        '#continueJourney, [data-screen="journey"], [data-target="journey"], .journey-nav, #journey button'
      );
      if (target) scheduleAfterNavigation();
    }, {passive:true});

    // If the app exposes showScreen, wrap it once so programmatic navigation
    // back to Journey also refreshes the indicator.
    try {
      if (typeof window.showScreen === 'function' && !window.showScreen.__kqRoadAheadWrapped) {
        const original = window.showScreen;
        const wrapped = function(...args) {
          const result = original.apply(this, args);
          if (String(args[0] || '').toLowerCase() === 'journey') {
            scheduleAfterNavigation();
          }
          return result;
        };
        wrapped.__kqRoadAheadWrapped = true;
        wrapped.__kqRoadAheadOriginal = original;
        window.showScreen = wrapped;
      }
    } catch (_) {}
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, {once:true});
  } else {
    install();
  }
})();
