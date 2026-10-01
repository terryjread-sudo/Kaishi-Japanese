import { z } from 'zod';
import type { Game } from 'phaser';
import { SIGNAL_SHIFTS, nextSignalShift, signalShift } from '../domains/kotoba-checkpoint/content';
import { activeSignalCase, advanceSignal, createDailySignalShift, createSignalRun, firstAvailableShift, judgeSignal, markSignalWordForPractice, migrateSignalCareer, recordSignalOperationalAction, recordTokenLookup, revealSignalReading, revealSignalTranslation, selectQueuedSignal, selectSignalEvidence, setSignalConfidence, setSignalEvidenceStatus, setSignalSpecialisation, spendSignalVerification, startSignalShift, tickSignalQueue, toggleSignalEquipment } from '../domains/kotoba-checkpoint/run';
import type { SignalCareer, SignalOperationalAction, SignalRun, SignalShift, SignalToken, SignalVerdict, SignalVerificationAction } from '../domains/kotoba-checkpoint/types';
import { playCheckpointAudio, startCheckpointAmbience, stopCheckpointAmbience } from '../platform/kotoba-checkpoint-audio';
import { createVersionedRepository, sessionStorage } from '../platform/storage';
import type { SignalDeskController, SignalDeskSnapshot } from './kotoba-checkpoint-game';
import './kotoba-checkpoint.css';

type SignalResult = { career: SignalCareer; shiftId: string; passed: boolean; creditsEarned: number; practiceIds: string[]; languageMistakes: string[]; ruleMistakes: string[] };
type Host = { show?: (id: string) => void; returnToJourney?: () => void; checkpointCareer?: () => unknown; saveCheckpointCareer?: (career: SignalCareer) => void; recordDeskMisses?: (ids: string[]) => void; completeShift?: (ids: string[]) => void; recordSignalResult?: (result: SignalResult) => void };

const repo = createVersionedRepository<SignalRun>({
  storage: sessionStorage(), key: 'kaishi-kotoba-checkpoint', version: 4,
  schema: z.custom<SignalRun>(value => Boolean(value && typeof value === 'object' && (value as SignalRun).version === 4)),
  migrate: () => null,
});

let dailyShift: SignalShift | null = null;
let openTokenIndex: number | null = null;
let dictionaryRevealed = false;
let notice = '';
let game: Game | null = null;
let gameLoading: Promise<void> | null = null;
const listeners = new Set<() => void>();

const root = (): HTMLElement | null => document.querySelector<HTMLElement>('#senseiDesk');
const host = (): Host => ((window as Window & { KaishiActivityPolicy?: { kotobaCheckpoint?: Host } }).KaishiActivityPolicy?.kotobaCheckpoint || {});
const escape = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));
const dateSeed = (): string => new Date().toISOString().slice(0, 10);
const shiftFor = (run: SignalRun): SignalShift => { if (run.daily) { dailyShift ||= createDailySignalShift(run.shiftId.replace(/^daily-/, '')); return dailyShift; } return signalShift(run.shiftId); };

function freshRun(): SignalRun {
  const career = migrateSignalCareer(host().checkpointCareer?.());
  if (career.completedShiftIds.length === SIGNAL_SHIFTS.length) {
    dailyShift = createDailySignalShift(dateSeed());
    const run = createSignalRun(SIGNAL_SHIFTS.at(-1)!.id, career, true);
    run.shiftId = dailyShift.id; run.remaining = dailyShift.seconds || 0; return run;
  }
  return createSignalRun(firstAvailableShift(career).id, career);
}

const load = (): SignalRun => repo.load() || freshRun();
function save(run: SignalRun, persistCareer = false): void { repo.save(run); if (persistCareer) host().saveCheckpointCareer?.(run.career); }
function emit(message = ''): void { notice = message; renderSemantic(); listeners.forEach(listener => listener()); }
function resetCaseView(): void { openTokenIndex = null; dictionaryRevealed = false; notice = ''; }

