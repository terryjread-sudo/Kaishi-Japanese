import './game-hub.css';
import { getRuntimeConfig } from '../platform/runtime-config';

type HubHost = { show?: (id: string) => void };
const host = (): HubHost => ((window as Window & { KaishiActivityPolicy?: { kotobaCheckpoint?: HubHost } }).KaishiActivityPolicy?.kotobaCheckpoint ?? {});
const root = () => document.querySelector<HTMLElement>('#gameHubRoot');

function openCheckpoint() {
  if (!getRuntimeConfig().features.signalDesk) return;
  host().show?.('senseiDesk');
  document.body.classList.add('experimental-immersive-active');
  window.dispatchEvent(new Event('kaishi-sensei-desk-host-ready'));
}

function render() {
  const target = root();
  if (!target) return;
  const config = getRuntimeConfig();
  host().show?.('gameHub');
  const signal = config.features.signalDesk ? `<button type="button" class="game-hub-card game-hub-card--signal" data-games-checkpoint><span class="game-hub-card-icon" aria-hidden="true">☎</span><span class="game-hub-card-copy"><small class="game-hub-card-kicker">SECTION K · SIGNAL DESK</small><strong>${escapeHtml(config.gameHub.signalTitle)}</strong><small>${escapeHtml(config.gameHub.signalDescription)}</small></span><span class="game-hub-card-action">Open desk <b aria-hidden="true">→</b></span></button>` : '';
  const repair = config.features.deviceRepair ? `<button type="button" class="game-hub-card game-hub-card--repair" data-device-repair-launch><span class="game-hub-card-icon" aria-hidden="true">⌘</span><span class="game-hub-card-copy"><small class="game-hub-card-kicker">WORKSHOP · DEVICE REPAIR</small><strong>${escapeHtml(config.gameHub.deviceTitle)}</strong><small>${escapeHtml(config.gameHub.deviceDescription)}</small></span><span class="game-hub-card-action">Enter workshop <b aria-hidden="true">→</b></span></button>` : '';
  target.innerHTML = `<main class="game-hub"><header class="game-hub-heading"><span class="eyebrow">Games · ゲーム</span><h1>${escapeHtml(config.gameHub.heading)}</h1><p>${escapeHtml(config.gameHub.introduction)}</p></header><div class="game-hub-grid">${signal}${repair}${signal || repair ? '' : '<p class="game-hub-empty">Games are temporarily unavailable. Your learning progress is unaffected.</p>'}</div><button type="button" class="game-hub-back" data-games-back>← Return to Journey</button></main>`;
  target.querySelector('[data-games-checkpoint]')?.addEventListener('click', openCheckpoint);
  target.querySelector('[data-games-back]')?.addEventListener('click', () => host().show?.('journey'));
}

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));

export function installGameHub() { window.addEventListener('kaishi-games-hub-open', render); document.addEventListener('kaishi-runtime-config-changed', () => { if (document.querySelector('#gameHub.active')) render(); }); }
