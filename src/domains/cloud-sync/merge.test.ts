import { describe, expect, it } from 'vitest';
import { hasStartedProgress, mergeSyncPayloads } from './merge';

describe('cloud sync merge', () => {
  it('preserves independent word learning and keeps the newest conflicting word', () => {
    const merged = mergeSyncPayloads(
      { progress: { a: { stage: 2, updatedAt: 10 }, shared: { stage: 1, updatedAt: 10 } }, meta: { updatedAt: 10 } },
      { progress: { b: { stage: 3, updatedAt: 20 }, shared: { stage: 4, updatedAt: 20 } }, meta: { updatedAt: 20 } },
      new Date('2026-09-06T12:00:00Z'),
    );
    expect(merged.progress).toMatchObject({ a: { stage: 2 }, b: { stage: 3 }, shared: { stage: 4 } });
  });

  it('unions durable histories while omitting temporary journey state and settings', () => {
    const merged = mergeSyncPayloads(
      { progress: {}, meta: { updatedAt: 1, dailyJourneyRoute: { chapter: 1 }, rhythmHistory: { '2026-09-05': { completedAt: 1 } }, notebook: { words: [{ wordId: 'a', savedAt: 1 }], mistakes: [{ key: 'meaning|yes|no|a|0', answer: 'yes', selected: 'no', count: 1, updatedAt: 1 }] }, sessionHistory: [{ id: 'one', completedAt: 1 }], canDoEvidence: { '1': { updatedAt: 10, listening: { passed: true } } } } },
      { progress: {}, meta: { updatedAt: 2, dailyActivity: { tested: 2 }, rhythmHistory: { '2026-09-06': { completedAt: 2 } }, notebook: { words: [{ wordId: 'b', savedAt: 2 }], mistakes: [{ key: 'meaning|yes|no|a|0', answer: 'yes', selected: 'no', count: 3, updatedAt: 2 }, { key: 'reading|hai|iie|b|0', answer: 'hai', selected: 'iie', count: 1, updatedAt: 2 }] }, sessionHistory: [{ id: 'two', completedAt: 2 }], canDoEvidence: { '1': { updatedAt: 20, transfer: { passed: true } }, '2': { updatedAt: 5 } } } },
      new Date('2026-09-06T12:00:00Z'),
    );
    expect(merged.meta.dailyJourneyRoute).toBeUndefined();
    expect(merged.meta.dailyActivity).toBeUndefined();
    expect((merged.meta.notebook as { words: unknown[] }).words).toHaveLength(2);
    expect((merged.meta.notebook as { mistakes: Array<{ count: number }> }).mistakes).toHaveLength(2);
    expect((merged.meta.notebook as { mistakes: Array<{ count: number }> }).mistakes.at(0)!.count).toBe(3);
    expect(merged.meta.sessionHistory).toHaveLength(2);
    expect(merged.meta.canDoEvidence).toEqual({ '1': { updatedAt: 20, transfer: { passed: true } }, '2': { updatedAt: 5 } });
    expect(merged.meta.streak).toBe(2);
  });

  it('recognises fresh and reset payloads safely', () => {
    expect(hasStartedProgress({ progress: {}, meta: {} })).toBe(false);
    expect(hasStartedProgress({ progress: {}, meta: { rhythmHistory: { '2026-09-06': {} } } })).toBe(true);
  });
});
