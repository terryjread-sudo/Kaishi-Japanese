/* Kaishi Quest — single source of truth for the application version. */
(() => {
  const RELEASE_VERSION = '11.16.8';
  try {
    window.APP_VERSION = RELEASE_VERSION;
    window.KAISHI_VERSION = RELEASE_VERSION;
  } catch (error) {
    try { window.APP_VERSION = '11.16.8'; } catch {}
  }
})();
