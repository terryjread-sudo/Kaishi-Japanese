import { z } from 'zod';
import { SIGNAL_SHIFTS, nextSignalShift, signalShift } from '../domains/kotoba-checkpoint/content';
import { advanceSignal, createDailySignalShift, createSignalRun, expectedSignalVerdict, firstAvailableShift, judgeSignal, markSignalAssisted, markSignalWordForPractice, migrateSignalCareer, recordSignalOperationalAction, recordTokenLookup, recordTokenRecall, revealSignalReading, revealSignalTranslation, selectSignalEvidence, setSignalConfidence, setSignalDebriefMode, setSignalEvidenceStatus, setSignalSpecialisation, signalLearningObjective, signalPriorityWords, signalRunPassed, toggleSignalEquipment } from '../domains/kotoba-checkpoint/run';
import type { SignalCareer, SignalCase, SignalConfidence, SignalDecision, SignalEvidenceStatus, SignalOperationalAction, SignalRule, SignalRun, SignalShift, SignalSpecialisation, SignalToken, SignalVerdict } from '../domains/kotoba-checkpoint/types';
import { playCheckpointAudio, playCheckpointEffect, setCheckpointAmbienceIntensity, startCheckpointAmbience, stopCheckpointAmbience } from '../platform/kotoba-checkpoint-audio';
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
let dictionaryRevealed = false;
let dictionaryGuess: string | null = null;
let productionResult: 'correct' | 'wrong' | null = null;
let directorHintOpen = false;
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

function officeProgressMarkup(career: SignalCareer): string {
  const completed = career.completedShiftIds.length;
  const upgrades = [{ at: 0, icon: '▤', name: 'Field manual' }, { at: 3, icon: '⌨', name: 'Cipher machine' }, { at: 7, icon: '☎', name: 'Wiretap console' }, { at: 10, icon: '◫', name: 'Night map' }, { at: 15, icon: '◎', name: 'Evidence wall' }, { at: 18, icon: '●', name: 'Red phone' }];
  const unlocked = upgrades.filter(item => completed >= item.at);
  const next = upgrades.find(item => completed < item.at);
  const tools = [{ id: 'phrasebook', at: 0, name: 'Phrasebook', benefit: 'Free reading support once per file' }, { id: 'tape-machine', at: 3, name: 'Tape machine', benefit: 'Slow and natural replay controls' }, { id: 'evidence-lamp', at: 7, name: 'Evidence lamp', benefit: 'Organise doubtful and contradictory clues' }, { id: 'red-phone', at: 15, name: 'Red phone', benefit: 'Request a Director hint' }].filter(item => completed >= item.at);
  const specialisations: Array<{ id: SignalSpecialisation; name: string; benefit: string }> = [{ id: 'linguist', name: 'Linguist', benefit: 'Fewer dictionary decoys' }, { id: 'listener', name: 'Listener', benefit: 'Clearer, slower first replay' }, { id: 'field', name: 'Field analyst', benefit: 'Starts each file at fair confidence' }, { id: 'cryptographer', name: 'Cryptographer', benefit: 'Displays a logical rule scan' }];
  return `<section class="signal-office-progress" aria-label="Office equipment"><span>YOUR SECTION K OFFICE</span><div>${unlocked.map(item => `<i title="${escape(item.name)}"><b>${item.icon}</b><small>${escape(item.name)}</small></i>`).join('')}</div>${next ? `<p>Next upgrade in ${next.at - completed} cleared shift${next.at - completed === 1 ? '' : 's'}: ${escape(next.name)}</p>` : '<p>Director-level office fully equipped.</p>'}<details class="signal-loadout"><summary>Agent specialisation, equipment and pacing</summary><fieldset><legend>Specialisation</legend>${specialisations.map(item => `<button class="${career.specialisation === item.id ? 'selected' : ''}" data-signal-specialisation="${item.id}" title="${escape(item.benefit)}">${escape(item.name)}<small>${escape(item.benefit)}</small></button>`).join('')}</fieldset><fieldset><legend>Equip up to two tools</legend>${tools.map(item => `<button class="${career.equippedTools.includes(item.id) ? 'selected' : ''}" data-signal-equipment="${item.id}" title="${escape(item.benefit)}">${escape(item.name)}</button>`).join('')}</fieldset><fieldset><legend>Debrief pace</legend>${(['guided', 'operational', 'sealed'] as const).map(mode => `<button class="${career.debriefMode === mode ? 'selected' : ''}" data-signal-debrief-mode="${mode}">${mode}</button>`).join('')}</fieldset></details></section>`;
}

function ruleLogic(rule: SignalRule): string {
  if (rule.op === 'fact') return rule.fact.toUpperCase();
  if (rule.op === 'not') return `NOT (${ruleLogic(rule.rule)})`;
  return `(${rule.rules.map(ruleLogic).join(rule.op === 'all' ? ' AND ' : ' OR ')})`;
}

