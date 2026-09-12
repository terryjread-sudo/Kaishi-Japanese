import { buildAscensionDeck } from './cards';
import { createAscensionMap, createPrologueMap } from './map';
import type { AscensionCard, AscensionEnemy, AscensionRelic, AscensionRunState, AscensionWord, EnemyIntent } from './types';

export const RUN_DEFAULTS = { maxHp: 60, energy: 3, focus: 2, handSize: 5 } as const;

export const ASCENSION_RELICS: readonly AscensionRelic[] = [
  { id: 'sumi-brush', name: 'Sumi brush', description: 'Your first full chain in every battle gains +2 damage.' },
  { id: 'travel-charm', name: 'Travel charm', description: 'Resting restores 22 HP instead of 18.' },
  { id: 'quiet-lantern', name: 'Quiet lantern', description: 'The first confuse intent in each battle removes no Focus.' },
];

function random(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = Math.imul(1664525, value) + 1013904223;
    return (value >>> 0) / 4294967296;
  };
}

function shuffle(cards: readonly AscensionCard[], seed: number): AscensionCard[] {
  const result = [...cards];
  const next = random(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(next() * (index + 1));
    [result[index], result[swap]] = [result[swap]!, result[index]!];
  }
  return result;
}

function intentFor(nodeType: 'combat' | 'elite' | 'boss', turn: number): EnemyIntent {
  if (nodeType === 'boss') return turn % 3 === 0 ? 'confuse' : turn % 2 === 0 ? 'ward' : 'attack';
  if (nodeType === 'elite') return turn % 3 === 0 ? 'confuse' : turn % 2 === 0 ? 'ward' : 'attack';
  return turn % 3 === 0 ? 'ward' : 'attack';
}

function createEnemy(nodeType: 'combat' | 'elite' | 'boss', topicId: string, turn = 1): AscensionEnemy {
  const boss = nodeType === 'boss';
  const elite = nodeType === 'elite';
  const maxHp = boss ? 80 : elite ? 48 : 30;
  return { id: `${topicId}-${nodeType}`, name: boss ? 'Kotoba Guardian' : elite ? 'Word Oni' : 'Lost Tanuki', meaning: boss ? 'topic guardian' : 'word challenger', maxHp, hp: maxHp, telegraph: elite ? 9 : boss ? 12 : 6, intent: intentFor(nodeType, turn), phase: 1, ...(elite ? { elite: true } : {}), ...(boss ? { boss: true } : {}) };
}

function drawToHand(state: AscensionRunState, size = RUN_DEFAULTS.handSize): AscensionRunState {
  let drawPile = [...state.drawPile];
  let discard = [...state.discard];
  const hand = [...state.hand];
  while (hand.length < size) {
    if (!drawPile.length) {
      drawPile = shuffle(discard, state.map.seed + state.turn + hand.length);
      discard = [];
    }
    const card = drawPile.shift();
    if (!card) break;
    hand.push(card);
  }
  return { ...state, drawPile, discard, hand };
}

export function createRun(options: { runId: string; seed: number; topicId: string; words: readonly AscensionWord[]; progressById?: Record<string, unknown>; adventurePoints?: number; prologue?: boolean }): AscensionRunState {
  const prologue = options.prologue === true;
  const rewardPool = buildAscensionDeck(options.words, options.progressById ?? {}, 24);
  const deck = rewardPool.slice(0, prologue ? 8 : 12);
  return {
    schemaVersion: 2,
    runId: options.runId,
    topicId: options.topicId,
    prologue,
    phase: 'map',
    map: prologue ? createPrologueMap(options.seed) : createAscensionMap(options.seed, 5),
    resources: { hp: RUN_DEFAULTS.maxHp, maxHp: RUN_DEFAULTS.maxHp, energy: RUN_DEFAULTS.energy, maxEnergy: RUN_DEFAULTS.energy, focus: RUN_DEFAULTS.focus, maxFocus: RUN_DEFAULTS.focus, adventurePoints: Math.max(0, Math.floor(options.adventurePoints ?? 0)) },
    deck,
    drawPile: shuffle(deck, options.seed),
    hand: [],
    discard: [],
    rewardPool,
    rewardChoices: [],
    relics: [],
    block: 0,
    turn: 1,
    wins: 0,
    pendingMessage: prologue ? 'Sensei: start with a simple chain.' : 'Choose your next node.',
    selectedCardIds: [],
  };
}

