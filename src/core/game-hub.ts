import './game-hub.css';

type HubHost = { show?: (id: string) => void };
const host = (): HubHost => ((window as Window & { KaishiActivityPolicy?: { kotobaCheckpoint?: HubHost } }).KaishiActivityPolicy?.kotobaCheckpoint ?? {});
const root = () => document.querySelector<HTMLElement>('#gameHubRoot');

function openCheckpoint() {
  host().show?.('senseiDesk');
  document.body.classList.add('experimental-immersive-active');
  window.dispatchEvent(new Event('kaishi-sensei-desk-host-ready'));
}

function render() {
  const target = root();
  if (!target) return;
  host().show?.('gameHub');
  target.innerHTML = `<main class="game-hub"><header class="game-hub-heading"><span class="eyebrow">Games</span><h1>Choose a Japanese challenge</h1><p>Each game strengthens your Kaishi learning record.</p></header><div class="game-hub-grid"><button type="button" class="game-hub-card" data-games-checkpoint><span aria-hidden="true">🛂</span><strong>Kotoba Checkpoint</strong><small>Inspect documents, read Japanese, and decide who can pass.</small></button><button type="button" class="game-hub-card" data-device-repair-launch><span aria-hidden="true">🔧</span><strong>Device Repair</strong><small>Repair a timed 3D device by solving linked Japanese puzzles.</small></button></div><button type="button" class="game-hub-back" data-games-back>← Journey</button></main>`;
  target.querySelector('[data-games-checkpoint]')?.addEventListener('click', openCheckpoint);
  target.querySelector('[data-games-back]')?.addEventListener('click', () => host().show?.('journey'));
}

export function installGameHub() { window.addEventListener('kaishi-games-hub-open', render); }
