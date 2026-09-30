import { SIGNAL_SHIFTS, signalShift } from './content';
import type { LegacyCheckpointState, SignalCareer, SignalCase, SignalConfidence, SignalDebriefMode, SignalEvidenceStatus, SignalOperationalAction, SignalRule, SignalRun, SignalShift, SignalSpecialisation, SignalToken, SignalVerdict, SignalWordMemory } from './types';

export const DEFAULT_SIGNAL_CAREER: SignalCareer = { schemaVersion: 1, credits: 0, attempts: 0, completedShiftIds: [], rank: 'Trainee Analyst', commendations: [], strikes: 0, timerDisabled: false, wordMemory: {}, relationships: { mori: 0, kuroda: 0, crane: 0 }, equippedTools: [], debriefMode: 'guided', investigation: { facts: [], doubtfulFacts: [], contradictions: [], sources: {}, operationalActions: [] }, archive: [] };

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
    return { ...DEFAULT_SIGNAL_CAREER, ...legacy, completedShiftIds: [...new Set(legacy.completedShiftIds)], commendations: [...new Set(legacy.commendations || [])], wordMemory: legacy.wordMemory && typeof legacy.wordMemory === 'object' ? legacy.wordMemory : {}, relationships: { ...DEFAULT_SIGNAL_CAREER.relationships, ...(legacy.relationships || {}) }, equippedTools: Array.isArray(legacy.equippedTools) ? legacy.equippedTools.slice(0, 2) : [], debriefMode: legacy.debriefMode || 'guided', investigation: { ...DEFAULT_SIGNAL_CAREER.investigation, ...(legacy.investigation || {}), sources: { ...(legacy.investigation?.sources || {}) } }, archive: Array.isArray(legacy.archive) ? legacy.archive : [] };
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
  return { version: 3, shiftId: shift.id, index: 0, phase: 'briefing', decisions: [], selectedEvidence: [], lookedUpTokens: [], recalledTokens: [], paused: false, remaining: shift.seconds || 0, assisted: false, confidence: career.specialisation === 'field' ? 'fair' : 'uncertain', evidenceStatus: {}, readingVisible: shift.aid === 'full', translationVisible: false, daily, career: migrateSignalCareer(career) };
}

export function selectSignalEvidence(run: SignalRun, evidence: string): SignalRun {
  const selectedEvidence = run.selectedEvidence.includes(evidence) ? run.selectedEvidence.filter(item => item !== evidence) : [...run.selectedEvidence, evidence];
  const evidenceStatus = { ...(run.evidenceStatus || {}) };
  if (!selectedEvidence.includes(evidence)) delete evidenceStatus[evidence]; else evidenceStatus[evidence] ||= 'confirmed';
  return { ...run, selectedEvidence, evidenceStatus };
}

export function setSignalEvidenceStatus(run: SignalRun, evidence: string, status: SignalEvidenceStatus): SignalRun { return run.selectedEvidence.includes(evidence) ? { ...run, evidenceStatus: { ...(run.evidenceStatus || {}), [evidence]: status } } : run; }
export function setSignalConfidence(run: SignalRun, confidence: SignalConfidence): SignalRun { return { ...run, confidence }; }
export function setSignalDebriefMode(run: SignalRun, mode: SignalDebriefMode): SignalRun { return { ...run, career: { ...run.career, debriefMode: mode } }; }
export function setSignalSpecialisation(run: SignalRun, specialisation: SignalSpecialisation): SignalRun { return { ...run, career: { ...run.career, specialisation } }; }
export function toggleSignalEquipment(run: SignalRun, tool: string): SignalRun {
  const equippedTools = run.career.equippedTools.includes(tool) ? run.career.equippedTools.filter(item => item !== tool) : [...run.career.equippedTools, tool].slice(-2);
  return { ...run, career: { ...run.career, equippedTools } };
}

export function recordTokenLookup(run: SignalRun, tokenSurface: string, assisted = false): SignalRun {
  const lookedUpTokens = run.lookedUpTokens.includes(tokenSurface) ? run.lookedUpTokens : [...run.lookedUpTokens, tokenSurface];
  return { ...run, lookedUpTokens, assisted: run.assisted || assisted };
}

export function recordTokenRecall(run: SignalRun, tokenSurface: string, correct: boolean): SignalRun {
  if (!correct || run.recalledTokens?.includes(tokenSurface)) return run;
  return { ...run, recalledTokens: [...(run.recalledTokens || []), tokenSurface] };
}

