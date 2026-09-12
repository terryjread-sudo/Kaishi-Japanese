import { z } from 'zod';
import { createVersionedRepository, sessionStorage } from '../platform/storage';
import { evaluateChain } from '../domains/kotoba-ascension/chains';
import { availableMapNodes, visitMapNode } from '../domains/kotoba-ascension/map';
import { applyDamage, chooseCards, createRun, refreshTurn, startNode } from '../domains/kotoba-ascension/run';
import type { AscensionRunState, AscensionWord } from '../domains/kotoba-ascension/types';

interface AscensionTopic { id: string; title: string; words?: AscensionWord[]; }
interface AscensionHost {
  show?: (id: string) => void;
  vocabulary?: () => AscensionWord[];
  progress?: () => Record<string, unknown>;
  topics?: () => AscensionTopic[];
  topicStats?: (topic: AscensionTopic) => { bossReady?: boolean; complete?: boolean };
  gradeWord?: (wordId: string, skill: string, rating: number, correct: boolean) => void;
  completeTopicBoss?: (topicId: string, passed?: boolean) => void;
  adventurePoints?: () => number;
  spendAdventurePoints?: (cost: number) => boolean;
  speak?: (text: string) => void;
}

declare global {
  interface Window { KaishiActivityPolicy?: Record<string, unknown>; }
}

const RUN_KEY = 'kaishi-kotoba-ascension-run';
const runSchema = z.custom<AscensionRunState>((value) => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AscensionRunState>;
  return candidate.schemaVersion === 1 && typeof candidate.runId === 'string' && Array.isArray(candidate.deck) && candidate.map !== undefined;
});

let fallbackWords: AscensionWord[] = [];
let fallbackTopics: AscensionTopic[] = [];
function fallbackShow(id: string): void {
  document.querySelectorAll<HTMLElement>('.screen').forEach((item) => item.classList.toggle('active', item.id === id));
  document.body.classList.toggle('experimental-immersive-active', id === 'ascension');
  document.querySelector('#experimentalBottomNav')?.classList.toggle('is-hidden', id !== 'ascension');
}
function host(): AscensionHost {
  const policy = window.KaishiActivityPolicy?.ascension as AscensionHost | undefined;
  return policy ?? { show: fallbackShow, vocabulary: () => fallbackWords, progress: () => ({}), topics: () => fallbackTopics };
}
function ensureHost(): void {
  const policy = window.KaishiActivityPolicy ?? {};
  const existing = policy.ascension as AscensionHost | undefined;
  window.KaishiActivityPolicy = { ...policy, ascension: { show: fallbackShow, vocabulary: () => fallbackWords, progress: () => ({}), topics: () => fallbackTopics, ...existing } };
}
async function loadFallbackContent(): Promise<void> {
  try {
    const [wordResponse, topicResponse] = await Promise.all([fetch('data/vocabulary.json'), fetch('data/topics-v72.json')]);
    const words = await wordResponse.json() as unknown;
    const topics = await topicResponse.json() as { topics?: unknown };
    fallbackWords = Array.isArray(words) ? words as AscensionWord[] : [];
    fallbackTopics = Array.isArray(topics.topics) ? topics.topics as AscensionTopic[] : [{ id: 'core-japanese', title: 'Core Japanese' }];
    ensureHost();
    if (screen()?.classList.contains('active') && !repository().load()) renderMenu();
  } catch { /* The legacy host may still provide content while offline. */ }
}
function escapeHtml(value: unknown): string { return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character); }
function repository() { return createVersionedRepository({ storage: sessionStorage(), key: RUN_KEY, version: 1, schema: runSchema }); }
function screen(): HTMLElement | null { return document.querySelector<HTMLElement>('#ascension'); }

function topicWords(topic: AscensionTopic): AscensionWord[] {
  if (topic.words?.length) return topic.words;
  const words = host().vocabulary?.() ?? [];
  const matches = words.filter((word) => word.topicId === topic.id);
  return (matches.length ? matches : words).slice(0, 24);
}

