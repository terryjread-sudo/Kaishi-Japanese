import { z } from 'zod';
import { SIGNAL_SHIFTS, nextSignalShift, signalShift } from '../domains/kotoba-checkpoint/content';
import { advanceSignal, createDailySignalShift, createSignalRun, expectedSignalVerdict, firstAvailableShift, judgeSignal, markSignalAssisted, migrateSignalCareer, recordTokenLookup, revealSignalReading, revealSignalTranslation, selectSignalEvidence, signalRunPassed } from '../domains/kotoba-checkpoint/run';
import type { SignalCareer, SignalCase, SignalRun, SignalShift, SignalVerdict } from '../domains/kotoba-checkpoint/types';
import { playCheckpointAudio, playCheckpointEffect, startCheckpointAmbience, stopCheckpointAmbience } from '../platform/kotoba-checkpoint-audio';
import { createVersionedRepository, sessionStorage } from '../platform/storage';
import './kotoba-checkpoint.css';

type SignalResult = { career: SignalCareer; shiftId: string; passed: boolean; creditsEarned: number; practiceIds: string[]; languageMistakes: string[]; ruleMistakes: string[] };
type Host = { show?: (id: string) => void; returnToJourney?: () => void; checkpointCareer?: () => unknown; saveCheckpointCareer?: (career: SignalCareer) => void; recordDeskMisses?: (ids: string[]) => void; completeShift?: (ids: string[]) => void; recordSignalResult?: (result: SignalResult) => void };

const repo = createVersionedRepository<SignalRun>({
  storage: sessionStorage(), key: 'kaishi-kotoba-checkpoint', version: 3,
  schema: z.custom<SignalRun>(value => Boolean(value && typeof value === 'object' && (value as SignalRun).version === 3)),
  migrate: (value, fromVersion) => fromVersion === 2 ? createSignalRun(undefined, migrateSignalCareer(value)) : null,
});
let openTokenIndex: number | null = null;
let tutorialOpen = false;
let guideOpen = false;
let dailyShift: SignalShift | null = null;

const root = (): HTMLElement | null => document.querySelector<HTMLElement>('#senseiDesk');
const host = (): Host => ((window as Window & { KaishiActivityPolicy?: { kotobaCheckpoint?: Host } }).KaishiActivityPolicy?.kotobaCheckpoint || {});
const escape = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
const dateSeed = (): string => new Date().toISOString().slice(0, 10);
const loadCareer = (): SignalCareer => migrateSignalCareer(host().checkpointCareer?.());
function shiftFor(run: SignalRun): SignalShift { if (run.daily) { dailyShift ||= createDailySignalShift(run.shiftId.replace(/^daily-/, '')); return dailyShift; } return signalShift(run.shiftId); }
function freshRun(): SignalRun { const career = loadCareer(); if (career.completedShiftIds.length === SIGNAL_SHIFTS.length) { dailyShift = createDailySignalShift(dateSeed()); const run = createSignalRun(SIGNAL_SHIFTS.at(-1)!.id, career, true); run.shiftId = dailyShift.id; run.remaining = dailyShift.seconds || 0; run.readingVisible = dailyShift.aid === 'full'; return run; } return createSignalRun(firstAvailableShift(career).id, career); }
function load(): SignalRun { return repo.load() || freshRun(); }
function save(run: SignalRun): void { repo.save(run); }

function campaignRail(run: SignalRun): string {
  const departments = [...new Set(SIGNAL_SHIFTS.map(shift => shift.department))];
  return `<ol class="signal-career-rail" aria-label="Section K departments">${departments.map(department => { const shifts = SIGNAL_SHIFTS.filter(item => item.department === department); const completed = shifts.filter(item => run.career.completedShiftIds.includes(item.id)).length; const active = shiftFor(run).department === department; return `<li class="${completed === shifts.length ? 'complete' : ''} ${active ? 'active' : ''}"><span>${completed === shifts.length ? '✓' : completed + 1}</span><b>${escape(department)}</b><small>${completed}/${shifts.length}</small></li>`; }).join('')}</ol>`;
}

const portrait = (name: 'kuroda' | 'crane' | 'mori'): string => name === 'kuroda' ? 'media/kotoba-checkpoint/agent-kuroda.webp' : name === 'crane' ? 'media/kotoba-checkpoint/informant-crane.webp' : 'media/kotoba-checkpoint/director-mori.png';

