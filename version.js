'use strict';

/* Kaishi Japanese 11.149.0 — single source of truth for application version. */
var APP_VERSION = '11.149.0';
var KAISHI_VERSION = APP_VERSION;

try {
  window.APP_VERSION = APP_VERSION;
  window.KAISHI_VERSION = KAISHI_VERSION;
} catch (e) {}

try {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const setBadge = () => {
      try {
        document.title = /v\d+\.\d+\.\d+/i.test(document.title)
          ? document.title.replace(/v\d+\.\d+\.\d+/i, 'v' + APP_VERSION)
          : `${document.title} • v${APP_VERSION}`;
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
