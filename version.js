'use strict';
/* Kaishi Quest — single source of truth. Works in Window and ServiceWorkerGlobalScope. */
var APP_VERSION = '11.18.0';
var KAISHI_VERSION = APP_VERSION;
try { window.APP_VERSION = APP_VERSION; window.KAISHI_VERSION = KAISHI_VERSION; } catch (e) {}

/*
 * v11.18.0 Journey activation bridge.
 * Loads the canonical Journey renderer followed by its interaction layer.
 */
try {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const loadScript = (src, marker, onload) => {
      if (window[marker] || document.querySelector(`script[data-${marker}]`)) {
        if (onload) onload();
        return;
      }
      window[marker] = true;
      const script = document.createElement('script');
      script.src = src + '?v=' + encodeURIComponent(APP_VERSION);
      script.setAttribute('data-' + marker, 'true');
      script.onload = () => { if (onload) onload(); };
      script.onerror = () => { window[marker] = false; };
      document.head.appendChild(script);
    };

    const loadJourney = () => {
      loadScript('./journey-v3.js', '__kaishiJourneyV3Loaded', () => {
        loadScript('./journey-v4.js', '__kaishiJourneyV4Loaded');
        try {
          document.title = document.title.replace(/v\d+\.\d+\.\d+/i, 'v' + APP_VERSION);
          document.querySelectorAll('#versionBadge,.version-badge').forEach(el => {
            el.textContent = 'v' + APP_VERSION;
            el.setAttribute('aria-label', 'Kaishi Quest version ' + APP_VERSION + '. Check for updates and refresh the app.');
          });
        } catch (_) {}
      });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(loadJourney, 0), { once: true });
    } else {
      setTimeout(loadJourney, 0);
    }
  }
} catch (_) {}