function renderMenu(): void {
  const target = screen();
  if (!target) return;
  const topics = host().topics?.() ?? [];
  const availableTopics = topics.filter((topic) => {
    const stats = host().topicStats?.(topic);
    return Boolean(stats?.bossReady || stats?.complete || topic.id === 'core-japanese');
  });
  target.innerHTML = `<div class="ascension-shell"><header class="ascension-heading"><div><span class="eyebrow">Kotoba Ascension · 言葉の塔</span><h1>Learn Japanese by climbing.</h1><p>Build useful sentences, defend your meaning, and carry the words into your regular review deck.</p></div><button type="button" class="ascension-exit" data-ascension-exit>← Journey</button></header><section class="ascension-hero"><span class="ascension-crest" aria-hidden="true">⛩</span><div><strong>A game route for every learner</strong><p>The Prologue is always open. You can learn the basics here before the guided Journey catches up.</p></div></section><div class="ascension-menu-grid"><button type="button" class="ascension-prologue" data-ascension-start="prologue"><span>第一歩</span><strong>Beginner Prologue</strong><small>Start → Combat → Rest → Boss</small></button>${availableTopics.map((topic) => `<button type="button" data-ascension-start="${escapeHtml(topic.id)}"><span>${escapeHtml(topic.id === 'core-japanese' ? '基礎' : '話題')}</span><strong>${escapeHtml(topic.title)}</strong><small>${host().topicStats?.(topic)?.bossReady ? 'Topic run ready' : 'Complete the guided practice first'}</small></button>`).join('')}</div><p class="ascension-note">Open Ascension directly from the bottom navigation whenever you want a game session.</p></div>`;
  target.querySelectorAll<HTMLElement>('[data-ascension-start]').forEach((button) => button.onclick = () => start(button.dataset.ascensionStart ?? 'prologue'));
  target.querySelector<HTMLElement>('[data-ascension-exit]')?.addEventListener('click', () => exitToJourney());
}

function start(kind: string): void {
  const topics = host().topics?.() ?? [];
  const topic = kind === 'prologue' ? topics.find((item) => item.id === 'core-japanese') ?? topics[0] : topics.find((item) => item.id === kind);
  const words = topicWords(topic ?? { id: 'core-japanese', title: 'Core Japanese' });
  const run = createRun({ runId: `ascension-${Date.now()}`, seed: Date.now(), topicId: topic?.id ?? 'core-japanese', words, progressById: host().progress?.() ?? {}, adventurePoints: host().adventurePoints?.() ?? 0, prologue: kind === 'prologue' });
  repository().save(run);
  renderRun(run);
}

function exitToJourney(): void {
  const active = repository().load();
  if (active && !['victory', 'defeat'].includes(active.phase) && !window.confirm('Leave Kotoba Ascension? Your current run will be kept for this session.')) return;
  host().show?.('journey');
}

function renderRun(state: AscensionRunState): void {
  const target = screen();
  if (!target) return;
  if (state.phase === 'map') return renderMap(state);
  if (state.phase === 'combat' || state.phase === 'boss') return renderCombat(state);
  if (state.phase === 'rest') return renderRest(state);
  if (state.phase === 'shop') return renderShop(state);
  renderEnd(state);
}

function frame(state: AscensionRunState, content: string): string {
  const resource = state.resources;
  return `<div class="ascension-shell"><header class="ascension-heading"><div><span class="eyebrow">${state.prologue ? 'Beginner Prologue' : 'Kotoba Ascension'} · ${escapeHtml(state.topicId)}</span><h1>${state.phase === 'map' ? 'Choose your path' : state.phase === 'combat' || state.phase === 'boss' ? 'Make a useful chain' : state.phase === 'rest' ? 'A quiet place to recover' : state.phase === 'shop' ? 'Prepare for the climb' : state.phase === 'victory' ? 'The summit is yours' : 'The climb can continue'}</h1></div><button type="button" class="ascension-exit" data-ascension-exit>× Exit</button></header><div class="ascension-resource-strip"><span>♥ ${resource.hp}/${resource.maxHp}</span><span>✦ ${resource.energy}/${resource.maxEnergy} energy</span><span>◈ ${resource.focus}/${resource.maxFocus} focus</span><span>AP ${resource.adventurePoints}</span></div>${content}</div>`;
}