function relationshipMarkup(career: SignalCareer): string {
  const contacts = [{ key: 'mori' as const, name: 'Mori' }, { key: 'kuroda' as const, name: 'Kuroda' }, { key: 'crane' as const, name: 'Crane' }];
  return `<div class="signal-relationships" aria-label="Contact trust">${contacts.map(contact => `<span title="Trust grows through sound judgement"><b>${escape(contact.name)}</b><i style="--trust:${career.relationships[contact.key]}%"><u></u></i><small>${career.relationships[contact.key]}</small></span>`).join('')}</div>`;
}

function learningObjectiveMarkup(run: SignalRun, shift: SignalShift): string {
  const target = signalLearningObjective(shift, run.career);
  const memory = run.career.wordMemory[target.surface];
  const modality = shift.cases.some(item => item.channel === 'telephone') ? 'hear' : 'read';
  const strength = modality === 'hear' ? memory?.listeningStrength || 0 : memory?.readingStrength || 0;
  const next = nextSignalShift(shift.id); const boss = !next || next.department !== shift.department;
  return `<section class="signal-learning-objective">${boss ? '<em>DEPARTMENT FINALE · BOSS CASE</em>' : ''}<span>LANGUAGE OBJECTIVE · ADAPTIVE</span><b>${modality === 'hear' ? 'Recognise by ear' : 'Recognise without lookup'}: <i lang="ja">${escape(target.surface)}</i></b><p>${strength ? `Current ${modality === 'hear' ? 'listening' : 'reading'} strength ${strength}/5. Retrieve it independently to strengthen the memory.` : 'New priority word. You will meet it in context during this shift.'}</p></section>`;
}

const portrait = (name: 'kuroda' | 'crane' | 'mori'): string => name === 'kuroda' ? 'media/kotoba-checkpoint/agent-kuroda.webp' : name === 'crane' ? 'media/kotoba-checkpoint/informant-crane.webp' : 'media/kotoba-checkpoint/director-mori.png';
const channelMission = (active: SignalCase): string => active.channel === 'telephone' ? 'LISTENING INTERCEPT' : active.channel === 'letter' ? 'HANDWRITTEN INTELLIGENCE' : active.channel === 'intercept' ? 'FIELD TRANSCRIPT' : 'CODED TELEGRAM';

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
  return `<main class="signal-shell ${shift.sequence >= 10 ? 'is-night' : ''}"><section class="signal-office signal-briefing"><header class="signal-masthead"><div><span>ことば局 · SECTION K</span><b>SIGNAL DESK</b></div><div><span>${escape(run.career.rank)}</span><b>◎ ${run.career.credits}</b></div></header>${campaignRail(run)}<article class="signal-brief"><img class="signal-director" src="${portrait(storyteller.portrait)}" alt="${escape(storyteller.speaker)}"><div class="signal-brief-copy"><span class="signal-kicker">SHIFT ${shift.sequence} · ${escape(shift.department)}</span><h1>${escape(shift.title)}</h1><p>${escape(shift.briefing)}</p>${storyteller.text ? `<blockquote class="signal-story-quote"><b>${escape(storyteller.speaker)}</b> “${escape(storyteller.text)}”</blockquote>` : ''}${learningObjectiveMarkup(run, shift)}<section class="signal-rule-card"><span>TODAY’S CODEBOOK</span><strong>${escape(shift.ruleText)}</strong><p>${escape(shift.guidance)}</p></section>${relationshipMarkup(run.career)}${officeProgressMarkup(run.career)}<div class="signal-brief-meta"><span>▤ ${shift.cases.length} classified messages</span><span>◷ ${timer}</span><span>⌖ ${escape(shift.location)}</span></div>${shift.seconds === null ? '' : `<label class="signal-timer-option"><input type="checkbox" data-signal-timer ${run.career.timerDisabled ? 'checked' : ''}> Disable shift timers</label>`}<div class="signal-actions"><button class="signal-primary" data-signal-start>Clock in <span>→</span></button><button data-signal-tutorial>Training manual</button><button data-signal-exit>Return to Journey</button></div></div></article></section></main>`;
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
    return `<button class="signal-token ${run.lookedUpTokens.includes(item.surface) ? 'looked-up' : ''} ${guided ? 'is-guided' : ''}" data-signal-token="${index}" aria-label="${escape(item.surface)}. Play audio and open dictionary." title="Play audio and look up this word">${escape(item.surface)}<span class="signal-token-audio" aria-hidden="true">♪</span></button>`;
  }).join('');
  return `<div class="signal-message-line" lang="ja">${tokens}</div>${firstCaseCoach && !run.lookedUpTokens.length ? '<p class="signal-first-tip">Start here: tap <b lang="ja">赤い</b> to look it up.</p>' : ''}${readingVisible ? `<p class="signal-reading">${escape(active.reading)}</p>` : `<button class="signal-help-reveal" data-signal-reading>Show full reading · ${helpLabel}</button>`}${run.translationVisible ? `<p class="signal-translation"><b>Translation:</b> ${escape(active.english)}</p>` : `<button class="signal-help-reveal" data-signal-translation>Reveal translation · ${helpLabel}</button>`}`;
}

