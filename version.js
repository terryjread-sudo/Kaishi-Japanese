'use strict';
/* Kaishi Quest — single source of truth. Works in Window and ServiceWorkerGlobalScope. */
var APP_VERSION = '11.17.3';
var KAISHI_VERSION = APP_VERSION;
try { window.APP_VERSION = APP_VERSION; window.KAISHI_VERSION = KAISHI_VERSION; } catch (e) {}
