import { z } from 'zod';

const checkSchema = z.object({
  wordId: z.string().min(1),
  prompt: z.string().min(1),
  choices: z.array(z.string().min(1)).min(2),
  answer: z.string().min(1),
  explanation: z.string().min(1),
}).refine((check) => check.choices.includes(check.answer), 'The listening answer must be one of its choices.');

const responseSchema = z.object({
  mode: z.enum(['choice', 'tiles', 'tiles-or-type', 'type-or-tiles']).optional(),
  prompt: z.string().min(1),
  model: z.string().min(1),
  reading: z.string().min(1),
  meaning: z.string().min(1),
  acceptable: z.array(z.string().min(1)).min(1),
  tiles: z.array(z.string().min(1)).min(1),
});

export const lessonOutcomeSchema = z.object({
  lesson: z.number().int().min(1).max(100),
  canDo: z.string().startsWith('I can '),
  situation: z.string().min(1),
  targetWordIds: z.array(z.string().min(1)).length(3),
  opening: checkSchema,
  production: responseSchema.required({ mode: true }),
  transfer: responseSchema.extend({ wordId: z.string().min(1) }),
});

export const lessonOutcomeCatalogSchema = z.object({
  schemaVersion: z.literal(1),
  lessons: z.array(lessonOutcomeSchema).length(100),
}).superRefine((catalog, context) => {
  const seen = new Set<number>();
  catalog.lessons.forEach((lesson, index) => {
    if (seen.has(lesson.lesson)) context.addIssue({ code: 'custom', path: ['lessons', index, 'lesson'], message: 'Lesson numbers must be unique.' });
    seen.add(lesson.lesson);
  });
  for (let lesson = 1; lesson <= 100; lesson += 1) {
    if (!seen.has(lesson)) context.addIssue({ code: 'custom', path: ['lessons'], message: `Lesson ${lesson} is missing.` });
  }
});

export type LessonOutcome = z.infer<typeof lessonOutcomeSchema>;
export type LessonOutcomeCatalog = z.infer<typeof lessonOutcomeCatalogSchema>;
export type LessonEvidenceKind = 'listening' | 'recall' | 'production' | 'transfer';
export type LessonEvidence = Partial<Record<LessonEvidenceKind, { passed: boolean; attempts: number; updatedAt: number }>> & { awardedAt?: number; updatedAt: number };

export function parseLessonOutcomeCatalog(input: unknown): LessonOutcomeCatalog | null {
  const result = lessonOutcomeCatalogSchema.safeParse(input);
  return result.success ? result.data : null;
}

export function outcomeForLesson(input: unknown, lesson: number): LessonOutcome | null {
  return parseLessonOutcomeCatalog(input)?.lessons.find((item) => item.lesson === lesson) ?? null;
}

export function validateLessonOutcomeCatalog(input: unknown, curriculum: readonly { lessonNumber: number; wordIds: readonly string[] }[]): string[] {
  const catalog = parseLessonOutcomeCatalog(input);
  if (!catalog) return ['The lesson outcome catalog does not match schema version 1.'];
  const issues: string[] = [];
  catalog.lessons.forEach((outcome) => {
    const lesson = curriculum.find((item) => item.lessonNumber === outcome.lesson);
    if (!lesson) { issues.push(`Lesson ${outcome.lesson} is missing from the curriculum.`); return; }
    if (lesson.wordIds.join('|') !== outcome.targetWordIds.join('|')) issues.push(`Lesson ${outcome.lesson} target words do not match the curriculum.`);
    if (!outcome.targetWordIds.includes(outcome.opening.wordId)) issues.push(`Lesson ${outcome.lesson} opening uses a word outside the lesson.`);
    if (!outcome.targetWordIds.includes(outcome.transfer.wordId)) issues.push(`Lesson ${outcome.lesson} transfer uses a word outside the lesson.`);
  });
  return issues;
}

export function normalizeJapaneseAnswer(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ja-JP').replace(/[\s、。！？!?.,]/g, '');
}

export function answerMatches(value: string, acceptable: readonly string[]): boolean {
  const normalized = normalizeJapaneseAnswer(value);
  return Boolean(normalized && acceptable.some((answer) => normalizeJapaneseAnswer(answer) === normalized));
}

export function recordLessonEvidence(current: LessonEvidence | null | undefined, kind: LessonEvidenceKind, passed: boolean, now = Date.now()): LessonEvidence {
  const previous = current?.[kind];
  const result: LessonEvidence = {
    ...(current ?? { updatedAt: now }),
    [kind]: { passed: Boolean(previous?.passed || passed), attempts: Number(previous?.attempts ?? 0) + 1, updatedAt: now },
    updatedAt: now,
  };
  if (['listening', 'recall', 'production', 'transfer'].every((key) => result[key as LessonEvidenceKind]?.passed)) result.awardedAt ??= now;
  return result;
}

export function evidenceLabel(evidence: LessonEvidence | null | undefined, kind: LessonEvidenceKind): string {
  const item = evidence?.[kind];
  if (!item?.attempts) return 'Not checked';
  return item.passed ? 'Demonstrated' : 'Developing';
}

export function lessonEvidenceDue(evidence: LessonEvidence | null | undefined, now = Date.now()): boolean {
  if (!evidence?.updatedAt) return false;
  const kinds: LessonEvidenceKind[] = ['listening', 'recall', 'production', 'transfer'];
  const complete = kinds.every((kind) => evidence[kind]?.passed);
  if (!complete) return now >= evidence.updatedAt + 10 * 60 * 1000;
  const attempts = Math.min(...kinds.map((kind) => Math.max(1, Number(evidence[kind]?.attempts ?? 1))));
  const days = [1, 3, 7, 21][Math.min(3, attempts - 1)] ?? 21;
  return now >= evidence.updatedAt + days * 86_400_000;
}
