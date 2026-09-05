import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findLessonStoryScene, selectLessonStoryScene } from './story-scenes';

const scene = {
  id: 'aiko-kai-introductions', lesson: 2, targetWordId: 'target', imageWordId: 'image',
  sentence: '私はカイです。', reading: 'わたしは カイです。', meaning: 'I am Kai.',
  grammarFocus: 'Named subject', grammarNote: 'Kai introduces himself.',
  question: { prompt: 'Who is speaking?', choices: ['Kai', 'Aiko'], answer: 'Kai', explanation: 'Kai says I am Kai.' },
};

const catalog = {
  schemaVersion: 1,
  scenes: [scene],
};

describe('lesson story scenes', () => {
  it('selects only a scene whose lesson target and visual are available', () => {
    expect(selectLessonStoryScene(catalog, 2, [
      { id: 'target' }, { id: 'image', picture: 'kai.webp' },
    ])).toMatchObject({ id: 'aiko-kai-introductions', image: 'kai.webp' });
    expect(selectLessonStoryScene(catalog, 2, [{ id: 'target' }])).toBeNull();
    expect(selectLessonStoryScene(catalog, 3, [{ id: 'target' }, { id: 'image', picture: 'kai.webp' }])).toBeNull();
  });

  it('rejects malformed catalogs and can recover a scene by ID for mission resume', () => {
    expect(selectLessonStoryScene({ schemaVersion: 1, scenes: [{ ...scene, question: { ...scene.question, answer: 'Sensei' } }] }, 2, [])).toBeNull();
    expect(findLessonStoryScene(catalog, 'aiko-kai-introductions')?.sentence).toBe('私はカイです。');
  });

  it('keeps Aiko and Kai returning every fourth lesson through the foundation', () => {
    const productionCatalog = JSON.parse(readFileSync(resolve(process.cwd(), 'data/lesson-story-scenes.json'), 'utf8')) as typeof catalog;
    const recurringLessons = productionCatalog.scenes.filter((entry) => entry.lesson >= 16).map((entry) => entry.lesson);

    expect(productionCatalog.scenes.slice(0, 6).map((entry) => entry.lesson)).toEqual([2, 4, 6, 8, 10, 12]);
    expect(recurringLessons).toEqual(Array.from({ length: 22 }, (_, index) => 16 + index * 4));
  });
});
