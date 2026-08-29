'use strict';

/*
 * Kaishi Quest — Unified Journey
 * v11.20.0
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
        future
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
              chapter,
              icon: step.icon || '⚔️',
              title: step.title || 'Side Quest',
              detail: step.detail || 'Extra practice on your Journey.',
              done: completed.has(step.id),
              current: chapter === current && !completed.has(step.id),
              future,
              required: Boolean(step.required)
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
      }

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

  function launchCurrentLesson() {
    try {
      if (typeof resumeSavedMission === 'function' && resumeSavedMission()) return true;
    } catch (_) {}

    try {
      const topic = typeof currentTopic === 'function' ? currentTopic() : null;
      if (topic && typeof startTopicSession === 'function') {
        startTopicSession(topic.id);
        return true;
      }
    } catch (_) {}

    try {
      const legacyButton = $('#startNextMission');
      if (legacyButton) {
        legacyButton.click();
        return true;
      }
    } catch (_) {}

    return false;
  }

  function retryLesson(chapter) {
    const words = lessonWords(chapter).filter(Boolean);
    const ids = words.map(word => word?.id).filter(Boolean);
    if (!ids.length) return false;

    try {
      activityReturnScreen = 'journey';
      if (typeof makeTargetedMasterySession === 'function') {
        makeTargetedMasterySession(ids, 'meaning');
        return true;
      }
    } catch (_) {}

    return false;
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
    `;
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
      <p><b>Why it’s next:</b> it builds on the Japanese you have already met.</p>
    `;
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
            Retry lesson
          </button>
        </div>
        <div class="kq-unified-expand"
             data-kq-details="${item.chapter}"
             hidden></div>
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
        </div>
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
            Retry lesson
          </button>
        </div>
      `;
    }

    return `
      <article class="${classes}" data-kq-id="${esc(item.id)}">
        <div class="kq-unified-marker">${item.done ? '✓' : esc(item.icon || '•')}</div>
        <div class="kq-unified-card">
          <span class="kq-unified-label">${label}</span>
          <strong class="kq-unified-title">${esc(item.title)}</strong>
          <p class="kq-unified-detail">${esc(item.detail)}</p>
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

    let previousChapter = null;
    let markup = '<div class="kq-unified-timeline">';

    data.forEach(item => {
      if (
        item.type === 'past' &&
        item.chapter !== previousChapter &&
        item.chapter > 0 &&
        (item.chapter + 1) % 5 === 0
      ) {
        markup += `
          <div class="kq-milestone" data-kq-milestone="milestone-${item.chapter}">
            <div style="font-size:1.6rem">🏆</div>
            <div>
              <strong>Milestone · Lesson ${item.chapter + 1}</strong>
              <small>Chapter checkpoint reached.</small>
            </div>
          </div>
        `;
      }

      markup += nodeHTML(item);
      previousChapter = item.chapter;
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
    if (!track || track.dataset.kqUnifiedBound === '1') return;

    track.dataset.kqUnifiedBound = '1';

    track.addEventListener('scroll', () => {
      track.dataset.kqUserScrolled = '1';
    }, {passive:true});

    track.addEventListener('click', event => {
      const button = event.target.closest?.('[data-kq-action]');
      if (!button) return;

      event.preventDefault();
      event.stopPropagation();

      const action = button.dataset.kqAction;
      const chapter = Number(button.dataset.kqChapter);
      if (!Number.isFinite(chapter)) return;

      if (action === 'continue') {
        launchCurrentLesson();
        return;
      }

      if (action === 'retry') {
        retryLesson(chapter);
        return;
      }

      if (action === 'results' || action === 'preview') {
        const details = track.querySelector(`[data-kq-details="${chapter}"]`);
        if (!details) return;

        const opening = details.hidden;

        if (opening) {
          details.innerHTML =
            action === 'results'
              ? resultsHTML(chapter)
              : previewHTML(chapter);
        }

        details.hidden = !opening;
        button.setAttribute('aria-expanded', String(opening));
      }
    });
  }

  function renderAfterNavigation() {
    requestAnimationFrame(() => requestAnimationFrame(render));
  }

  function init() {
    addStyles();
    bind();

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
