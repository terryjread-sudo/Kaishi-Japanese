/* Kaishi Quest — single source of truth for the application version. */
(() => {
  const RELEASE_VERSION = '11.16.6';
  try {
    // APP_VERSION is the canonical contract used by app.js and release-manager.js.
    window.APP_VERSION = RELEASE_VERSION;
    // Backwards-compatible alias for older integrations; do not use this for new code.
    window.KAISHI_VERSION = RELEASE_VERSION;
  } catch (error) {
    // Keep this file fail-safe: version setup must never throw during startup.
    try { window.APP_VERSION = '11.16.6'; } catch {}
  }
})();
