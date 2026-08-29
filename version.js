'use strict';

/* Kaishi Quest — single source of truth. */
var APP_VERSION = '11.20.1';
var KAISHI_VERSION = APP_VERSION;

try {
  window.APP_VERSION = APP_VERSION;
  window.KAISHI_VERSION = KAISHI_VERSION;
} catch (e) {}

/*
 * Journey architecture:
 *   app.js      = learning engine / data / lesson execution
 *   journey.js = the ONLY Journey UI renderer
 *
 * The former journey-v3.js and journey-v4.js are intentionally not loaded.
 */
try {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const loadJourney = () => {
      if (window.__kaishiUnifiedJourneyLoaded || document.querySelector('script[data-kaishi-unified-journey]')) return;
      window.__kaishiUnifiedJourneyLoaded = true;
      const script = document.createElement('script');
      script.src = './journey.js?v=' + encodeURIComponent(APP_VERSION);
      script.setAttribute('data-kaishi-unified-journey', 'true');
      script.onerror = () => { window.__kaishiUnifiedJourneyLoaded = false; };
      document.head.appendChild(script);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadJourney, {once:true});
    } else {
      loadJourney();
    }

    const setBadge = () => {
      try {
        document.title = document.title.replace(/v\d+\.\d+\.\d+/i, 'v' + APP_VERSION);
        document.querySelectorAll('#versionBadge,.version-badge').forEach(el => {
          el.textContent = 'v' + APP_VERSION;
          el.setAttribute('aria-label', 'Kaishi Quest version ' + APP_VERSION + '. Check for updates and refresh the app.');
        });
      } catch (_) {}
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setBadge, {once:true});
    else setBadge();
  }
} catch (_) {}