function dictionaryChoices(item: SignalToken, shift: SignalShift, career: SignalCareer): string[] {
  const distractors = shift.cases.flatMap(signal => signal.tokens).map(token => token.meaning).filter((meaning, index, all) => meaning !== item.meaning && all.indexOf(meaning) === index).slice(0, career.specialisation === 'linguist' ? 1 : 2);
  const choices = [item.meaning, ...distractors];
  const offset = [...item.surface].reduce((total, character) => total + character.charCodeAt(0), 0) % choices.length;
  return [...choices.slice(offset), ...choices.slice(0, offset)];
}

function dictionaryMarkup(run: SignalRun, shift: SignalShift): string {
  const active = shift.cases[run.index]!;
  const item = openTokenIndex === null ? null : active.tokens[openTokenIndex];
  if (!item) return `<div class="signal-dictionary-empty"><span>POCKET DICTIONARY</span><p>Tap a Japanese word to inspect it.</p></div>`;
  const coached = shift.id === 'training-colour' && run.index === 0 && item.fact === 'red' && !run.selectedEvidence.includes('red');
  const assistance = shift.sequence > 3 ? '<em class="signal-assist-note">Dictionary lookup recorded as assisted.</em>' : '';
  if (!dictionaryRevealed) return `<div class="signal-dictionary-card signal-recall-card"><span>POCKET DICTIONARY · RECALL FIRST</span><b lang="ja">${escape(item.surface)}</b><small>${escape(item.reading)}</small><p>What do you think this word means?</p><div class="signal-dictionary-choices">${dictionaryChoices(item, shift, run.career).map(choice => `<button class="${coached && choice === item.meaning ? 'is-guided' : ''}" data-signal-dictionary-guess="${escape(choice)}">${escape(choice)}</button>`).join('')}</div><button class="signal-quick-reveal" data-signal-dictionary-reveal>Show answer</button>${assistance}</div>`;
  const correctGuess = dictionaryGuess === item.meaning;
  const result = dictionaryGuess ? `<em class="signal-recall-result ${correctGuess ? 'is-correct' : 'is-wrong'}">${correctGuess ? 'Independent recall strengthened.' : `Not quite—you chose “${escape(dictionaryGuess)}”.`}</em>` : '<em class="signal-recall-result">Answer revealed for study.</em>';
  return `<div class="signal-dictionary-card"><span>POCKET DICTIONARY</span><b lang="ja">${escape(item.surface)}</b><small>${escape(item.reading)}</small><p>${escape(item.meaning)}</p>${result}<button data-signal-word-audio="${escape(item.surface)}">♪ Hear word again</button>${item.fact ? `<button class="${coached ? 'is-guided' : ''}" data-signal-evidence="${escape(item.fact)}">${run.selectedEvidence.includes(item.fact) ? 'Remove evidence' : 'Pin as evidence'} · ${escape(item.meaning)}</button>${coached ? '<em class="signal-pin-tip">Now pin “red” so you can compare it with the codebook.</em>' : ''}` : '<em>This word is context, not a codebook fact.</em>'}${assistance}</div>`;
}

function fieldConsequence(active: SignalCase, decision: SignalDecision, delayed: boolean): string {
  if (decision.operationalAction === 'monitor') return 'Monitoring continues. Another intercept may clarify the source’s intent before agents are exposed.';
  if (decision.operationalAction === 'verify') return 'A second analyst is checking the uncertain language and source history before action is taken.';
  if (decision.operationalAction === 'dispatch') return 'A field unit has been dispatched using the locations, people and times on your evidence board.';
  if (delayed) return 'The sealed file has moved to Operations. Its consequences will be disclosed in the after-action report.';
  if (!decision.correct) return 'A follow-up intercept has been ordered. Your learning record is safe, and this clue will return for review.';
  if (decision.verdict === 'escalate') return active.storyAfter || 'A field team has been quietly mobilised using the evidence you identified.';
  return active.storyAfter || 'The routine channel remains open and field teams stay focused on higher-priority traffic.';
}

function operationalChoiceMarkup(decision: SignalDecision): string {
  const choices: Array<{ id: SignalOperationalAction; label: string; description: string }> = [{ id: 'monitor', label: 'Continue monitoring', description: 'Safer, but the operation may move.' }, { id: 'verify', label: 'Verify translation', description: 'Reduce uncertainty before acting.' }, { id: 'dispatch', label: 'Dispatch field team', description: 'Act immediately on current evidence.' }];
  return `<section class="signal-operational-choice"><span>OPERATIONAL RECOMMENDATION</span><div>${choices.map(choice => `<button class="${decision.operationalAction === choice.id ? 'selected' : ''}" data-signal-operation="${choice.id}"><b>${escape(choice.label)}</b><small>${escape(choice.description)}</small></button>`).join('')}</div></section>`;
}

