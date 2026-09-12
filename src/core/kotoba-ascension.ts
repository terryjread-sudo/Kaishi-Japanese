import { z } from 'zod';
import { createVersionedRepository, sessionStorage } from '../platform/storage';
import { evaluateChain } from '../domains/kotoba-ascension/chains';
import { availableMapNodes, visitMapNode } from '../domains/kotoba-ascension/map';
import { addCard, applyDamage, ASCENSION_RELICS, chooseCards, createRun, refreshTurn, removeCardFromDeck, startNode, upgradeCardInDeck } from '../domains/kotoba-ascension/run';
import type { AscensionCard, AscensionRunState, AscensionWord } from '../domains/kotoba-ascension/types';
import { ascensionMusicEnabled, duckAscensionMusic, playAscensionStinger, startAscensionMusic, stopAscensionMusic, setAscensionMusicEnabled } from '../platform/ascension-audio';

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
  return candidate.schemaVersion === 2 && typeof candidate.runId === 'string' && Array.isArray(candidate.deck) && Array.isArray(candidate.drawPile) && candidate.map !== undefined;
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
function repository() { return createVersionedRepository({ storage: sessionStorage(), key: RUN_KEY, version: 2, schema: runSchema }); }
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
  target.innerHTML = `<div class="ascension-shell"><header class="ascension-heading"><div><span class="eyebrow">Kotoba Ascension · 言葉の塔</span><h1>Learn Japanese by climbing.</h1><p>Build useful sentences, defend your meaning, and carry the words into your regular review deck.</p></div><button type="button" class="ascension-exit" data-ascension-exit>← Journey</button></header><section class="ascension-hero"><span class="ascension-crest" aria-hidden="true">⛩</span><div><strong>A game route for every learner</strong><p>The Prologue is always open. You can learn the basics here before the guided Journey catches up.</p></div></section><div class="ascension-menu-grid"><button type="button" class="ascension-prologue" data-ascension-start="prologue"><span>第一歩</span><strong>Beginner Prologue</strong><small>Start → Combat → Rest → Boss</small></button>${availableTopics.map((topic) => `<button type="button" data-ascension-start="${escapeHtml(topic.id)}"><span>${escapeHtml(topic.id === 'core-japanese' ? '基礎' : '話題')}</span><strong>${escapeHtml(topic.title)}</strong><small>${host().topicStats?.(topic)?.bossReady ? 'Topic run ready' : 'Complete the guided practice first'}</small></button>`).join('')}</div><div class="ascension-menu-actions"><button type="button" data-ascension-music>${ascensionMusicEnabled() ? '♫ Music on' : '♫ Music off'}</button><a href="media/ascension/README.md">Audio credits</a></div><p class="ascension-note">Open Ascension directly from the bottom navigation whenever you want a game session.</p></div>`;
  target.querySelectorAll<HTMLElement>('[data-ascension-start]').forEach((button) => button.onclick = () => start(button.dataset.ascensionStart ?? 'prologue'));
  target.querySelector<HTMLElement>('[data-ascension-exit]')?.addEventListener('click', () => exitToJourney());
  target.querySelector<HTMLElement>('[data-ascension-music]')?.addEventListener('click', () => { const enabled = !ascensionMusicEnabled(); setAscensionMusicEnabled(enabled); renderMenu(); if (enabled) startAscensionMusic('map'); });
}

function speakAscension(text: string): void {
  duckAscensionMusic(true);
  host().speak?.(text);
  window.setTimeout(() => duckAscensionMusic(false), Math.max(900, text.length * 170));
}

function start(kind: string): void {
  const topics = host().topics?.() ?? [];
  const topic = kind === 'prologue' ? topics.find((item) => item.id === 'core-japanese') ?? topics[0] : topics.find((item) => item.id === kind);
  const words = topicWords(topic ?? { id: 'core-japanese', title: 'Core Japanese' });
  const run = createRun({ runId: `ascension-${Date.now()}`, seed: Date.now(), topicId: topic?.id ?? 'core-japanese', words, progressById: host().progress?.() ?? {}, adventurePoints: host().adventurePoints?.() ?? 0, prologue: kind === 'prologue' });
  repository().save(run);
  startAscensionMusic('map');
  renderRun(run);
}

