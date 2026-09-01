'use strict';

/* Kaishi Quest — single source of truth. */
var APP_VERSION = '11.25.24';
var KAISHI_VERSION = APP_VERSION;

try {
  window.APP_VERSION = APP_VERSION;
  window.KAISHI_VERSION = KAISHI_VERSION;
} catch (e) {}

try {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const loadLearningPlanSettings = () => {
      if (window.__kaishiLearningPlanSettingsLoaded || document.querySelector('script[data-kaishi-learning-plan-settings]')) {
        return;
      }
      window.__kaishiLearningPlanSettingsLoaded = true;
      const script = document.createElement('script');
      script.src = './learning-plan-settings.js?v=' + encodeURIComponent(APP_VERSION);
      script.setAttribute('data-kaishi-learning-plan-settings', 'true');
      script.onerror = () => { window.__kaishiLearningPlanSettingsLoaded = false; };
      document.head.appendChild(script);
    };

    const loadKeyEvents = () => {
      if (window.__kaishiJourneyKeyEventsLoaded || document.querySelector('script[data-kaishi-journey-key-events]')) {
        loadLearningPlanSettings();
        return;
      }
      window.__kaishiJourneyKeyEventsLoaded = true;
      const script = document.createElement('script');
      script.src = './journey-key-events.js?v=' + encodeURIComponent(APP_VERSION);
      script.setAttribute('data-kaishi-journey-key-events', 'true');
      script.onload = loadLearningPlanSettings;
      script.onerror = loadLearningPlanSettings;
      document.head.appendChild(script);
    };

    const loadRoadAhead = () => {
      if (window.__kaishiRoadAheadLoaded || document.querySelector('script[data-kaishi-road-ahead]')) {
        loadKeyEvents();
        return;
      }
      window.__kaishiRoadAheadLoaded = true;
      const script = document.createElement('script');
      script.src = './road-ahead.js?v=' + encodeURIComponent(APP_VERSION);
      script.setAttribute('data-kaishi-road-ahead', 'true');
      script.onload = loadKeyEvents;
      script.onerror = loadKeyEvents;
      document.head.appendChild(script);
    };

    const loadRoadmapEngine = () => {
      if (window.__kaishiRoadmapEngineLoaded || document.querySelector('script[data-kaishi-roadmap-engine]')) {
        loadRoadAhead();
        return;
      }
      window.__kaishiRoadmapEngineLoaded = true;
      const script = document.createElement('script');
      script.src = './roadmap-engine.js?v=' + encodeURIComponent(APP_VERSION);
      script.setAttribute('data-kaishi-roadmap-engine', 'true');
      script.onload = loadRoadAhead;
      script.onerror = loadRoadAhead;
      document.head.appendChild(script);
    };

    const loadJourney = () => {
      if (window.__kaishiUnifiedJourneyLoaded || document.querySelector('script[data-kaishi-unified-journey]')) {
        loadRoadmapEngine();
        return;
      }
      window.__kaishiUnifiedJourneyLoaded = true;
      const script = document.createElement('script');
      script.src = './journey.js?v=' + encodeURIComponent(APP_VERSION);
      script.setAttribute('data-kaishi-unified-journey', 'true');
      script.onload = loadRoadmapEngine;
      script.onerror = () => { window.__kaishiUnifiedJourneyLoaded = false; };
      document.head.appendChild(script);
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadJourney, {once:true});
    else loadJourney();

    const setBadge = () => {
      try {
        document.title = document.title.replace(/v\d+\.\d+\.\d+/i, 'v' + APP_VERSION);
        document.querySelectorAll('#versionBadge,.version-badge').forEach(el => {
          el.textContent = 'v' + APP_VERSION;
          el.setAttribute('aria-label', 'Kaishi Quest version ' + APP_VERSION + '.');
        });
      } catch (_) {}
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setBadge, {once:true});
    else setBadge();
  }
} catch (_) {}