function reportCompletion(before: SignalRun, run: SignalRun, shift: SignalShift): void {
  if (run.phase !== 'report' && run.phase !== 'failed') return;
  const languageMistakes = run.decisions.filter(item => !item.evidenceCorrect).map(item => item.caseId);
  const ruleMistakes = run.decisions.filter(item => !item.correct).map(item => item.caseId);
  host().recordSignalResult?.({ career: run.career, shiftId: shift.id, passed: run.phase === 'report', creditsEarned: run.career.credits - before.career.credits, practiceIds: shift.cases.flatMap(item => item.practiceIds), languageMistakes, ruleMistakes });
  if (run.phase === 'report') host().completeShift?.(shift.cases.flatMap(item => item.practiceIds));
}

const controller: SignalDeskController = {
  snapshot(): SignalDeskSnapshot { const run = load(), shift = shiftFor(run); return { run, shift, active: activeSignalCase(run, shift), openTokenIndex, dictionaryRevealed, notice }; },
  subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  start() { const current = load(), run = startSignalShift(current, shiftFor(current)); save(run); startCheckpointAmbience(); resetCaseView(); emit(); },
  exit() { stopCheckpointAmbience(); const bridge = host(); if (bridge.returnToJourney) bridge.returnToJourney(); else bridge.show?.('journey'); },
  pause() { const run = load(); if (run.phase !== 'decode') return; run.paused = !run.paused; save(run); emit(); },
  selectCase(id) { const current = load(); save(selectQueuedSignal(current, id, shiftFor(current))); resetCaseView(); emit(); },
  inspectToken(index) {
    const run = load(), shift = shiftFor(run), active = activeSignalCase(run, shift), item = active?.tokens[index]; if (!item) return;
    openTokenIndex = index; dictionaryRevealed = shift.sequence <= 3; playCheckpointAudio(item.surface, run.career.specialisation === 'listener' ? .72 : .82);
    save(recordTokenLookup(run, item.surface, shift.sequence > 3)); emit();
  },
  revealDictionary() {
    const run = load(), shift = shiftFor(run); if (openTokenIndex === null) return;
    const spent = shift.sequence <= 3 ? run : spendSignalVerification(run, 'dictionary');
    if (spent === run && shift.sequence > 3 && run.verification === 0 && !((run.equipmentUses.phrasebook || 0) > 0)) { emit('No verification charges remain. Trust your reading.'); return; }
    dictionaryRevealed = true; save(revealSignalReading(spent, shift.sequence > 3)); emit();
  },
  pinEvidence(fact) { save(selectSignalEvidence(load(), fact)); emit(); },
  setEvidenceStatus(fact, status) { save(setSignalEvidenceStatus(load(), fact, status)); emit(); },
  verify(action: SignalVerificationAction) {
    const run = load(), shift = shiftFor(run); const spent = shift.sequence <= 3 ? run : spendSignalVerification(run, action);
    if (spent === run && shift.sequence > 3) { emit('No verification charges remain.'); return; }
    let next = spent; let message = '';
    if (action === 'translation') { next = revealSignalTranslation(next, true); message = activeSignalCase(next, shift)?.english || ''; }
    if (action === 'director-hint') { next = { ...next, career: { ...next.career, relationships: { ...next.career.relationships, mori: Math.max(0, next.career.relationships.mori - 1) } } }; message = `DIRECTOR: This rule needs ${activeSignalCase(next, shift)?.decisiveFacts.length || 1} decisive clue(s).`; }
    if (action === 'source-check') message = 'SOURCE CHECK: compare the exact claim with your evidence wall.';
    if (action === 'slow-replay') { const active = activeSignalCase(next, shift); if (active) playCheckpointAudio(active.japanese, .62); }
    save(next); emit(message);
  },
  setConfidence(value) { save(setSignalConfidence(load(), value)); emit(); },
  file(verdict: SignalVerdict) {
    const run = load(); if (run.phase !== 'decode' || run.paused) return;
    const shift = shiftFor(run), active = activeSignalCase(run, shift); if (!active) return;
    const result = judgeSignal(run, verdict, shift); if (!result.decisions.at(-1)?.correct) host().recordDeskMisses?.(active.practiceIds);
    save(result, true); emit();
  },
  continue() { const before = load(), shift = shiftFor(before), run = advanceSignal(before, shift); save(run, true); reportCompletion(before, run, shift); resetCaseView(); emit(); },
  next() {
    const run = load(), shift = shiftFor(run); let nextRun: SignalRun;
    if (run.phase === 'report' && !run.daily && nextSignalShift(shift.id)) nextRun = createSignalRun(nextSignalShift(shift.id)!.id, run.career);
    else if (run.phase === 'report' && run.career.completedShiftIds.length === SIGNAL_SHIFTS.length) { dailyShift = createDailySignalShift(dateSeed()); nextRun = createSignalRun(SIGNAL_SHIFTS.at(-1)!.id, run.career, true); nextRun.shiftId = dailyShift.id; nextRun.remaining = dailyShift.seconds || 0; }
    else nextRun = createSignalRun(shift.id, run.career, run.daily);
    save(nextRun); resetCaseView(); emit();
  },
  operate(action: SignalOperationalAction) { save(recordSignalOperationalAction(load(), action), true); emit(); },
  speak(text, rate = .82) { playCheckpointAudio(text, rate); },
  specialise(value) { save(setSignalSpecialisation(load(), value), true); emit(); },
  equip(tool) { save(toggleSignalEquipment(load(), tool), true); emit(); },
  toggleTimer() { const run = load(); run.career.timerDisabled = !run.career.timerDisabled; save(run, true); emit(); },
  inspectMap() { const threads = Object.values(load().career.investigation.threads); emit(threads.length ? `NIGHT MAP: ${threads.flatMap(thread => thread.locations).slice(-4).join(' · ')}` : 'NIGHT MAP: no linked locations yet.'); },
};

