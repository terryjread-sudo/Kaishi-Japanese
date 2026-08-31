'use strict';

/*
 * Kaishi Quest — Road Ahead
 * v11.25.11
 *
 * The Road Ahead headline deliberately excludes routine activities such
 * as Listening. Key milestones take priority, followed by distinctive
 * immersive activities, then the general learning path.
 */
(() => {
  const BUBBLE_ID = 'kqRoadAheadBubble';
  const DASHBOARD_BTN_ID = 'kqJourneyDashboardBtn';
  const STYLE_ID = 'kqRoadAheadFloatingStyles';

  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const addStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BUBBLE_ID}{position:fixed;left:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));
        z-index:60;max-width:min(78vw,320px);padding:10px 14px;border-radius:999px;
        display:flex;align-items:center;gap:9px;background:var(--card-bg,#fff);
        border:1px solid rgba(0,0,0,.10);box-shadow:0 4px 14px rgba(0,0,0,.14);
        pointer-events:none;transition:opacity .15s ease}
      #${BUBBLE_ID}[hidden]{display:none}
      #${BUBBLE_ID} .kq-ra-icon{flex:0 0 auto;font-size:1.05rem;line-height:1}
      #${BUBBLE_ID} .kq-ra-text{min-width:0;display:flex;flex-direction:column;gap:1px}
      #${BUBBLE_ID} .kq-ra-title{font-weight:800;font-size:.82rem;white-space:nowrap;
        overflow:hidden;text-overflow:ellipsis}
      #${BUBBLE_ID} .kq-ra-count{font-size:.72rem;opacity:.68;white-space:nowrap}
      #${DASHBOARD_BTN_ID}{position:fixed;left:12px;top:calc(12px + env(safe-area-inset-top,0px));
        z-index:60;padding:8px 13px;border-radius:999px;border:1px solid rgba(0,0,0,.10);
        background:var(--card-bg,#fff);box-shadow:0 4px 14px rgba(0,0,0,.14);
        font-weight:800;font-size:.82rem;cursor:pointer}
      #${DASHBOARD_BTN_ID}[hidden]{display:none}
      .kq-road-ahead-active #journeyBack{display:none}
    `;
    document.head.appendChild(style);
  };

  const headlineFor = roadmap => {
    if (!roadmap || !roadmap.lessons?.length) return null;

    const withEvent = roadmap.lessons.find(lesson => lesson.event);
    if (withEvent) {
      const offset = Math.max(1, withEvent.chapterIndex - roadmap.currentLesson);
      return {
        icon: withEvent.event.icon || '✨',
        label: withEvent.event.label,
        offset,
        hasEvent: true,
      };
    }

    const last = roadmap.lessons[roadmap.lessons.length - 1];
    return {
      icon: '🌱',
      label: 'Learning path continues',
      offset: Math.max(1, last.chapterIndex - roadmap.currentLesson),
      hasEvent: false,
    };
  };

  const ensureBubble = () => {
    let bubble = document.getElementById(BUBBLE_ID);
    if (!bubble) {
      bubble = document.createElement('aside');
      bubble.id = BUBBLE_ID;
      bubble.setAttribute('aria-label', 'What is ahead on your Journey');
      bubble.setAttribute('aria-live', 'polite');
      document.body.appendChild(bubble);
    }
    return bubble;
  };

  const renderBubble = () => {
    const roadmap = window.KaishiRoadmap?.get?.();
    const headline = headlineFor(roadmap);
    const bubble = ensureBubble();

    if (!headline) {
      bubble.hidden = true;
      return;
    }

    const count = headline.offset === 1 ? '1 lesson' : `${headline.offset} lessons`;
    bubble.hidden = false;
    bubble.innerHTML = `
      <span class="kq-ra-icon" aria-hidden="true">${escapeHTML(headline.icon)}</span>
      <span class="kq-ra-text">
        <span class="kq-ra-title">${escapeHTML(headline.label)}</span>
        <span class="kq-ra-count">${headline.hasEvent ? `in ${count}` : `${count} mapped ahead`}</span>
      </span>
    `;
  };

  const ensureDashboardButton = () => {
    let btn = document.getElementById(DASHBOARD_BTN_ID);
    if (!btn) {
      btn = document.createElement('button');
      btn.id = DASHBOARD_BTN_ID;
      btn.type = 'button';
      btn.textContent = '← Dashboard';
      btn.setAttribute('aria-label', 'Return to dashboard');
      btn.addEventListener('click', () => {
        try {
          if (typeof show === 'function') show('home');
          else if (typeof window.show === 'function') window.show('home');
        } catch (_) {}
      });
      document.body.appendChild(btn);
    }
    return btn;
  };

  const setVisible = visible => {
    addStyles();
    const bubble = ensureBubble();
    const btn = ensureDashboardButton();
    if (visible) {
      btn.hidden = false;
      renderBubble();
    } else {
      bubble.hidden = true;
      btn.hidden = true;
    }
  };

  const isJourneyActive = () => {
    const journey = document.getElementById('journey');
    return Boolean(journey && journey.classList.contains('active'));
  };

  const schedule = () => requestAnimationFrame(() => requestAnimationFrame(() => setVisible(isJourneyActive())));

  const install = () => {
    if (document.documentElement.dataset.kqRoadAheadInstalled === '1') return;
    document.documentElement.dataset.kqRoadAheadInstalled = '1';
    document.documentElement.classList.add('kq-road-ahead-active');
    addStyles();
    schedule();

    document.addEventListener('click', event => {
      const target = event.target?.closest?.(
        '#continueJourney,[data-screen="journey"],[data-target="journey"],.journey-nav,#journey button,#journeyBack'
      );
      if (target) schedule();
    }, { passive: true });

    try {
      if (typeof window.show === 'function' && !window.show.__kqRoadAheadWrapped) {
        const original = window.show;
        const wrapped = function (...args) {
          const result = original.apply(this, args);
          schedule();
          return result;
        };
        wrapped.__kqRoadAheadWrapped = true;
        window.show = wrapped;
      }
    } catch (_) {}
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once:true });
  } else {
    install();
  }
})();
