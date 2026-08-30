'use strict';

/*
 * Kaishi Quest — Road Ahead
 * v11.24.0
 *
 * Rolling-horizon indicator.
 * Keeps a logical 10-lesson planning horizon without creating a second
 * Journey renderer. Special events are only advertised when they exist
 * in the route/step data within that horizon.
 */

(() => {
  const ID = 'kqRoadAhead';
  const STYLE_ID = 'kqRoadAheadStyles';
  const HORIZON = 10;

  const $ = (s, root = document) => root.querySelector(s);

  const safeJSON = (key) => {
    try {
      const storageKey = typeof profileStorageKey === 'function'
        ? profileStorageKey(key) : key;
      return JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch (_) { return {}; }
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
      return Math.ceil((Array.isArray(vocab) ? vocab.length : 0) / 3);
    } catch (_) { return 0; }
  };

  const currentLesson = () => {
    const r = route();
    const done = completedSet();
    const current = r.steps.find(s =>
      s && s.kind === 'chapter' && !s.retryOf && !done.has(s.id)
    );
    const n = chapterNumber(current?.id);
    if (n != null) return Math.max(0, n);

    try {
      const key = typeof profileStorageKey === 'function'
        ? profileStorageKey('kq-progress') : 'kq-progress';
      const progress = JSON.parse(localStorage.getItem(key) || '{}');
      const total = lessonCount();

      for (let chapter = 0; chapter < total; chapter++) {
        const words = typeof chapterWords === 'function'
          ? (chapterWords(chapter) || [])
          : (Array.isArray(vocab) ? vocab.slice(chapter * 3, chapter * 3 + 3) : []);
        if (!words.length) break;

        const started = words.every(word => {
          const p = progress[word?.id];
          return p && (Number(p.stage || 0) > 0 || Number(p.reps || 0) > 0);
        });
        if (!started) return chapter;
      }
      return Math.max(0, total - 1);
    } catch (_) { return 0; }
  };

  const labelFor = (step) => {
    const title = String(step?.title || '').trim();
    const text = `${step?.id || ''} ${title}`.toLowerCase();

    if (/manga/.test(text)) return 'Manga Challenge';
    if (/conversation/.test(text)) return 'Conversation';
    if (/theatre|theater/.test(text)) return 'Theatre';
    if (/karuta/.test(text)) return 'Karuta Challenge';
    if (/battle|boss/.test(text)) return 'Battle Challenge';
    if (/mastery/.test(text)) return 'Mastery Challenge';
    if (/milestone/.test(text)) return title || 'Milestone';
    if (/challenge/.test(text)) return title || 'Challenge';
    return title || 'Special activity';
  };

  const eventLesson = (step) => {
    const direct = chapterNumber(step?.id);
    if (direct != null) return direct;
    return chapterNumber(step?.sideQuestFor || step?.retryOf);
  };

  /*
   * The rolling horizon is measured in lesson positions, not DOM items.
   * This means side-quest/retry steps do not accidentally make the learner
   * appear farther ahead than they really are.
   */
  const findNextEvent = () => {
    const r = route();
    const done = completedSet();
    const current = currentLesson();
    const maxLesson = Math.min(lessonCount() - 1, current + HORIZON);

    const candidates = r.steps
      .filter(step => {
        if (!step || done.has(step.id) || step.kind === 'chapter') return false;
        const lesson = eventLesson(step);
        // An event must be anchored to a known future lesson to be advertised.
        return lesson != null && lesson > current && lesson <= maxLesson;
      })
      .map(step => ({
        step,
        lesson: eventLesson(step)
      }))
      .sort((a, b) => a.lesson - b.lesson);

    if (!candidates.length) return null;

    const next = candidates[0];
    return {
      lessons: next.lesson - current,
      label: labelFor(next.step),
      icon: next.step.icon || '✨'
    };
  };

  const nextLessonSummary = () => {
    const total = lessonCount();
    const current = currentLesson();
    const remaining = Math.max(0, total - 1 - current);
    if (!remaining) return null;
    return {
      lessons: Math.min(HORIZON, remaining),
      label: 'Learning path continues',
      icon: '🌱'
    };
  };

  const addStyles = () => {
    if ($('#' + STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ID}{margin:2px 4px 20px;padding:14px 15px;border:1px solid rgba(0,0,0,.10);
        border-radius:18px;background:var(--card-bg,#fff);box-shadow:0 3px 10px rgba(0,0,0,.05);
        display:flex;align-items:center;gap:12px}
      #${ID} .kq-ra-icon{flex:0 0 42px;width:42px;height:42px;border-radius:50%;
        display:grid;place-items:center;background:rgba(234,179,8,.10);font-size:1.15rem}
      #${ID} .kq-ra-copy{min-width:0;flex:1}
      #${ID} .kq-ra-eyebrow{margin:0 0 2px;font-size:.72rem;font-weight:800;
        letter-spacing:.05em;text-transform:uppercase;opacity:.65}
      #${ID} .kq-ra-title{margin:0;font-weight:850;line-height:1.25}
      #${ID} .kq-ra-detail{margin:3px 0 0;font-size:.86rem;opacity:.72}
      #${ID} .kq-ra-count{flex:0 0 auto;padding:7px 10px;border-radius:999px;
        background:rgba(37,99,235,.08);font-weight:850;font-size:.78rem;white-space:nowrap}
      @media(max-width:480px){#${ID}{align-items:flex-start}#${ID} .kq-ra-count{margin-left:auto}}
    `;
    document.head.appendChild(style);
  };

  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const render = () => {
    const journey = $('#journey');
    if (!journey) return;

    const host = $('#journeyHistoryTimeline', journey) ||
                 $('#journeyHistoryTrack', journey);
    if (!host) return;

    const next = findNextEvent() || nextLessonSummary();
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

    const count = next.lessons === 1 ? '1 lesson' : `${next.lessons} lessons`;
    const hasEvent = next.label !== 'Learning path continues';

    card.innerHTML = `
      <div class="kq-ra-icon" aria-hidden="true">${escapeHTML(next.icon)}</div>
      <div class="kq-ra-copy">
        <p class="kq-ra-eyebrow">What's ahead</p>
        <p class="kq-ra-title">${escapeHTML(next.label)}</p>
        <p class="kq-ra-detail">${
          hasEvent ? 'A special event is coming up.' : 'Your next lessons are already mapped out.'
        }</p>
      </div>
      <div class="kq-ra-count">${count}</div>
    `;
  };

  const schedule = () => requestAnimationFrame(() => requestAnimationFrame(render));

  const install = () => {
    if (document.documentElement.dataset.kqRoadAheadInstalled === '1') return;
    document.documentElement.dataset.kqRoadAheadInstalled = '1';
    addStyles();
    schedule();

    document.addEventListener('click', event => {
      const target = event.target?.closest?.(
        '#continueJourney,[data-screen="journey"],[data-target="journey"],.journey-nav,#journey button'
      );
      if (target) schedule();
    }, {passive:true});

    try {
      if (typeof window.showScreen === 'function' && !window.showScreen.__kqRoadAheadWrapped) {
        const original = window.showScreen;
        const wrapped = function(...args) {
          const result = original.apply(this, args);
          if (String(args[0] || '').toLowerCase() === 'journey') schedule();
          return result;
        };
        wrapped.__kqRoadAheadWrapped = true;
        window.showScreen = wrapped;
      }
    } catch (_) {}
  };

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();