function semanticButtons(snapshot: SignalDeskSnapshot): string {
  const { run, active } = snapshot;
  if (run.phase === 'briefing') return '<button data-signal-start>Clock in</button><button data-signal-exit>Return to Journey</button>';
  if (run.phase === 'report' || run.phase === 'failed') return `<button data-signal-next>${run.phase === 'report' ? 'Next assignment' : 'Repeat shift'}</button><button data-signal-exit>Return to Journey</button>`;
  const tokens = active?.tokens.map((item, index) => `<button data-signal-token="${index}">${escape(item.surface)}</button>`).join('') || '';
  const evidence = active?.tokens.filter(item => item.fact).map(item => `<button data-signal-evidence="${escape(item.fact)}">Pin ${escape(item.fact)}</button>`).join('') || '';
  return `${run.queuedCaseIds.map(id => `<button data-signal-case="${escape(id)}">Open ${escape(id)}</button>`).join('')}<div class="signal-message-line">${tokens}</div>${evidence}<button data-signal-confidence="fair">Fair confidence</button><button data-signal-verdict="standard">Standard</button><button data-signal-verdict="escalate">Escalate</button><button data-signal-pause>${run.paused ? 'Resume' : 'Pause'}</button>${run.phase === 'feedback' ? '<button data-signal-continue>Continue</button>' : ''}<button data-signal-exit>Leave</button>`;
}

