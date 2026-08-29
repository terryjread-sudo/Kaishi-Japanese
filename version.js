'use strict';
/* Kaishi Quest — single source of truth. */
var APP_VERSION = '11.19.5';
var KAISHI_VERSION = APP_VERSION;
try { window.APP_VERSION = APP_VERSION; window.KAISHI_VERSION = KAISHI_VERSION; } catch (e) {}

/*
  Stable Journey loading:
  journey-v3 owns the timeline DOM. journey-v4 only enhances already-rendered
  cards and never becomes a second renderer.
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
    const loadJourney = () => loadScript('./journey-v3.js', '__kaishiJourneyV3Loaded', () => {
      loadScript('./journey-v4.js', '__kaishiJourneyV4Loaded');
    });
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(loadJourney, 0), {once:true});
    } else setTimeout(loadJourney, 0);

    try {
      document.title = document.title.replace(/v\d+\.\d+\.\d+/i, 'v' + APP_VERSION);
      document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('#versionBadge,.version-badge').forEach(el => {
          el.textContent = 'v' + APP_VERSION;
          el.setAttribute('aria-label', 'Kaishi Quest version ' + APP_VERSION + '. Check for updates and refresh the app.');
        });
      }, {once:true});
    } catch (_) {}
  }
} catch (_) {}
