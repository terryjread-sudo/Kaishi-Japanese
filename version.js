'use strict';
// Kaishi Quest v11.16.4 — Journey crash/audio reliability patch.
var APP_VERSION='11.16.4';
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const load = (src) => {
      if (document.querySelector(`script[data-kq-patch="${src}"]`)) return;
      const s=document.createElement('script'); s.src=src+'?v='+APP_VERSION; s.dataset.kqPatch=src; document.body.appendChild(s);
    };
    load('journey-v3.js');
    load('japan-ready.js');
    const css=document.createElement('link'); css.rel='stylesheet'; css.href='journey-v3.css?v='+APP_VERSION; document.head.appendChild(css);
  }, {once:true});
}
