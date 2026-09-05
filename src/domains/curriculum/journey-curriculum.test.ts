import { describe, expect, it } from 'vitest';
import {
  CONNECTOR_STEPS,
  CURATED_FOUNDATION_LESSON_COUNT,
  CURRICULUM_LESSON_SIZE,
  SPOKEN_FIRST_FOUNDATION,
  buildJourneyCurriculum,
  connectorForLesson,
  resolveJourneyVocabulary,
  validateJourneyCurriculum,
} from './journey-curriculum';

const foundationVocabulary = SPOKEN_FIRST_FOUNDATION.flat().map((id) => ({ id }));
const fillerVocabulary = Array.from({ length: 90 }, (_, index) => ({ id: `filler-${index}` }));
const vocabulary = [...foundationVocabulary, ...fillerVocabulary];

describe('Journey curriculum', () => {
  it('puts the spoken-first foundation before untouched frequency-order remainder', () => {
    const ordered = resolveJourneyVocabulary([...fillerVocabulary, ...foundationVocabulary]);
    expect(ordered.slice(0, 3).map((word) => word.id)).toEqual([...SPOKEN_FIRST_FOUNDATION[0]!]);
    expect(ordered.at(-1)?.id).toBe('filler-89');
  });

  it('creates three-word lessons without losing or duplicating vocabulary', () => {
    const lessons = buildJourneyCurriculum(vocabulary);
    expect(SPOKEN_FIRST_FOUNDATION).toHaveLength(CURATED_FOUNDATION_LESSON_COUNT);
    expect(lessons[0]?.wordIds).toEqual(SPOKEN_FIRST_FOUNDATION[0]);
    expect(lessons.slice(0, CURATED_FOUNDATION_LESSON_COUNT).every((lesson) => lesson.wordIds.length === CURRICULUM_LESSON_SIZE)).toBe(true);
    expect(new Set(lessons.flatMap((lesson) => lesson.wordIds)).size).toBe(vocabulary.length);
    expect(validateJourneyCurriculum(vocabulary)).toEqual([]);
  });

  it('has a deliberate, one-at-a-time connector schedule', () => {
    expect(connectorForLesson(2)?.form).toBe('は');
    expect(connectorForLesson(3)).toBeNull();
    expect(new Set(CONNECTOR_STEPS.map((step) => step.lesson)).size).toBe(CONNECTOR_STEPS.length);
  });
});
