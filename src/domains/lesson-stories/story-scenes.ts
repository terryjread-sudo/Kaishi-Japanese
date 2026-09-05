import { z } from 'zod';

const questionSchema = z.object({
  prompt: z.string().min(1),
  choices: z.array(z.string().min(1)).min(2),
  answer: z.string().min(1),
  explanation: z.string().min(1),
}).refine((question) => question.choices.includes(question.answer), {
  message: 'The story answer must be one of its choices.',
});

export const lessonStorySceneSchema = z.object({
  id: z.string().min(1),
  lesson: z.number().int().positive(),
  targetWordId: z.string().min(1),
  imageWordId: z.string().min(1),
  sentence: z.string().min(1),
  reading: z.string().min(1),
  meaning: z.string().min(1),
  grammarFocus: z.string().min(1),
  grammarNote: z.string().min(1),
  question: questionSchema,
});

export const lessonStoryCatalogSchema = z.object({
  schemaVersion: z.literal(1),
  scenes: z.array(lessonStorySceneSchema),
}).superRefine((catalog, context) => {
  const ids = new Set<string>();
  const lessons = new Set<number>();
  catalog.scenes.forEach((scene, index) => {
    if (ids.has(scene.id)) context.addIssue({ code: 'custom', path: ['scenes', index, 'id'], message: 'Story scene IDs must be unique.' });
    if (lessons.has(scene.lesson)) context.addIssue({ code: 'custom', path: ['scenes', index, 'lesson'], message: 'Only one story scene may be scheduled per lesson.' });
    ids.add(scene.id);
    lessons.add(scene.lesson);
  });
});

export type LessonStoryScene = z.infer<typeof lessonStorySceneSchema>;
export type LessonStoryCatalog = z.infer<typeof lessonStoryCatalogSchema>;

export interface LessonStoryWord {
  id: string;
  picture?: string;
}

export interface SelectedLessonStoryScene extends LessonStoryScene {
  image: string;
}

/** Returns a scene only when its target and visual are present in this lesson. */
export function selectLessonStoryScene(
  catalogInput: unknown,
  lesson: number,
  words: readonly LessonStoryWord[],
): SelectedLessonStoryScene | null {
  const parsed = lessonStoryCatalogSchema.safeParse(catalogInput);
  if (!parsed.success) return null;

  const scene = parsed.data.scenes.find((candidate) => candidate.lesson === lesson);
  if (!scene) return null;

  const target = words.find((word) => word.id === scene.targetWordId);
  const imageWord = words.find((word) => word.id === scene.imageWordId);
  if (!target || !imageWord?.picture) return null;

  return { ...scene, image: imageWord.picture };
}

export function findLessonStoryScene(catalogInput: unknown, id: string): LessonStoryScene | null {
  const parsed = lessonStoryCatalogSchema.safeParse(catalogInput);
  if (!parsed.success) return null;
  return parsed.data.scenes.find((scene) => scene.id === id) ?? null;
}