function productiveTaskMarkup(run: SignalRun, shift: SignalShift, active: SignalCase): string {
  const next = nextSignalShift(shift.id); const boss = (!next || next.department !== shift.department) && run.index + 1 === shift.cases.length;
  if (!boss) return '';
  const target = active.tokens.find(token => token.fact && active.decisiveFacts.includes(token.fact)) || active.tokens[0]!;
  return `<section class="signal-production"><span>FINAL LANGUAGE CHECK</span><label>Type the Japanese for “${escape(target.meaning)}” without copying it.<input data-signal-production data-answer="${escape(target.surface)}" data-reading="${escape(target.reading)}" autocomplete="off" lang="ja"></label><button data-signal-production-check>Check response</button>${productionResult ? `<p class="${productionResult === 'correct' ? 'is-correct' : 'is-wrong'}">${productionResult === 'correct' ? 'Correct—productive recall confirmed.' : `Review it once more: ${escape(target.surface)} (${escape(target.reading)}).`}</p>` : ''}</section>`;
}

function languageDebriefMarkup(run: SignalRun, active: SignalCase, decision: SignalDecision): string {
  const selected = decision.selectedEvidence.length ? decision.selectedEvidence.join(', ') : 'none';
  const decisive = active.decisiveFacts.join(', ');
  const slowReplay = run.career.equippedTools.includes('tape-machine') ? `<button data-signal-speech="${escape(active.japanese)}" data-signal-rate="0.58">◷ Tape-machine slow replay</button>` : '';
  return `<div class="signal-feedback-audio"><button data-signal-speech="${escape(active.japanese)}" data-signal-rate="0.82">▶ Natural audio</button>${slowReplay}</div><details class="signal-language-debrief"><summary>Open language debrief</summary><div class="signal-evidence-comparison"><span>YOUR EVIDENCE <b>${escape(selected)}</b></span><span>DECISIVE EVIDENCE <b>${escape(decisive)}</b></span></div><div class="signal-word-alignment">${active.tokens.map(token => { const memory = run.career.wordMemory[token.surface]; return `<article><button data-signal-speech="${escape(token.surface)}" data-signal-rate="0.76" lang="ja">${escape(token.surface)} ♪</button><small>${escape(token.reading)}</small><b>${escape(token.meaning)}</b><button data-signal-practice="${escape(token.surface)}">${memory?.markedForPractice ? '✓ In practice file' : '+ Practise this'}</button></article>`; }).join('')}</div></details>`;
}

function sourceDossierMarkup(run: SignalRun, active: SignalCase): string {
  const sourceName = active.speaker || active.event?.speaker || `${active.channel} source`;
  const source = run.career.investigation.sources[sourceName];
  const reliability = source?.reports ? Math.round(source.accurateFilings / source.reports * 100) : null;
  return `<details class="signal-source-dossier"><summary>Source dossier · ${escape(sourceName)}</summary><p>${reliability === null ? 'New source. Reliability is not established.' : `${source!.reports} prior report${source!.reports === 1 ? '' : 's'} · ${reliability}% aligned with accurate filings.`}</p>${source?.lastClaim ? `<blockquote>${escape(source.lastClaim)}</blockquote>` : ''}</details>`;
}

function investigationMarkup(career: SignalCareer): string {
  const file = career.investigation;
  const cards = (items: string[], status: SignalEvidenceStatus) => items.map(item => `<span class="${status}">${escape(item)}</span>`).join('');
  return `<details class="signal-investigation"><summary>Operation board · ${file.facts.length + file.doubtfulFacts.length + file.contradictions.length} persistent clues</summary><div><section><b>CONFIRMED</b>${cards(file.facts, 'confirmed') || '<small>None yet</small>'}</section><section><b>DOUBTFUL</b>${cards(file.doubtfulFacts, 'doubtful') || '<small>None yet</small>'}</section><section><b>CONTRADICTIONS</b>${cards(file.contradictions, 'contradiction') || '<small>None yet</small>'}</section></div></details>`;
}

function archiveMarkup(career: SignalCareer): string {
  const entries = [...career.archive].sort((left, right) => right.collectedAt - left.collectedAt).slice(0, 6);
  return `<details class="signal-archive" ${entries.length ? '' : 'open'}><summary>Classified archive · ${career.archive.length} case file${career.archive.length === 1 ? '' : 's'}</summary>${entries.length ? `<ol>${entries.map(entry => `<li><span class="${entry.cleared ? 'cleared' : 'reassigned'}">${entry.cleared ? 'CLEARED' : 'REASSIGNED'}</span><b>${escape(entry.title)}</b><small>${entry.independentFilings} independent filing${entry.independentFilings === 1 ? '' : 's'}</small></li>`).join('')}</ol>` : '<p>Cleared shifts become collectible story files here.</p>'}</details>`;
}

