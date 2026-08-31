'use strict';

/*
 * Kaishi Quest v11.25.18
 *
 * Existing lesson stability patch retained from v11.25.17.
 * The checkpoint handler is deliberately left as the known-good
 * save-and-continue implementation:
 *   checkpoint -> save -> bubble -> normal lesson continuation.
 *
 * v11.25.18 moves roadmap/timeline responsibility into the original source
 * files (roadmap-engine.js and journey-key-events.js).
 */
(() => {
  const VERSION = '11.25.18';

  function savingBubble() {
    let bubble = document.getElementById('kaishiSavingProgress');
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.id = 'kaishiSavingProgress';
      bubble.setAttribute('role', 'status');
      bubble.setAttribute('aria-live', 'polite');

      Object.assign(bubble.style, {
        position: 'fixed',
        left: '50%',
        bottom: '24px',
        transform: 'translateX(-50%)',
        zIndex: '2147483647',
        padding: '9px 15px',
        borderRadius: '999px',
        background: 'rgba(15,23,42,.94)',
        color: '#fff',
        font: '600 14px system-ui,sans-serif',
        boxShadow: '0 8px 30px rgba(0,0,0,.22)',
        opacity: '0',
        transition: 'opacity .18s ease',
        pointerEvents: 'none'
      });

      document.body.appendChild(bubble);
    }

    bubble.textContent = 'Saving progress';
    bubble.style.opacity = '1';
    clearTimeout(bubble.__kaishiTimer);
    bubble.__kaishiTimer = setTimeout(() => {
      bubble.style.opacity = '0';
    }, 1600);
  }

  function installCheckpointHandler() {
    if (typeof window.showMissionCheckpoint !== 'function') return false;
    if (window.__kaishi112517CheckpointInstalled) return true;

    window.showMissionCheckpoint = function () {
      try {
        saveMissionResume();
      } catch (_) {}

      savingBubble();

      try {
        index++;
        renderCurrent();
      } catch (error) {
        try {
          window.kaishiLog?.(
            'patch',
            `[${VERSION}] checkpoint advance failed: ${error?.message || error}`
          );
        } catch (_) {}
      }
    };

    window.__kaishi112517CheckpointInstalled = true;
    return true;
  }

  function hideDuplicateImmersiveNotice() {
    if (!document.getElementById('kaishi112517NoticeStyle')) {
      const style = document.createElement('style');
      style.id = 'kaishi112517NoticeStyle';
      style.textContent = `
        .kq-unified-next-event {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  function accelerateThreeSuccessfulReviews() {
    try {
      const adminMode = (() => {
        try { return sessionStorage.getItem('kq-admin-test-mode') === '1'; }
        catch (_) { return false; }
      })();

      const key = adminMode ? 'kq-admin-test-progress' : 'kq-progress';
      const raw = localStorage.getItem(key);
      if (!raw) return;

      const data = JSON.parse(raw);
      let changed = false;

      Object.values(data || {}).forEach(card => {
        const skills = card?.skills;
        if (!skills || typeof skills !== 'object') return;

        Object.values(skills).forEach(metric => {
          if (!metric || typeof metric !== 'object') return;

          const attempts = Number(metric.attempts || 0);
          const correct = Number(metric.correct || 0);

          if (attempts >= 3 && correct >= 3 && Number(metric.strength || 0) < 1) {
            metric.strength = 1;
            changed = true;
          }
        });
      });

      if (changed) localStorage.setItem(key, JSON.stringify(data));
    } catch (_) {}
  }

  function start() {
    hideDuplicateImmersiveNotice();

    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;

      const checkpointReady = installCheckpointHandler();
      accelerateThreeSuccessfulReviews();

      if (checkpointReady && attempts >= 10) {
        clearInterval(timer);
      } else if (attempts >= 120) {
        clearInterval(timer);
      }
    }, 50);

    setInterval(() => {
      accelerateThreeSuccessfulReviews();
      hideDuplicateImmersiveNotice();
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, {once:true});
  } else {
    start();
  }

  window.KaishiPatch112518 = {
    version: VERSION,
    checkpoint: 'automatic-save-and-continue',
    immersiveNotice: 'road-ahead-only',
    cardMasteryReviews: 3
  };
})();
