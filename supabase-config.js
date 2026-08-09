'use strict';

// These browser-facing values are public by design. Never add a Supabase
// service-role key or a GitHub OAuth client secret to this file.
window.KAISHI_SUPABASE_CONFIG=Object.freeze({
  url:'https://wcnsvwbhfstgadqnaarr.supabase.co',
  publishableKey:'sb_publishable_NQFkJ7VsbdSM9nHCwaVzqA_qujW4sfm'
});

/*
 * Kaishi Quest v11.3.0 overlay bootstrap
 * - Removes the village cat from view.
 * - Adds Kotoba Colosseum to Games.
 * - Adds the battle screen.
 * - Loads battle-listen.js after app.js.
 *
 * Kept here deliberately so this update can be copied over the existing repo
 * without replacing the very large index.html.
 */
(() => {
  function installKotobaColosseum() {
    const releaseVersion = '11.3.0';
    document.title = `Kaishi Quest • v${releaseVersion}`;
    document.querySelectorAll('.version-badge').forEach(el => { el.textContent = `v${releaseVersion}`; });
    const versionCard = document.querySelector('.version-card');
    if (versionCard) {
      const strong = versionCard.querySelector('strong');
      const span = versionCard.querySelector('span');
      const small = versionCard.querySelector('small');
      if (strong) strong.textContent = `Kaishi Quest v${releaseVersion}`;
      if (span) span.textContent = 'Kotoba Colosseum · Listen & Strike';
      if (small) small.textContent = 'A new party battle game that turns learned Japanese into listening-based tactical combat.';
    }
    // Remove the cat from the village without disturbing any existing app.js
    // references/event wiring that may have been created during startup.
    const cat = document.getElementById('villageCat');
    if (cat) {
      cat.hidden = true;
      cat.setAttribute('aria-hidden', 'true');
      cat.style.setProperty('display', 'none', 'important');
      cat.style.pointerEvents = 'none';
    }

    if (!document.getElementById('kaishiNoVillageCatStyle')) {
      const style = document.createElement('style');
      style.id = 'kaishiNoVillageCatStyle';
      style.textContent = '#villageCat,.village-cat{display:none!important;visibility:hidden!important;pointer-events:none!important}';
      document.head.appendChild(style);
    }

    // Add the Kotoba Colosseum screen.
    if (!document.getElementById('listenBattle')) {
      const games = document.getElementById('games');
      if (games) {
        const section = document.createElement('section');
        section.id = 'listenBattle';
        section.className = 'screen';
        section.setAttribute('aria-hidden', 'true');
        section.innerHTML =
          '<div class="study-top">' +
            '<button id="kbBack">← Back</button>' +
            '<h2>Kotoba Colosseum</h2>' +
          '</div>' +
          '<article class="card kb-wrap" id="kbCard"></article>';
        games.insertAdjacentElement('afterend', section);
      }
    }

    // Keep the existing SRS battle for comparison and add the new game beside it.
    if (!document.getElementById('kotobaColosseumMode')) {
      const oldBattle = document.getElementById('decayBattleMode');
      const grid = oldBattle?.parentElement || document.querySelector('#games .game-mode-grid');
      if (grid) {
        const button = document.createElement('button');
        button.id = 'kotobaColosseumMode';
        button.className = 'battle-mode';
        button.innerHTML = '🗣️⚔️ Kotoba Colosseum · Listen &amp; Strike';
        if (oldBattle) oldBattle.insertAdjacentElement('afterend', button);
        else grid.appendChild(button);
      }
    }

    // Load the standalone game only once. app.js has already run because
    // supabase-config.js is loaded after app.js in the current index.html.
    if (!document.getElementById('kotobaColosseumScript')) {
      const script = document.createElement('script');
      script.id = 'kotobaColosseumScript';
      script.src = 'battle-listen.js?v=11.3.0';
      document.body.appendChild(script);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installKotobaColosseum, { once: true });
  } else {
    installKotobaColosseum();
  }
})();
