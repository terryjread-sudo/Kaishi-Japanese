'use strict';

/*
 * Kotoba Colosseum Activity Village integration — Kaishi Quest v11.3.0
 *
 * Keeps the activity visible from the main Activity Village while enforcing
 * the battle's actual practical minimum: at least 4 introduced vocabulary
 * words, because the listening question needs 4 answer choices.
 */
(() => {
  const REQUIRED_WORDS = 4;

  function introducedCount() {
    try {
      return Array.isArray(vocab) && typeof wordIntroduced === 'function'
        ? vocab.filter(wordIntroduced).length
        : 0;
    } catch {
      return 0;
    }
  }

  function refreshKotobaReadiness() {
    const button = document.getElementById('kotobaColosseumMode');
    const label = document.getElementById('kotobaReadiness');
    const card = document.getElementById('kotobaActivityCard');
    if (!button || !label || !card) return;

    const known = introducedCount();
    const ready = known >= REQUIRED_WORDS;

    button.disabled = !ready;
    button.setAttribute('aria-disabled', String(!ready));
    card.dataset.ready = ready ? 'true' : 'false';

    if (ready) {
      label.textContent = `${known} introduced words · Ready to enter`;
      button.textContent = '⚔️ Enter Colosseum';
      button.title = 'Start Kotoba Colosseum';
    } else {
      const remaining = Math.max(0, REQUIRED_WORDS - known);
      label.textContent = `${known} / ${REQUIRED_WORDS} introduced words · Learn ${remaining} more to unlock`;
      button.textContent = `🔒 ${remaining} more word${remaining === 1 ? '' : 's'}`;
      button.title = 'Learn a few more vocabulary words first';
    }
  }

  function returnToJourney() {
    try {
      if (typeof show === 'function') {
        show('journey');
        return;
      }
    } catch {}
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.toggle('active', screen.id === 'journey');
    });
    window.scrollTo(0, 0);
  }

  function init() {
    refreshKotobaReadiness();

    // The battle script owns the launch button click. This script only keeps
    // readiness honest and makes the back button return to Activity Village.
    document.getElementById('kbBack')?.addEventListener('click', returnToJourney);

    // Re-check after normal learning/navigation activity.
    document.addEventListener('click', event => {
      if (!event.target.closest('#kotobaColosseumMode')) {
        setTimeout(refreshKotobaReadiness, 120);
      }
    });
    window.addEventListener('focus', refreshKotobaReadiness);
    window.addEventListener('pageshow', refreshKotobaReadiness);

    // App data loads asynchronously, so give it a few chances to refresh.
    [250, 750, 1500, 3000].forEach(ms => setTimeout(refreshKotobaReadiness, ms));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
