export interface CompositionExercise {
  id: string;
  japanese: string;
  prompt: string;
  tiles: string[];
  accepted: string[];
  explanation: string;
}

export function composeFromTiles(tiles: readonly string[]) {
  return tiles.join("");
}

export function scoreComposition(exercise: CompositionExercise, answer: string) {
  const normalized = answer.replace(/\s+/g, "").trim();
  return exercise.accepted.some((candidate) => candidate.replace(/\s+/g, "").trim() === normalized);
}

export function filterGrammarLessons<T extends { title?: string; summary?: string; japanese?: string }>(lessons: readonly T[], query: string) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [...lessons];
  return lessons.filter((lesson) => [lesson.title, lesson.summary, lesson.japanese].filter(Boolean).join(" ").toLocaleLowerCase().includes(needle));
}