function renderMap(state: AscensionRunState): void {
  const target = screen();
  if (!target) return;
  const current = state.map.nodes.find((node) => node.id === state.map.currentNodeId);
  const nodes = state.map.nodes.map((node) => `<span class="ascension-map-node ${node.id === current?.id ? 'current' : ''} ${node.layer < (current?.layer ?? 0) ? 'visited' : ''}">${node.type === 'boss' ? '⛩' : node.type === 'combat' ? '⚔' : node.type === 'elite' ? '☠' : node.type === 'rest' ? '♨' : '宝'}<small>${escapeHtml(node.label)}</small></span>`).join('');
  const choices = availableMapNodes(state.map).map((node) => `<button type="button" data-ascension-node="${escapeHtml(node.id)}"><b>${node.type === 'boss' ? '⛩' : node.type === 'combat' ? '⚔' : node.type === 'elite' ? '☠' : node.type === 'rest' ? '♨' : '宝'}</b>${escapeHtml(node.label)}<small>${node.type === 'boss' ? 'Face the topic guardian' : node.type === 'rest' ? 'Recover and study' : node.type === 'shop' ? 'Spend AP' : 'Test your chain'}</small></button>`).join('');
  target.innerHTML = frame(state, `<section class="ascension-map-card"><div class="ascension-map" aria-label="Ascension path">${nodes}</div><p class="ascension-message">${escapeHtml(state.pendingMessage)}</p><div class="ascension-choice-grid">${choices}</div></section>`);
  bindExit(target); target.querySelectorAll<HTMLElement>('[data-ascension-node]').forEach((button) => button.onclick = () => chooseNode(state, button.dataset.ascensionNode ?? ''));
}

function chooseNode(state: AscensionRunState, nodeId: string): void {
  const map = visitMapNode(state.map, nodeId);
  const node = map.nodes.find((item) => item.id === nodeId);
  if (!node) return;
  const next = { ...state, map };
  if (node.type === 'rest' || node.type === 'shop') { repository().save({ ...next, phase: node.type }); renderRun({ ...next, phase: node.type }); return; }
  const combat = startNode(next, node.type === 'boss' ? 'boss' : node.type === 'elite' ? 'elite' : 'combat'); repository().save(combat); renderRun(combat);
}

function renderCombat(state: AscensionRunState): void {
  const target = screen();
  if (!target || !state.enemy) return;
  const selected = new Set(state.selectedCardIds);
  const cards = state.hand.map((card) => `<button type="button" class="ascension-card ${selected.has(card.id) ? 'selected' : ''}" data-ascension-card="${escapeHtml(card.id)}"><b>${escapeHtml(card.text)}</b><small>${escapeHtml(card.meaning ?? (card.particle ? 'grammar connector' : ''))}</small></button>`).join('');
  target.innerHTML = frame(state, `<section class="ascension-battle-card"><div class="ascension-enemy"><span class="ascension-enemy-sprite">${state.enemy.boss ? '⛩' : state.enemy.elite ? '👹' : '🦝'}</span><div><span class="eyebrow">${state.enemy.boss ? 'Final test' : state.enemy.elite ? 'Elite encounter' : 'Encounter'}</span><h2>${escapeHtml(state.enemy.name)}</h2><p>Telegraph: <b>${state.enemy.telegraph} damage</b></p><i><b style="width:${state.enemy.hp / state.enemy.maxHp * 100}%"></b></i></div></div><p class="ascension-message">${escapeHtml(state.pendingMessage)}</p><div class="ascension-hand" aria-label="Choose cards">${cards}</div><div class="ascension-battle-actions"><button type="button" class="primary" data-ascension-play>Use chain</button><button type="button" data-ascension-audio>🔊 Hear a card</button></div><p class="ascension-tip">Try noun + を + verb for an attack, or noun + で + verb to defend.</p></section>`);
  bindExit(target);
  target.querySelectorAll<HTMLElement>('[data-ascension-card]').forEach((button) => button.onclick = () => toggleCard(state, button.dataset.ascensionCard ?? ''));
  target.querySelector<HTMLElement>('[data-ascension-play]')?.addEventListener('click', () => playChain(state));
  target.querySelector<HTMLElement>('[data-ascension-audio]')?.addEventListener('click', () => { const card = state.hand.find((item) => item.wordId); if (card) host().speak?.(card.reading ?? card.text); });
}

function toggleCard(state: AscensionRunState, id: string): void {
  const selected = state.hand.filter((card) => state.selectedCardIds.includes(card.id) !== (card.id === id));
  const next = chooseCards(state, selected); repository().save(next); renderRun(next);
}

