'use strict';
/* Kaishi Quest — single source of truth. */
var APP_VERSION = '11.19.4';
var KAISHI_VERSION = APP_VERSION;
try { window.APP_VERSION = APP_VERSION; window.KAISHI_VERSION = KAISHI_VERSION; } catch (e) {}

/*
  Journey 11.19.4 intentionally does NOT load journey-v3.js.
  v3 and v4 were both writing to the same timeline DOM, creating a
  render/observer feedback loop that made the cards and buttons flash.
  v4 is now the sole Journey renderer.
*/
try {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const loadJourney = () => {
      if (window.__kaishiJourneyV4Loaded || document.querySelector('script[data-__kaishiJourneyV4Loaded]')) return;
      window.__kaishiJourneyV4Loaded = true;
      const script = document.createElement('script');
      script.src = './journey-v4.js?v=' + encodeURIComponent(APP_VERSION);
      script.setAttribute('data-__kaishiJourneyV4Loaded', 'true');
      script.onload = () => { window.__kaishiJourneyV4Ready = true; };
      script.onerror = () => { window.__kaishiJourneyV4Loaded = false; };
      document.head.appendChild(script);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(loadJourney, 0), {once:true});
    else setTimeout(loadJourney, 0);
  }
} catch (_) {}