const boundedStrength = (value: number): number => Math.max(0, Math.min(5, value));
function updateWordMemory(run: SignalRun, shift: SignalShift, active: SignalCase, evidenceCorrect: boolean): Record<string, SignalWordMemory> {
  const memory = { ...run.career.wordMemory };
  for (const token of active.tokens) {
    const prior = memory[token.surface] || { surface: token.surface, reading: token.reading, meaning: token.meaning, encounters: 0, independentRecalls: 0, assistedRecalls: 0, misses: 0, readingStrength: 0, listeningStrength: 0, markedForPractice: false };
    const decisive = Boolean(token.fact && active.decisiveFacts.includes(token.fact));
    const recalled = Boolean(run.recalledTokens?.includes(token.surface)) || Boolean(decisive && token.fact && run.selectedEvidence.includes(token.fact) && !run.lookedUpTokens.includes(token.surface));
    const assisted = run.lookedUpTokens.includes(token.surface) && !recalled;
    const missed = decisive && !evidenceCorrect && !recalled;
    const delta = recalled ? 1 : missed ? -1 : 0;
    memory[token.surface] = {
      ...prior,
      surface: token.surface,
      reading: token.reading,
      meaning: token.meaning,
      encounters: prior.encounters + 1,
      independentRecalls: prior.independentRecalls + (recalled ? 1 : 0),
      assistedRecalls: prior.assistedRecalls + (assisted ? 1 : 0),
      misses: prior.misses + (missed ? 1 : 0),
      readingStrength: boundedStrength(prior.readingStrength + (active.channel === 'telephone' ? 0 : delta)),
      listeningStrength: boundedStrength(prior.listeningStrength + (active.channel === 'telephone' ? delta : 0)),
      markedForPractice: missed ? true : prior.markedForPractice,
    };
  }
  return memory;
}

function updateRelationships(run: SignalRun, shift: SignalShift, active: SignalCase, correct: boolean): SignalCareer['relationships'] {
  const relationships = { ...run.career.relationships };
  const change = correct ? 2 : -1;
  const contact = active.event?.portrait === 'crane' || shift.story?.portrait === 'crane' ? 'crane' : shift.sequence >= 16 || active.event?.portrait === 'kuroda' || shift.story?.portrait === 'kuroda' ? 'kuroda' : 'mori';
  relationships[contact] = Math.max(0, Math.min(100, relationships[contact] + change));
  return relationships;
}

export function markSignalWordForPractice(run: SignalRun, token: SignalToken): SignalRun {
  const prior = run.career.wordMemory[token.surface] || { surface: token.surface, reading: token.reading, meaning: token.meaning, encounters: 0, independentRecalls: 0, assistedRecalls: 0, misses: 0, readingStrength: 0, listeningStrength: 0, markedForPractice: false };
  return { ...run, career: { ...run.career, wordMemory: { ...run.career.wordMemory, [token.surface]: { ...prior, markedForPractice: !prior.markedForPractice } } } };
}

export function signalLearningObjective(shift: SignalShift, career: SignalCareer): SignalToken {
  const candidates = shift.cases.flatMap(item => item.tokens).filter((token, index, all) => Boolean(token.fact) && all.findIndex(other => other.surface === token.surface) === index);
  return candidates.sort((a, b) => {
    const left = career.wordMemory[a.surface]; const right = career.wordMemory[b.surface];
    const leftStrength = shift.cases.some(item => item.channel === 'telephone' && item.tokens.some(token => token.surface === a.surface)) ? left?.listeningStrength || 0 : left?.readingStrength || 0;
    const rightStrength = shift.cases.some(item => item.channel === 'telephone' && item.tokens.some(token => token.surface === b.surface)) ? right?.listeningStrength || 0 : right?.readingStrength || 0;
    return leftStrength - rightStrength || (right?.misses || 0) - (left?.misses || 0);
  })[0] || shift.cases[0]!.tokens[0]!;
}

export function signalPriorityWords(career: SignalCareer, limit = 4): SignalWordMemory[] {
  return Object.values(career.wordMemory).filter(item => item.markedForPractice || item.misses > item.independentRecalls).sort((a, b) => Number(b.markedForPractice) - Number(a.markedForPractice) || b.misses - a.misses || a.readingStrength + a.listeningStrength - b.readingStrength - b.listeningStrength).slice(0, limit);
}

