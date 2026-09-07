export interface LessonWord { id: string; word: string; reading?: string; meaning: string }
export interface LessonStep<W extends LessonWord = LessonWord> {
  v: W;
  skill: string;
  character?: string;
  requiredAssessment?: boolean;
  reinforcementRepair?: boolean;
  adaptiveRepair?: boolean;
}
const passive = new Set(['kanaUnlock', 'firstEncounter', 'intro', 'pronunciation', 'example']);

/** Expand prerequisites once, and reserve recall before optional context can fill a mission. */
export function prepareLesson<W extends LessonWord, S extends LessonStep<W>>(
  steps: S[], unknownKana: (word: W) => string[], limit = 15,
): Array<LessonStep<W>> {
  const seenKana = new Set<string>();
  const result: Array<LessonStep<W>> = [];
  for (const step of steps) {
    if (step.skill !== 'kanaUnlock') { result.push({ ...step }); continue; }
    for (const character of unknownKana(step.v)) {
      if (seenKana.has(character)) continue;
      seenKana.add(character);
      result.push({ ...step, character });
    }
  }
  const newWords = new Map(result.filter(s => s.skill === 'firstEncounter').map(s => [s.v.id, s.v]));
  for (const word of newWords.values()) {
    const check = result.find(s => s.v.id === word.id && !passive.has(s.skill));
    if (check) check.requiredAssessment = true;
    else result.push({ v: word, skill: 'meaning', requiredAssessment: true });
  }
  // Never sacrifice prerequisites or assessment to satisfy the soft card limit.
  for (const skill of ['example', 'pronunciation']) {
    for (let i = result.length - 1; i >= 0 && result.length > limit; i--) {
      if (result[i]?.skill === skill) result.splice(i, 1);
    }
  }
  return result;
}

export function lessonPhase(skill: string): string {
  if (skill === 'kanaUnlock') return 'Learn a sound';
  if (skill === 'firstEncounter') return 'Meet the word';
  if (skill === 'intro') return 'Make a memory';
  if (skill === 'pronunciation') return 'Optional speaking';
  if (skill === 'example') return 'See it in a sentence';
  return 'Check your recall';
}

export function sessionPosition(steps: LessonStep[], index: number) {
  const original = steps.filter(s => !s.reinforcementRepair && !s.adaptiveRepair);
  const extra = Boolean(steps[index]?.reinforcementRepair || steps[index]?.adaptiveRepair);
  return { total: original.length, completed: steps.slice(0, index).filter(s => !s.reinforcementRepair && !s.adaptiveRepair).length, extra };
}