function renderSemantic(): void {
  const target = root(); if (!target) return; const snapshot = controller.snapshot();
  target.dataset.signalPhase = snapshot.run.phase; target.dataset.signalActiveCase = snapshot.run.activeCaseId || ''; target.dataset.signalQueue = snapshot.run.queuedCaseIds.join(','); target.dataset.signalVerification = String(snapshot.run.verification);
  let semantic = target.querySelector<HTMLElement>('.signal-semantic');
  if (!semantic) { semantic = document.createElement('section'); semantic.className = 'signal-semantic'; semantic.setAttribute('aria-live', 'polite'); target.appendChild(semantic); }
  semantic.innerHTML = `<h1>Signal Desk · ${escape(snapshot.shift.title)}</h1><p>${escape(snapshot.shift.ruleText)}</p><p>${escape(snapshot.active?.japanese || '')}</p><p>${escape(notice)}</p>${semanticButtons(snapshot)}`;
  semantic.querySelector('[data-signal-start]')?.addEventListener('click', () => controller.start());
  semantic.querySelectorAll('[data-signal-exit]').forEach(button => button.addEventListener('click', () => controller.exit()));
  semantic.querySelector('[data-signal-next]')?.addEventListener('click', () => controller.next()); semantic.querySelector('[data-signal-pause]')?.addEventListener('click', () => controller.pause()); semantic.querySelector('[data-signal-continue]')?.addEventListener('click', () => controller.continue());
  semantic.querySelectorAll<HTMLElement>('[data-signal-case]').forEach(button => button.addEventListener('click', () => controller.selectCase(button.dataset.signalCase || '')));
  semantic.querySelectorAll<HTMLElement>('[data-signal-token]').forEach(button => button.addEventListener('click', () => controller.inspectToken(Number(button.dataset.signalToken))));
  semantic.querySelectorAll<HTMLElement>('[data-signal-evidence]').forEach(button => button.addEventListener('click', () => controller.pinEvidence(button.dataset.signalEvidence || '')));
  semantic.querySelectorAll<HTMLElement>('[data-signal-confidence]').forEach(button => button.addEventListener('click', () => controller.setConfidence('fair')));
  semantic.querySelectorAll<HTMLElement>('[data-signal-verdict]').forEach(button => button.addEventListener('click', () => controller.file(button.dataset.signalVerdict as SignalVerdict)));
}

function ensureGame(): void {
  const target = root(); if (!target) return; let mount = target.querySelector<HTMLElement>('#signalPhaserHost');
  if (!mount) { mount = document.createElement('div'); mount.id = 'signalPhaserHost'; target.appendChild(mount); }
  if (!game && !gameLoading) gameLoading = import('./kotoba-checkpoint-game').then(({ createSignalDeskGame }) => { if (!game && mount) game = createSignalDeskGame(mount, controller); }).finally(() => { gameLoading = null; });
  const run = load(); if (run.career.schemaVersion === 2) host().saveCheckpointCareer?.(run.career); renderSemantic();
}

function tick(): void {
  const current = load(), shift = shiftFor(current); if (current.phase !== 'decode' || current.paused) return;
  const next = tickSignalQueue(current, shift); save(next, next.expiredCaseIds.length !== current.expiredCaseIds.length);
  if (next.phase === 'report' || next.phase === 'failed') reportCompletion(current, next, shift);
  emit(next.expiredCaseIds.length > current.expiredCaseIds.length ? 'A signal expired, but the shift continues.' : '');
}

export function installKotobaCheckpoint(): void {
  window.setInterval(tick, 1000);
  document.querySelector<HTMLElement>('[data-experimental-nav="sensei-desk"]')?.addEventListener('click', ensureGame);
  window.addEventListener('kaishi-sensei-desk-host-ready', ensureGame);
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || !root()?.classList.contains('active')) return;
    if (event.key.toLowerCase() === 's') controller.file('standard');
    if (event.key.toLowerCase() === 'e') controller.file('escalate');
    if (event.key === ' ') { event.preventDefault(); controller.pause(); }
  });
  if (root()?.classList.contains('active')) ensureGame();
}

export function markCurrentSignalWordForPractice(token: SignalToken): void { const run = markSignalWordForPractice(load(), token); save(run, true); emit(); }