function feedbackMarkup(run: SignalRun, shift: SignalShift): string {
  if (run.phase !== 'feedback') return '';
  const active = shift.cases[run.index]!;
  const decision = run.decisions.at(-1)!;
  const translation = `<p class="signal-feedback-translation"><b>Translation:</b> ${escape(active.english)}</p>`;
  const consequence = `<p class="signal-consequence"><b>FIELD CONSEQUENCE</b>${escape(fieldConsequence(active, decision, shift.delayedFeedback))}</p>`;
  const debrief = languageDebriefMarkup(run, active, decision);
  const operations = operationalChoiceMarkup(decision);
  const production = productiveTaskMarkup(run, shift, active);
  const sealed = shift.delayedFeedback || run.career.debriefMode === 'sealed';
  if (sealed) return `<div class="signal-feedback-backdrop"><aside class="signal-feedback is-sealed" role="dialog" aria-modal="true" aria-labelledby="signal-feedback-title"><span>FILE SEALED</span><h2 id="signal-feedback-title">Decision logged</h2>${translation}${consequence}${operations}${run.career.debriefMode === 'operational' ? '' : debrief}${production}<button class="signal-primary" data-signal-continue>${run.index + 1 < shift.cases.length ? 'Next intercept →' : 'Open shift report →'}</button></aside></div>`;
  return `<div class="signal-feedback-backdrop"><aside class="signal-feedback ${decision.correct ? 'is-correct' : 'is-wrong'}" role="dialog" aria-modal="true" aria-labelledby="signal-feedback-title"><span>${decision.correct ? 'CORRECT FILING' : 'CODEBOOK ERROR'}</span><h2 id="signal-feedback-title">${decision.correct ? 'Good judgement' : `This belonged in ${expectedSignalVerdict(shift, active).toUpperCase()}`}</h2>${translation}<p>${escape(active.explanation)}</p>${consequence}<small>${decision.evidenceCorrect ? 'Evidence identified correctly.' : 'Review the decisive Japanese evidence before the next file.'}</small>${operations}${run.career.debriefMode === 'operational' ? '' : debrief}${production}<button class="signal-primary" data-signal-continue>${run.index + 1 < shift.cases.length ? 'Next intercept →' : 'Open shift report →'}</button></aside></div>`;
}

function desk(run: SignalRun): string {
  const shift = shiftFor(run), active = shift.cases[run.index]!;
  const ruleText = active.event?.ruleText || shift.ruleText;
  const activeRuleText = run.career.specialisation === 'cryptographer' ? `${ruleText} · CIPHER SCAN: ${ruleLogic(active.event?.ruleOverride || shift.rule)}` : ruleText;
  const statusLabel: Record<SignalEvidenceStatus, string> = { confirmed: 'Confirmed', doubtful: 'Doubtful', contradiction: 'Contradiction' };
  const selected = run.selectedEvidence.map(item => { const status = run.evidenceStatus?.[item] || 'confirmed'; return `<article class="signal-evidence-card ${status}" draggable="true" data-signal-evidence-card="${escape(item)}"><b>${escape(item)}</b><button data-signal-evidence-status="${escape(item)}" title="Change evidence status">${statusLabel[status]}</button><button data-signal-evidence="${escape(item)}" aria-label="Remove ${escape(item)}">×</button></article>`; }).join('');
  const confidence = (['uncertain', 'fair', 'confident'] as const).map(item => `<button class="${(run.confidence || 'uncertain') === item ? 'selected' : ''}" data-signal-confidence="${item}">${item}</button>`).join('');
  const equipment = run.career.equippedTools;
  const equipmentActions = `${equipment.includes('phrasebook') && !run.readingVisible ? '<button data-signal-equipment-reading>▤ Phrasebook reading</button>' : ''}${equipment.includes('red-phone') ? '<button data-signal-director-hint>☎ Director hint</button>' : ''}`;
  const hint = directorHintOpen ? `<p class="signal-director-hint"><b>DIRECTOR:</b> The rule needs ${active.decisiveFacts.length} decisive clue${active.decisiveFacts.length === 1 ? '' : 's'}. Check the exact logical condition; do not infer danger from tone alone.</p>` : '';
  const pause = run.paused ? `<div class="signal-pause" role="dialog" aria-modal="true"><span>SHIFT PAUSED</span><h2>The office can wait.</h2><p>Your message and remaining time are held safely.</p><button class="signal-primary" data-signal-pause>Resume shift</button></div>` : '';
  return `<main class="signal-shell ${shift.sequence >= 10 ? 'is-night' : ''}"><section class="signal-office"><header class="signal-hud"><div><span>${escape(shift.department)} · SHIFT ${shift.sequence}</span><b>${run.index + 1}/${shift.cases.length} messages</b></div><div><span>${escape(run.career.rank)}</span>${shift.seconds !== null && !run.career.timerDisabled ? `<b data-signal-clock>${run.remaining}s</b>` : '<b>UNTIMED</b>'}<button data-signal-pause>Pause</button><button data-signal-exit>Leave</button></div></header><div class="signal-desk">${eventMarkup(active)}<aside class="signal-codebook ${active.event?.ruleOverride ? 'is-amended' : ''}"><span>${active.event?.ruleOverride ? 'EMERGENCY AMENDMENT' : 'ACTIVE CODEBOOK'}</span><strong>${escape(activeRuleText)}</strong><p>${active.event?.ruleOverride ? 'This temporary order applies only to the current file.' : escape(shift.guidance)}</p>${sourceDossierMarkup(run, active)}<div class="signal-equipment-actions">${equipmentActions}</div>${hint}<button data-signal-handbook>How to decode</button></aside><article class="signal-paper ${active.channel}"><header><span>${channelMission(active)} · ${escape(active.speaker || 'SOURCE CLASSIFIED')}</span><b>${String(run.index + 1).padStart(3, '0')} / K</b></header>${tokenMarkup(run, shift)}${active.channel === 'telephone' && run.assisted ? '<button data-signal-audio>▶ Replay call</button>' : ''}</article><aside class="signal-notepad"><span>EVIDENCE NOTEPAD</span><div class="signal-evidence-list">${selected || '<p>No evidence pinned yet.</p>'}</div><div class="signal-evidence-zones" aria-label="Evidence board"><button data-signal-drop-status="confirmed">✓ Confirmed</button><button data-signal-drop-status="doubtful">? Doubtful</button><button data-signal-drop-status="contradiction">× Contradiction</button></div>${dictionaryMarkup(run, shift)}${investigationMarkup(run.career)}</aside><section class="signal-confidence"><span>YOUR CONFIDENCE</span><div>${confidence}</div><small>Calibrated confidence improves the quality of the intelligence record.</small></section><div class="signal-trays"><button class="signal-tray standard" data-signal-verdict="standard" ${run.phase !== 'decode' ? 'disabled' : ''}><span>通常</span><b>STANDARD</b><small>Routine contents</small></button><button class="signal-tray escalate" data-signal-verdict="escalate" ${run.phase !== 'decode' ? 'disabled' : ''}><span>至急</span><b>ESCALATE</b><small>Send up the chain</small></button></div>${feedbackMarkup(run, shift)}${pause}</div>${guideMarkup()}</section></main>`;
}

