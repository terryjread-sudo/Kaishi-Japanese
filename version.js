'use strict';

/*
 * Kaishi Quest 11.25.26 startup repair.
 *
 * This file is the normal bootstrap script (not a patch overlay).
 * The 11.25.26 app.js starts init() and then immediately emits
 * kaishi:core-ready, even though its async core data loads are not
 * finished.  Journey/roadmap listeners can therefore run against an
 * uninitialised deck.
 *
 * Keep APP_VERSION in app.js.  This bootstrap only:
 *  - suppresses the premature core-ready event;
 *  - observes the eight core data fetches;
 *  - emits core-ready after Promise.all() has had a chance to continue.
 */

try {
  window.KAISHI_VERSION = '11.25.26';
  window.KAISHI_BOOT_VERSION = '11.25.26';

  const originalFetch = window.fetch.bind(window);
  const coreFiles = [
    'data/vocabulary.json',
    'data/kana.json',
    'data/manga-stories.json',
    'data/conversations.json',
    'data/theatre-scenes.json',
    'data/grammar-lessons.json',
    'data/kanji-components.json',
    'memory-scenes.json'
  ];

  let coreRemaining = coreFiles.length;
  let coreComplete = false;
  let coreReadyQueued = false;

  const isCoreRequest = input => {
    try {
      const raw = typeof input === 'string' ? input : input?.url || '';
      const pathname = new URL(raw, document.baseURI).pathname;
      return coreFiles.some(file => pathname.endsWith('/' + file));
    } catch (_) {
      return false;
    }
  };

  const emitCoreReady = () => {
    if (coreComplete || coreReadyQueued) return;
    coreReadyQueued = true;
    /*
     * Queue this after the fetch promise handler has returned.  This lets
     * app.js's Promise.all() continuation run first, so updateHome() and
     * the core deck state are established before Journey listeners run.
     */
    queueMicrotask(() => {
      coreComplete = true;
      try {
        window.__KAISHI_CORE_READY__ = true;
        window.dispatchEvent(new CustomEvent('kaishi:core-ready', {
          detail: { version: window.KAISHI_VERSION, repaired: true }
        }));
      } catch (_) {}
    });
  };

  window.fetch = function(input, init) {
    const core = isCoreRequest(input);
    return originalFetch(input, init).then(response => {
      if (core && !coreComplete) {
        coreRemaining = Math.max(0, coreRemaining - 1);
        if (coreRemaining === 0) emitCoreReady();
      }
      return response;
    });
  };

  /*
   * 11.25.26 app.js emits a premature core-ready immediately after init().
   * Hold that event until our core-fetch gate above has completed.
   */
  const originalDispatchEvent = window.dispatchEvent.bind(window);
  window.dispatchEvent = function(event) {
    if (event?.type === 'kaishi:core-ready' && !coreComplete) return true;
    return originalDispatchEvent(event);
  };
} catch (_) {}