export function markSignalAssisted(run: SignalRun): SignalRun { return { ...run, assisted: true }; }
export function revealSignalReading(run: SignalRun, assisted = false): SignalRun { return { ...run, readingVisible: true, assisted: run.assisted || assisted }; }
export function revealSignalTranslation(run: SignalRun, assisted = false): SignalRun { return { ...run, translationVisible: true, assisted: run.assisted || assisted }; }

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
    confidence: run.confidence || 'uncertain',
  };
  const sourceName = active.speaker || active.event?.speaker || `${active.channel} source`;
  const priorSource = run.career.investigation.sources[sourceName] || { name: sourceName, reports: 0, accurateFilings: 0, lastClaim: '' };
  const statuses = run.evidenceStatus || {};
  const confirmed = run.selectedEvidence.filter(item => (statuses[item] || 'confirmed') === 'confirmed');
  const doubtful = run.selectedEvidence.filter(item => statuses[item] === 'doubtful');
  const contradictions = run.selectedEvidence.filter(item => statuses[item] === 'contradiction');
  const investigation = {
    ...run.career.investigation,
    facts: [...new Set([...run.career.investigation.facts.filter(item => !run.selectedEvidence.includes(item)), ...confirmed])],
    doubtfulFacts: [...new Set([...run.career.investigation.doubtfulFacts.filter(item => !run.selectedEvidence.includes(item)), ...doubtful])],
    contradictions: [...new Set([...run.career.investigation.contradictions.filter(item => !run.selectedEvidence.includes(item)), ...contradictions])],
    sources: { ...run.career.investigation.sources, [sourceName]: { ...priorSource, reports: priorSource.reports + 1, accurateFilings: priorSource.accurateFilings + (decision.correct ? 1 : 0), lastClaim: active.english } },
  };
  const career = { ...run.career, wordMemory: updateWordMemory(run, shift, active, decision.evidenceCorrect), relationships: updateRelationships(run, shift, active, decision.correct), investigation };
  return { ...run, career, decisions: [...run.decisions, decision], phase: 'feedback' };
}

export function recordSignalOperationalAction(run: SignalRun, action: SignalOperationalAction): SignalRun {
  if (run.phase !== 'feedback' || !run.decisions.length) return run;
  const decisions = [...run.decisions]; const latest = decisions.at(-1)!; decisions[decisions.length - 1] = { ...latest, operationalAction: action };
  const operationalActions = latest.operationalAction ? [...run.career.investigation.operationalActions.slice(0, -1), action] : [...run.career.investigation.operationalActions, action];
  return { ...run, decisions, career: { ...run.career, investigation: { ...run.career.investigation, operationalActions } } };
}

export function advanceSignal(run: SignalRun, shift = signalShift(run.shiftId)): SignalRun {
  if (run.phase !== 'feedback') return run;
  if (run.index + 1 < shift.cases.length) return { ...run, index: run.index + 1, phase: 'decode', selectedEvidence: [], evidenceStatus: {}, lookedUpTokens: [], recalledTokens: [], assisted: false, confidence: run.career.specialisation === 'field' ? 'fair' : 'uncertain', readingVisible: shift.aid === 'full', translationVisible: false };
  const correct = run.decisions.filter(item => item.correct).length;
  const passed = correct >= Math.ceil(shift.cases.length * .6);
  const completedShiftIds = passed && !run.daily ? [...new Set([...run.career.completedShiftIds, shift.id])] : run.career.completedShiftIds;
  const commendations = [...run.career.commendations];
  if (completedShiftIds.length === SIGNAL_SHIFTS.length && !commendations.includes('Section K Distinguished Service')) commendations.push('Section K Distinguished Service');
  const career: SignalCareer = {
    ...run.career,
    attempts: run.career.attempts + 1,
    credits: run.career.credits + correct * 4 + (passed ? 8 : 0) + (shift.sequence > 3 ? run.decisions.filter(item => item.correct && !item.assisted).length * 2 : 0),
    completedShiftIds,
    rank: rankFor(completedShiftIds.length),
    commendations,
    strikes: passed ? Math.max(0, run.career.strikes - 1) : run.career.strikes + 1,
    archive: [...run.career.archive.filter(item => item.shiftId !== shift.id), { shiftId: shift.id, title: shift.title, cleared: passed, independentFilings: run.decisions.filter(item => item.correct && !item.assisted).length, collectedAt: Date.now() }],
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
