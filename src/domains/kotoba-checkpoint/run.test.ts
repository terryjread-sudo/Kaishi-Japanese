import { describe, expect, it } from 'vitest';
import { SIGNAL_SHIFTS } from './content';
import { activeSignalCase, advanceSignal, createDailySignalShift, createSignalRun, evaluateSignalRule, expectedSignalVerdict, judgeSignal, markSignalWordForPractice, migrateSignalCareer, recordSignalOperationalAction, recordTokenLookup, recordTokenRecall, revealSignalReading, revealSignalTranslation, selectQueuedSignal, selectSignalEvidence, setSignalConfidence, setSignalDebriefMode, setSignalEvidenceStatus, setSignalSpecialisation, signalLearningObjective, signalPriorityWords, spendSignalVerification, startSignalShift, tickSignalQueue, toggleSignalEquipment } from './run';
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
    let run: SignalRun = startSignalShift(createSignalRun(shift.id), shift);
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

  it('tracks word memory, contact trust and learner-selected practice priorities', () => {
    const shift = SIGNAL_SHIFTS[0]!;
    let run: SignalRun = startSignalShift(createSignalRun(shift.id), shift);
    run = recordTokenLookup(run, '赤い');
    run = recordTokenRecall(run, '赤い', true);
    run = selectSignalEvidence(run, 'red');
    run = judgeSignal(run, 'escalate', shift);
    expect(run.career.wordMemory['赤い']).toMatchObject({ encounters: 1, independentRecalls: 1, readingStrength: 1 });
    expect(run.career.relationships.mori).toBe(2);
    run = markSignalWordForPractice(run, shift.cases[0]!.tokens[0]!);
    expect(signalPriorityWords(run.career)[0]).toMatchObject({ surface: '赤い', markedForPractice: true });
    expect(signalLearningObjective(shift, run.career).surface).not.toBe('赤い');
  });

  it('builds a persistent investigation from confidence-aware evidence and operations', () => {
    const shift = SIGNAL_SHIFTS[0]!;
    let run: SignalRun = startSignalShift(createSignalRun(shift.id), shift);
    run = selectSignalEvidence(run, 'red');
    run = setSignalEvidenceStatus(run, 'red', 'doubtful');
    run = setSignalConfidence(run, 'fair');
    run = judgeSignal(run, 'escalate', shift);
    expect(run.decisions[0]).toMatchObject({ confidence: 'fair' });
    expect(run.career.investigation.doubtfulFacts).toContain('red');
    expect(Object.values(run.career.investigation.sources)[0]).toMatchObject({ reports: 1, accurateFilings: 1 });
    run = recordSignalOperationalAction(run, 'verify');
    run = recordSignalOperationalAction(run, 'monitor');
    expect(run.decisions[0]).toMatchObject({ operationalAction: 'monitor' });
    expect(run.career.investigation.operationalActions).toEqual(['monitor']);
  });

  it('persists specialist loadouts and gives field analysts calibrated starting confidence', () => {
    let run = createSignalRun();
    run = setSignalSpecialisation(run, 'field');
    run = toggleSignalEquipment(run, 'phrasebook');
    run = toggleSignalEquipment(run, 'tape-machine');
    run = toggleSignalEquipment(run, 'evidence-lamp');
    run = setSignalDebriefMode(run, 'operational');
    expect(run.career).toMatchObject({ specialisation: 'field', equippedTools: ['tape-machine', 'evidence-lamp'], debriefMode: 'operational' });
    expect(createSignalRun(undefined, run.career).confidence).toBe('fair');
  });

  it('gives cryptographers readings on written intercepts', () => {
    let run = createSignalRun();
    run = setSignalSpecialisation(run, 'cryptographer');
    const cryptographer = createSignalRun(undefined, run.career);
    expect(cryptographer.readingVisible).toBe(true);
  });

  it('archives a cleared shift as a collectible case file', () => {
    const shift = SIGNAL_SHIFTS[0]!;
    let run: SignalRun = startSignalShift(createSignalRun(shift.id), shift);
    for (let index = 0; index < shift.cases.length; index += 1) {
      const active = activeSignalCase(run, shift)!;
      run = judgeSignal(run, expectedSignalVerdict(shift, active), shift);
      run = advanceSignal(run, shift);
    }
    expect(run.phase).toBe('report');
    expect(run.career.archive).toEqual([expect.objectContaining({ shiftId: shift.id, cleared: true, independentFilings: shift.cases.length })]);
  });

  it('resets the superseded sequential campaign exactly once', () => {
    expect(migrateSignalCareer({ schemaVersion: 1, credits: 42, attempts: 3, completedShiftIds: ['training-colour'] })).toMatchObject({ schemaVersion: 2, credits: 0, attempts: 0, completedShiftIds: [], commendations: [] });
    const current = { ...migrateSignalCareer(undefined), credits: 12 };
    expect(migrateSignalCareer(current)).toMatchObject({ schemaVersion: 2, credits: 12 });
  });

  it('releases signals into a selectable queue and spends verification resources', () => {
    const shift = SIGNAL_SHIFTS[3]!;
    let run = startSignalShift(createSignalRun(shift.id), shift);
    expect(run.queuedCaseIds).toEqual([shift.cases[0]!.id]);
    for (let second = 0; second < 24; second += 1) run = tickSignalQueue(run, shift);
    expect(run.queuedCaseIds).toHaveLength(2);
    run = selectQueuedSignal(run, shift.cases[1]!.id, shift);
    expect(activeSignalCase(run, shift)?.id).toBe(shift.cases[1]!.id);
    const before = run.verification;
    run = spendSignalVerification(run, 'dictionary');
    expect(run.verification).toBe(before - 1);
    expect(run.assisted).toBe(true);
  });

  it('lets an urgent queued signal expire without ending the shift', () => {
    const base = SIGNAL_SHIFTS[3]!;
    const shift = { ...base, cases: base.cases.map((item, index) => ({ ...item, urgency: index === 0 ? 'urgent' as const : item.urgency })) };
    let run = startSignalShift(createSignalRun(base.id), shift);
    for (let second = 0; second < 48; second += 1) run = tickSignalQueue(run, shift);
    expect(run.expiredCaseIds).toContain(shift.cases[0]!.id);
    expect(run.decisions[0]).toMatchObject({ correct: false, expired: true });
    expect(run.phase).toBe('decode');
  });

  it('creates deterministic six-case daily shifts with both verdicts', () => {
    const first = createDailySignalShift('2026-09-29');
    const again = createDailySignalShift('2026-09-29');
    expect(first.cases.map(item => item.id)).toEqual(again.cases.map(item => item.id));
    expect(first.cases).toHaveLength(6);
    expect(new Set(first.cases.map(item => expectedSignalVerdict(first, item)))).toEqual(new Set(['standard', 'escalate']));
  });
});