function eventMarkup(active: SignalCase): string {
  const event = active.event;
  if (!event) return '';
  const figure = event.portrait ? `<img src="${portrait(event.portrait)}" alt="${escape(event.speaker || event.headline)}">` : `<span aria-hidden="true">${event.kind === 'blackout' ? 'ϟ' : event.kind === 'priority' ? '☎' : '!'}</span>`;
  return `<aside class="signal-event signal-event-${event.kind}" role="status">${figure}<div><small>${escape(event.speaker || 'SECTION K CONTROL')}</small><h2>${escape(event.headline)}</h2><p>${escape(event.body)}</p></div></aside>`;
}

function briefing(run: SignalRun): string {
  const shift = shiftFor(run);
  const timer = shift.seconds === null ? 'Untimed training' : run.career.timerDisabled ? 'Timer disabled' : `${Math.ceil(shift.seconds / 60)} minute shift`;
  const storyteller = shift.story || { speaker: 'Director Mori', portrait: 'mori' as const, text: '' };
  return `<main class="signal-shell ${shift.sequence >= 10 ? 'is-night' : ''}"><section class="signal-office signal-briefing"><header class="signal-masthead"><div><span>ことば局 · SECTION K</span><b>SIGNAL DESK</b></div><div><span>${escape(run.career.rank)}</span><b>◎ ${run.career.credits}</b></div></header>${campaignRail(run)}<article class="signal-brief"><img class="signal-director" src="${portrait(storyteller.portrait)}" alt="${escape(storyteller.speaker)}"><div class="signal-brief-copy"><span class="signal-kicker">SHIFT ${shift.sequence} · ${escape(shift.department)}</span><h1>${escape(shift.title)}</h1><p>${escape(shift.briefing)}</p>${storyteller.text ? `<blockquote class="signal-story-quote"><b>${escape(storyteller.speaker)}</b> “${escape(storyteller.text)}”</blockquote>` : ''}<section class="signal-rule-card"><span>TODAY’S CODEBOOK</span><strong>${escape(shift.ruleText)}</strong><p>${escape(shift.guidance)}</p></section><div class="signal-brief-meta"><span>▤ ${shift.cases.length} classified messages</span><span>◷ ${timer}</span><span>⌖ ${escape(shift.location)}</span></div>${shift.seconds === null ? '' : `<label class="signal-timer-option"><input type="checkbox" data-signal-timer ${run.career.timerDisabled ? 'checked' : ''}> Disable shift timers</label>`}<div class="signal-actions"><button class="signal-primary" data-signal-start>Clock in <span>→</span></button><button data-signal-tutorial>Training manual</button><button data-signal-exit>Return to Journey</button></div></div></article></section></main>`;
}

function tutorial(run: SignalRun): string {
  return `<main class="signal-shell"><section class="signal-office signal-briefing"><article class="signal-manual"><span class="signal-kicker">SECTION K FIELD MANUAL</span><h1>Read. Mark. Decide.</h1><ol><li><b>Decode one clue at a time.</b> Tap a written word to open its pocket-dictionary card. Readings are supplied during training and become optional later.</li><li><b>Pin evidence.</b> Add only the facts that matter to the notepad. The codebook may need one clue, several clues or an exception.</li><li><b>Apply today’s rule.</b> Facts are not automatically dangerous. The active codebook determines the filing.</li><li><b>Use the trays.</b> Choose STANDARD or ESCALATE. The complete English translation appears after you file the message.</li></ol><p>Training help is free. On classified shifts, optional dictionary, transcript, reading and translation help is recorded as assisted—not as a wrong answer.</p><p>Keyboard: <kbd>S</kbd> standard, <kbd>E</kbd> escalate, <kbd>Space</kbd> pause.</p><button class="signal-primary" data-signal-tutorial-close>Return to briefing</button><button data-signal-exit>Return to Journey</button></article>${campaignRail(run)}</section></main>`;
}

