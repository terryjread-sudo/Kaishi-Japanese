import { describe, expect, it } from 'vitest';
import { createShift, finishShift, gradePaper, reviewPaper, shiftScore } from './desk';
import type { GradeDecision } from './types';

const words = [
  { id: '1', word: 'みず', reading: 'みず', meaning: 'water' },
  { id: '2', word: 'ひと', reading: 'ひと', meaning: 'person' },
  { id: '3', word: 'いえ', reading: 'いえ', meaning: 'house' },
  { id: '4', word: 'ともだち', reading: 'ともだち', meaning: 'friend' },
  { id: '5', word: 'ほん', reading: 'ほん', meaning: 'book' },
];

describe('Sensei Desk shifts', () => {
  it('creates five deterministic papers with teachable word-card errors', () => {
    const first = createShift(words, '2026-09-12', 42), second = createShift(words, '2026-09-12', 42);
    expect(first.submissions).toHaveLength(5);
    expect(first.submissions.map(item => item.pupil.id)).toEqual(second.submissions.map(item => item.pupil.id));
    expect(first.submissions.flatMap(item => item.lines).some(line => line.errorTag === 'meaning')).toBe(true);
    expect(first.submissions.flatMap(item => item.lines).every(line => line.kind === 'word')).toBe(true);
  });

  it('uses an exact previously introduced sentence, its English translation, and its audio', () => {
    const sentenceWord = { id: 'sentence', word: 'ここ', reading: 'ここ', meaning: 'here', sentence: 'ここに本があります。', sentenceMeaning: "There's a book here.", sentenceReading: 'ここに ほんが あります。', sentenceAudio: 'koko-sentence.mp3', sentenceIntroduced: true };
    const shift = createShift([sentenceWord, ...words], '2026-09-12', 9);
    const line = shift.submissions.flatMap(paper => paper.lines).find(item => item.wordId === 'sentence');
    expect(line).toMatchObject({ kind: 'sentence', correctJapanese: 'ここに本があります。', correctMeaning: "There's a book here.", audio: 'koko-sentence.mp3' });
  });

  it('never creates a shift with fallback or unintroduced vocabulary', () => {
    expect(() => createShift([], '2026-09-12', 42)).toThrow('introduced vocabulary');
    const shift = createShift(words.slice(0, 2), '2026-09-12', 42);
    expect(shift.submissions.flatMap(paper => paper.lines).every(line => ['1', '2'].includes(line.wordId))).toBe(true);
  });

  it('scores line verdicts and requires correction review before continuing', () => {
    const shift = createShift(words, '2026-09-12', 1), paper = shift.submissions[0]!;
    const decisions: Record<string, GradeDecision> = Object.fromEntries(paper.lines.map(line => [line.id, { verdict: line.isCorrect ? 'correct' : 'needs-correction', ...(line.errorTag ? { errorTag: line.errorTag } : {}) }]));
    const corrected = gradePaper(shift, decisions);
    expect(corrected.phase).toBe('correction');
    expect(reviewPaper(corrected).currentIndex).toBe(1);
  });

  it('passes a fully correct shift and fails a low-scoring shift', () => {
    let state = createShift(words, '2026-09-12', 2);
    for (const paper of state.submissions) {
      const decisions: Record<string, GradeDecision> = Object.fromEntries(paper.lines.map(line => [line.id, { verdict: line.isCorrect ? 'correct' : 'needs-correction', ...(line.errorTag ? { errorTag: line.errorTag } : {}) }]));
      state = reviewPaper(gradePaper(state, decisions));
    }
    expect(shiftScore(state).percent).toBe(100);
    expect(finishShift(state).phase).toBe('passed');
  });
});
