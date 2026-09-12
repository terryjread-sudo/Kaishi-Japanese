import { cardPower } from './cards';
import type { AscensionCard, ChainResult } from './types';

export function evaluateChain(cards: readonly AscensionCard[], energy: number, focus: number): ChainResult {
  const nouns = cards.filter((card) => card.role === 'noun');
  const verbs = cards.filter((card) => card.role === 'verb');
  const adjective = cards.some((card) => card.role === 'adjective');
  const particle = cards.find((card) => card.kind === 'particle')?.particle;
  const power = cards.reduce((sum, card) => sum + cardPower(card), 0);
  if (!cards.length || energy < 1) return { outcome: 'fizzle', damage: 0, block: 0, energySpent: 0, focusSpent: 0, explanation: 'No energy: the chain fizzles.' };
  if (nouns.length && verbs.length && particle === 'を') return { outcome: 'full', damage: power + (adjective ? 4 : 0) + Math.min(2, focus), block: 0, energySpent: 1, focusSpent: adjective ? 1 : 0, explanation: 'Noun + を + verb: a clear action lands.' };
  if (nouns.length && verbs.length && particle === 'で') return { outcome: 'full', damage: 2, block: power + 3, energySpent: 1, focusSpent: 0, explanation: 'Noun + で + verb: the place becomes your guard.' };
  if (nouns.length && verbs.length) return { outcome: 'partial', damage: Math.max(2, Math.floor(power / 2)), block: 0, energySpent: 1, focusSpent: 0, explanation: 'The meaning is close, but a useful particle would make it stronger.' };
  return { outcome: 'fizzle', damage: 0, block: 0, energySpent: 1, focusSpent: 0, explanation: 'The words do not form a useful chain yet.' };
}
