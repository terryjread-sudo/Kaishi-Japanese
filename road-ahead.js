'use strict';
/*
 * Kaishi Quest — Road Ahead
 * v11.25.19
 *
 * The Journey reminder has one job: tell the learner how far away their
 * next SRS battle is. Keeping it single-purpose avoids competing prompts.
 */
(() => {
  const BUBBLE_ID = 'kqRoadAheadBubble';
  const STYLE_ID = 'kqRoadAheadFloatingStyles';
  const escapeHTML = value => String(value ?? '').replace(/[&<>\"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'
  }[c]));

  const addStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BUBBLE_ID}{position:fixed;left:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));
        z-index:60;max-width:min(82vw,350px);padding:8px 14px 8px 8px;border-radius:22px;
        display:flex;align-items:center;gap:9px;background:var(--card-bg,#fff);
        border:1px solid rgba(0,0,0,.10);box-shadow:0 4px 14px rgba(0,0,0,.14);
        pointer-events:none;transition:opacity .15s ease}
      #${BUBBLE_ID}[hidden]{display:none}
      #${BUBBLE_ID} .kq-ra-sensei{flex:0 0 44px;width:44px;height:44px;object-fit:contain;align-self:flex-end}
      #${BUBBLE_ID} .kq-ra-text{min-width:0;display:flex;flex-direction:column;gap:1px}
      #${BUBBLE_ID} .kq-ra-title{font-weight:800;font-size:.82rem;white-space:nowrap;
        overflow:hidden;text-overflow:ellipsis}
      #${BUBBLE_ID} .kq-ra-count{font-size:.72rem;opacity:.68;white-space:nowrap}
    `;
    document.head.appendChild(style);
  };

  const nextBattle = roadmap => {
    if (!roadmap) return null;
    return (roadmap.keyEvents || [])
      .filter(e => {
        if (e.id !== 'battle') return false;
        const afterLesson = Number(e.afterLessonNumber);
        const afterChapter = Number(e.afterChapterIndex);
        return (Number.isFinite(afterChapter) && afterChapter >= roadmap.currentLesson) ||
               (Number.isFinite(afterLesson) && afterLesson > roadmap.currentLesson + 0);
      })
      .map(e => {
        const afterLesson = Number.isFinite(Number(e.afterLessonNumber))
          ? Number(e.afterLessonNumber)
          : Number(e.afterChapterIndex) + 1;
        return {
          lessonNumber: afterLesson,
          currentLesson: Number(roadmap.currentLesson || 0)
        };
      })
      .filter(e => Number.isFinite(e.lessonNumber) && e.lessonNumber > roadmap.currentLesson)
      .sort((a, b) => a.lessonNumber - b.lessonNumber)[0] || null;
  };

  const headlineFor = roadmap => {
    const battle = nextBattle(roadmap);
    if (!battle) return null;
    return { offset: Math.max(1, battle.lessonNumber - battle.currentLesson) };
  };

  const ensureBubble = () => {
    let bubble = document.getElementById(BUBBLE_ID);
    if (!bubble) {
      bubble = document.createElement('aside');
      bubble.id = BUBBLE_ID;
      bubble.setAttribute('aria-label', 'Sensei: next SRS battle reminder');
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
      <img class="kq-ra-sensei" src="media/guides/sensei/sensei-explaining.webp?v=${encodeURIComponent(window.APP_VERSION || '')}" alt="Sensei">
      <span class="kq-ra-text">
        <span class="kq-ra-title">Sensei</span>
        <span class="kq-ra-count">Next SRS battle in ${count}</span>
      </span>
    `;
  };

  const setVisible = visible => {
    addStyles();
    const bubble = ensureBubble();
    if (visible) {
      renderBubble();
    } else {
      bubble.hidden = true;
    }
  };

  const isJourneyActive = () => {
    const journey = document.getElementById('journey');
    return Boolean(journey && journey.classList.contains('active'));
  };

  const schedule = () =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setVisible(isJourneyActive()))
    );

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
