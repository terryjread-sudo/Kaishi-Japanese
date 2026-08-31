'use strict';

/* Kaishi Quest — single source of truth. */
var APP_VERSION = '11.25.5';
var KAISHI_VERSION = APP_VERSION;

try {
  window.APP_VERSION = APP_VERSION;
  window.KAISHI_VERSION = KAISHI_VERSION;
} catch (e) {}

try {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const loadJourney = () => {
      if (window.__kaishiUnifiedJourneyLoaded || document.querySelector('script[data-kaishi-unified-journey]')) return;
      window.__kaishiUnifiedJourneyLoaded = true;

      const script = document.createElement('script');
      script.src = './journey.js?v=' + encodeURIComponent(APP_VERSION);
      script.setAttribute('data-kaishi-unified-journey', 'true');

      script.onload = () => {
        if (window.__kaishiRoadmapEngineLoaded || document.querySelector('script[data-kaishi-roadmap-engine]')) return;
        window.__kaishiRoadmapEngineLoaded = true;
        const roadmapEngine = document.createElement('script');
        roadmapEngine.src = './roadmap-engine.js?v=' + encodeURIComponent(APP_VERSION);
        roadmapEngine.setAttribute('data-kaishi-roadmap-engine', 'true');

        const loadRoadAhead = () => {
          if (window.__kaishiRoadAheadLoaded || document.querySelector('script[data-kaishi-road-ahead]')) return;
          window.__kaishiRoadAheadLoaded = true;
          const roadAhead = document.createElement('script');
          roadAhead.src = './road-ahead.js?v=' + encodeURIComponent(APP_VERSION);
          roadAhead.setAttribute('data-kaishi-road-ahead', 'true');
          roadAhead.onerror = () => { window.__kaishiRoadAheadLoaded = false; };
          document.head.appendChild(roadAhead);
        };

        // road-ahead.js reads from window.KaishiRoadmap, so it must load
        // after roadmap-engine.js regardless of success/failure.
        roadmapEngine.onload = loadRoadAhead;
        roadmapEngine.onerror = () => { window.__kaishiRoadmapEngineLoaded = false; loadRoadAhead(); };
        document.head.appendChild(roadmapEngine);
      };

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

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setBadge, {once:true});
    } else {
      setBadge();
    }
  }
} catch (_) {}