function exitToJourney(): void {
  const active = repository().load();
  if (active && !['victory', 'defeat'].includes(active.phase) && !window.confirm('Leave Kotoba Ascension? Your current run will be kept for this session.')) return;
  stopAscensionMusic();
  host().show?.('journey');
}

function renderRun(state: AscensionRunState): void {
  const target = screen();
  if (!target) return;
  startAscensionMusic(state.phase === 'boss' ? 'boss' : state.phase === 'victory' ? 'victory' : state.phase === 'combat' ? 'combat' : state.phase === 'reward' ? 'reward' : 'map');
  if (state.phase === 'map') return renderMap(state);
  if (state.phase === 'combat' || state.phase === 'boss') return renderCombat(state);
  if (state.phase === 'rest') return renderRest(state);
  if (state.phase === 'shop') return renderShop(state);
  if (state.phase === 'event') return renderEvent(state);
  if (state.phase === 'reward') return renderReward(state);
  renderEnd(state);
}

function frame(state: AscensionRunState, content: string): string {
  const resource = state.resources;
  const title = state.phase === 'map' ? 'Choose your path' : state.phase === 'combat' || state.phase === 'boss' ? 'Make a useful chain' : state.phase === 'rest' ? 'A quiet place to recover' : state.phase === 'shop' ? 'Prepare for the climb' : state.phase === 'event' ? 'A choice on the road' : state.phase === 'reward' ? 'Claim your reward' : state.phase === 'victory' ? 'The summit is yours' : 'The climb can continue';
  const relics = state.relics.length ? `<div class="ascension-relics" aria-label="Run relics">${state.relics.map((relic) => `<span title="${escapeHtml(relic.description)}">◈ ${escapeHtml(relic.name)}</span>`).join('')}</div>` : '';
  return `<div class="ascension-shell"><header class="ascension-heading"><div><span class="eyebrow">${state.prologue ? 'Beginner Prologue' : 'Kotoba Ascension'} · ${escapeHtml(state.topicId)}</span><h1>${title}</h1></div><button type="button" class="ascension-exit" data-ascension-exit>× Exit</button></header><div class="ascension-resource-strip"><span>♥ ${resource.hp}/${resource.maxHp}</span><span>✦ ${resource.energy}/${resource.maxEnergy} energy</span><span>◈ ${resource.focus}/${resource.maxFocus} focus</span><span>AP ${resource.adventurePoints}</span><span>Deck ${state.deck.length}</span></div>${relics}${content}</div>`;
}

function nodeIcon(type: string): string { return type === 'boss' ? '⛩' : type === 'combat' ? '⚔' : type === 'elite' ? '☠' : type === 'rest' ? '♨' : type === 'shop' ? '宝' : type === 'event' ? '✦' : '箱'; }

function renderMap(state: AscensionRunState): void {
  const target = screen();
  if (!target) return;
  const current = state.map.nodes.find((node) => node.id === state.map.currentNodeId);
  const nodes = state.map.nodes.map((node) => `<span class="ascension-map-node ${node.id === current?.id ? 'current' : ''} ${node.layer < (current?.layer ?? 0) ? 'visited' : ''}">${nodeIcon(node.type)}<small>${escapeHtml(node.label)}</small></span>`).join('');
  const choices = availableMapNodes(state.map).map((node) => `<button type="button" data-ascension-node="${escapeHtml(node.id)}"><b>${nodeIcon(node.type)}</b>${escapeHtml(node.label)}<small>${node.type === 'boss' ? 'Face the topic guardian' : node.type === 'rest' ? 'Recover and upgrade' : node.type === 'shop' ? 'Spend AP and tune your deck' : node.type === 'event' ? 'Make a risky learning choice' : node.type === 'treasure' ? 'Find a run relic' : 'Test your chain'}</small></button>`).join('');
  target.innerHTML = frame(state, `<section class="ascension-map-card"><div class="ascension-map" aria-label="Ascension path">${nodes}</div><p class="ascension-message">${escapeHtml(state.pendingMessage)}</p><div class="ascension-choice-grid">${choices}</div></section>`);
  bindExit(target); target.querySelectorAll<HTMLElement>('[data-ascension-node]').forEach((button) => button.onclick = () => chooseNode(state, button.dataset.ascensionNode ?? ''));
}

