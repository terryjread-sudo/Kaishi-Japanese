'use strict';

/*
 * Kaishi Quest v11.25.17
 *
 * Stability fixes:
 * 1. Checkpoint 5 is a silent automatic save, not a dialog.
 * 2. Only the Road Ahead floating notification is shown for upcoming
 *    immersive activities; the duplicate Journey timeline badge is hidden.
 * 3. A learning card reaches 100% after three successful reviews of a skill.
 *
 * This deliberately replaces the checkpoint handler itself rather than
 * waiting for a dialog to open and trying to suppress it afterwards.
 */
(() => {
  const VERSION = '11.25.17';

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

    /*
     * next() calls showMissionCheckpoint() when the checkpoint is reached.
     * Replacing that function means the dialog is never created/opened.
     * The normal lesson advances exactly as it would after choosing
     * "continue" in the old dialog.
     */
    window.showMissionCheckpoint = function () {
      try {
        saveMissionResume();
      } catch (_) {}

      savingBubble();

      try {
        index++;
        renderCurrent();
      } catch (error) {
        try { window.kaishiLog?.('patch', `[${VERSION}] checkpoint advance failed: ${error?.message || error}`); } catch (_) {}
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
        /* Road Ahead owns the floating upcoming-activity notification.
           The Journey timeline must not show a second copy. */
        .kq-unified-next-event {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  function accelerateThreeSuccessfulReviews() {
    /*
     * The Journey's wordScore() averages the stored skill strengths.
     * Once a skill has been successfully reviewed three times, treat that
     * skill as mastered for the learner-facing progression meter.
     *
     * We only promote metrics that already have three attempts and three
     * correct answers. Failed reviews therefore cannot trigger this.
     */
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

      if (changed) {
        localStorage.setItem(key, JSON.stringify(data));
      }
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

    /*
     * The Journey can be re-rendered after lesson completion. Keep the
     * progression promotion lightweight and ensure the duplicate notice
     * remains hidden without repeatedly changing the DOM.
     */
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

  window.KaishiPatch112517 = {
    version: VERSION,
    checkpoint: 'automatic-save-and-continue',
    immersiveNotice: 'road-ahead-only',
    cardMasteryReviews: 3
  };
})();
