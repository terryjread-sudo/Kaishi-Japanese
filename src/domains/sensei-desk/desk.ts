import type { GradeDecision, HomeworkLine, HomeworkSubmission, PupilProfile, SenseiShiftState, SenseiWord } from './types';

export const SHIFT_PAPERS = 5;
export const SHIFT_DURATION_MS = 8 * 60 * 1000;

const PUPILS: readonly PupilProfile[] = [
  { id: 'mio', name: 'Mio Tanaka', role: 'careful beginner', portrait: 'media/profiles/journey-girl-avatar.png', encouragement: 'Mio beams when the correction makes sense.', concern: 'Mio studies the red mark and quietly tries again.' },
  { id: 'ren', name: 'Ren Sato', role: 'fast but untidy', portrait: 'media/profiles/journey-boy-avatar.png', encouragement: 'Ren gives a relieved thumbs-up.', concern: 'Ren promises to slow down and check the kana.' },
  { id: 'yuki', name: 'Yuki Mori', role: 'new exchange student', portrait: 'media/profiles/journey-friend-avatar.png', encouragement: 'Yuki repeats the sentence aloud with confidence.', concern: 'Yuki opens the handbook and circles the particle.' },
  { id: 'haru', name: 'Haru Kato', role: 'quiet perfectionist', portrait: 'media/profiles/journey-guide-base.png', encouragement: 'Haru smiles at the neat, specific feedback.', concern: 'Haru frowns at the correction, then asks for one more example.' },
  { id: 'sora', name: 'Sora Watanabe', role: 'enthusiastic improvisor', portrait: 'media/profiles/girl-base.webp', encouragement: 'Sora celebrates the tiny improvement.', concern: 'Sora laughs nervously and promises not to guess the reading.' },
];

const PAPER_ASSETS = ['media/sensei-desk/homework-paper.png', 'media/sensei-desk/homework-paper.png', 'media/sensei-desk/homework-paper.png', 'media/sensei-desk/homework-paper.png', 'media/sensei-desk/homework-paper.png'];
const ERROR_TAGS = ['meaning', 'particle', 'kana'] as const;

function random(seed: number): () => number {
  let value = seed >>> 0;
  return () => { value = Math.imul(1664525, value) + 1013904223; return (value >>> 0) / 4294967296; };
}

function pick<T>(items: readonly T[], next: () => number, index: number): T { return items[Math.floor(next() * items.length) % items.length] ?? items[index % items.length]!; }
function mutateKana(reading: string): string { return reading.length > 1 ? `${reading.slice(0, -1)}${reading.at(-1) === 'う' ? 'お' : 'う'}` : `${reading}ー`; }
function otherMeaning(words: readonly SenseiWord[], word: SenseiWord): string { return words.find(item => item.id !== word.id)?.meaning ?? 'something else'; }

function makeLine(word: SenseiWord, words: readonly SenseiWord[], paperIndex: number, lineIndex: number): HomeworkLine {
  const isCorrect = (paperIndex + lineIndex) % 4 !== 1;
  const errorTag = ERROR_TAGS[(paperIndex + lineIndex) % ERROR_TAGS.length];
  const wrongReading = mutateKana(word.reading);
  const japanese = errorTag === 'particle' ? `${word.word}にします` : word.word;
  return {
    id: `paper-${paperIndex + 1}-line-${lineIndex + 1}`,
    wordId: word.id,
    japanese: isCorrect ? `${word.word}をおぼえます` : japanese,
    reading: isCorrect || errorTag !== 'kana' ? word.reading : wrongReading,
    meaning: isCorrect || errorTag !== 'meaning' ? word.meaning : otherMeaning(words, word),
    correctJapanese: `${word.word}をおぼえます`,
    correctReading: word.reading,
    correctMeaning: word.meaning,
    isCorrect,
    errorTag: isCorrect ? undefined : errorTag,
    explanation: isCorrect ? 'The word, reading, and sentence are consistent.' : errorTag === 'particle' ? 'This sentence needs を for the object being remembered.' : errorTag === 'kana' ? `The reading should be ${word.reading}. Compare each kana sound.` : `The meaning should be “${word.meaning}”.`,
    audio: word.wordAudio,
  };
}

