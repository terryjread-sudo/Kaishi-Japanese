import { z } from 'zod';

export const RESTORE_POINT_LIMIT = 3;

export const learnerSnapshotSchema = z.object({
  progress: z.record(z.string(), z.unknown()),
  meta: z.record(z.string(), z.unknown()),
  settings: z.record(z.string(), z.unknown()),
});

export const restorePointSchema = z.object({
  id: z.string().min(1),
  createdAt: z.number().int().positive(),
  reason: z.string().min(1),
  summary: z.object({
    introducedWords: z.number().int().nonnegative(),
    masteredWords: z.number().int().nonnegative(),
    answers: z.number().int().nonnegative(),
    streak: z.number().int().nonnegative(),
    lesson: z.number().int().positive(),
  }),
  snapshot: learnerSnapshotSchema,
});

export const restorePointsSchema = z.array(restorePointSchema).max(RESTORE_POINT_LIMIT);
export type LearnerSnapshot = z.infer<typeof learnerSnapshotSchema>;
export type RestorePoint = z.infer<typeof restorePointSchema>;

export function addRestorePoint(
  current: readonly RestorePoint[],
  point: RestorePoint,
): RestorePoint[] {
  const validated = restorePointSchema.parse(point);
  return [...current.filter((item) => item.id !== validated.id), validated]
    .sort((left, right) => left.createdAt - right.createdAt)
    .slice(-RESTORE_POINT_LIMIT);
}

export function findRestorePoint(
  current: readonly RestorePoint[],
  id: string,
): RestorePoint | null {
  return current.find((point) => point.id === id) ?? null;
}
