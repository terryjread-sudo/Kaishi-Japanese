'use strict';
/*
 * Kaishi Quest v11.25.8
 * Checkpoint UX: keep automatic progress saves, remove the checkpoint
 * decision popup at its source, and show a brief non-blocking notification.
 * Base: v11.25.7
 */
(() => {
  const PATCH = '11.25.8';
  const log = (message) => { try { window.kaishiLog?.('patch', `[${PATCH}] ${message}`); } catch (_) {} };

  function savingBubble() {
    let bubble = document.getElementById('kaishiSavingProgress');
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.id = 'kaishiSavingProgress';
      bubble.setAttribute('role', 'status');
      bubble.setAttribute('aria-live', 'polite');
      Object.assign(bubble.style, {
        position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)',
        zIndex: '2147483647', padding: '10px 16px', borderRadius: '999px',
        background: 'rgba(15,23,42,.94)', color: '#fff',
        font: '600 14px system-ui,sans-serif',
        boxShadow: '0 8px 30px rgba(0,0,0,.22)', opacity: '0',
        transition: 'opacity .18s ease', pointerEvents: 'none'
      });
      document.body.appendChild(bubble);
    }
    bubble.textContent = 'Saving progress';
    bubble.style.opacity = '1';
    clearTimeout(bubble.__timer);
    bubble.__timer = setTimeout(() => { bubble.style.opacity = '0'; }, 1600);
  }

  function matchingCheckpointIfs(source) {
    const hits = [];
    let from = 0;
    while (true) {
      const idx = source.indexOf('CHECKPOINT_INTERVAL', from);
      if (idx < 0) break;
      let pos = idx;
      while (pos >= 0) {
        const ifIdx = source.lastIndexOf('if', pos);
        if (ifIdx < 0) break;
        const open = source.indexOf('(', ifIdx + 2);
        if (open < 0 || open > idx) { pos = ifIdx - 1; continue; }
        let depth = 0, close = -1, inStr = null, esc = false;
        for (let i = open; i < source.length; i++) {
          const ch = source[i];
          if (inStr) {
            if (esc) esc = false;
            else if (ch === '\\') esc = true;
            else if (ch === inStr) inStr = null;
            continue;
          }
          if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
          if (ch === '(') depth++;
          else if (ch === ')' && --depth === 0) { close = i; break; }
        }
        if (close > idx && source.slice(open + 1, close).includes('CHECKPOINT_INTERVAL')) {
          const after = close + 1;
          let bodyStart = after;
          while (/\s/.test(source[bodyStart] || '')) bodyStart++;
          if (source[bodyStart] === '{') {
            let bdepth = 0, bodyEnd = -1, s = null, e = false;
            for (let i = bodyStart; i < source.length; i++) {
              const ch = source[i];
              if (s) {
                if (e) e = false;
                else if (ch === '\\') e = true;
                else if (ch === s) s = null;
                continue;
              }
              if (ch === '"' || ch === "'" || ch === '`') { s = ch; continue; }
              if (ch === '{') bdepth++;
              else if (ch === '}' && --bdepth === 0) { bodyEnd = i; break; }
            }
            if (bodyEnd > bodyStart) hits.push({ ifIdx, bodyStart, bodyEnd });
          }
          break;
        }
        pos = ifIdx - 1;
      }
      from = idx + 'CHECKPOINT_INTERVAL'.length;
    }
    const unique = new Map(hits.map(h => [h.bodyStart, h]));
    return [...unique.values()];
  }

  function patchNext() {
    if (window.__kaishi11258NextPatched) return true;
    const nextFn = window.next;
    if (typeof nextFn !== 'function') return false;
    const source = Function.prototype.toString.call(nextFn);
    if (!source.includes('CHECKPOINT_INTERVAL')) {
      log('next() found but no checkpoint interval; nothing patched');
      window.__kaishi11258NextPatched = true;
      return true;
    }

    const hits = matchingCheckpointIfs(source);
    if (!hits.length) {
      log('checkpoint condition found but its block could not be located');
      return false;
    }

    let patchedSource = source;
    [...hits].sort((a, b) => b.bodyStart - a.bodyStart).forEach(hit => {
      const replacement = '{ saveMissionResume(); savingBubble(); }';
      patchedSource = patchedSource.slice(0, hit.bodyStart) + replacement + patchedSource.slice(hit.bodyEnd + 1);
    });

    try {
      const patched = (0, eval)(`(${patchedSource})`);
      window.next = patched;
      window.__kaishi11258NextPatched = true;
      log(`next() patched: ${hits.length} checkpoint block(s) now save silently`);
      return true;
    } catch (error) {
      log(`next() patch failed: ${error?.message || error}`);
      return false;
    }
  }

  function start() {
    if (window.__kaishi11258Started) return;
    window.__kaishi11258Started = true;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      if (patchNext() || attempts > 120) clearInterval(timer);
    }, 50);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.KaishiCheckpointUX = {
    version: PATCH,
    mode: 'automatic-save',
    notification: 'Saving progress'
  };
})();