function chooseNode(state: AscensionRunState, nodeId: string): void {
  const map = visitMapNode(state.map, nodeId);
  const node = map.nodes.find((item) => item.id === nodeId);
  if (!node) return;
  const next = { ...state, map };
  if (node.type === 'rest' || node.type === 'shop') { repository().save({ ...next, phase: node.type }); renderRun({ ...next, phase: node.type }); return; }
  if (node.type === 'event' || node.type === 'treasure') { const eventState = { ...next, phase: 'event' as const, eventId: node.type }; repository().save(eventState); renderRun(eventState); return; }
  const combat = startNode(next, node.type === 'boss' ? 'boss' : node.type === 'elite' ? 'elite' : 'combat'); repository().save(combat); renderRun(combat);
}

function intentLabel(state: AscensionRunState): string {
  if (!state.enemy) return '';
  if (state.enemy.intent === 'ward') return 'Ward · incoming damage reduced';
  if (state.enemy.intent === 'confuse') return 'Confuse · lose Focus if unprotected';
  return `Attack · ${state.enemy.telegraph} damage`;
}

function playerCombatArt(): string {
  const profileImage = document.querySelector<HTMLImageElement>('#dashboardAvatar, .experimental-hero-profile img, #experimentalProfileLargeAvatar')?.getAttribute('src');
  return profileImage && !profileImage.includes('guest-learner') ? profileImage : 'media/battle-listen/party-warrior.png';
}

function enemyCombatArt(state: AscensionRunState): string {
  if (state.enemy?.boss) return 'media/battle-listen/kitsune.png';
  if (state.enemy?.elite) return 'media/battle-listen/karakasa.png';
  return 'media/battle-listen/tanuki.png';
}

function renderCombat(state: AscensionRunState): void {
  const target = screen();
  if (!target || !state.enemy) return;
  const selected = new Set(state.selectedCardIds);
  const cards = state.hand.map((card) => `<button type="button" class="ascension-card ${selected.has(card.id) ? 'selected' : ''}" data-ascension-card="${escapeHtml(card.id)}"><span class="ascension-card-cost">${card.cost} energy</span><b>${escapeHtml(card.text)}${card.upgradeLevel ? ` +${card.upgradeLevel}` : ''}</b><small>${escapeHtml(card.meaning ?? (card.particle ? 'grammar connector' : ''))}</small></button>`).join('');
  const selectedCost = state.hand.filter((card) => selected.has(card.id)).reduce((sum, card) => sum + card.cost, 0);
  target.innerHTML = frame(state, `<section class="ascension-battle-card ascension-battlefield"><div class="ascension-battle-topline"><span class="eyebrow">${state.enemy.boss ? `Final test · Phase ${state.enemy.phase}` : state.enemy.elite ? 'Elite encounter' : 'Word encounter'}</span><span>Turn ${state.turn}</span></div><div class="ascension-battle-stage"><article class="ascension-combatant ascension-player-combatant"><div class="ascension-combatant-copy"><span class="eyebrow">Your party</span><h2>Word learner</h2><div class="ascension-player-stats"><span>♥ ${state.resources.hp}/${state.resources.maxHp}</span><span>◈ ${state.resources.focus}/${state.resources.maxFocus}</span></div></div><img class="ascension-player-art" src="${escapeHtml(playerCombatArt())}" alt="Your learning character" /></article><span class="ascension-battle-vs" aria-hidden="true">VS</span><article class="ascension-combatant ascension-enemy-combatant"><img class="ascension-enemy-art" src="${escapeHtml(enemyCombatArt(state))}" alt="${escapeHtml(state.enemy.name)}" /><div class="ascension-combatant-copy"><span class="eyebrow">${state.enemy.boss ? 'Topic guardian' : state.enemy.elite ? 'Elite enemy' : 'Enemy'}</span><h2>${escapeHtml(state.enemy.name)}</h2><p class="ascension-intent"><b>${intentLabel(state)}</b></p><div class="ascension-enemy-health"><i><b style="width:${state.enemy.hp / state.enemy.maxHp * 100}%"></b></i><span>${state.enemy.hp}/${state.enemy.maxHp} HP</span></div></div></article></div><div class="ascension-battle-lower"><p class="ascension-message">${escapeHtml(state.pendingMessage)}</p><div class="ascension-combat-status"><span>Selected chain: ${selectedCost || 0} energy</span><span>Guard: ${state.block}</span><span>Draw pile: ${state.drawPile.length}</span></div><div class="ascension-hand-heading"><h3>Choose your words</h3><span>${state.hand.length} cards in hand</span></div><div class="ascension-hand" aria-label="Choose cards">${cards}</div><div class="ascension-battle-actions"><button type="button" class="primary" data-ascension-play ${selectedCost > state.resources.energy || !selected.size ? 'disabled' : ''}>Use chain</button><button type="button" data-ascension-audio>🔊 Hear a card</button></div><p class="ascension-tip">Try noun + を + verb for an attack, or noun + で + verb to defend. A warded enemy needs a stronger chain.</p></div></section>`);
  bindExit(target);
  target.querySelectorAll<HTMLElement>('[data-ascension-card]').forEach((button) => button.onclick = () => toggleCard(state, button.dataset.ascensionCard ?? ''));
  target.querySelector<HTMLElement>('[data-ascension-play]')?.addEventListener('click', () => playChain(state));
  target.querySelector<HTMLElement>('[data-ascension-audio]')?.addEventListener('click', () => { const card = state.hand.find((item) => item.wordId); if (card) speakAscension(card.reading ?? card.text); });
}