export function startNode(state: AscensionRunState, nodeType: 'combat' | 'elite' | 'boss'): AscensionRunState {
  const next = { ...state, phase: nodeType === 'boss' ? 'boss' as const : 'combat' as const, hand: [], discard: [...state.discard, ...state.hand], block: 0, turn: 1, enemy: createEnemy(nodeType, state.topicId), rewardChoices: [], selectedCardIds: [], pendingMessage: nodeType === 'boss' ? 'The topic guardian tests everything together.' : 'Build a Japanese chain, then attack.' };
  return drawToHand(next);
}

export function refreshTurn(state: AscensionRunState): AscensionRunState {
  const nextEnemy = state.enemy ? { ...state.enemy, intent: intentFor(state.enemy.boss ? 'boss' : state.enemy.elite ? 'elite' : 'combat', state.turn + 1) } : undefined;
  return drawToHand({ ...state, turn: state.turn + 1, resources: { ...state.resources, energy: state.resources.maxEnergy, focus: state.resources.maxFocus }, block: 0, enemy: nextEnemy, selectedCardIds: [] });
}

export function applyDamage(state: AscensionRunState, damage: number, block: number): AscensionRunState {
  const enemy = state.enemy;
  if (!enemy) return state;
  const wardReduction = enemy.intent === 'ward' ? 5 : 0;
  const hp = Math.max(0, enemy.hp - Math.max(0, damage - wardReduction));
  if (hp === 0) return { ...state, enemy: { ...enemy, hp }, wins: state.wins + 1, phase: state.phase === 'boss' ? 'victory' : 'reward', block: 0, pendingMessage: state.phase === 'boss' ? 'Victory! The topic is ready to be recorded.' : 'Victory. Choose one reward or skip it.' };
  const incoming = enemy.intent === 'confuse' ? Math.max(1, enemy.telegraph - 2) : enemy.telegraph;
  const focusLoss = enemy.intent === 'confuse' && !state.relics.some((relic) => relic.id === 'quiet-lantern' && state.turn === 1) ? 1 : 0;
  const hpAfterEnemy = Math.max(0, state.resources.hp - Math.max(0, incoming - state.block - block));
  const focus = Math.max(0, state.resources.focus - focusLoss);
  const phaseTwo = enemy.boss && enemy.phase === 1 && hp <= enemy.maxHp / 2;
  const nextEnemy = phaseTwo ? { ...enemy, hp, phase: 2, intent: 'confuse' as const, telegraph: enemy.telegraph + 4 } : { ...enemy, hp };
  return { ...state, enemy: nextEnemy, phase: hpAfterEnemy === 0 ? 'defeat' : state.phase, resources: { ...state.resources, hp: hpAfterEnemy, focus }, block: 0, pendingMessage: hpAfterEnemy === 0 ? 'The chain broke. Your learned words are safe, but this climb ends here.' : phaseTwo ? 'The guardian changes form. It now tests your focus as well as your words.' : enemy.intent === 'ward' ? 'The enemy wards itself. Use a stronger chain next turn.' : enemy.intent === 'confuse' ? 'The enemy muddles your focus before retreating.' : 'The enemy strikes back.' };
}

export function chooseCards(state: AscensionRunState, cards: readonly AscensionCard[]): AscensionRunState {
  return { ...state, selectedCardIds: cards.map((card) => card.id) };
}

export function addCard(state: AscensionRunState, card: AscensionCard): AscensionRunState {
  return { ...state, deck: [...state.deck, card], drawPile: [...state.drawPile, card] };
}

export function upgradeCardInDeck(state: AscensionRunState, cardId: string): AscensionRunState {
  const upgrade = (card: AscensionCard) => card.id === cardId ? { ...card, upgradeLevel: card.upgradeLevel + 1 } : card;
  return { ...state, deck: state.deck.map(upgrade), drawPile: state.drawPile.map(upgrade), hand: state.hand.map(upgrade), discard: state.discard.map(upgrade) };
}

export function removeCardFromDeck(state: AscensionRunState, cardId: string): AscensionRunState {
  if (state.deck.length <= 5) return state;
  return { ...state, deck: state.deck.filter((card) => card.id !== cardId), drawPile: state.drawPile.filter((card) => card.id !== cardId), hand: state.hand.filter((card) => card.id !== cardId), discard: state.discard.filter((card) => card.id !== cardId) };
}
