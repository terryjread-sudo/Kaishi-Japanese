'use strict';

// Kaishi Quest 11.25.25 bootstrap marker.
// Do not declare APP_VERSION here: app.js owns the lexical constant. Keeping
// this file side-effect-only avoids a global const/const redeclaration error.
try {
  window.KAISHI_VERSION = '11.25.25';
  window.KAISHI_BOOT_VERSION = '11.25.25';
} catch (_) {}