function toggleCard(state: AscensionRunState, id: string): void {
  const selected = state.hand.filter((card) => state.selectedCardIds.includes(card.id) !== (card.id === id));
  const next = chooseCards(state, selected); repository().save(next); renderRun(next);
}

function rewardChoicesFor(state: AscensionRunState): AscensionCard[] {
  const unused = state.rewardPool.filter((card) => !state.deck.some((owned) => owned.id === card.id));
  const fallback = state.deck.filter((card) => !card.upgradeLevel);
  return [...unused, ...fallback].slice(0, 3);
}

function rewardRelicFor(state: AscensionRunState): AscensionRunState['rewardRelic'] {
  if (!state.enemy?.elite) return undefined;
  return ASCENSION_RELICS.find((relic) => !state.relics.some((owned) => owned.id === relic.id));
}

function playChain(state: AscensionRunState): void {
  const cards = state.hand.filter((card) => state.selectedCardIds.includes(card.id));
  const result = evaluateChain(cards, state.resources.energy, state.resources.focus);
  if (result.outcome !== 'fizzle') cards.filter((card) => card.wordId).forEach((card) => host().gradeWord?.(card.wordId!, 'meaning', result.outcome === 'full' ? 3 : 2, true));
  const nextResources = { ...state.resources, energy: Math.max(0, state.resources.energy - result.energySpent), focus: Math.max(0, state.resources.focus - result.focusSpent) };
  const relicBonus = result.outcome === 'full' && state.turn === 1 && state.relics.some((relic) => relic.id === 'sumi-brush') ? 2 : 0;
  const playedCards = cards.length ? { hand: state.hand.filter((card) => !state.selectedCardIds.includes(card.id)), discard: [...state.discard, ...cards] } : {};
  let next = applyDamage({ ...state, ...playedCards, resources: nextResources, pendingMessage: result.explanation }, result.damage + relicBonus, result.block);
  if (next.phase === 'reward') next = { ...next, rewardChoices: rewardChoicesFor(next), rewardRelic: rewardRelicFor(next) };
  if (next.phase === 'reward') playAscensionStinger('reward');
  if (next.phase === 'victory' && state.prologue) host().completeTopicBoss?.(state.topicId, true);
  if (next.phase === 'victory' && !state.prologue) host().completeTopicBoss?.(state.topicId, true);
  if (next.phase === 'victory') playAscensionStinger('victory');
  if (next.phase === 'combat' || next.phase === 'boss') next = refreshTurn(next);
  repository().save(next); renderRun(next);
}

