import { SIGNAL_SHIFTS, signalShift } from './content';
import type { LegacyCheckpointState, SignalCareer, SignalCase, SignalRule, SignalRun, SignalShift, SignalVerdict } from './types';

export const DEFAULT_SIGNAL_CAREER: SignalCareer = { schemaVersion: 1, credits: 0, attempts: 0, completedShiftIds: [], rank: 'Trainee Analyst', commendations: [], strikes: 0, timerDisabled: false };

export function evaluateSignalRule(rule: SignalRule, facts: readonly string[]): boolean {
  if (rule.op === 'fact') return facts.includes(rule.fact);
  if (rule.op === 'not') return !evaluateSignalRule(rule.rule, facts);
  return rule.op === 'all' ? rule.rules.every(item => evaluateSignalRule(item, facts)) : rule.rules.some(item => evaluateSignalRule(item, facts));
}

export function expectedSignalVerdict(shift: SignalShift, item: SignalCase): SignalVerdict {
  return evaluateSignalRule(item.event?.ruleOverride || shift.rule, item.facts) ? 'escalate' : 'standard';
}

function rankFor(completed: number): string {
  if (completed >= 20) return 'Deputy Section Director';
  if (completed >= 15) return 'Section Chief';
  if (completed >= 12) return 'Intelligence Officer';
  if (completed >= 8) return 'Signal Analyst';
  if (completed >= 3) return 'Junior Analyst';
  return 'Trainee Analyst';
}

export function migrateSignalCareer(value: unknown): SignalCareer {
  if (!value || typeof value !== 'object') return { ...DEFAULT_SIGNAL_CAREER };
  const legacy = value as LegacyCheckpointState & Partial<SignalCareer>;
  if (legacy.schemaVersion === 1 && Array.isArray(legacy.completedShiftIds)) {
    return { ...DEFAULT_SIGNAL_CAREER, ...legacy, completedShiftIds: [...new Set(legacy.completedShiftIds)], commendations: [...new Set(legacy.commendations || [])] };
  }
  const cleared = Array.isArray(legacy.cleared) ? legacy.cleared : Array.isArray(legacy.completedLevels) ? legacy.completedLevels : [];
  return {
    ...DEFAULT_SIGNAL_CAREER,
    credits: Math.max(0, Number(legacy.credits) || 0),
    attempts: Math.max(0, Number(legacy.attempts) || 0),
    commendations: cleared.length ? ['Immigration Service Veteran'] : [],
  };
}

export function firstAvailableShift(career: SignalCareer): SignalShift {
  const next = SIGNAL_SHIFTS.find(shift => !career.completedShiftIds.includes(shift.id));
  return next || SIGNAL_SHIFTS.at(-1)!;
}

export function createSignalRun(shiftId = SIGNAL_SHIFTS[0]!.id, career: SignalCareer = DEFAULT_SIGNAL_CAREER, daily = false): SignalRun {
  const shift = signalShift(shiftId);
  return { version: 3, shiftId: shift.id, index: 0, phase: 'briefing', decisions: [], selectedEvidence: [], lookedUpTokens: [], paused: false, remaining: shift.seconds || 0, assisted: false, daily, career: migrateSignalCareer(career) };
}

export function selectSignalEvidence(run: SignalRun, evidence: string): SignalRun {
  const selectedEvidence = run.selectedEvidence.includes(evidence) ? run.selectedEvidence.filter(item => item !== evidence) : [...run.selectedEvidence, evidence];
  return { ...run, selectedEvidence };
}

export function recordTokenLookup(run: SignalRun, tokenSurface: string): SignalRun {
  return run.lookedUpTokens.includes(tokenSurface) ? run : { ...run, lookedUpTokens: [...run.lookedUpTokens, tokenSurface] };
}

export function markSignalAssisted(run: SignalRun): SignalRun { return { ...run, assisted: true }; }

export function judgeSignal(run: SignalRun, verdict: SignalVerdict, shift = signalShift(run.shiftId)): SignalRun {
  if (run.phase !== 'decode') return run;
  const active = shift.cases[run.index];
  if (!active) return run;
  const expected = expectedSignalVerdict(shift, active);
  const decision = {
    caseId: active.id,
    verdict,
    correct: verdict === expected,
    evidenceCorrect: active.decisiveFacts.every(item => run.selectedEvidence.includes(item)),
    selectedEvidence: [...run.selectedEvidence],
    assisted: run.assisted,
  };
  return { ...run, decisions: [...run.decisions, decision], phase: 'feedback' };
}

export function advanceSignal(run: SignalRun, shift = signalShift(run.shiftId)): SignalRun {
  if (run.phase !== 'feedback') return run;
  if (run.index + 1 < shift.cases.length) return { ...run, index: run.index + 1, phase: 'decode', selectedEvidence: [], lookedUpTokens: [], assisted: false };
  const correct = run.decisions.filter(item => item.correct).length;
  const passed = correct >= Math.ceil(shift.cases.length * .6);
  const completedShiftIds = passed && !run.daily ? [...new Set([...run.career.completedShiftIds, shift.id])] : run.career.completedShiftIds;
  const commendations = [...run.career.commendations];
  if (completedShiftIds.length === SIGNAL_SHIFTS.length && !commendations.includes('Section K Distinguished Service')) commendations.push('Section K Distinguished Service');
  const career: SignalCareer = {
    ...run.career,
    attempts: run.career.attempts + 1,
    credits: run.career.credits + correct * 4 + (passed ? 8 : 0),
    completedShiftIds,
    rank: rankFor(completedShiftIds.length),
    commendations,
    strikes: passed ? Math.max(0, run.career.strikes - 1) : run.career.strikes + 1,
  };
  return { ...run, career, phase: passed ? 'report' : 'failed' };
}

function numberSeed(seed: string): number { return [...seed].reduce((value, char) => Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261); }
function shuffled<T>(items: T[], seed: string): T[] { let state = numberSeed(seed); return [...items].sort(() => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return (state / 4294967296) - .5; }); }

export function createDailySignalShift(seed: string): SignalShift {
  const source = SIGNAL_SHIFTS[numberSeed(seed) % SIGNAL_SHIFTS.length]!;
  const escalated = source.cases.find(item => expectedSignalVerdict(source, item) === 'escalate')!;
  const standard = source.cases.find(item => expectedSignalVerdict(source, item) === 'standard')!;
  const cases = shuffled([...source.cases, { ...escalated, id: `${escalated.id}-daily-a` }, { ...standard, id: `${standard.id}-daily-b` }], seed);
  return { ...source, id: `daily-${seed}`, sequence: SIGNAL_SHIFTS.length + 1, department: 'Daily Signals', title: 'Daily classified file', location: 'Section K · Rotating Desk', delayedFeedback: true, story: undefined, debrief: undefined, cases };
}

export function signalRunPassed(run: SignalRun): boolean { return run.phase === 'report'; }