function guideMarkup(): string {
  if (!guideOpen) return '';
  return `<div class="signal-guide-backdrop" role="dialog" aria-modal="true" aria-labelledby="signal-guide-title"><article class="signal-guide"><button class="signal-guide-close" data-signal-guide-close aria-label="Close decoding guide">×</button><span>SECTION K QUICK GUIDE</span><h2 id="signal-guide-title">How to decode a signal</h2><ol><li><b>Tap a Japanese word.</b><p>Its reading and meaning open in the pocket dictionary.</p></li><li><b>Pin useful evidence.</b><p>If a meaning matches the codebook, pin it to your notepad.</p></li><li><b>Check the exact rule.</b><p>Look for AND, OR and exceptions. Not every familiar word is decisive.</p></li><li><b>File the message.</b><p>Choose STANDARD or ESCALATE. You will see the complete translation after filing.</p></li></ol><p class="signal-guide-note">Training help is consequence-free. Later assistance is recorded so your report can distinguish independent recall from supported work.</p><button class="signal-primary" data-signal-guide-close>Return to file</button></article></div>`;
}

function tokenMarkup(run: SignalRun, shift: SignalShift): string {
  const active = shift.cases[run.index]!;
  if (active.channel === 'telephone' && !run.assisted) return `<div class="signal-audio-only"><div class="signal-phone" aria-hidden="true">☎</div><div class="signal-reels" aria-hidden="true"><i></i><i></i></div><p>Listen for meaning. The transcript is available if you need it.</p><button data-signal-audio>▶ Play intercepted call</button><button data-signal-transcript>Show transcript · assisted</button></div>`;
  const firstCaseCoach = shift.id === 'training-colour' && run.index === 0;
  const readingVisible = run.readingVisible ?? shift.aid === 'full';
  const helpLabel = shift.sequence <= 3 ? 'training help' : 'assisted';
  const tokens = active.tokens.map((item, index) => {
    const guided = firstCaseCoach && index === 0 && !run.lookedUpTokens.length;
    return `<button class="signal-token ${run.lookedUpTokens.includes(item.surface) ? 'looked-up' : ''} ${guided ? 'is-guided' : ''}" data-signal-token="${index}">${escape(item.surface)}</button>`;
  }).join('');
  return `<div class="signal-message-line" lang="ja">${tokens}</div>${firstCaseCoach && !run.lookedUpTokens.length ? '<p class="signal-first-tip">Start here: tap <b lang="ja">赤い</b> to look it up.</p>' : ''}${readingVisible ? `<p class="signal-reading">${escape(active.reading)}</p>` : `<button class="signal-help-reveal" data-signal-reading>Show full reading · ${helpLabel}</button>`}${run.translationVisible ? `<p class="signal-translation"><b>Translation:</b> ${escape(active.english)}</p>` : `<button class="signal-help-reveal" data-signal-translation>Reveal translation · ${helpLabel}</button>`}`;
}

function dictionaryMarkup(run: SignalRun, shift: SignalShift): string {
  const active = shift.cases[run.index]!;
  const item = openTokenIndex === null ? null : active.tokens[openTokenIndex];
  if (!item) return `<div class="signal-dictionary-empty"><span>POCKET DICTIONARY</span><p>Tap a Japanese word to inspect it.</p></div>`;
  const coached = shift.id === 'training-colour' && run.index === 0 && item.fact === 'red' && !run.selectedEvidence.includes('red');
  const assistance = shift.sequence > 3 ? '<em class="signal-assist-note">Dictionary lookup recorded as assisted.</em>' : '';
  return `<div class="signal-dictionary-card"><span>POCKET DICTIONARY</span><b lang="ja">${escape(item.surface)}</b><small>${escape(item.reading)}</small><p>${escape(item.meaning)}</p>${item.fact ? `<button class="${coached ? 'is-guided' : ''}" data-signal-evidence="${escape(item.fact)}">${run.selectedEvidence.includes(item.fact) ? 'Remove evidence' : 'Pin as evidence'} · ${escape(item.meaning)}</button>${coached ? '<em class="signal-pin-tip">Now pin “red” so you can compare it with the codebook.</em>' : ''}` : '<em>This word is context, not a codebook fact.</em>'}${assistance}</div>`;
}

