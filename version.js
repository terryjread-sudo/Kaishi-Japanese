'use strict';
// Kaishi Quest — single source of truth for the app version.
// This is the ONLY file that needs editing to release a new version number.
// It must load before every other script (see index.html) and, for the
// service worker, is pulled in with importScripts() at the top of
// service-worker.js. Release-note content (title/changes) still lives in
// version.json — update that too when you want the "What's new" dialog to
// describe the release, but the version number itself only lives here.
// `var` (not const/let) is deliberate: it attaches APP_VERSION to the shared
// global object (window in the page, self in the service worker) so every
// other script can read it, whether as a bare identifier or as
// window.APP_VERSION / self.APP_VERSION.
var APP_VERSION='11.14.0';
