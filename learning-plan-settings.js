'use strict';

/*
 * Kaishi Quest — Learning Plan Settings
 * v11.25.20
 *
 * Adds a manual "Regenerate learning plan" control to Settings.
 *
 * Regeneration is deliberately non-destructive:
 * - learner progress is untouched;
 * - SRS history is untouched;
 * - mastery is untouched;
 * - only the derived roadmap/plan is rebuilt.
 */
(() => {
  const STYLE_ID = 'kqLearningPlanSettingsStyles';
  const CONTROL_ID = 'kqRegenerateLearningPlan';
  const MODAL_ID = 'kqRegenerateLearningPlanModal';

  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'
  }[c]));

  const addStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .kq-learning-plan-settings {
        margin-top: 16px;
        padding: 14px;
        border: 1px solid rgba(100,116,139,.20);
        border-radius: 16px;
        background: rgba(100,116,139,.045);
      }
      .kq-learning-plan-settings .kq-lps-title {
        display:block;
        font-weight:800;
        margin-bottom:4px;
      }
      .kq-learning-plan-settings .kq-lps-copy {
        display:block;
        font-size:.82rem;
        line-height:1.45;
        opacity:.72;
        margin-bottom:10px;
      }
      .kq-learning-plan-settings button {
        width:100%;
        min-height:42px;
        border:0;
        border-radius:12px;
        padding:9px 13px;
        font:inherit;
        font-weight:800;
        cursor:pointer;
      }
      #${MODAL_ID} {
        position:fixed;
        inset:0;
        z-index:2147483000;
        display:grid;
        place-items:center;
        padding:20px;
        background:rgba(15,23,42,.48);
      }
      #${MODAL_ID}[hidden] { display:none; }
      #${MODAL_ID} .kq-lps-dialog {
        width:min(100%,430px);
        padding:22px;
        border-radius:20px;
        background:var(--card-bg,#fff);
        color:inherit;
        box-shadow:0 20px 70px rgba(0,0,0,.28);
      }
      #${MODAL_ID} h2 { margin:0 0 8px; font-size:1.2rem; }
      #${MODAL_ID} p { margin:0 0 16px; line-height:1.5; opacity:.78; }
      #${MODAL_ID} .kq-lps-actions {
        display:flex; gap:9px; justify-content:flex-end; flex-wrap:wrap;
      }
      #${MODAL_ID} button {
        min-height:42px; padding:9px 14px; border-radius:12px;
        border:1px solid rgba(100,116,139,.22); font:inherit; font-weight:800;
      }
      #${MODAL_ID} .primary { border:0; }
      #${MODAL_ID} .kq-lps-status {
        min-height:1.4em; margin:0 0 12px; font-weight:750;
      }
    `;
    document.head.appendChild(style);
  };

  const findSettingsContainer = () => {
    const candidates = [
      '#settingsModal',
      '#settingsPanel',
      '#settings',
      '.settings-modal',
      '.settings-panel',
      '[data-screen="settings"]'
    ];

    for (const selector of candidates) {
      const el = document.querySelector(selector);
      if (el && el.offsetParent !== null) return el;
    }

    const button = document.getElementById('settingsBtn');
    if (button) {
      let parent = button.closest('header');
      for (let i=0; i<5 && parent; i++, parent=parent.parentElement) {
        const text = (parent.textContent || '').toLowerCase();
        if (text.includes('settings') || text.includes('preferences')) {
          if (parent.offsetParent !== null) return parent;
        }
      }
    }
    return null;
  };

  const showToast = message => {
    let toast = document.getElementById('kqLearningPlanToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'kqLearningPlanToast';
      Object.assign(toast.style, {
        position:'fixed', left:'50%', bottom:'24px', transform:'translateX(-50%)',
        zIndex:'2147483647', padding:'10px 15px', borderRadius:'999px',
        background:'rgba(15,23,42,.94)', color:'#fff',
        font:'700 14px system-ui,sans-serif', boxShadow:'0 8px 30px rgba(0,0,0,.22)',
        opacity:'0', transition:'opacity .18s ease', pointerEvents:'none'
      });
      toast.setAttribute('role','status');
      toast.setAttribute('aria-live','polite');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    clearTimeout(toast.__timer);
    toast.__timer = setTimeout(() => { toast.style.opacity='0'; }, 1800);
  };

  const regenerate = () => {
    let roadmap = null;
    try {
      if (window.KaishiRoadmap?.refresh) roadmap = window.KaishiRoadmap.refresh();
    } catch (_) {}

    /*
     * Re-render the existing Journey surfaces. None of these operations clears
     * learner progress; they only consume the newly generated derived plan.
     */
    try { window.renderJourneyPathAhead?.(); } catch (_) {}
    try { window.KaishiJourneyKeyEvents?.render?.(); } catch (_) {}
    try { window.dispatchEvent(new Event('kaishi-roadmap-updated')); } catch (_) {}

    showToast(
      roadmap ? '✓ Learning plan updated' : 'Learning plan will refresh when Journey data is ready'
    );
    return Boolean(roadmap);
  };

  const createFallbackModal = () => {
    addStyles();
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.hidden = true;
    modal.innerHTML = `
      <div class="kq-lps-dialog" role="dialog" aria-modal="true"
           aria-labelledby="${MODAL_ID}Title">
        <h2 id="${MODAL_ID}Title">Regenerate learning plan?</h2>
        <p>This will rebuild your upcoming lessons and activities using your current progress. It will not erase your progress, reviews or mastery.</p>
        <div class="kq-lps-status" aria-live="polite"></div>
        <div class="kq-lps-actions">
          <button type="button" data-kq-lps-cancel>Cancel</button>
          <button type="button" class="primary" data-kq-lps-confirm>Regenerate</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => { modal.hidden = true; };
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('[data-kq-lps-cancel]')) close();
      if (event.target.closest('[data-kq-lps-confirm]')) {
        const status = modal.querySelector('.kq-lps-status');
        status.textContent = 'Regenerating…';
        const ok = regenerate();
        status.textContent = ok ? '✓ Learning plan updated.' : 'Journey data is still loading.';
        setTimeout(close, 500);
      }
    });

    return modal;
  };

  const openRegenerator = () => {
    const modal = createFallbackModal();
    modal.hidden = false;
  };

  const makeControl = () => {
    addStyles();
    if (document.getElementById(CONTROL_ID)) return true;

    const container = findSettingsContainer();
    if (!container) return false;

    const section = document.createElement('section');
    section.className = 'kq-learning-plan-settings';
    section.innerHTML = `
      <span class="kq-lps-title">Learning plan</span>
      <span class="kq-lps-copy">Rebuild your upcoming lesson and activity plan using your current progress. Your learning history is not erased.</span>
      <button type="button" id="${CONTROL_ID}">Regenerate learning plan</button>
    `;
    container.appendChild(section);

    section.querySelector('button').addEventListener('click', openRegenerator);
    return true;
  };

  const install = () => {
    if (document.documentElement.dataset.kqLearningPlanSettingsInstalled === '1') return;
    document.documentElement.dataset.kqLearningPlanSettingsInstalled = '1';
    addStyles();

    const tryInstall = () => {
      makeControl();
    };

    tryInstall();

    const settingsButton = document.getElementById('settingsBtn');
    settingsButton?.addEventListener('click', () => {
      setTimeout(tryInstall, 50);
      setTimeout(tryInstall, 250);
      setTimeout(tryInstall, 700);
    }, { passive:true });

    const observer = new MutationObserver(() => {
      if (!document.getElementById(CONTROL_ID)) tryInstall();
    });
    observer.observe(document.body, { childList:true, subtree:true });

    window.addEventListener('kaishi-roadmap-updated', tryInstall, { passive:true });

    window.dispatchEvent(new Event('kaishi-learning-plan-settings-ready'));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once:true });
  } else {
    install();
  }

  window.KaishiLearningPlanSettings = {
    version:'11.25.20',
    regenerate,
    open:openRegenerator
  };
})();
