import { buildAscensionDeck, drawHand } from './cards';
import { createAscensionMap, createPrologueMap } from './map';
import type { AscensionCard, AscensionRunState, AscensionWord } from './types';

export const RUN_DEFAULTS = { maxHp: 60, energy: 3, focus: 2, handSize: 5 } as const;

function createEnemy(nodeType: 'combat' | 'elite' | 'boss', topicId: string) {
  const boss = nodeType === 'boss';
  const elite = nodeType === 'elite';
  const maxHp = boss ? 80 : elite ? 48 : 30;
  return { id: `${topicId}-${nodeType}`, name: boss ? 'Kotoba Guardian' : elite ? 'Word Oni' : 'Lost Tanuki', meaning: boss ? 'topic guardian' : 'word challenger', maxHp, hp: maxHp, telegraph: elite ? 9 : boss ? 12 : 6, ...(elite ? { elite: true } : {}), ...(boss ? { boss: true } : {}) };
}

export function createRun(options: { runId: string; seed: number; topicId: string; words: readonly AscensionWord[]; progressById?: Record<string, unknown>; adventurePoints?: number; prologue?: boolean }): AscensionRunState {
  const prologue = options.prologue === true;
  const deck = buildAscensionDeck(options.words, options.progressById ?? {}, prologue ? 12 : 24);
  return {
    schemaVersion: 1,
    runId: options.runId,
    topicId: options.topicId,
    prologue,
    phase: 'map',
    map: prologue ? createPrologueMap(options.seed) : createAscensionMap(options.seed, 5),
    resources: { hp: RUN_DEFAULTS.maxHp, maxHp: RUN_DEFAULTS.maxHp, energy: RUN_DEFAULTS.energy, maxEnergy: RUN_DEFAULTS.energy, focus: RUN_DEFAULTS.focus, maxFocus: RUN_DEFAULTS.focus, adventurePoints: Math.max(0, Math.floor(options.adventurePoints ?? 0)) },
    deck,
    hand: [],
    discard: [],
    turn: 1,
    wins: 0,
    pendingMessage: prologue ? 'Sensei: start with a simple chain.' : 'Choose your next node.',
    selectedCardIds: [],
  };
}

export function startNode(state: AscensionRunState, nodeType: 'combat' | 'elite' | 'boss'): AscensionRunState {
  const hand = drawHand(state.deck);
  return { ...state, phase: nodeType === 'boss' ? 'boss' : 'combat', hand, discard: [], enemy: createEnemy(nodeType, state.topicId), selectedCardIds: [], pendingMessage: nodeType === 'boss' ? 'The topic guardian tests everything together.' : 'Build a Japanese chain, then attack.' };
}

export function refreshTurn(state: AscensionRunState): AscensionRunState {
  return { ...state, turn: state.turn + 1, resources: { ...state.resources, energy: state.resources.maxEnergy, focus: state.resources.maxFocus }, selectedCardIds: [] };
}

export function applyDamage(state: AscensionRunState, damage: number, block: number): AscensionRunState {
  const enemy = state.enemy;
  if (!enemy) return state;
  const hp = Math.max(0, enemy.hp - Math.max(0, damage));
  if (hp === 0) return { ...state, enemy: { ...enemy, hp }, wins: state.wins + 1, phase: state.phase === 'boss' ? 'victory' : 'map', resources: { ...state.resources, hp: Math.min(state.resources.maxHp, state.resources.hp + (state.phase === 'boss' ? 0 : block)) }, pendingMessage: state.phase === 'boss' ? 'Victory! The topic is ready to be recorded.' : 'Victory. Choose your next node.' };
  const hpAfterEnemy = Math.max(1, state.resources.hp - Math.max(0, enemy.telegraph - block));
  return { ...state, enemy: { ...enemy, hp }, resources: { ...state.resources, hp: hpAfterEnemy }, pendingMessage: hpAfterEnemy === 1 ? 'That hit was heavy. Use a rest node soon.' : 'The enemy strikes back.' };
}

export function chooseCards(state: AscensionRunState, cards: readonly AscensionCard[]): AscensionRunState {
  return { ...state, selectedCardIds: cards.map((card) => card.id) };
}