function renderRest(state: AscensionRunState): void {
  const target = screen(); if (!target) return;
  const heal = state.relics.some((relic) => relic.id === 'travel-charm') ? 22 : 18;
  const cards = state.deck.map((card) => `<button type="button" class="ascension-mini-card" data-ascension-upgrade="${escapeHtml(card.id)}"><b>${escapeHtml(card.text)}${card.upgradeLevel ? ` +${card.upgradeLevel}` : ''}</b><small>${card.upgradeLevel ? 'Fully upgraded' : 'Upgrade this card'}</small></button>`).join('');
  target.innerHTML = frame(state, `<section class="ascension-service-card"><span class="ascension-service-icon">♨</span><h2>Rest at the study house</h2><p>Recover ${heal} HP, or upgrade one card to make its next chain stronger.</p><div class="ascension-battle-actions"><button type="button" class="primary" data-ascension-rest>Recover HP</button><button type="button" data-ascension-study>Restore Focus</button></div><h3 class="ascension-section-title">Choose one card to upgrade</h3><div class="ascension-mini-grid">${cards}</div></section>`);
  bindExit(target); target.querySelector<HTMLElement>('[data-ascension-rest]')?.addEventListener('click', () => leaveService({ ...state, resources: { ...state.resources, hp: Math.min(state.resources.maxHp, state.resources.hp + heal), energy: state.resources.maxEnergy, focus: state.resources.maxFocus }, phase: 'map', pendingMessage: 'You feel ready for the next lesson.' }));
  target.querySelector<HTMLElement>('[data-ascension-study]')?.addEventListener('click', () => leaveService({ ...state, resources: { ...state.resources, focus: state.resources.maxFocus }, phase: 'map', pendingMessage: 'A focused review will make your next chain stronger.' }));
  target.querySelectorAll<HTMLElement>('[data-ascension-upgrade]').forEach((button) => button.addEventListener('click', () => leaveService({ ...upgradeCardInDeck(state, button.dataset.ascensionUpgrade ?? ''), phase: 'map', pendingMessage: 'Your upgraded card is ready for the next battle.' })));
}

function renderShop(state: AscensionRunState): void {
  const target = screen(); if (!target) return;
  const cards = state.deck.map((card) => `<button type="button" class="ascension-mini-card" data-ascension-remove="${escapeHtml(card.id)}" ${state.deck.length <= 5 ? 'disabled' : ''}><b>${escapeHtml(card.text)}</b><small>Remove from deck · 4 AP</small></button>`).join('');
  target.innerHTML = frame(state, `<section class="ascension-service-card"><span class="ascension-service-icon">宝</span><h2>Word market</h2><p>Adventure points: ${state.resources.adventurePoints}. Tune your deck before the next encounter.</p><div class="ascension-battle-actions"><button type="button" class="primary" data-ascension-buy ${state.resources.adventurePoints < 3 ? 'disabled' : ''}>Buy energy · 3 AP</button><button type="button" data-ascension-leave>Leave shop</button></div><h3 class="ascension-section-title">Remove a weak card · 4 AP</h3><div class="ascension-mini-grid">${cards}</div></section>`);
  bindExit(target); target.querySelector<HTMLElement>('[data-ascension-buy]')?.addEventListener('click', () => { if (!host().spendAdventurePoints?.(3)) return; leaveService({ ...state, resources: { ...state.resources, energy: state.resources.maxEnergy, adventurePoints: Math.max(0, state.resources.adventurePoints - 3) }, phase: 'map', pendingMessage: 'Energy restored for the next encounter.' }); }); target.querySelector<HTMLElement>('[data-ascension-leave]')?.addEventListener('click', () => leaveService({ ...state, phase: 'map' }));
  target.querySelectorAll<HTMLElement>('[data-ascension-remove]').forEach((button) => button.addEventListener('click', () => { if (state.deck.length <= 5 || !host().spendAdventurePoints?.(4)) return; leaveService({ ...removeCardFromDeck(state, button.dataset.ascensionRemove ?? ''), resources: { ...state.resources, adventurePoints: Math.max(0, state.resources.adventurePoints - 4) }, phase: 'map', pendingMessage: 'A weak card was removed. Your deck is becoming more focused.' }); }));
}