function playChain(state: AscensionRunState): void {
  const cards = state.hand.filter((card) => state.selectedCardIds.includes(card.id));
  const result = evaluateChain(cards, state.resources.energy, state.resources.focus);
  if (result.outcome !== 'fizzle') cards.filter((card) => card.wordId).forEach((card) => host().gradeWord?.(card.wordId!, 'meaning', result.outcome === 'full' ? 3 : 2, true));
  const nextResources = { ...state.resources, energy: Math.max(0, state.resources.energy - result.energySpent), focus: Math.max(0, state.resources.focus - result.focusSpent) };
  let next = applyDamage({ ...state, resources: nextResources, pendingMessage: result.explanation }, result.damage, result.block);
  if (next.phase === 'map' && next.enemy?.hp === 0) next = { ...next, pendingMessage: 'Choose your next node.' };
  if (next.phase === 'victory' && state.prologue) host().completeTopicBoss?.(state.topicId, true);
  if (next.phase === 'victory' && !state.prologue) host().completeTopicBoss?.(state.topicId, true);
  if (next.phase === 'combat' || next.phase === 'boss') next = refreshTurn(next);
  repository().save(next); renderRun(next);
}

function renderRest(state: AscensionRunState): void {
  const target = screen(); if (!target) return;
  target.innerHTML = frame(state, `<section class="ascension-service-card"><span class="ascension-service-icon">♨</span><h2>Rest at the study house</h2><p>Recover 18 HP, or study one card to strengthen the next chain.</p><div class="ascension-battle-actions"><button type="button" class="primary" data-ascension-rest>Recover HP</button><button type="button" data-ascension-study>Study a card</button></div></section>`);
  bindExit(target); target.querySelector<HTMLElement>('[data-ascension-rest]')?.addEventListener('click', () => leaveService({ ...state, resources: { ...state.resources, hp: Math.min(state.resources.maxHp, state.resources.hp + 18), energy: state.resources.maxEnergy, focus: state.resources.maxFocus }, phase: 'map', pendingMessage: 'You feel ready for the next lesson.' }));
  target.querySelector<HTMLElement>('[data-ascension-study]')?.addEventListener('click', () => leaveService({ ...state, resources: { ...state.resources, focus: state.resources.maxFocus }, phase: 'map', pendingMessage: 'A focused review will make your next chain stronger.' }));
}

function renderShop(state: AscensionRunState): void {
  const target = screen(); if (!target) return;
  target.innerHTML = frame(state, `<section class="ascension-service-card"><span class="ascension-service-icon">宝</span><h2>Word market</h2><p>Adventure points: ${state.resources.adventurePoints}. Add a little energy or remove a weak card.</p><div class="ascension-battle-actions"><button type="button" class="primary" data-ascension-buy>Buy energy · 3 AP</button><button type="button" data-ascension-leave>Leave shop</button></div></section>`);
  bindExit(target); target.querySelector<HTMLElement>('[data-ascension-buy]')?.addEventListener('click', () => { if (!host().spendAdventurePoints?.(3)) return; leaveService({ ...state, resources: { ...state.resources, energy: state.resources.maxEnergy, adventurePoints: Math.max(0, state.resources.adventurePoints - 3) }, phase: 'map', pendingMessage: 'Energy restored for the next encounter.' }); }); target.querySelector<HTMLElement>('[data-ascension-leave]')?.addEventListener('click', () => leaveService({ ...state, phase: 'map' }));
}

function leaveService(state: AscensionRunState): void { repository().save(state); renderRun(state); }
function renderEnd(state: AscensionRunState): void { const target = screen(); if (!target) return; target.innerHTML = frame(state, `<section class="ascension-end-card"><span class="ascension-crest">${state.phase === 'victory' ? '✦' : '🌱'}</span><h2>${state.phase === 'victory' ? 'A strong climb.' : 'Every attempt teaches you.'}</h2><p>${state.phase === 'victory' ? 'Your topic boss is complete and the words have been sent to regular review.' : 'The run is over, but your learning record is safe. Start another climb when you are ready.'}</p><button type="button" class="primary" data-ascension-menu>Return to Ascension</button></section>`); bindExit(target); target.querySelector<HTMLElement>('[data-ascension-menu]')?.addEventListener('click', () => { repository().remove(); renderMenu(); }); }
function bindExit(target: HTMLElement): void { target.querySelector<HTMLElement>('[data-ascension-exit]')?.addEventListener('click', exitToJourney); }

export function installKotobaAscension(): void {
  const target = screen(); if (!target) return;
  ensureHost();
  const nav = document.querySelector<HTMLElement>('[data-experimental-nav="ascension"]');
  nav?.addEventListener('click', () => { host().show?.('ascension'); const saved = repository().load(); if (saved && saved.phase !== 'defeat' && saved.phase !== 'victory') renderRun(saved); else renderMenu(); });
  window.addEventListener('kaishi-ascension-host-ready', () => { if (document.body.classList.contains('ascension-active')) renderMenu(); });
  renderMenu();
  void loadFallbackContent();
}
