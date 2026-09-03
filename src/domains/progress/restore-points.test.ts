import { describe, expect, it } from 'vitest';
import { addRestorePoint, findRestorePoint, type RestorePoint } from './restore-points';

function point(id: string, createdAt: number): RestorePoint {
  return {
    id,
    createdAt,
    reason: `Snapshot ${id}`,
    summary: { introducedWords: 3, masteredWords: 1, answers: 12, streak: 2, lesson: 4 },
    snapshot: { progress: {}, meta: {}, settings: {} },
  };
}

describe('restore points', () => {
  it('keeps the newest three points in chronological order', () => {
    const points = [point('one', 1), point('two', 2), point('three', 3)]
      .reduce<RestorePoint[]>((current, item) => addRestorePoint(current, item), []);

    expect(addRestorePoint(points, point('four', 4)).map((item) => item.id))
      .toEqual(['two', 'three', 'four']);
  });

  it('replaces a duplicate identifier without increasing capacity', () => {
    const points = [point('one', 1), point('two', 2)];
    const updated = addRestorePoint(points, point('one', 3));

    expect(updated.map((item) => item.id)).toEqual(['two', 'one']);
    expect(updated).toHaveLength(2);
  });

  it('returns a selected snapshot or null', () => {
    const points = [point('one', 1)];
    expect(findRestorePoint(points, 'one')?.summary.lesson).toBe(4);
    expect(findRestorePoint(points, 'missing')).toBeNull();
  });
});
