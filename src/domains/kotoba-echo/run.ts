export interface EchoWord {
  id: string;
  productionStrength: number;
}

export interface EchoRun {
  firstRound: EchoWord[];
  retryRound: EchoWord[];
}

/** Select weak production words first, while keeping each karaoke run distinct. */
export function createEchoRun(words: readonly EchoWord[], random: () => number = Math.random): EchoRun {
  const sorted = [...words]
    .sort((left, right) => left.productionStrength - right.productionStrength || random() - 0.5)
    .slice(0, 5);
  return { firstRound: sorted, retryRound: [] };
}

export function retryWords(firstRound: readonly EchoWord[], missedIds: ReadonlySet<string>): EchoWord[] {
  return firstRound.filter((word) => missedIds.has(word.id));
}

/** Echo success is production practice, not a full SRS review. */
export function reinforcedProductionStrength(current: number): number {
  return Math.max(0, Math.min(1, current * 0.75 + 0.75 * 0.25));
}
