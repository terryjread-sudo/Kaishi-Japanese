import { describe, expect, it } from 'vitest';
import { answerMatches, lessonEvidenceDue, lessonOutcomeCatalogSchema, outcomeForLesson, recordLessonEvidence, validateLessonOutcomeCatalog } from './lesson-outcomes';
import type { LessonEvidence } from './lesson-outcomes';
import { buildJourneyCurriculum } from './journey-curriculum';
import catalog from '../../../data/lesson-outcomes.json';
import vocabulary from '../../../data/vocabulary.json';

describe('communicative lesson outcomes', () => {
  it('covers all 100 lessons with valid targets and response content', () => {
    const parsed = lessonOutcomeCatalogSchema.parse(catalog);
    expect(parsed.lessons.map((lesson) => lesson.lesson)).toEqual(Array.from({ length: 100 }, (_, index) => index + 1));
    expect(outcomeForLesson(catalog, 1)?.canDo).toContain('はい、いいえ、大丈夫');
    expect(validateLessonOutcomeCatalog(catalog, buildJourneyCurriculum(vocabulary).slice(0, 100))).toEqual([]);
  });

  it('normalizes Japanese punctuation and spacing', () => {
    expect(answerMatches(' はい。 ', ['はい'])).toBe(true);
    expect(answerMatches('いいえ', ['はい'])).toBe(false);
  });

  it('fades response support across the course', () => {
    const lessons = lessonOutcomeCatalogSchema.parse(catalog).lessons;
    expect(lessons.at(9)!.production.mode).toBe('choice');
    expect(lessons.at(10)!.production.mode).toBe('tiles');
    expect(lessons.at(30)!.production.mode).toBe('tiles-or-type');
    expect(lessons.at(60)!.production.mode).toBe('type-or-tiles');
  });

  it('records attempts without losing an earlier pass', () => {
    const passed = recordLessonEvidence(undefined, 'listening', true, 1);
    const retried = recordLessonEvidence(passed, 'listening', false, 2);
    expect(retried.listening).toEqual({ passed: true, attempts: 2, updatedAt: 2 });
  });

  it('schedules incomplete evidence for a quick repair and complete evidence for a delayed review', () => {
    expect(lessonEvidenceDue({ updatedAt: 1, listening: { passed: false, attempts: 1, updatedAt: 1 } }, 600_002)).toBe(true);
    const complete: LessonEvidence = {
      updatedAt: 1,
      listening: { passed: true, attempts: 1, updatedAt: 1 },
      recall: { passed: true, attempts: 1, updatedAt: 1 },
      production: { passed: true, attempts: 1, updatedAt: 1 },
      transfer: { passed: true, attempts: 1, updatedAt: 1 },
    };
    expect(lessonEvidenceDue({ ...complete, updatedAt: 1 }, 86_400_002)).toBe(true);
  });
});
