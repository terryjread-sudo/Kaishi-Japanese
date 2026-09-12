import { describe, expect, it } from 'vitest';
import { buildAscensionDeck, drawHand } from './cards';
import { evaluateChain } from './chains';
import { availableMapNodes, createAscensionMap, createPrologueMap, visitMapNode } from './map';
import { applyDamage, createRun, refreshTurn, RUN_DEFAULTS, startNode } from './run';

const words = [
  { id: 'cat', word: 'ねこ', reading: 'neko', meaning: 'cat', role: 'noun' as const },
  { id: 'eat', word: '食べる', reading: 'taberu', meaning: 'to eat', role: 'verb' as const },
  { id: 'big', word: 'おおきい', reading: 'ōkii', meaning: 'big', role: 'adjective' as const },
];

describe('Kotoba Ascension map', () => {
  it('is deterministic, connected, and bounds the run length', () => {
    const first = createAscensionMap(42, 6);
    const second = createAscensionMap(42, 6);
    expect(first).toEqual(second);
    expect(first.nodes.at(-1)?.type).toBe('boss');
    let map = first;
    while (availableMapNodes(map).length) map = visitMapNode(map, availableMapNodes(map)[0]!.id);
    expect(map.nodes.find((node) => node.id === map.currentNodeId)?.type).toBe('boss');
  });

  it('gives the beginner a fixed combat, rest, and boss sequence', () => {
    const map = createPrologueMap(7);
    expect(map.nodes.map((node) => node.type)).toEqual(['combat', 'combat', 'rest', 'boss']);
  });
});

describe('Kotoba Ascension cards and chains', () => {
  it('builds a five-card hand and includes particles', () => {
    const deck = buildAscensionDeck(words, {}, 3);
    expect(deck.some((card) => card.particle === 'を')).toBe(true);
    expect(drawHand(deck, () => 0.5)).toHaveLength(5);
  });

  it('recognises full, partial, and fizzle chains', () => {
    const deck = buildAscensionDeck(words, {}, 3);
    const cat = deck.find((card) => card.wordId === 'cat')!;
    const eat = deck.find((card) => card.wordId === 'eat')!;
    const wo = deck.find((card) => card.particle === 'を')!;
    const de = deck.find((card) => card.particle === 'で')!;
    expect(evaluateChain([cat, wo, eat], 3, 2).outcome).toBe('full');
    expect(evaluateChain([cat, de, eat], 3, 2).block).toBeGreaterThan(0);
    expect(evaluateChain([cat], 3, 2).outcome).toBe('fizzle');
  });
});

describe('Kotoba Ascension run', () => {
  it('starts with the planned beginner resources and playable prologue', () => {
    const run = createRun({ runId: 'run-1', seed: 1, topicId: 'core-japanese', words, prologue: true });
    expect(run.resources).toMatchObject({ maxHp: RUN_DEFAULTS.maxHp, energy: 3, focus: 2 });
    expect(run.schemaVersion).toBe(2);
    expect(run.prologue).toBe(true);
    const combat = startNode(run, 'combat');
    expect(combat.phase).toBe('combat');
    expect(combat.hand).toHaveLength(5);
    expect(combat.enemy?.hp).toBeGreaterThan(0);
    expect(combat.drawPile.length + combat.hand.length + combat.discard.length).toBe(combat.deck.length);
    const refreshed = refreshTurn({ ...combat, hand: combat.hand.slice(1), discard: [...combat.discard, combat.hand[0]!] });
    expect(refreshed.hand).toHaveLength(5);
  });

  it('creates a reward state and escalates the boss intent', () => {
    const run = createRun({ runId: 'run-2', seed: 2, topicId: 'core-japanese', words, prologue: true });
    const combat = startNode(run, 'combat');
    const defeated = applyDamage({ ...combat, enemy: { ...combat.enemy!, hp: 1 } }, 10, 0);
    expect(defeated.phase).toBe('reward');
    const boss = startNode(run, 'boss');
    const phaseTwo = applyDamage({ ...boss, enemy: { ...boss.enemy!, hp: 40 }, turn: 1 }, 1, 0);
    expect(phaseTwo.enemy?.phase).toBe(2);
    expect(phaseTwo.enemy?.intent).toBe('confuse');
  });
});
