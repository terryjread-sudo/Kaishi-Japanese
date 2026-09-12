import type { AscensionCard, AscensionWord, CardRole } from './types';

export const PARTICLES = ['は', 'を', 'で', 'が', 'の'] as const;

export function masteryFromProgress(progress: unknown): number {
  if (!progress || typeof progress !== 'object') return 0;
  const value = progress as { stage?: unknown; skills?: Record<string, { strength?: unknown }> };
  const stage = Math.max(0, Math.min(4, Number(value.stage) || 0));
  const strength = Math.max(0, Math.min(1, Number(value.skills?.meaning?.strength) || 0));
  return Math.max(stage, Math.round(strength * 4));
}

export function cardPower(card: AscensionCard): number {
  return 4 + card.mastery * 2 + (card.kind === 'particle' ? 1 : 0);
}

export function roleForWord(word: AscensionWord): CardRole {
  if (word.role) return word.role;
  if (/(です|ます|する|ある|いる|行く|見る|食べる|飲む|話す|読む|聞く|来る|なる)$/.test(word.word)) return 'verb';
  if (/(い|しい)$/.test(word.word)) return 'adjective';
  return 'noun';
}

export function buildAscensionDeck(words: readonly AscensionWord[], progressById: Record<string, unknown>, limit = 24): AscensionCard[] {
  const selected = [...words].slice(0, Math.max(1, limit));
  const cards: AscensionCard[] = selected.map((word) => ({
    id: `word:${word.id}`,
    wordId: word.id,
    text: word.word,
    reading: word.reading,
    meaning: word.meaning,
    role: roleForWord(word),
    kind: 'word' as const,
    mastery: masteryFromProgress(progressById[word.id]),
  }));
  return cards.concat(PARTICLES.map((particle) => ({
    id: `particle:${particle}`,
    text: particle,
    role: 'other' as const,
    kind: 'particle' as const,
    particle,
    mastery: 2,
  })));
}

export function drawHand(deck: readonly AscensionCard[], random: () => number = Math.random, size = 5): AscensionCard[] {
  return [...deck].sort(() => random() - 0.5).slice(0, Math.max(1, size));
}
