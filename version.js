'use strict';

/* Kaishi Japanese 11.75.0 — single source of truth for application version. */
var APP_VERSION = '11.75.0';
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

      const loadActivityPolicy = () => {
        if (window.__kaishiActivityPolicyLoaded || document.querySelector('script[data-kaishi-activity-policy]')) return;
        window.__kaishiActivityPolicyLoaded = true;
        const activityPolicy = document.createElement('script');
        activityPolicy.src = './journey-activities.js?v=' + encodeURIComponent(APP_VERSION);
        activityPolicy.setAttribute('data-kaishi-activity-policy', 'true');
        activityPolicy.onerror = () => { window.__kaishiActivityPolicyLoaded = false; };
        document.head.appendChild(activityPolicy);
      };

      script.onload = () => {
        if (window.__kaishiRoadmapEngineLoaded || document.querySelector('script[data-kaishi-roadmap-engine]')) return;
        window.__kaishiRoadmapEngineLoaded = true;
        const roadmapEngine = document.createElement('script');
        roadmapEngine.src = './roadmap-engine.js?v=' + encodeURIComponent(APP_VERSION);
        roadmapEngine.setAttribute('data-kaishi-roadmap-engine', 'true');

        const loadRoadAhead = () => {
          if (window.__kaishiRoadAheadLoaded || document.querySelector('script[data-kaishi-road-ahead]')) {
            loadActivityPolicy();
            return;
          }
          window.__kaishiRoadAheadLoaded = true;
          const roadAhead = document.createElement('script');
          roadAhead.src = './road-ahead.js?v=' + encodeURIComponent(APP_VERSION);
          roadAhead.setAttribute('data-kaishi-road-ahead', 'true');
          roadAhead.onload = loadActivityPolicy;
          roadAhead.onerror = () => { window.__kaishiRoadAheadLoaded = false; loadActivityPolicy(); };
          document.head.appendChild(roadAhead);
        };

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
          el.setAttribute('aria-label', 'Kaishi Japanese version ' + APP_VERSION + '. Check for updates and refresh the app.');
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
