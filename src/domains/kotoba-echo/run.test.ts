import { describe, expect, it } from 'vitest';
import { createEchoRun, reinforcedProductionStrength, retryWords } from './run';

describe('Kotoba Echo run rules', () => {
  const words = [
    { id: 'strong', productionStrength: 0.9 },
    { id: 'weak', productionStrength: 0.1 },
    { id: 'middle', productionStrength: 0.5 },
    { id: 'newer', productionStrength: 0.2 },
    { id: 'steady', productionStrength: 0.6 },
    { id: 'extra', productionStrength: 0.4 },
  ];

  it('uses five distinct lower-production words for the first round', () => {
    const run = createEchoRun(words, () => 0.5);
    expect(run.firstRound.map((word) => word.id)).toEqual(['weak', 'newer', 'extra', 'middle', 'steady']);
  });

  it('retries only words missed in the first round', () => {
    const run = createEchoRun(words, () => 0.5);
    expect(retryWords(run.firstRound, new Set(['weak', 'middle'])).map((word) => word.id))
      .toEqual(['weak', 'middle']);
  });

  it('adds a positive production-strength sample without exceeding one', () => {
    expect(reinforcedProductionStrength(0)).toBeCloseTo(0.1875);
    expect(reinforcedProductionStrength(1)).toBe(0.9375);
  });
});
