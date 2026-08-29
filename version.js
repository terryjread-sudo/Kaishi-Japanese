'use strict';
// Kaishi Quest v11.16.2 — V3 Journey patch.
// The version remains the single source of truth. The small V3 compatibility
// layer is loaded after the page has initialised so the existing app.js,
// Japan Ready and Journey code remain intact.
var APP_VERSION='11.16.2';
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const load = (src) => { if (document.querySelector(`script[data-kq-v3="${src}"]`)) return; const s=document.createElement('script'); s.src=src+'?v='+APP_VERSION; s.dataset.kqV3=src; document.body.appendChild(s); };
    load('journey-v3.js');
    const css=document.createElement('link'); css.rel='stylesheet'; css.href='journey-v3.css?v='+APP_VERSION; document.head.appendChild(css);
  }, {once:true});
}
