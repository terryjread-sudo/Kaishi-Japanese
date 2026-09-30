import { describe, expect, it } from 'vitest';
import { SIGNAL_SHIFTS } from './content';
import { advanceSignal, createDailySignalShift, createSignalRun, evaluateSignalRule, expectedSignalVerdict, judgeSignal, migrateSignalCareer, recordTokenLookup, revealSignalReading, revealSignalTranslation, selectSignalEvidence } from './run';
import type { SignalRule, SignalRun } from './types';

describe('Section K signal rules', () => {
  it('evaluates nested all, any and not rules', () => {
    const rule: SignalRule = { op: 'all', rules: [{ op: 'any', rules: [{ op: 'fact', fact: 'red' }, { op: 'fact', fact: 'blue' }] }, { op: 'not', rule: { op: 'fact', fact: 'cancelled' } }] };
    expect(evaluateSignalRule(rule, ['blue'])).toBe(true);
    expect(evaluateSignalRule(rule, ['red', 'cancelled'])).toBe(false);
    expect(evaluateSignalRule(rule, ['park'])).toBe(false);
  });

  it('ships twenty authored shifts and a varied pool of uniquely solvable cases', () => {
    expect(SIGNAL_SHIFTS).toHaveLength(20);
    expect(SIGNAL_SHIFTS.flatMap(shift => shift.cases)).toHaveLength(86);
    for (const shift of SIGNAL_SHIFTS) {
      expect(shift.cases.length).toBeGreaterThanOrEqual(4);
      const verdicts = shift.cases.map(item => expectedSignalVerdict(shift, item));
      expect(verdicts).toContain('standard');
      expect(verdicts).toContain('escalate');
      expect(shift.cases.every(item => item.decisiveFacts.length > 0 && item.tokens.length > 0)).toBe(true);
    }
  });

  it('uses authored emergency amendments for occasional unexpected events', () => {
    const events = SIGNAL_SHIFTS.flatMap(shift => shift.cases.map(item => ({ shift, item }))).filter(({ item }) => item.event);
    expect(events).toHaveLength(7);
    expect(events.every(({ item }) => Boolean(item.event?.ruleOverride && item.event.ruleText))).toBe(true);
    const compromisedCrane = events.find(({ item }) => item.id === 'f17-3')!;
    expect(evaluateSignalRule(compromisedCrane.shift.rule, compromisedCrane.item.facts)).toBe(true);
    expect(expectedSignalVerdict(compromisedCrane.shift, compromisedCrane.item)).toBe('standard');
    expect(SIGNAL_SHIFTS.filter(shift => shift.story && shift.debrief)).toHaveLength(5);
  });

  it('scores evidence separately from the final filing decision', () => {
    const shift = SIGNAL_SHIFTS[0]!;
    let run: SignalRun = { ...createSignalRun(shift.id), phase: 'decode' };
    run = selectSignalEvidence(run, 'red');
    const judged = judgeSignal(run, expectedSignalVerdict(shift, shift.cases[0]!), shift);
    expect(judged.decisions[0]).toMatchObject({ correct: true, evidenceCorrect: true });
    const advanced = advanceSignal(judged, shift);
    expect(advanced.index).toBe(1);
    expect(advanced.selectedEvidence).toEqual([]);
  });

  it('records optional classified help while keeping training help consequence-free', () => {
    const training = createSignalRun(SIGNAL_SHIFTS[0]!.id);
    expect(revealSignalTranslation(training)).toMatchObject({ translationVisible: true, assisted: false });
    const classified = recordTokenLookup(createSignalRun(SIGNAL_SHIFTS[3]!.id), '至急', true);
    expect(classified).toMatchObject({ lookedUpTokens: ['至急'], assisted: true });
    expect(revealSignalReading(classified, true)).toMatchObject({ readingVisible: true, assisted: true });
    expect(revealSignalTranslation(classified, true)).toMatchObject({ translationVisible: true, assisted: true });
  });

  it('migrates prior checkpoint credit without pretending the new campaign was cleared', () => {
    expect(migrateSignalCareer({ credits: 42, attempts: 3, cleared: [1, 2] })).toMatchObject({ credits: 42, attempts: 3, completedShiftIds: [], commendations: ['Immigration Service Veteran'] });
  });

  it('creates deterministic six-case daily shifts with both verdicts', () => {
    const first = createDailySignalShift('2026-09-29');
    const again = createDailySignalShift('2026-09-29');
    expect(first.cases.map(item => item.id)).toEqual(again.cases.map(item => item.id));
    expect(first.cases).toHaveLength(6);
    expect(new Set(first.cases.map(item => expectedSignalVerdict(first, item)))).toEqual(new Set(['standard', 'escalate']));
  });
});
