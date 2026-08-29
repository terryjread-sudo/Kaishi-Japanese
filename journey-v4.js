'use strict';
/*
  Kaishi Quest Journey 11.19.4
  SINGLE OWNER implementation.

  Important stability rule:
  - never load/use journey-v3.js
  - never observe the Journey DOM
  - never poll by rewriting the timeline
  - render only when the data signature actually changes

  This removes the feedback loop that caused flashing/disappearing controls.
*/
(() => {
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const wordsFor = c => {
    try { return typeof chapterWords === 'function' ? (chapterWords(c) || []) : []; }
    catch { return []; }
  };
  const chapterCount = () => {
    try { return Number(typeof wordChapterCount === 'function' ? wordChapterCount() : 0); }
    catch { return 0; }
  };
  const currentChapter = () => {
    try { return Number(typeof currentWordChapterIndex === 'function' ? currentWordChapterIndex() : 0); }
    catch { return 0; }
  };
  const statsFor = c => {
    try { return typeof chapterStats === 'function' ? (chapterStats(c) || {}) : {}; }
    catch { return {}; }
  };
  const topicFor = words => {
    try { return words[0] && typeof topicForWord === 'function' ? topicForWord(words[0]) : null; }
    catch { return null; }
  };
  const meta = () => {
    try {
      const key = typeof profileStorageKey === 'function' ? profileStorageKey('kq-meta') : 'kq-meta';
      return JSON.parse(localStorage.getItem(key) || '{}');
    } catch { return {}; }
  };
  const historyEntriesSafe = () => {
    try { return typeof historyEntries === 'function' ? (historyEntries() || []) : []; }
    catch { return []; }
  };
  const entryWords = e => {
    try { return typeof historyEntryWords === 'function' ? (historyEntryWords(e) || []) : []; }
    catch { return []; }
  };
  const entryAccuracy = e => {
    try { return typeof historyEntryAccuracy === 'function' ? historyEntryAccuracy(e) : null; }
    catch { return null; }
  };

  function historyFor(c) {
    const ids = new Set(wordsFor(c).map(w => w?.id).filter(Boolean));
    if (!ids.size) return null;
    let best = null, score = 0;
    for (const e of historyEntriesSafe()) {
      const s = entryWords(e).reduce((n, w) => n + (ids.has(w?.id) ? 1 : 0), 0);
      if (s > score || (s === score && s && Number(e.completedAt || 0) > Number(best?.completedAt || 0))) {
        best = e; score = s;
      }
    }
    return best;
  }

  function ensureHost() {
    let timeline = $('#journeyHistoryTimeline');
    if (!timeline) {
      const journey = $('#journey');
      if (!journey) return null;
      timeline = document.createElement('section');
      timeline.id = 'journeyHistoryTimeline';
      journey.appendChild(timeline);
    }
    let track = $('#journeyHistoryTrack');
    if (!track) {
      track = document.createElement('div');
      track.id = 'journeyHistoryTrack';
      timeline.appendChild(track);
    }
    return track;
  }

  function installStyles() {
    if ($('#kqJourneyStableStyles')) return;
    const style = document.createElement('style');
    style.id = 'kqJourneyStableStyles';
    style.textContent = `
      #journeyHistoryTimeline{margin-top:18px;overflow:hidden}
      #journeyHistoryTrack{position:relative;display:flex;flex-direction:column;gap:0;max-height:min(72vh,760px);overflow-y:auto;overflow-x:hidden;padding:28px 14px 36px 42px;overscroll-behavior:contain;scroll-behavior:auto;touch-action:pan-y}
      #journeyHistoryTrack::-webkit-scrollbar{width:9px}
      .kq-timeline-spine{position:absolute;left:30px;top:20px;bottom:28px;width:3px;border-radius:4px;background:#cbd5e1;pointer-events:none}
      .kq-timeline-item{position:relative;display:grid;grid-template-columns:54px minmax(0,1fr);gap:10px;min-height:96px;margin:0 0 18px;padding:0 4px 0 0}
      .kq-timeline-marker{position:relative;z-index:2;width:42px;height:42px;margin:4px auto 0;border-radius:50%;display:grid;place-items:center;background:var(--card-bg,#fff);border:3px solid #cbd5e1;box-shadow:0 3px 10px rgba(15,23,42,.08);font-weight:900}
      .kq-timeline-card{padding:14px;border:1px solid #e2e8f0;border-radius:16px;background:var(--card-bg,#fff);box-shadow:0 4px 12px rgba(15,23,42,.05)}
      .kq-timeline-card strong{display:block;font-size:1rem;margin:.15rem 0 .3rem}
      .kq-timeline-card p{margin:.25rem 0;color:#64748b;line-height:1.4}
      .kq-timeline-item.current .kq-timeline-marker{border-width:4px;transform:scale(1.08)}
      .kq-timeline-item.current .kq-timeline-card{border-width:2px;box-shadow:0 8px 22px rgba(15,23,42,.1)}
      .kq-timeline-item.done .kq-timeline-marker{background:#f0fdf4;border-color:#86efac}
      .kq-timeline-item.side-quest .kq-timeline-marker{background:#fff7ed;border-color:#fb923c}
      .kq-timeline-item.side-quest .kq-timeline-card{border-color:#fdba74}
      .kq-timeline-item.retry .kq-timeline-marker{background:#eff6ff;border-color:#93c5fd}
      .kq-timeline-item.future{opacity:.74}
      .kq-timeline-item.future .kq-timeline-marker{border-style:dashed}
      .kq-journey-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:12px}
      .kq-journey-actions button{font:inherit;cursor:pointer;padding:11px 16px;border-radius:13px;border:1px solid #cbd5e1;background:#fff;font-weight:800}
      .kq-journey-actions button.primary{background:#2563eb;color:#fff;border-color:#2563eb}
      .kq-journey-details{margin-top:12px;padding:13px;border-radius:13px;background:rgba(37,99,235,.055);border:1px solid rgba(37,99,235,.16)}
      .kq-journey-details[hidden]{display:none}
      .kq-detail-stats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
      .kq-detail-stats span{padding:6px 10px;border-radius:999px;background:rgba(37,99,235,.08);font-weight:800;font-size:.85rem}
      .kq-word-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .kq-word{display:flex;justify-content:space-between;gap:8px;padding:9px 10px;border-radius:10px;background:rgba(0,0,0,.04)}
      .kq-word small{opacity:.7;text-align:right}
      #journey .journey-utility-actions,#journey .journey-path-ahead,#bonsaiQuickStep{display:none!important}
      @media(min-width:760px){
        #journeyHistoryTrack{padding-left:42px;padding-right:18px}
        .kq-timeline-item{grid-template-columns:64px minmax(0,760px);justify-content:center}
        .kq-timeline-marker{width:46px;height:46px}
        .kq-timeline-spine{left:calc(50% - 380px + 26px)}
      }
      @media(max-width:560px){.kq-word-list{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function buildItems() {
    const total = chapterCount();
    const current = currentChapter();
    if (!total) return [];

    const from = Math.max(0, current - 3);
    const to = Math.min(total, current + 5);
    const r = meta().dailyJourneyRoute || {};
    const steps = Array.isArray(r.steps) ? r.steps : [];
    const completed = new Set(Array.isArray(r.completed) ? r.completed : []);
    const items = [];

    for (let c = from; c < to; c++) {
      const words = wordsFor(c);
      const topic = topicFor(words);
      const st = statsFor(c);
      const complete = Boolean(st.complete);
      const isCurrent = c === current && !complete;
      const title = `Lesson ${c + 1}: ${words.slice(0,2).map(w => w.meaning).filter(Boolean).join(' + ') || topic?.title || `Lesson ${c+1}`}`;
      const detail = complete
        ? `Completed · ${Number(st.percent ?? 100)}%`
        : isCurrent
          ? `Current lesson · ${words.length} connected word${words.length === 1 ? '' : 's'}${topic?.title ? ` · ${topic.title}` : ''}`
          : `Upcoming${topic?.title ? ` · ${topic.title}` : ''}`;

      items.push({
        type: complete ? 'past' : isCurrent ? 'current' : 'future',
        id: `lesson-${c}`, chapter:c, icon:topic?.icon || '📖',
        title, detail, done:complete, current:isCurrent, future:c>current
      });

      steps.filter(s => String(s.sideQuestFor || s.retryOf || '') === `lesson-${c}`).forEach(s => {
        if (s.retryOf) items.push({
          type:'retry', id:s.id, chapter:c, icon:s.icon || '🔄',
          title:s.title || `Retry · Lesson ${c+1}`,
          detail:s.detail || 'Return to the lesson and try again.',
          done:completed.has(s.id), current:false, future:c>current
        });
        else if (s.kind === 'activity') items.push({
          type:'side', id:s.id, chapter:c, icon:s.icon || '⚔️',
          title:s.title || 'Side Quest', detail:s.detail || 'Extra practice.',
          done:completed.has(s.id), current:false, future:c>current, required:Boolean(s.required)
        });
      });

      if (c > 0 && c % 5 === 0) items.push({
        type:'milestone', id:`milestone-${c}`, chapter:c, icon:'🏆',
        title:`Milestone · ${c} lessons`, detail:'A chapter checkpoint on your Journey.',
        done:c <= current, current:false, future:c>current
      });
    }
    return items;
  }

  function signature(items) {
    return JSON.stringify({
      v: APP_VERSION,
      current: currentChapter(),
      total: chapterCount(),
      items: items.map(x => [x.id,x.type,x.done,x.current,x.title,x.detail])
    });
  }

  function render() {
    const track = ensureHost();
    if (!track) return false;
    const items = buildItems();
    const sig = signature(items);
    if (track.dataset.kqSignature === sig) return true;

    const oldScroll = track.scrollTop;
    const currentId = track.querySelector('.kq-timeline-item.current')?.dataset.timelineId;
    track.dataset.kqSignature = sig;

    track.innerHTML = `<div class="kq-timeline-spine" aria-hidden="true"></div>` +
      items.map(x => {
        const cls = `kq-timeline-item ${x.done?'done':''} ${x.current?'current':''} ${x.future?'future':''} ${x.type==='side'?'side-quest':''} ${x.type==='retry'?'retry':''}`;
        const eyebrow = x.type==='past' ? 'Completed' :
          x.type==='side' ? (x.required ? 'Required side quest' : 'Side quest') :
          x.type==='retry' ? 'Retry lesson' :
          x.type==='milestone' ? 'Milestone' :
          x.current ? 'Current lesson' : 'Coming up';
        const actions = x.type==='past'
          ? `<div class="kq-journey-actions"><button type="button" data-kq-action="results">View lesson results</button><button type="button" class="primary" data-kq-action="retry">Retry lesson</button></div><div class="kq-journey-details" data-results-panel hidden></div>`
          : x.current
            ? `<div class="kq-journey-actions"><button type="button" class="primary" data-kq-action="continue">Continue lesson</button></div>`
            : x.future
              ? `<div class="kq-journey-actions"><button type="button" data-kq-action="preview">Preview lesson</button></div>`
              : '';
        return `<article class="${cls}" data-timeline-id="${esc(x.id)}" data-chapter="${x.chapter}">
          <div class="kq-timeline-marker" aria-hidden="true">${esc(x.icon)}</div>
          <div class="kq-timeline-card">
            <span class="eyebrow">${eyebrow}</span>
            <strong>${esc(x.title)}</strong>
            <p>${esc(x.detail)}</p>
            ${x.type==='side'&&!x.done?`<small>${x.required?'Required before you continue':'Optional challenge'}</small>`:''}
            ${actions}
          </div>
        </article>`;
      }).join('');

    if (currentId) {
      const el = track.querySelector(`[data-timeline-id="${CSS.escape(currentId)}"]`);
      if (el) track.scrollTop = oldScroll;
    } else {
      track.scrollTop = oldScroll;
    }
    return true;
  }

  function showResults(node, chapter) {
    const panel = node.querySelector('[data-results-panel]');
    if (!panel) return;
    if (!panel.hidden) { panel.hidden = true; return; }

    const e = historyFor(chapter);
    const ws = e ? entryWords(e) : wordsFor(chapter);
    const acc = e ? entryAccuracy(e) : null;
    panel.innerHTML =
      `<div class="kq-detail-stats"><span>${ws.length} word${ws.length===1?'':'s'}</span>` +
      (acc != null ? `<span>${esc(acc)}% accuracy</span>` : '') +
      `</div><div class="kq-word-list">` +
      (ws.map(w => `<div class="kq-word"><b lang="ja">${esc(w.word)}</b><small>${esc(w.meaning)}</small></div>`).join('') ||
       '<p>No word-level results are available for this lesson.</p>') +
      `</div>`;
    panel.hidden = false;
  }

  function continueLesson(chapter) {
    const words = wordsFor(chapter);
    let topic = topicFor(words);
    try {
      if (typeof startTopicSession === 'function') {
        startTopicSession(topic?.id || undefined);
        return;
      }
    } catch (e) { console.error('Journey continue failed', e); }

    try {
      const legacy = $('#continueJourney');
      if (legacy) legacy.click();
    } catch {}
  }

  function retryLesson(chapter) {
    const e = historyFor(chapter);
    try {
      if (e?.id && typeof redoHistoryEntry === 'function') {
        redoHistoryEntry(e.id);
        return;
      }
    } catch {}
    try {
      const ids = wordsFor(chapter).map(w => w?.id).filter(Boolean);
      if (ids.length && typeof makeTargetedMasterySession === 'function') {
        activityReturnScreen = 'journey';
        makeTargetedMasterySession(ids, 'retain', `Retry · Lesson ${chapter+1}`);
      }
    } catch (e) { console.error('Journey retry failed', e); }
  }

  function previewLesson(chapter) {
    const node = document.querySelector(`[data-timeline-id="lesson-${chapter}"]`);
    if (!node) return;
    const existing = node.querySelector('[data-preview-panel]');
    if (existing) { existing.hidden = !existing.hidden; return; }

    const words = wordsFor(chapter);
    const topic = topicFor(words);
    const panel = document.createElement('div');
    panel.className = 'kq-journey-details';
    panel.dataset.previewPanel = 'true';
    panel.innerHTML =
      `<b>What you’ll learn</b><p>${words.slice(0,4).map(w => `<b lang="ja">${esc(w.word)}</b> ${esc(w.meaning)}`).join(' · ') ||
      'The lesson content will be revealed when you reach it.'}</p>` +
      (topic?.title ? `<p><b>Topic:</b> ${esc(topic.title)}</p>` : '') +
      `<p><b>Why it’s next:</b> it builds on what you’ve just learned.</p>`;
    node.querySelector('.kq-timeline-card')?.appendChild(panel);
  }

  function handleClick(e) {
    const button = e.target.closest?.('[data-kq-action]');
    if (!button) return;
    const node = button.closest('.kq-timeline-item');
    if (!node) return;

    e.preventDefault();
    e.stopPropagation();

    const chapter = Number(node.dataset.chapter);
    const action = button.dataset.kqAction;

    if (action === 'results') showResults(node, chapter);
    else if (action === 'retry') retryLesson(chapter);
    else if (action === 'continue') continueLesson(chapter);
    else if (action === 'preview') previewLesson(chapter);
  }

  function init() {
    installStyles();
    if (!$('#journey')) return false;

    /* Remove any legacy Journey DOM once, before our renderer starts.
       Since v3 is no longer loaded, this is only cleanup of old static markup. */
    $('#journeyHistoryTrack')?.replaceChildren();

    document.addEventListener('click', handleClick, false);

    /* Wait for the app's vocabulary/chapter data to exist. We do not observe
       or mutate the timeline in response to mutations. The interval only calls
       render when the DATA signature changes, so it cannot flash the buttons. */
    let attempts = 0;
    const boot = () => {
      if (render()) return;
      if (++attempts < 30) setTimeout(boot, 250);
    };
    boot();

    let lastSig = '';
    window.setInterval(() => {
      const items = buildItems();
      const sig = signature(items);
      if (sig !== lastSig) {
        lastSig = sig;
        render();
      }
    }, 1500);
    window.addEventListener('pageshow', render);
    window.__kqJourneyStableInstalled = true;
    return true;
  }

  if (!window.__kqJourneyStableInstalled) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
    else setTimeout(init, 0);
  }
})();