function feedbackMarkup(run: SignalRun, shift: SignalShift): string {
  if (run.phase !== 'feedback') return '';
  const active = shift.cases[run.index]!;
  const decision = run.decisions.at(-1)!;
  const translation = `<p class="signal-feedback-translation"><b>Translation:</b> ${escape(active.english)}</p>`;
  if (shift.delayedFeedback) return `<aside class="signal-feedback is-sealed" role="status"><span>FILE SEALED</span><h2>Decision logged</h2>${translation}<p>${active.storyAfter ? escape(active.storyAfter) : 'Director Mori will return the complete analysis at the end of this shift.'}</p><button class="signal-primary" data-signal-continue>${run.index + 1 < shift.cases.length ? 'Next intercept →' : 'Open shift report →'}</button></aside>`;
  return `<aside class="signal-feedback ${decision.correct ? 'is-correct' : 'is-wrong'}" role="status"><span>${decision.correct ? 'CORRECT FILING' : 'CODEBOOK ERROR'}</span><h2>${decision.correct ? 'Good judgement' : `This belonged in ${expectedSignalVerdict(shift, active).toUpperCase()}`}</h2>${translation}<p>${escape(active.explanation)}${active.storyAfter ? ` ${escape(active.storyAfter)}` : ''}</p><small>${decision.evidenceCorrect ? 'Evidence identified correctly.' : 'Review the decisive Japanese evidence before the next file.'}</small><button class="signal-primary" data-signal-continue>${run.index + 1 < shift.cases.length ? 'Next intercept →' : 'Open shift report →'}</button></aside>`;
}

function desk(run: SignalRun): string {
  const shift = shiftFor(run), active = shift.cases[run.index]!;
  const activeRuleText = active.event?.ruleText || shift.ruleText;
  const selected = run.selectedEvidence.map(item => `<button data-signal-evidence="${escape(item)}">${escape(item)} ×</button>`).join('');
  const pause = run.paused ? `<div class="signal-pause" role="dialog" aria-modal="true"><span>SHIFT PAUSED</span><h2>The office can wait.</h2><p>Your message and remaining time are held safely.</p><button class="signal-primary" data-signal-pause>Resume shift</button></div>` : '';
  return `<main class="signal-shell ${shift.sequence >= 10 ? 'is-night' : ''}"><section class="signal-office"><header class="signal-hud"><div><span>${escape(shift.department)} · SHIFT ${shift.sequence}</span><b>${run.index + 1}/${shift.cases.length} messages</b></div><div><span>${escape(run.career.rank)}</span>${shift.seconds !== null && !run.career.timerDisabled ? `<b data-signal-clock>${run.remaining}s</b>` : '<b>UNTIMED</b>'}<button data-signal-pause>Pause</button><button data-signal-exit>Leave</button></div></header><div class="signal-desk">${eventMarkup(active)}<aside class="signal-codebook ${active.event?.ruleOverride ? 'is-amended' : ''}"><span>${active.event?.ruleOverride ? 'EMERGENCY AMENDMENT' : 'ACTIVE CODEBOOK'}</span><strong>${escape(activeRuleText)}</strong><p>${active.event?.ruleOverride ? 'This temporary order applies only to the current file.' : escape(shift.guidance)}</p><button data-signal-handbook>How to decode</button></aside><article class="signal-paper ${active.channel}"><header><span>${active.channel.toUpperCase()} · ${escape(active.speaker || 'SOURCE CLASSIFIED')}</span><b>${String(run.index + 1).padStart(3, '0')} / K</b></header>${tokenMarkup(run, shift)}${active.channel === 'telephone' && run.assisted ? '<button data-signal-audio>▶ Replay call</button>' : ''}</article><aside class="signal-notepad"><span>EVIDENCE NOTEPAD</span><div class="signal-evidence-list">${selected || '<p>No evidence pinned yet.</p>'}</div>${dictionaryMarkup(run, shift)}</aside><div class="signal-trays"><button class="signal-tray standard" data-signal-verdict="standard" ${run.phase !== 'decode' ? 'disabled' : ''}><span>通常</span><b>STANDARD</b><small>Routine contents</small></button><button class="signal-tray escalate" data-signal-verdict="escalate" ${run.phase !== 'decode' ? 'disabled' : ''}><span>至急</span><b>ESCALATE</b><small>Send up the chain</small></button></div>${feedbackMarkup(run, shift)}${pause}</div>${guideMarkup()}</section></main>`;
}

