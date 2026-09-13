import { describe, expect, it } from 'vitest';
import { checkpointLevel, CHECKPOINT_LEVELS } from './content';
import { advanceCheckpoint, createCheckpointRun, judgeCheckpoint } from './run';

describe('Kotoba Checkpoint progression', () => {
  it('has a ten-level, day-one curriculum with generous early shifts', () => {
    expect(CHECKPOINT_LEVELS).toHaveLength(10);
    expect(checkpointLevel(1).travellers).toBe(3);
    expect(checkpointLevel(1).seconds).toBeGreaterThan(checkpointLevel(9).seconds);
  });

  it('starts with visual kana matching without requiring learner vocabulary', () => {
    const run = createCheckpointRun();
    expect(run.cases).toHaveLength(3);
    expect(run.cases.every(item => item.ruleId === 'kana-match')).toBe(true);
  });

  it('only links checkpoint vocabulary cases to vocabulary supplied by the learner', () => {
    const word = { id: 'hello', word: 'こんにちは', reading: 'こんにちは', meaning: 'hello' };
    const run = createCheckpointRun(5, [word]);
    expect(run.cases.every(item => item.practiceIds.every(id => id === word.id))).toBe(true);
  });

  it('records an inspection then advances without silently changing the answer', () => {
    const run = { ...createCheckpointRun(), phase: 'inspect' as const };
    const judged = judgeCheckpoint(run, run.cases[0]!.expected);
    expect(judged.correct).toBe(1);
    expect(advanceCheckpoint(judged).index).toBe(1);
  });
});
