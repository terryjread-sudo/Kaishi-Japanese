const JOURNEY_RENDER_REQUESTED = 'kaishi-journey-render-requested';
const JOURNEY_RENDERED = 'kaishi-journey-rendered';
const JOURNEY_PENDING_CLASS = 'journey-render-pending';

function journeyIsVisible(): boolean {
  return document.getElementById('journey')?.classList.contains('active') ?? false;
}

function setJourneyRenderPending(pending: boolean): void {
  document.body.classList.toggle(JOURNEY_PENDING_CLASS, pending);
  const journey = document.getElementById('journey');
  journey?.setAttribute('aria-busy', String(pending));
}

// The Journey renderer is still being migrated from the legacy runtime. This
// shell owns the hand-off state so old history markup can never be painted as
// the new Journey screen is mounting.
setJourneyRenderPending(true);

document.addEventListener(JOURNEY_RENDER_REQUESTED, () => {
  if (journeyIsVisible() || document.body.classList.contains('experimental-journey-enabled')) {
    setJourneyRenderPending(true);
  }
});

document.addEventListener(JOURNEY_RENDERED, () => {
  if (journeyIsVisible()) setJourneyRenderPending(false);
});

window.addEventListener('pageshow', () => {
  if (journeyIsVisible()) setJourneyRenderPending(true);
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && journeyIsVisible()) setJourneyRenderPending(true);
});