export function createShift(words: readonly SenseiWord[], dateKey: string, seed = Date.now()): SenseiShiftState {
  const next = random(seed);
  const pool = [...words].filter(word => word.word && word.reading && word.meaning);
  const usable = pool.length ? pool : [{ id: 'beginner-water', word: 'みず', reading: 'みず', meaning: 'water' }];
  const submissions = Array.from({ length: SHIFT_PAPERS }, (_, paperIndex) => {
    const selected = [0, 1].map(offset => usable[(paperIndex * 2 + offset) % usable.length]!);
    return { id: `submission-${paperIndex + 1}`, pupil: pick(PUPILS, next, paperIndex), subject: paperIndex === 0 ? 'Basic vocabulary' : paperIndex === 1 ? 'Kana check' : paperIndex === 2 ? 'Particles in context' : paperIndex === 3 ? 'Everyday sentences' : 'Review paper', paperAsset: PAPER_ASSETS[paperIndex]!, lines: selected.map((word, lineIndex) => makeLine(word, usable, paperIndex, lineIndex)) };
  });
  const startedAt = Date.now();
  return { schemaVersion: 1, shiftId: `sensei-${startedAt.toString(36)}`, dateKey, phase: 'desk', currentIndex: 0, submissions, decisions: {}, paperResults: {}, reputation: 100, quota: { total: SHIFT_PAPERS, submitted: 0 }, startedAt, deadlineAt: startedAt + SHIFT_DURATION_MS, missedLineIds: [] };
}

export function currentSubmission(state: SenseiShiftState): HomeworkSubmission | null { return state.submissions[state.currentIndex] ?? null; }
export function lineFor(state: SenseiShiftState, lineId: string): HomeworkLine | null { return state.submissions.flatMap(item => item.lines).find(line => line.id === lineId) ?? null; }
export function gradePaper(state: SenseiShiftState, decisions: Record<string, GradeDecision>): SenseiShiftState {
  const submission = currentSubmission(state);
  if (!submission || state.phase !== 'desk') return state;
  const mistakes = submission.lines.filter(line => { const decision = decisions[line.id]; return !decision || decision.verdict !== (line.isCorrect ? 'correct' : 'needs-correction') || (!line.isCorrect && decision.errorTag !== line.errorTag); });
  const result = { correct: submission.lines.length - mistakes.length, total: submission.lines.length, mistakes: mistakes.map(line => line.id), reviewed: mistakes.length === 0 };
  return { ...state, phase: 'correction', decisions: { ...state.decisions, ...decisions }, paperResults: { ...state.paperResults, [submission.id]: result }, quota: { total: SHIFT_PAPERS, submitted: state.quota.submitted + 1 }, reputation: Math.max(0, state.reputation - mistakes.length * 4) };
}

export function reviewPaper(state: SenseiShiftState): SenseiShiftState {
  const submission = currentSubmission(state); const result = submission ? state.paperResults[submission.id] : undefined;
  if (!submission || !result || state.phase !== 'correction') return state;
  const nextMissed = [...new Set([...state.missedLineIds, ...result.mistakes])];
  const complete = state.currentIndex + 1 >= state.submissions.length;
  if (!complete) return { ...state, phase: 'desk', currentIndex: state.currentIndex + 1, missedLineIds: nextMissed };
  const total = Object.values(state.paperResults).reduce((sum, item) => sum + item.total, 0);
  const correct = Object.values(state.paperResults).reduce((sum, item) => sum + item.correct, 0);
  const passed = correct / Math.max(1, total) >= .8;
  return { ...state, phase: passed ? 'summary' : 'summary', missedLineIds: nextMissed };
}

export function finishShift(state: SenseiShiftState, now = Date.now()): SenseiShiftState {
  if (state.phase !== 'summary') return state;
  const total = Object.values(state.paperResults).reduce((sum, item) => sum + item.total, 0);
  const correct = Object.values(state.paperResults).reduce((sum, item) => sum + item.correct, 0);
  const timedOut = now > state.deadlineAt;
  const passed = !timedOut && correct / Math.max(1, total) >= .8;
  return { ...state, phase: passed ? 'passed' : 'failed' };
}

export function shiftScore(state: SenseiShiftState): { correct: number; total: number; percent: number } {
  const correct = Object.values(state.paperResults).reduce((sum, item) => sum + item.correct, 0);
  const total = Object.values(state.paperResults).reduce((sum, item) => sum + item.total, 0);
  return { correct, total, percent: Math.round(correct / Math.max(1, total) * 100) };
}
