'use strict';
/* Kaishi Quest — single source of truth. Works in Window and ServiceWorkerGlobalScope. */
var APP_VERSION = '11.17.4';
var KAISHI_VERSION = APP_VERSION;
try { window.APP_VERSION = APP_VERSION; window.KAISHI_VERSION = KAISHI_VERSION; } catch (e) {}

/*
 * v11.17.4 Journey activation bridge.
 *
 * The repository already contains the canonical unified Journey renderer in
 * journey-v3.js, but older index.html shells do not load that file. Because
 * version.js is intentionally loaded before app.js, use this small bridge to
 * load the renderer after the main app has initialised. This avoids rewriting
 * the large index shell and gives the browser a versioned URL for the renderer.
 */
try {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const loadJourneyV3 = () => {
      if (window.__kaishiJourneyV3Loaded || document.querySelector('script[data-kaishi-journey-v3]')) return;
      window.__kaishiJourneyV3Loaded = true;

      const script = document.createElement('script');
      script.src = './journey-v3.js?v=' + encodeURIComponent(APP_VERSION);
      script.dataset.kaishiJourneyV3 = 'true';
      script.onload = () => {
        try {
          document.title = document.title.replace(/v\d+\.\d+\.\d+/i, 'v' + APP_VERSION);
          document.querySelectorAll('#versionBadge,.version-badge').forEach(el => {
            el.textContent = 'v' + APP_VERSION;
            el.setAttribute('aria-label', 'Kaishi Quest version ' + APP_VERSION + '. Check for updates and refresh the app.');
          });
        } catch (_) {}
      };
      script.onerror = () => { window.__kaishiJourneyV3Loaded = false; };
      document.head.appendChild(script);
    };

    // Queue after app.js's DOMContentLoaded work so journey-v3 sees the
    // fully initialised learning engine.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(loadJourneyV3, 0), { once: true });
    } else {
      setTimeout(loadJourneyV3, 0);
    }
  }
} catch (_) {}