function renderReward(state: AscensionRunState): void {
  const target = screen(); if (!target) return;
  const choices = state.rewardChoices.map((card) => `<button type="button" class="ascension-reward-card" data-ascension-reward="${escapeHtml(card.id)}"><span>New card</span><b>${escapeHtml(card.text)}</b><small>${escapeHtml(card.meaning ?? 'Grammar connector')} · ${card.cost} energy</small></button>`).join('');
  const relic = state.rewardRelic ? `<button type="button" class="ascension-reward-card ascension-relic-reward" data-ascension-relic><span>Elite relic</span><b>◈ ${escapeHtml(state.rewardRelic.name)}</b><small>${escapeHtml(state.rewardRelic.description)}</small></button>` : '';
  target.innerHTML = frame(state, `<section class="ascension-service-card ascension-reward"><span class="ascension-service-icon">✦</span><h2>Choose one reward</h2><p>Build a deck that says what you want to say. You may skip this reward if it does not fit your plan.</p><div class="ascension-reward-grid">${choices}${relic}</div><button type="button" class="ascension-skip" data-ascension-skip>Skip reward → Map</button></section>`);
  bindExit(target); target.querySelectorAll<HTMLElement>('[data-ascension-reward]').forEach((button) => button.addEventListener('click', () => claimReward(state, button.dataset.ascensionReward ?? '')));
  target.querySelector<HTMLElement>('[data-ascension-relic]')?.addEventListener('click', () => { if (!state.rewardRelic) return; claimReward({ ...state, relics: [...state.relics, state.rewardRelic] }, ''); });
  target.querySelector<HTMLElement>('[data-ascension-skip]')?.addEventListener('click', () => leaveService({ ...state, phase: 'map', rewardChoices: [], rewardRelic: undefined, pendingMessage: 'You kept the deck lean. Choose your next node.' }));
}

function claimReward(state: AscensionRunState, cardId: string): void {
  const card = state.rewardChoices.find((item) => item.id === cardId);
  const next = card ? addCard(state, card) : state;
  leaveService({ ...next, phase: 'map', rewardChoices: [], rewardRelic: undefined, pendingMessage: card ? `${card.text} joined your deck.` : 'The relic is ready for the next battle.' });
}

function renderEvent(state: AscensionRunState): void {
  const target = screen(); if (!target) return;
  if (state.eventId === 'treasure') {
    const relic = ASCENSION_RELICS.find((item) => !state.relics.some((owned) => owned.id === item.id));
    target.innerHTML = frame(state, `<section class="ascension-service-card"><span class="ascension-service-icon">箱</span><h2>A sealed learning relic</h2><p>You find an old study box beneath the shrine steps. Open it to carry a new advantage through this run.</p><button type="button" class="primary" data-ascension-treasure ${relic ? '' : 'disabled'}>${relic ? `Take ${escapeHtml(relic.name)}` : 'The box is empty'}</button></section>`);
    bindExit(target); target.querySelector<HTMLElement>('[data-ascension-treasure]')?.addEventListener('click', () => leaveService({ ...state, phase: 'map', relics: relic ? [...state.relics, relic] : state.relics, eventId: undefined, pendingMessage: relic ? `${relic.name} joined your climb.` : 'The box held only a quiet lesson.' }));
    return;
  }
  target.innerHTML = frame(state, `<section class="ascension-service-card"><span class="ascension-service-icon">✦</span><h2>The shrine asks a question</h2><p>Choose the kind of practice you need. Every choice changes the climb.</p><div class="ascension-event-choices"><button type="button" class="primary" data-ascension-event="study"><b>Study the inscription</b><small>Gain 1 Focus and continue safely.</small></button><button type="button" data-ascension-event="risk"><b>Take the traveller’s gamble</b><small>Gain 5 AP, but lose 5 HP.</small></button></div></section>`);
  bindExit(target); target.querySelectorAll<HTMLElement>('[data-ascension-event]').forEach((button) => button.addEventListener('click', () => { const risky = button.dataset.ascensionEvent === 'risk'; leaveService({ ...state, phase: 'map', eventId: undefined, resources: { ...state.resources, focus: risky ? state.resources.focus : Math.min(state.resources.maxFocus, state.resources.focus + 1), hp: risky ? Math.max(1, state.resources.hp - 5) : state.resources.hp, adventurePoints: risky ? state.resources.adventurePoints + 5 : state.resources.adventurePoints }, pendingMessage: risky ? 'The gamble paid off. Spend those AP wisely.' : 'The inscription sharpened your focus.' }); }));
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
