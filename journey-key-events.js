'use strict';

/*
 * Kaishi Quest — Journey Key Events
 * v11.25.22
 *
 * Key Events are independent timeline objects.
 * They are ordered around lessons, but are never children of a lesson.
 */
(() => {
  const STYLE_ID = 'kqJourneyKeyEventStyles';

  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'
  }[c]));

  const addStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #journeyHistoryTrack{display:block!important;width:100%;min-width:0;}
      .kq-journey-key-event{display:flex;width:100%;max-width:100%;box-sizing:border-box;gap:12px;align-items:center;margin:2px 2px 13px 49px;padding:12px 14px;border:2px solid rgba(234,179,8,.42);border-radius:16px;background:rgba(234,179,8,.07);box-shadow:0 2px 7px rgba(0,0,0,.04)}
      .kq-journey-key-event-icon{width:40px;height:40px;flex:0 0 40px;border-radius:50%;display:grid;place-items:center;background:rgba(234,179,8,.14);font-size:1.1rem}
      .kq-journey-key-event-copy{min-width:0}
      .kq-journey-key-event-label{display:block;font-size:.72rem;font-weight:900;letter-spacing:.04em;text-transform:uppercase;opacity:.68}
      .kq-journey-key-event-title{display:block;font-weight:850;margin-top:2px}
      .kq-journey-key-event-detail{display:block;font-size:.78rem;opacity:.72;margin-top:2px}
      @media(max-width:560px){.kq-journey-key-event{margin-left:48px;width:calc(100% - 48px)}}
    `;
    document.head.appendChild(style);
  };

  const render = () => {
    const timeline = document.getElementById('journeyHistoryTrack');
    const timelineContent = timeline?.querySelector('.kq-unified-timeline') || timeline;
    const roadmap = window.KaishiRoadmap?.get?.();
    if (!timeline || !roadmap?.keyEvents?.length) return;

    addStyles();
    timeline.querySelectorAll('.kq-journey-key-event').forEach(el => el.remove());

    const lessonNodes = Array.from(timelineContent.querySelectorAll('[data-kq-chapter],.kq-unified-node'));

    roadmap.keyEvents.slice().reverse().forEach(event => {
      const target = lessonNodes.find(node => {
        const chapter = Number(node.dataset.kqChapter ?? node.dataset.chapter);
        const fallbackId = String(node.dataset.kqId || '').match(/lesson-(\d+)/);
        const resolved = Number.isFinite(chapter) ? chapter : (fallbackId ? Number(fallbackId[1]) : NaN);
        return Number.isFinite(resolved) && resolved === Number(event.afterChapterIndex);
      });

      const item = document.createElement('div');
      item.className = 'kq-journey-key-event';
      item.dataset.kqKeyEvent = event.id;
      item.dataset.kqAfterChapter = String(event.afterChapterIndex ?? '');
      item.innerHTML = `
        <span class="kq-journey-key-event-icon" aria-hidden="true">${esc(event.icon || '⭐')}</span>
        <span class="kq-journey-key-event-copy">
          <span class="kq-journey-key-event-label">Key Event</span>
          <span class="kq-journey-key-event-title">${esc(event.label || 'Milestone')}</span>
          <span class="kq-journey-key-event-detail">A major Journey challenge is approaching.</span>
        </span>`;

      if (target?.parentNode) {
        if (target.nextSibling) target.parentNode.insertBefore(item, target.nextSibling);
        else target.parentNode.appendChild(item);
      } else {
        timelineContent.appendChild(item);
      }
    });
  };

  const schedule = () => requestAnimationFrame(() => requestAnimationFrame(render));

  const install = () => {
    if (document.documentElement.dataset.kqJourneyKeyEventsInstalled === '1') return;
    document.documentElement.dataset.kqJourneyKeyEventsInstalled = '1';
    schedule();
    window.addEventListener('kaishi-roadmap-updated', schedule, {passive:true});
    document.addEventListener('click', event => {
      if (event.target?.closest?.('#journey button,.journey-nav,[data-screen="journey"]')) schedule();
    }, {passive:true});
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();

  window.KaishiJourneyKeyEvents = {render};
})();