function report(run: SignalRun): string {
  const shift = shiftFor(run), passed = signalRunPassed(run), correct = run.decisions.filter(item => item.correct).length, evidence = run.decisions.filter(item => item.evidenceCorrect).length;
  const independent = run.decisions.filter(item => item.correct && !item.assisted).length;
  const priority = signalPriorityWords(run.career);
  return `<main class="signal-shell ${shift.sequence >= 10 ? 'is-night' : ''}"><section class="signal-office signal-report-wrap"><article class="signal-report"><span class="signal-seal ${passed ? 'pass' : 'fail'}">${passed ? 'CLEARED' : 'REASSIGNED'}</span><span class="signal-kicker">${escape(shift.department)} · AFTER-ACTION REPORT</span><h1>${passed ? 'Shift cleared' : 'Training reassignment'}</h1><p>${passed ? `Director Mori has approved your work as ${escape(run.career.rank)}.` : 'Your learning record is safe. Review this codebook and run the shift again.'}</p>${passed && shift.debrief ? `<blockquote class="signal-debrief"><b>NARRATIVE UPDATE</b>${escape(shift.debrief)}</blockquote>` : ''}<div class="signal-score-grid"><div><b>${correct}/${shift.cases.length}</b><span>filings</span></div><div><b>${evidence}/${shift.cases.length}</b><span>evidence</span></div><div><b>${independent}</b><span>independent</span></div><div><b>◎ ${run.career.credits}</b><span>career credits</span></div></div>${priority.length ? `<section class="signal-priority-file"><span>ADAPTIVE PRACTICE FILE</span><p>These words will be prioritised in future assignments.</p><div>${priority.map(item => `<button data-signal-speech="${escape(item.surface)}" data-signal-rate="0.76"><b lang="ja">${escape(item.surface)}</b><small>${escape(item.reading)} · ${escape(item.meaning)}</small></button>`).join('')}</div></section>` : ''}${relationshipMarkup(run.career)}${investigationMarkup(run.career)}${archiveMarkup(run.career)}${officeProgressMarkup(run.career)}<div class="signal-case-review">${shift.cases.map((item, index) => { const decision = run.decisions[index]; const expected = expectedSignalVerdict(shift, item); return `<details ${decision?.correct ? '' : 'open'}><summary><span>${decision?.correct ? '✓' : '×'} ${escape(item.japanese)}</span><b>${expected.toUpperCase()}</b></summary><p>${escape(item.english)} — ${escape(item.explanation)}</p></details>`; }).join('')}</div><div class="signal-actions"><button class="signal-primary" data-signal-next>${passed ? nextSignalShift(shift.id) ? 'Accept next assignment →' : 'Open daily signals →' : 'Repeat this shift →'}</button><button data-signal-exit>Return to Journey</button></div></article></section></main>`;
}