function report(run: SignalRun): string {
  const shift = shiftFor(run), passed = signalRunPassed(run), correct = run.decisions.filter(item => item.correct).length, evidence = run.decisions.filter(item => item.evidenceCorrect).length;
  return `<main class="signal-shell ${shift.sequence >= 10 ? 'is-night' : ''}"><section class="signal-office signal-report-wrap"><article class="signal-report"><span class="signal-seal ${passed ? 'pass' : 'fail'}">${passed ? 'CLEARED' : 'REASSIGNED'}</span><span class="signal-kicker">${escape(shift.department)} · AFTER-ACTION REPORT</span><h1>${passed ? 'Shift cleared' : 'Training reassignment'}</h1><p>${passed ? `Director Mori has approved your work as ${escape(run.career.rank)}.` : 'Your learning record is safe. Review this codebook and run the shift again.'}</p>${passed && shift.debrief ? `<blockquote class="signal-debrief"><b>NARRATIVE UPDATE</b>${escape(shift.debrief)}</blockquote>` : ''}<div class="signal-score-grid"><div><b>${correct}/${shift.cases.length}</b><span>filings</span></div><div><b>${evidence}/${shift.cases.length}</b><span>evidence</span></div><div><b>${run.decisions.filter(item => item.assisted).length}</b><span>assisted</span></div><div><b>◎ ${run.career.credits}</b><span>career credits</span></div></div><div class="signal-case-review">${shift.cases.map((item, index) => { const decision = run.decisions[index]; const expected = expectedSignalVerdict(shift, item); return `<details ${decision?.correct ? '' : 'open'}><summary><span>${decision?.correct ? '✓' : '×'} ${escape(item.japanese)}</span><b>${expected.toUpperCase()}</b></summary><p>${escape(item.english)} — ${escape(item.explanation)}</p></details>`; }).join('')}</div><div class="signal-actions"><button class="signal-primary" data-signal-next>${passed ? nextSignalShift(shift.id) ? 'Accept next assignment →' : 'Open daily signals →' : 'Repeat this shift →'}</button><button data-signal-exit>Return to Journey</button></div></article></section></main>`;
}

function render(): void { const target = root(); if (!target) return; const run = load(); target.innerHTML = tutorialOpen ? tutorial(run) : run.phase === 'briefing' ? briefing(run) : run.phase === 'report' || run.phase === 'failed' ? report(run) : desk(run); bind(); }
function start(): void { const run = load(); run.phase = 'decode'; run.paused = false; guideOpen = false; save(run); startCheckpointAmbience(); render(); }
function decide(verdict: SignalVerdict): void { const run = load(), shift = shiftFor(run), active = shift.cases[run.index]!; const result = judgeSignal(run, verdict, shift); if (!result.decisions.at(-1)?.correct) host().recordDeskMisses?.(active.practiceIds); save(result); playCheckpointEffect('stamp'); render(); }
function advance(): void { const before = load(), shift = shiftFor(before), run = advanceSignal(before, shift); save(run); if (run.phase === 'report' || run.phase === 'failed') { const languageMistakes = run.decisions.filter(item => !item.evidenceCorrect).map(item => item.caseId); const ruleMistakes = run.decisions.filter(item => !item.correct).map(item => item.caseId); host().recordSignalResult?.({ career: run.career, shiftId: shift.id, passed: run.phase === 'report', creditsEarned: run.career.credits - before.career.credits, practiceIds: shift.cases.flatMap(item => item.practiceIds), languageMistakes, ruleMistakes }); if (run.phase === 'report') host().completeShift?.(shift.cases.flatMap(item => item.practiceIds)); } openTokenIndex = null; guideOpen = false; render(); }
function next(): void { const run = load(), shift = shiftFor(run); if (run.phase === 'report' && !run.daily && nextSignalShift(shift.id)) save(createSignalRun(nextSignalShift(shift.id)!.id, run.career)); else if (run.phase === 'report' && run.career.completedShiftIds.length === SIGNAL_SHIFTS.length) { dailyShift = createDailySignalShift(dateSeed()); const dailyRun = createSignalRun(SIGNAL_SHIFTS.at(-1)!.id, run.career, true); dailyRun.shiftId = dailyShift.id; dailyRun.remaining = dailyShift.seconds || 0; dailyRun.readingVisible = dailyShift.aid === 'full'; save(dailyRun); } else save(createSignalRun(shift.id, run.career, run.daily)); openTokenIndex = null; guideOpen = false; render(); }
function exit(): void { stopCheckpointAmbience(); guideOpen = false; const bridge = host(); if (bridge.returnToJourney) bridge.returnToJourney(); else bridge.show?.('journey'); }

