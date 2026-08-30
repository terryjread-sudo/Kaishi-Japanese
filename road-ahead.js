'use strict';

/*
 * Kaishi Quest — Road Ahead
 * v11.25.0
 *
 * Two independent floating overlays on the Journey screen:
 *  - Road Ahead bubble (bottom-left): what's coming up, from the rolling
 *    roadmap computed by roadmap-engine.js
 *  - Dashboard button (top-left): returns to the dashboard using the
 *    app's existing show('home') navigation
 *
 * Both are pure overlays. Neither touches the Journey renderer, the DOM
 * structure it owns, or the Continue/retry/completion logic. Neither
 * uses a MutationObserver or polling — visibility is driven by wrapping
 * the existing global show() function once.
 */
(() => {
  const BUBBLE_ID = 'kqRoadAheadBubble';
  const DASHBOARD_BTN_ID = 'kqJourneyDashboardBtn';
  const STYLE_ID = 'kqRoadAheadFloatingStyles';

  const log = (category, message) => {
    try {
      if (typeof window.kaishiLog === 'function') window.kaishiLog(category, message);
    } catch (_) {}
  };

  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
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
      #${BUBBLE_ID} .kq-ra-icon{flex:0 0 auto;font-size:1.05rem;line-height:1}
      #${BUBBLE_ID} .kq-ra-text{min-width:0;display:flex;flex-direction:column;gap:1px}
      #${BUBBLE_ID} .kq-ra-title{font-weight:800;font-size:.82rem;white-space:nowrap;
        overflow:hidden;text-overflow:ellipsis}
      #${BUBBLE_ID} .kq-ra-count{font-size:.72rem;opacity:.68;white-space:nowrap}

      #${DASHBOARD_BTN_ID}{position:fixed;left:12px;top:calc(12px + env(safe-area-inset-top,0px));
        z-index:60;padding:8px 13px;border-radius:999px;border:1px solid rgba(0,0,0,.10);
        background:var(--card-bg,#fff);box-shadow:0 4px 14px rgba(0,0,0,.14);
        font-weight:800;font-size:.82rem;cursor:pointer;pointer-events:auto}
      #${DASHBOARD_BTN_ID}:active{transform:scale(.97)}

      @media(max-width:380px){
        #${BUBBLE_ID}{max-width:70vw;padding:8px 12px}
        #${DASHBOARD_BTN_ID}{padding:7px 11px;font-size:.78rem}
      }
    `;
    document.head.appendChild(style);
  };

  // ---- Road Ahead bubble ----
  const headlineFor = (roadmap) => {
    if (!roadmap || !roadmap.lessons.length) return null;
    const withEvent = roadmap.lessons.find((l) => l.event);
    if (withEvent) {
      const offset = withEvent.lessonNumber - roadmap.currentLesson; // lessons from now
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
      offset: last.lessonNumber - roadmap.currentLesson,
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
    const roadmap = typeof window.KaishiRoadmap?.get === 'function' ? window.KaishiRoadmap.get() : null;
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

  // ---- Dashboard button ----
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

  // ---- shared visibility + scheduling ----
  const setVisible = (visible) => {
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
    addStyles();
    schedule();
    log('journey', 'Road Ahead floating overlays installed (bubble + dashboard button)');

    // Re-render on any click that plausibly changes screen/journey state,
    // same lightweight delegation pattern used elsewhere in the app —
    // no MutationObserver, no animation-frame polling loop.
    document.addEventListener('click', (event) => {
      const target = event.target?.closest?.(
        '#continueJourney,[data-screen="journey"],[data-target="journey"],.journey-nav,#journey button,#journeyBack'
      );
      if (target) schedule();
    }, { passive: true });

    // The single source of truth for "which screen is active" is the
    // existing global show() function. Wrap it once so both overlays stay
    // in sync without touching anything it does.
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
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
