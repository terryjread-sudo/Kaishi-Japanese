'use strict';
/*
  Kaishi Quest Journey 11.19.5
  Stable enhancement layer.

  DOM ownership stays with journey-v3. This file NEVER observes the Journey
  subtree and NEVER renders/rebuilds the timeline. It only adds missing
  controls to an already-rendered timeline, with a bounded boot retry.
*/
(() => {
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const historyEntriesSafe = () => {
    try { return typeof historyEntries === 'function' ? historyEntries() : []; }
    catch { return []; }
  };
  const historyWords = e => {
    try { return typeof historyEntryWords === 'function' ? historyEntryWords(e) : []; }
    catch { return []; }
  };
  const historyAccuracy = e => {
    try { return typeof historyEntryAccuracy === 'function' ? historyEntryAccuracy(e) : null; }
    catch { return null; }
  };
  const chapterWordsSafe = c => {
    try { return typeof chapterWords === 'function' ? (chapterWords(Number(c)) || []) : []; }
    catch { return []; }
  };

  function chapterOf(node) {
    const m = String(node?.dataset?.kq1710Id || '').match(/^lesson-(\d+)$/);
    return m ? Number(m[1]) : null;
  }

  function bestHistory(chapter) {
    const ids = new Set(chapterWordsSafe(chapter).map(w => w?.id).filter(Boolean));
    if (!ids.size) return null;
    let best = null, score = 0;
    for (const e of historyEntriesSafe()) {
      const overlap = historyWords(e).reduce((n,w) => n + (ids.has(w?.id) ? 1 : 0), 0);
      if (overlap > score || (overlap === score && overlap &&
          Number(e.completedAt || 0) > Number(best?.completedAt || 0))) {
        best = e; score = overlap;
      }
    }
    return best;
  }

  function addStyles() {
    if ($('#kqJourneyStableEnhancementStyles')) return;
    const s = document.createElement('style');
    s.id = 'kqJourneyStableEnhancementStyles';
    s.textContent = `
      .kq1710-action-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
      .kq1710-action-row .kq1710-action{margin-top:0}
      .kq1710-detail{margin-top:12px;padding-top:12px;border-top:1px solid rgba(0,0,0,.1)}
      .kq1710-detail[hidden]{display:none}
      .kq1710-detail-stats{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:9px}
      .kq1710-detail-stats span{padding:6px 9px;border-radius:999px;background:rgba(37,99,235,.08);font-size:.82rem;font-weight:700}
      .kq1710-word-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:8px}
      .kq1710-word{display:flex;justify-content:space-between;gap:8px;padding:8px 10px;border-radius:10px;background:rgba(0,0,0,.035)}
      .kq1710-word small{opacity:.7;text-align:right}
      .kq1710-preview{font-size:.9rem}
      .kq1710-milestone{display:flex;gap:12px;align-items:center;margin:10px 4px 14px 50px;padding:12px 14px;border:2px solid rgba(234,179,8,.45);border-radius:16px;background:rgba(234,179,8,.07)}
      .kq1710-milestone strong{display:block}.kq1710-milestone p{margin:3px 0;opacity:.75}
      #journeyHistoryTrack [data-kq1710="continue"]{display:none!important}
      @media(max-width:560px){.kq1710-action-row{display:grid}.kq1710-action-row button{width:100%}.kq1710-word-list{grid-template-columns:1fr}.kq1710-milestone{margin-left:48px}}
    `;
    document.head.appendChild(s);
  }

  function startLesson(chapter) {
    try {
      if (typeof startJourneyChapter === 'function') {
        startJourneyChapter(Number(chapter));
        return true;
      }
    } catch {}
    try {
      const words = chapterWordsSafe(chapter);
      const ids = words.map(w => w?.id).filter(Boolean);
      if (ids.length && typeof makeTargetedMasterySession === 'function') {
        activityReturnScreen = 'journey';
        makeTargetedMasterySession(ids, 'retain', `Retry · Lesson ${Number(chapter)+1}`);
        return true;
      }
    } catch {}
    try { if (typeof toast === 'function') toast('That lesson could not be started yet. Please try again.'); } catch {}
    return false;
  }

  function retryLesson(chapter) {
    const entry = bestHistory(chapter);
    if (entry?.id && typeof redoHistoryEntry === 'function') {
      redoHistoryEntry(entry.id);
      return true;
    }
    return startLesson(chapter);
  }

  function fillDetails(node, chapter) {
    const detail = node.querySelector('.kq1710-detail');
    if (!detail) return;
    const entry = bestHistory(chapter);
    const words = entry ? historyWords(entry) : chapterWordsSafe(chapter);
    const acc = entry ? historyAccuracy(entry) : null;
    detail.innerHTML =
      `<div class="kq1710-detail-stats"><span>${words.length} word${words.length===1?'':'s'}</span>` +
      (acc != null ? `<span>${esc(acc)}% accuracy</span>` : '') +
      `</div><div class="kq1710-word-list">` +
      (words.map(w => `<span class="kq1710-word"><b lang="ja">${esc(w.word)}</b><small>${esc(w.meaning)}</small></span>`).join('') ||
       '<p class="muted">No word-level results are available for this lesson.</p>') +
      `</div>`;
  }

  function fillPreview(node, chapter) {
    const detail = node.querySelector('.kq1710-detail');
    if (!detail) return;
    const words = chapterWordsSafe(chapter);
    let topic = null;
    try { topic = words[0] && typeof topicForWord === 'function' ? topicForWord(words[0]) : null; } catch {}
    detail.innerHTML =
      `<div class="kq1710-preview"><strong>What you'll learn</strong>` +
      `<p>${words.slice(0,4).map(w => `<b lang="ja">${esc(w.word)}</b> ${esc(w.meaning)}`).join(' · ') ||
        'The lesson content will be revealed when you reach it.'}</p>` +
      (topic?.title ? `<p><b>Topic:</b> ${esc(topic.title)}</p>` : '') +
      `<p><b>Why it's next:</b> it builds on what you've just learned.</p></div>`;
  }

  function addControls(node) {
    const chapter = chapterOf(node);
    const card = node.querySelector('.kq1710-card');
    if (chapter === null || !card || node.querySelector('.kq1710-v5-controls')) return false;

    const current = node.classList.contains('current');
    const past = node.classList.contains('done') && !current;
    const future = node.classList.contains('future');
    const row = document.createElement('div');
    row.className = 'kq1710-action-row kq1710-v5-controls';

    if (current) {
      row.innerHTML = '<button type="button" class="primary kq1710-action" data-kq-v5="continue">Continue lesson</button>';
    } else if (past) {
      row.innerHTML =
        '<button type="button" class="kq1710-action" data-kq-v5="details" aria-expanded="false">View lesson results</button>' +
        '<button type="button" class="primary kq1710-action" data-kq-v5="retry">Retry lesson</button>';
    } else if (future) {
      row.innerHTML = '<button type="button" class="kq1710-action" data-kq-v5="preview" aria-expanded="false">Preview lesson</button>';
    } else {
      return false;
    }

    card.appendChild(row);
    if (past || future) {
      const detail = document.createElement('div');
      detail.className = 'kq1710-detail';
      detail.hidden = true;
      card.appendChild(detail);
    }
    return true;
  }

  function addMilestones(track) {
    if (track.dataset.kqMilestonesAdded === '1') return;
    const lessons = [...track.querySelectorAll('.kq1710-node')].filter(n => chapterOf(n) !== null);
    if (!lessons.length) return;

    lessons.forEach(node => {
      const chapter = chapterOf(node);
      if (!chapter || chapter % 5 !== 0) return;
      if (track.querySelector(`[data-kq-milestone="milestone-${chapter}"]`)) return;
      const milestone = document.createElement('div');
      milestone.className = 'kq1710-milestone';
      milestone.dataset.kqMilestone = `milestone-${chapter}`;
      milestone.innerHTML = `<div style="font-size:1.7rem">🏆</div><div><strong>Milestone · Lesson ${chapter+1}</strong><p>Chapter checkpoint — keep going.</p></div>`;
      node.parentNode.insertBefore(milestone, node);
    });
    track.dataset.kqMilestonesAdded = '1';
  }

  function enhance() {
    const track = $('#journeyHistoryTrack');
    if (!track || !$('#journey')?.classList.contains('active')) return false;
    addStyles();
    track.querySelectorAll('.kq1710-node').forEach(addControls);
    bindButtons(track);
    addMilestones(track);
    return track.querySelector('.kq1710-node') !== null;
  }

  function bindButtons(track) {
    track.querySelectorAll('[data-kq-v5]').forEach(button => {
      if (button.dataset.kqV5Bound) return;
      button.dataset.kqV5Bound = '1';
      button.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const node = button.closest('.kq1710-node');
        const chapter = chapterOf(node);
        if (chapter === null) return;
        const action = button.dataset.kqV5;
        if (action === 'continue') startLesson(chapter);
        else if (action === 'retry') retryLesson(chapter);
        else if (action === 'details' || action === 'preview') {
          const detail = node.querySelector('.kq1710-detail');
          if (!detail) return;
          const opening = detail.hidden;
          if (opening) {
            if (action === 'details') fillDetails(node, chapter);
            else fillPreview(node, chapter);
          }
          detail.hidden = !opening;
          button.setAttribute('aria-expanded', String(opening));
        }
      });
    });
  }

  function install() {
    if (window.__kqJourneyStableEnhancementInstalled) return;
    window.__kqJourneyStableEnhancementInstalled = true;
    addStyles();

    document.addEventListener('click', e => {
      const nav = e.target.closest?.('#continueJourney,#journeyBack');
      if (nav) setTimeout(enhance, 250);
    }, true);

    let tries = 0;
    const boot = () => {
      if (enhance() || ++tries >= 25) return;
      setTimeout(boot, 120);
    };
    boot();
    window.addEventListener('pageshow', () => setTimeout(enhance, 150));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();