function bind(): void {
  const target = root(); if (!target) return;
  target.querySelector('[data-signal-start]')?.addEventListener('click', start);
  target.querySelector('[data-signal-tutorial]')?.addEventListener('click', () => { tutorialOpen = true; render(); });
  target.querySelector('[data-signal-tutorial-close]')?.addEventListener('click', () => { tutorialOpen = false; render(); });
  target.querySelectorAll('[data-signal-exit]').forEach(button => button.addEventListener('click', exit));
  target.querySelectorAll<HTMLElement>('[data-signal-verdict]').forEach(button => button.addEventListener('click', () => decide(button.dataset.signalVerdict as SignalVerdict)));
  target.querySelector('[data-signal-continue]')?.addEventListener('click', advance);
  target.querySelector('[data-signal-next]')?.addEventListener('click', next);
  target.querySelectorAll('[data-signal-pause]').forEach(button => button.addEventListener('click', () => { const run = load(); run.paused = !run.paused; save(run); render(); }));
  target.querySelectorAll<HTMLElement>('[data-signal-token]').forEach(button => button.addEventListener('click', () => { const run = load(), shift = shiftFor(run), item = shift.cases[run.index]?.tokens[Number(button.dataset.signalToken)]; if (!item) return; openTokenIndex = Number(button.dataset.signalToken); save(recordTokenLookup(run, item.surface, shift.sequence > 3)); render(); }));
  target.querySelectorAll<HTMLElement>('[data-signal-evidence]').forEach(button => button.addEventListener('click', () => { save(selectSignalEvidence(load(), button.dataset.signalEvidence || '')); render(); }));
  target.querySelectorAll('[data-signal-audio]').forEach(button => button.addEventListener('click', () => { const run = load(), active = shiftFor(run).cases[run.index]; if (!active) return; target.classList.add('is-playing'); playCheckpointAudio(active.japanese); window.setTimeout(() => target.classList.remove('is-playing'), Math.max(1400, active.japanese.length * 180)); }));
  target.querySelector('[data-signal-transcript]')?.addEventListener('click', () => { save(markSignalAssisted(load())); render(); });
  target.querySelector('[data-signal-reading]')?.addEventListener('click', () => { const run = load(), shift = shiftFor(run); save(revealSignalReading(run, shift.sequence > 3)); render(); });
  target.querySelector('[data-signal-translation]')?.addEventListener('click', () => { const run = load(), shift = shiftFor(run); save(revealSignalTranslation(run, shift.sequence > 3)); render(); });
  target.querySelector<HTMLInputElement>('[data-signal-timer]')?.addEventListener('change', event => { const run = load(); run.career.timerDisabled = (event.currentTarget as HTMLInputElement).checked; save(run); host().saveCheckpointCareer?.(run.career); render(); });
  target.querySelector('[data-signal-handbook]')?.addEventListener('click', () => { guideOpen = true; render(); });
  target.querySelectorAll('[data-signal-guide-close]').forEach(button => button.addEventListener('click', () => { guideOpen = false; render(); }));
}

function tick(): void { const run = load(), shift = shiftFor(run); if (run.phase !== 'decode' || run.paused || shift.seconds === null || run.career.timerDisabled) return; if (run.remaining <= 0) { run.phase = 'failed'; run.career = { ...run.career, attempts: run.career.attempts + 1, strikes: run.career.strikes + 1 }; save(run); host().recordSignalResult?.({ career: run.career, shiftId: shift.id, passed: false, creditsEarned: 0, practiceIds: [], languageMistakes: [], ruleMistakes: ['timeout'] }); render(); return; } run.remaining -= 1; save(run); const clock = root()?.querySelector<HTMLElement>('[data-signal-clock]'); if (clock) clock.textContent = `${run.remaining}s`; }

export function installKotobaCheckpoint(): void {
  window.setInterval(tick, 1000);
  document.querySelector<HTMLElement>('[data-experimental-nav="sensei-desk"]')?.addEventListener('click', render);
  window.addEventListener('kaishi-sensei-desk-host-ready', () => { const run = load(); if (run.phase === 'report' || run.phase === 'failed') { /* Keep the report available. */ } render(); });
  document.addEventListener('keydown', event => { if (event.altKey || event.ctrlKey || event.metaKey || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return; const target = root(); if (!target?.classList.contains('active')) return; if (event.key.toLowerCase() === 's') target.querySelector<HTMLElement>('[data-signal-verdict="standard"]')?.click(); if (event.key.toLowerCase() === 'e') target.querySelector<HTMLElement>('[data-signal-verdict="escalate"]')?.click(); if (event.key === ' ') { event.preventDefault(); target.querySelector<HTMLElement>('[data-signal-pause]')?.click(); } });
  if (root()?.classList.contains('active')) render();
}
