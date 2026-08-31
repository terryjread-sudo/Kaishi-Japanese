'use strict';
/*
 * Kaishi Quest — Road Ahead
 * v11.25.15
 *
 * Headline priority tiers:
 *   0 – immersive side quests (karuta, theatre, manga)
 *   1 – distinctive lesson activities (picture, sentence-understanding, …)
 *   2 – milestones
 *   3 – topic changes
 *
 * Variety protection: the last-highlighted activity ID is persisted in
 * localStorage so the same type is skipped when an alternative exists.
 */
(() => {
  const BUBBLE_ID = 'kqRoadAheadBubble';
  const DASHBOARD_BTN_ID = 'kqJourneyDashboardBtn';
  const STYLE_ID = 'kqRoadAheadFloatingStyles';
  const VARIETY_KEY = 'kqRoadAheadLastHighlight';

  // Priority tier: lower = more interesting
  const TIER = { sideQuest: 0, activity: 1, milestone: 2, topic: 3 };

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

  const readLastHighlight = () => {
    try { return JSON.parse(localStorage.getItem(VARIETY_KEY)) || null; } catch (_) { return null; }
  };

  const saveLastHighlight = (id, lessonNumber) => {
    try { localStorage.setItem(VARIETY_KEY, JSON.stringify({ id, lessonNumber })); } catch (_) {}
  };

  const headlineFor = roadmap => {
    if (!roadmap || !roadmap.lessons?.length) return null;

    // Collect all lessons that carry an interesting event (not topic-change only)
    const candidates = roadmap.lessons
      // The current lesson may already show an arrived badge. The indicator is
      // deliberately about the next event still ahead on the path.
      .filter(l => l.chapterIndex > roadmap.currentLesson && l.event && l.event.type !== 'topic')
      .sort((a, b) => {
        // Primary: tier (lower = better)
        const ta = TIER[a.event.type] ?? 99;
        const tb = TIER[b.event.type] ?? 99;
        if (ta !== tb) return ta - tb;
        // Secondary: proximity (closer = better)
        return a.chapterIndex - b.chapterIndex;
      });

    // Also keep any topic events as a last-resort fallback
    const topicFallback = roadmap.lessons.find(l => l.chapterIndex > roadmap.currentLesson && l.event?.type === 'topic');

    if (!candidates.length && !topicFallback) {
      // Nothing interesting in horizon — show generic path message
      const last = roadmap.lessons[roadmap.lessons.length - 1];
      return {
        icon: '🌱',
        label: 'Learning path continues',
        offset: Math.max(1, last.chapterIndex - roadmap.currentLesson),
        hasEvent: false,
        eventId: null
      };
    }

    // Variety protection: skip last-highlighted ID when an alternative exists
    const last = readLastHighlight();
    let chosen = candidates[0] || topicFallback;

    if (last?.id && candidates.length > 1) {
      const alternative = candidates.find(l => l.event.id !== last.id);
      if (alternative) chosen = alternative;
    } else if (last?.id && candidates.length === 1 && candidates[0]?.event?.id === last.id && topicFallback) {
      // Only one candidate and it's the same as last time — try topic as break
      chosen = topicFallback;
    }

    const offset = Math.max(1, chosen.chapterIndex - roadmap.currentLesson);
    return {
      icon: chosen.event.icon || '✨',
      label: chosen.event.label,
      offset,
      hasEvent: true,
      eventId: chosen.event.id,
      currentLesson: roadmap.currentLesson
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

    // Persist variety selection so next render rotates to a different activity
    if (headline.hasEvent && headline.eventId) {
      saveLastHighlight(headline.eventId, (headline.currentLesson || 0) + headline.offset);
    }
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
    window.addEventListener('kaishi-roadmap-updated', schedule);

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