function render(): void { const target = root(); if (!target) return; const run = load(); target.innerHTML = tutorialOpen ? tutorial(run) : run.phase === 'briefing' ? briefing(run) : run.phase === 'report' || run.phase === 'failed' ? report(run) : desk(run); bind(); }
function start(): void { const run = load(); run.phase = 'decode'; run.paused = false; guideOpen = false; dictionaryRevealed = false; dictionaryGuess = null; productionResult = null; directorHintOpen = false; save(run); startCheckpointAmbience(); playCheckpointEffect('file'); setCheckpointAmbienceIntensity(shiftFor(run).sequence >= 10 ? 'tense' : 'calm'); render(); }
function decide(verdict: SignalVerdict): void { const run = load(), shift = shiftFor(run), active = shift.cases[run.index]!; const result = judgeSignal(run, verdict, shift); if (!result.decisions.at(-1)?.correct) host().recordDeskMisses?.(active.practiceIds); save(result); setCheckpointAmbienceIntensity(verdict === 'escalate' || Boolean(active.event) ? 'tense' : 'calm'); playCheckpointEffect('stamp'); render(); }
function advance(): void { const before = load(), shift = shiftFor(before), run = advanceSignal(before, shift); save(run); if (run.phase === 'report' || run.phase === 'failed') { const languageMistakes = run.decisions.filter(item => !item.evidenceCorrect).map(item => item.caseId); const ruleMistakes = run.decisions.filter(item => !item.correct).map(item => item.caseId); host().recordSignalResult?.({ career: run.career, shiftId: shift.id, passed: run.phase === 'report', creditsEarned: run.career.credits - before.career.credits, practiceIds: shift.cases.flatMap(item => item.practiceIds), languageMistakes, ruleMistakes }); if (run.phase === 'report') host().completeShift?.(shift.cases.flatMap(item => item.practiceIds)); } else { setCheckpointAmbienceIntensity(shift.cases[run.index]?.event ? 'tense' : 'calm'); playCheckpointEffect('file'); } openTokenIndex = null; dictionaryRevealed = false; dictionaryGuess = null; productionResult = null; directorHintOpen = false; guideOpen = false; render(); }
function next(): void { const run = load(), shift = shiftFor(run); if (run.phase === 'report' && !run.daily && nextSignalShift(shift.id)) save(createSignalRun(nextSignalShift(shift.id)!.id, run.career)); else if (run.phase === 'report' && run.career.completedShiftIds.length === SIGNAL_SHIFTS.length) { dailyShift = createDailySignalShift(dateSeed()); const dailyRun = createSignalRun(SIGNAL_SHIFTS.at(-1)!.id, run.career, true); dailyRun.shiftId = dailyShift.id; dailyRun.remaining = dailyShift.seconds || 0; dailyRun.readingVisible = dailyShift.aid === 'full'; save(dailyRun); } else save(createSignalRun(shift.id, run.career, run.daily)); openTokenIndex = null; dictionaryRevealed = false; dictionaryGuess = null; productionResult = null; directorHintOpen = false; guideOpen = false; render(); }
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
  target.querySelectorAll<HTMLElement>('[data-signal-token]').forEach(button => button.addEventListener('click', () => { const run = load(), shift = shiftFor(run), item = shift.cases[run.index]?.tokens[Number(button.dataset.signalToken)]; if (!item) return; openTokenIndex = Number(button.dataset.signalToken); dictionaryRevealed = false; dictionaryGuess = null; playCheckpointAudio(item.surface, run.career.specialisation === 'listener' ? .72 : .82); save(recordTokenLookup(run, item.surface, shift.sequence > 3)); render(); }));
  target.querySelectorAll<HTMLElement>('[data-signal-dictionary-guess]').forEach(button => button.addEventListener('click', () => { const run = load(), shift = shiftFor(run), item = openTokenIndex === null ? null : shift.cases[run.index]?.tokens[openTokenIndex]; if (!item) return; dictionaryGuess = button.dataset.signalDictionaryGuess || ''; dictionaryRevealed = true; save(recordTokenRecall(run, item.surface, dictionaryGuess === item.meaning)); playCheckpointEffect(dictionaryGuess === item.meaning ? 'clear' : 'stamp'); render(); }));
  target.querySelector('[data-signal-dictionary-reveal]')?.addEventListener('click', () => { dictionaryGuess = null; dictionaryRevealed = true; render(); });
  target.querySelectorAll<HTMLElement>('[data-signal-evidence]').forEach(button => button.addEventListener('click', () => { save(selectSignalEvidence(load(), button.dataset.signalEvidence || '')); playCheckpointEffect('pin'); render(); }));
  target.querySelectorAll<HTMLElement>('[data-signal-evidence-status]').forEach(button => button.addEventListener('click', () => { const run = load(); const evidence = button.dataset.signalEvidenceStatus || ''; const current = run.evidenceStatus?.[evidence] || 'confirmed'; const nextStatus: Record<SignalEvidenceStatus, SignalEvidenceStatus> = { confirmed: 'doubtful', doubtful: 'contradiction', contradiction: 'confirmed' }; save(setSignalEvidenceStatus(run, evidence, nextStatus[current])); render(); }));
  target.querySelectorAll<HTMLElement>('[data-signal-evidence-card]').forEach(card => card.addEventListener('dragstart', event => { event.dataTransfer?.setData('text/plain', card.dataset.signalEvidenceCard || ''); }));
  target.querySelectorAll<HTMLElement>('[data-signal-drop-status]').forEach(zone => { zone.addEventListener('dragover', event => event.preventDefault()); zone.addEventListener('drop', event => { event.preventDefault(); const evidence = event.dataTransfer?.getData('text/plain') || ''; if (!evidence) return; save(setSignalEvidenceStatus(load(), evidence, zone.dataset.signalDropStatus as SignalEvidenceStatus)); render(); }); });
  target.querySelectorAll<HTMLElement>('[data-signal-confidence]').forEach(button => button.addEventListener('click', () => { save(setSignalConfidence(load(), button.dataset.signalConfidence as SignalConfidence)); playCheckpointEffect('ready'); render(); }));
  target.querySelectorAll('[data-signal-audio]').forEach(button => button.addEventListener('click', () => { const run = load(), active = shiftFor(run).cases[run.index]; if (!active) return; target.classList.add('is-playing'); playCheckpointAudio(active.japanese, run.career.specialisation === 'listener' ? .72 : .82); window.setTimeout(() => target.classList.remove('is-playing'), Math.max(1400, active.japanese.length * 180)); }));
  target.querySelector('[data-signal-transcript]')?.addEventListener('click', () => { save(markSignalAssisted(load())); render(); });
  target.querySelector('[data-signal-reading]')?.addEventListener('click', () => { const run = load(), shift = shiftFor(run); save(revealSignalReading(run, shift.sequence > 3)); render(); });
  target.querySelector('[data-signal-translation]')?.addEventListener('click', () => { const run = load(), shift = shiftFor(run); save(revealSignalTranslation(run, shift.sequence > 3)); render(); });
  target.querySelectorAll<HTMLElement>('[data-signal-word-audio]').forEach(button => button.addEventListener('click', () => playCheckpointAudio(button.dataset.signalWordAudio || '')));
  target.querySelectorAll<HTMLElement>('[data-signal-speech]').forEach(button => button.addEventListener('click', () => playCheckpointAudio(button.dataset.signalSpeech || '', Number(button.dataset.signalRate) || .82)));
  target.querySelectorAll<HTMLElement>('[data-signal-practice]').forEach(button => button.addEventListener('click', () => { const run = load(), shift = shiftFor(run), token = shift.cases[run.index]?.tokens.find(item => item.surface === button.dataset.signalPractice); if (!token) return; save(markSignalWordForPractice(run, token)); host().saveCheckpointCareer?.(load().career); render(); }));
  target.querySelectorAll<HTMLElement>('[data-signal-operation]').forEach(button => button.addEventListener('click', () => { save(recordSignalOperationalAction(load(), button.dataset.signalOperation as SignalOperationalAction)); playCheckpointEffect('ready'); render(); }));
  target.querySelector('[data-signal-production-check]')?.addEventListener('click', () => { const input = target.querySelector<HTMLInputElement>('[data-signal-production]'); if (!input) return; const answer = input.value.trim().replace(/\s+/g, ''); productionResult = answer === (input.dataset.answer || '').replace(/\s+/g, '') || answer.toLowerCase() === (input.dataset.reading || '').replace(/\s+/g, '').toLowerCase() ? 'correct' : 'wrong'; playCheckpointEffect(productionResult === 'correct' ? 'clear' : 'stamp'); render(); });
  target.querySelectorAll<HTMLElement>('[data-signal-specialisation]').forEach(button => button.addEventListener('click', () => { const run = setSignalSpecialisation(load(), button.dataset.signalSpecialisation as SignalSpecialisation); save(run); host().saveCheckpointCareer?.(run.career); render(); }));
  target.querySelectorAll<HTMLElement>('[data-signal-equipment]').forEach(button => button.addEventListener('click', () => { const run = toggleSignalEquipment(load(), button.dataset.signalEquipment || ''); save(run); host().saveCheckpointCareer?.(run.career); render(); }));
  target.querySelectorAll<HTMLElement>('[data-signal-debrief-mode]').forEach(button => button.addEventListener('click', () => { const run = setSignalDebriefMode(load(), button.dataset.signalDebriefMode as SignalCareer['debriefMode']); save(run); host().saveCheckpointCareer?.(run.career); render(); }));
  target.querySelector('[data-signal-equipment-reading]')?.addEventListener('click', () => { save(revealSignalReading(load(), false)); render(); });
  target.querySelector('[data-signal-director-hint]')?.addEventListener('click', () => { directorHintOpen = !directorHintOpen; if (directorHintOpen) save(markSignalAssisted(load())); render(); });
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
