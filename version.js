'use strict';

/* Kaishi Quest 11.25.28 — single source of truth for application version. */
var APP_VERSION = '11.25.28';
try {
  window.APP_VERSION = APP_VERSION;
  window.KAISHI_VERSION = APP_VERSION;
  window.KAISHI_BOOT_VERSION = APP_VERSION;
} catch (_) {}
