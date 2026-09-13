import { z } from 'zod';
import { createVersionedRepository, deviceStorage, sessionStorage } from '../platform/storage';
import { playSenseiDeskEffect, playSenseiDeskWordAudio, senseiDeskAudioEnabled, setSenseiDeskAudioEnabled, startSenseiDeskMusic, stopSenseiDeskMusic } from '../platform/sensei-desk-audio';
import { createShift, currentSubmission, finishShift, gradePaper, lineFor, reviewPaper, shiftScore } from '../domains/sensei-desk/desk';
import type { GradeDecision, HomeworkLine, SenseiShiftState, SenseiWord, SenseiWordProgress } from '../domains/sensei-desk/types';

const SHIFT_KEY = 'kaishi-sensei-desk-shift';
const TUTORIAL_KEY = 'kaishi-sensei-desk-tutorial';
const shiftSchema = z.custom<SenseiShiftState>((value) => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SenseiShiftState>;
  return candidate.schemaVersion === 1 && Array.isArray(candidate.submissions) && typeof candidate.currentIndex === 'number' && typeof candidate.phase === 'string';
});
const tutorialSchema = z.object({ schemaVersion: z.literal(1), completed: z.boolean() });
const repository = createVersionedRepository<SenseiShiftState>({ storage: sessionStorage(), key: SHIFT_KEY, version: 1, schema: shiftSchema });
const tutorialRepository = createVersionedRepository({ storage: deviceStorage(), key: TUTORIAL_KEY, version: 1, schema: tutorialSchema });

type HostPolicy = {
  show?: (id: string) => void;
  currentLessonWords?: () => unknown;
  introducedVocabulary?: () => unknown;
  completeShift?: (wordIds: string[]) => void;
  wordProgress?: () => Record<string, SenseiWordProgress>;
  recordDeskMisses?: (wordIds: string[]) => void;
  speak?: (text: string) => void;
};

let draftDecisions: Record<string, GradeDecision> = {};
let timerHandle: number | undefined;
let tutorialActive = false;
let tutorialChoice: GradeDecision['verdict'] | undefined;
let stampHandle: number | undefined;
let handbookOpen = false;
let handbookQuery = '';
let handbookWordId: string | undefined;
let deskView: 'arrival' | 'idle' | 'inspect' | 'closed' = 'idle';

function host(): HostPolicy { return (window.KaishiActivityPolicy?.senseiDesk || {}) as HostPolicy; }
function target(): HTMLElement | null { return document.querySelector<HTMLElement>('#senseiDesk'); }
function resetViewport(): void {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}
function escapeHtml(value: unknown): string { return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character)); }
function today(): string { return new Date().toISOString().slice(0, 10); }
function wordsFrom(value: unknown): SenseiWord[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => {
    const word = item as Record<string, unknown>;
    return { id: String(word.id ?? ''), word: String(word.word ?? word.text ?? ''), reading: String(word.reading ?? word.kana ?? ''), meaning: String(word.meaning ?? ''), wordAudio: typeof word.wordAudio === 'string' ? word.wordAudio : undefined };
  }).filter(item => item.id && item.word && item.reading && item.meaning);
}
function availableWords(): SenseiWord[] {
  const current = wordsFrom(host().currentLessonWords?.());
  const introduced = wordsFrom(host().introducedVocabulary?.());
  const introducedIds = new Set(introduced.map(word => word.id));
  const unique = new Map<string, SenseiWord>();
  // Current-lesson words are a priority, never an exception: a learner must
  // have encountered a word before it can appear on a pupil's paper.
  [...current.filter(word => introducedIds.has(word.id)), ...introduced].forEach(word => unique.set(word.id, word));
  return [...unique.values()];
}
function formatTime(deadline: number): string {
  const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
function stateOrNull(): SenseiShiftState | null {
  const saved = repository.load();
  if (!saved || saved.dateKey !== today()) return null;
  const introducedIds = new Set(availableWords().map(word => word.id));
  const usesOnlyIntroducedWords = saved.submissions.flatMap(submission => submission.lines).every(line => introducedIds.has(line.wordId));
  if (!usesOnlyIntroducedWords) {
    repository.remove();
    return null;
  }
  return saved;
}
function tutorialSeen(): boolean { return tutorialRepository.load()?.completed === true; }
function markTutorialSeen(): void { tutorialRepository.save({ schemaVersion: 1, completed: true }); }
function startSavedShift(guided = false): void {
  const words = availableWords();
  if (!words.length) {
    renderMenu();
    return;
  }
  const state = createShift(words, today(), Date.now(), { guided, wordProgress: host().wordProgress?.() });
  repository.save(state);
  draftDecisions = {};
  handbookOpen = false;
  handbookQuery = '';
  handbookWordId = undefined;
  deskView = 'arrival';
  startSenseiDeskMusic();
  render(state);
}
function startShift(): void {
  if (!tutorialSeen()) {
    tutorialActive = true;
    tutorialChoice = undefined;
    render(null);
    return;
  }
  startSavedShift();
}
function openTutorial(): void { tutorialActive = true; tutorialChoice = undefined; render(stateOrNull()); }
function finishTutorial(): void {
  markTutorialSeen();
  tutorialActive = false;
  tutorialChoice = undefined;
  const saved = stateOrNull();
  if (saved && (saved.phase === 'desk' || saved.phase === 'correction')) return render(saved);
  if (!availableWords().length) {
    renderMenu();
    return;
  }
  startSavedShift(true);
}
function exitDesk(): void {
  const state = stateOrNull();
  const active = state?.phase === 'desk' || state?.phase === 'correction';
  if (active && !window.confirm('Leave Sensei’s Desk? Your current shift will be saved so you can return later.')) return;
  if (stampHandle) {
    window.clearTimeout(stampHandle);
    stampHandle = undefined;
  }
  stopSenseiDeskMusic();
  host().show?.('journey');
}
function selectVerdict(lineId: string, verdict: GradeDecision['verdict']): void {
  draftDecisions[lineId] = { verdict };
  render(stateOrNull());
}
function selectError(lineId: string, errorTag: GradeDecision['errorTag']): void {
  const current = draftDecisions[lineId];
  if (!current) return;
  draftDecisions[lineId] = { ...current, errorTag };
  render(stateOrNull());
}
function decisionReady(line: HomeworkLine): boolean {
  const decision = draftDecisions[line.id];
  return Boolean(decision && (decision.verdict === 'correct' || decision.errorTag));
}
function submitPaper(state: SenseiShiftState): void {
  const submission = currentSubmission(state);
  if (!submission || !submission.lines.every(decisionReady) || stampHandle) return;
  playSenseiDeskEffect('stamp');
  stampHandle = window.setTimeout(() => {
    stampHandle = undefined;
    const latest = stateOrNull();
    if (!latest || latest.phase !== 'desk') return;
    const next = gradePaper(latest, draftDecisions);
    const current = currentSubmission(next);
    const missed = current ? current.lines.filter(line => next.paperResults[current.id]?.mistakes.includes(line.id)).map(line => line.wordId) : [];
    if (missed.length) host().recordDeskMisses?.(missed);
    repository.save(next);
    draftDecisions = {};
    render(next);
  }, 720);
  render(state);
}
function continueAfterReview(state: SenseiShiftState): void {
  const next = reviewPaper(state);
  repository.save(next);
  playSenseiDeskEffect(next.phase === 'summary' ? 'success' : 'paper');
  deskView = 'arrival';
  render(next);
}
function finish(state: SenseiShiftState): void {
  const next = finishShift(state);
  repository.save(next);
  if (next.phase === 'passed') {
    host().completeShift?.(availableWords().map(word => word.id));
    playSenseiDeskEffect('success');
  }
  deskView = 'closed';
  playSenseiDeskEffect('lampOff');
  render(next);
}
function tick(): void {
  const state = stateOrNull();
  if (!state || (state.phase !== 'desk' && state.phase !== 'correction')) return;
  const clock = target()?.querySelector<HTMLElement>('[data-sensei-timer]');
  if (clock) clock.textContent = formatTime(state.deadlineAt);
  if (Date.now() >= state.deadlineAt) {
    const expired = { ...state, phase: 'summary' as const };
    repository.save(expired);
    render(expired);
  }
}
function bindTimer(state: SenseiShiftState | null): void {
  if (timerHandle) window.clearInterval(timerHandle);
  timerHandle = undefined;
  if (!state) return;
  if (state.phase === 'desk' || state.phase === 'correction') timerHandle = window.setInterval(tick, 1000);
}
function lineMarkup(line: HomeworkLine, state: SenseiShiftState): string {
  const decision = draftDecisions[line.id];
  const verdict = decision?.verdict;
  const correctionOptions = verdict === 'needs-correction' ? `<div class="sensei-error-tags" aria-label="What needs correction">${(['meaning', 'particle', 'kana'] as const).map(tag => `<button type="button" class="sensei-tag ${decision?.errorTag === tag ? 'is-selected' : ''}" data-sensei-error="${line.id}" data-sensei-error-tag="${tag}">${tag === 'meaning' ? 'Meaning' : tag === 'particle' ? 'Particle' : 'Kana'}</button>`).join('')}</div>` : '';
  return `<article class="sensei-homework-line ${verdict ? `is-${verdict}` : ''}" data-sensei-line="${escapeHtml(line.id)}"><div class="sensei-line-copy"><span class="sensei-line-number">${state.currentIndex + 1}.${line.id.split('-').at(-1)}</span><strong lang="ja">${escapeHtml(line.japanese)}</strong><span>${escapeHtml(line.reading)} · ${escapeHtml(line.meaning)}</span></div>${line.audio ? `<button type="button" class="sensei-hear sensei-preflight-hear" data-sensei-hear="${escapeHtml(line.id)}">🔊 Hear it</button>` : ''}<div class="sensei-verdicts"><button type="button" class="sensei-verdict ${verdict === 'correct' ? 'is-selected' : ''}" data-sensei-verdict="${line.id}" data-sensei-value="correct">✓ Looks right</button><button type="button" class="sensei-verdict ${verdict === 'needs-correction' ? 'is-selected is-wrong' : ''}" data-sensei-verdict="${line.id}" data-sensei-value="needs-correction">✎ Needs correction</button></div>${correctionOptions}</article>`;
}
function frame(title: string, content: string): string {
  return `<div class="sensei-desk-shell"><header class="sensei-desk-header"><div><span class="eyebrow">SENSEI’S DESK · 先生の机</span><h1>${title}</h1><p>Grade one small answer at a time. Every correction teaches a word.</p></div><div class="sensei-desk-header-actions"><label class="sensei-audio-toggle"><input type="checkbox" data-sensei-audio ${senseiDeskAudioEnabled() ? 'checked' : ''}> Sound</label><button type="button" class="sensei-exit" data-sensei-exit>← Leave desk</button></div></header>${content}<p class="sensei-desk-note">A beginner can learn through the desk: read the pupil’s answer, identify the issue, then check the explanation.</p></div>`;
}
function handbookMarkup(): string {
  const query = handbookQuery.trim().toLocaleLowerCase();
  const words = availableWords();
  const matches = words.filter(word => !query || [word.word, word.reading, word.meaning].some(value => value.toLocaleLowerCase().includes(query))).slice(0, 8);
  const selected = words.find(word => word.id === handbookWordId) ?? matches[0];
  if (selected && !handbookWordId) handbookWordId = selected.id;
  return `<div class="sensei-handbook-heading"><div><span class="sensei-seal">辞</span><h2>Sensei’s handbook</h2></div><button type="button" class="sensei-handbook-toggle" data-sensei-handbook-toggle aria-expanded="${handbookOpen}">${handbookOpen ? 'Close' : 'Open'} handbook</button></div><p>Check a word before you make your judgement. Search the Japanese, reading, or English meaning.</p><form class="sensei-handbook-search" data-sensei-handbook-form><label for="senseiHandbookSearch">Look up a word</label><div><input id="senseiHandbookSearch" data-sensei-handbook-search value="${escapeHtml(handbookQuery)}" placeholder="e.g. water / みず" autocomplete="off"><button type="submit">Search</button></div></form><div class="sensei-handbook-results" aria-live="polite">${matches.length ? matches.map(word => `<button type="button" class="sensei-handbook-word ${selected?.id === word.id ? 'is-selected' : ''}" data-sensei-handbook-word="${escapeHtml(word.id)}"><strong lang="ja">${escapeHtml(word.word)}</strong><span>${escapeHtml(word.reading)} · ${escapeHtml(word.meaning)}</span></button>`).join('') : '<p class="sensei-handbook-empty">No matching word yet. Try a Japanese word, reading, or English meaning.</p>'}</div>${selected ? `<article class="sensei-handbook-entry"><span class="eyebrow">Word card</span><h3 lang="ja">${escapeHtml(selected.word)}</h3><strong>${escapeHtml(selected.reading)}</strong><p>${escapeHtml(selected.meaning)}</p>${selected.wordAudio ? `<button type="button" class="sensei-hear" data-sensei-handbook-hear="${escapeHtml(selected.wordAudio)}">🔊 Hear word</button>` : '<small>Audio is not available for this word yet.</small>'}</article>` : ''}<div class="sensei-handbook-rules"><b>Meaning</b><span>Does the English match?</span><b>Particle</b><span>Does the connector fit?</span><b>Kana</b><span>Does each sound match?</span></div>`;
}
function enhanceDesk(state: SenseiShiftState, targetElement: HTMLElement): void {
  const status = targetElement.querySelector<HTMLElement>('.sensei-desk-status');
  status?.insertAdjacentHTML('beforeend', `<button type="button" class="sensei-handbook-launch" data-sensei-handbook-toggle aria-expanded="${handbookOpen}">📖 ${handbookOpen ? 'Close handbook' : 'Open handbook'}</button>`);
  const handbook = targetElement.querySelector<HTMLElement>('.sensei-handbook');
  if (handbook) {
    handbook.classList.toggle('is-open', handbookOpen);
    handbook.innerHTML = handbookMarkup();
  }
  const paper = targetElement.querySelector<HTMLElement>('.sensei-paper');
  if (stampHandle && paper) {
    paper.classList.add('is-stamping');
    paper.insertAdjacentHTML('afterbegin', '<span class="sensei-stamp-drop" aria-hidden="true">判</span>');
  }
  if (stampHandle) {
    const submit = targetElement.querySelector<HTMLButtonElement>('[data-sensei-submit]');
    if (submit) {
      submit.disabled = true;
      submit.innerHTML = 'Stamping paper… <span>判</span>';
    }
  }
}
function renderTutorial(state: SenseiShiftState | null): void {
  const choice = tutorialChoice;
  const choiceFeedback = choice === 'correct'
    ? '<p class="sensei-tutorial-feedback is-correct" data-sensei-tutorial-feedback>Correct. The Japanese, reading, and meaning agree, so mark <b>Looks right</b>.</p>'
    : choice === 'needs-correction'
      ? '<p class="sensei-tutorial-feedback is-wrong" data-sensei-tutorial-feedback>Almost—but this example is consistent. On a real mistake, choose <b>Needs correction</b>, then name the issue: Meaning, Particle, or Kana.</p>'
      : '<p class="sensei-tutorial-prompt">Try the decision below. You can change your choice at any time.</p>';
  const actionLabel = state && (state.phase === 'desk' || state.phase === 'correction') ? 'Continue my shift' : 'Start my first shift';
  const content = `<section class="sensei-tutorial"><div class="sensei-tutorial-heading"><span class="sensei-seal">学</span><div><span class="eyebrow">First shift briefing · はじめに</span><h2>How to grade a paper</h2><p>You are the Sensei for a small class. Open each paper on the desk, check the clues, then leave a helpful mark.</p></div></div><div class="sensei-tutorial-grid"><ol class="sensei-tutorial-steps"><li><b>Open the paper</b><span>Tap the new homework on the desk. The handbook and audio are always there if you need them.</span></li><li><b>Read the three clues</b><span>Compare the Japanese answer, its reading, and the English meaning.</span></li><li><b>Make one decision</b><span>Choose <strong>Looks right</strong> when they agree, or <strong>Needs correction</strong> when they do not.</span></li><li><b>Stamp and learn</b><span>Name a mistake if there is one, stamp the paper, then read Sensei’s feedback.</span></li></ol><section class="sensei-tutorial-example" aria-labelledby="senseiTutorialExampleTitle"><span class="eyebrow">Worked example</span><h3 id="senseiTutorialExampleTitle">Does this answer match?</h3><article class="sensei-tutorial-line"><span class="sensei-line-number">EXAMPLE</span><strong lang="ja">わたしは みずを のみます</strong><span>わたしは みずを のみます · I drink water</span></article><div class="sensei-verdicts"><button type="button" class="sensei-verdict ${choice === 'correct' ? 'is-selected' : ''}" data-sensei-tutorial-choice="correct">✓ Looks right</button><button type="button" class="sensei-verdict ${choice === 'needs-correction' ? 'is-selected is-wrong' : ''}" data-sensei-tutorial-choice="needs-correction">✎ Needs correction</button></div>${choiceFeedback}<aside class="sensei-tutorial-mistake"><b>When it is wrong</b><span><span lang="ja">みずに おぼえます</span> · “I remember water”</span><small>The connector に is the issue here. Mark <b>Needs correction → Particle</b>.</small></aside></section></div><button type="button" class="sensei-primary sensei-tutorial-start" data-sensei-tutorial-start>${actionLabel} <span>判</span></button></section>`;
  const targetElement = target();
  if (targetElement) targetElement.innerHTML = frame('Your first paper, step by step', content);
  bind();
}
function renderMenu(): void {
  const saved = stateOrNull();
  const resume = saved && (saved.phase === 'desk' || saved.phase === 'correction') ? `<button type="button" class="sensei-primary" data-sensei-resume>Resume shift <span>${saved.quota.submitted}/${saved.quota.total} papers</span></button>` : '';
  const hasIntroducedWords = availableWords().length > 0;
  const start = hasIntroducedWords
    ? `<button type="button" class="sensei-primary" data-sensei-start>Start a new shift <span>5 papers · 8 min</span></button>`
    : '<button type="button" class="sensei-primary" data-sensei-journey>Learn your first words <span>Journey →</span></button><p class="sensei-desk-unavailable">Sensei’s Desk opens after you have met your first lesson word. Papers only use words already introduced in your Journey.</p>';
  const content = `<section class="sensei-desk-welcome"><div class="sensei-desk-welcome-art" role="img" aria-label="A calm teacher’s desk"></div><div><span class="sensei-seal">判</span><h2>Welcome to the homework desk</h2><p>Students have left five short papers for you. Decide what is correct, mark the kind of mistake, and read the Sensei’s explanation.</p><div class="sensei-rules"><span><b>01</b> Read the answer</span><span><b>02</b> Spot the issue</span><span><b>03</b> Learn the fix</span></div><div class="sensei-menu-actions">${resume}${start}<button type="button" class="sensei-secondary" data-sensei-tutorial>Tutorial &amp; example</button></div></div></section>`;
  const targetElement = target();
  if (targetElement) targetElement.innerHTML = frame('The homework shift', content);
  bind();
}
function renderDeskScene(state: SenseiShiftState): void {
  const submission = currentSubmission(state);
  if (!submission) return renderSummary(state);
  const arrival = deskView === 'arrival';
  const content = `<div class="sensei-desk-status"><span><b>Paper ${state.currentIndex + 1}</b> of ${state.submissions.length}</span><span>Quota <b>${state.quota.submitted}/${state.quota.total}</b></span><span>Reputation <b>${state.reputation}</b></span>${state.guided ? '<span class="sensei-guided-status">Guided shift · no timer</span>' : `<span class="sensei-clock">⌛ <b data-sensei-timer>${formatTime(state.deadlineAt)}</b></span>`}</div><section class="sensei-desk-stage ${arrival ? 'is-arriving' : ''}"><div class="sensei-desk-stack" aria-hidden="true"><span></span><span></span><span></span></div><button type="button" class="sensei-desk-paper-preview" data-sensei-open-paper aria-label="Open ${escapeHtml(submission.pupil.name)}’s homework"><span class="sensei-desk-paper-label">${arrival ? 'A new paper arrives' : 'Tap to open homework'}</span><img src="${escapeHtml(submission.pupil.portrait)}" alt="" class="sensei-stage-pupil"><strong>${escapeHtml(submission.pupil.name)}’s homework</strong><small>${escapeHtml(submission.subject)}</small></button><div class="sensei-desk-out-tray" aria-hidden="true"><span>Graded tray</span></div><img class="sensei-hand-place" src="media/sensei-desk/overlays/sensei-hands.png" alt="" aria-hidden="true"><button type="button" class="sensei-handbook-launch sensei-stage-handbook" data-sensei-handbook-toggle aria-expanded="${handbookOpen}">📖 Handbook</button><aside class="sensei-handbook ${handbookOpen ? 'is-open' : ''}">${handbookMarkup()}</aside></section><p class="sensei-desk-stage-note">${state.guided ? 'Start by opening the paper. You can listen or check the handbook before making a judgement.' : 'A pupil has left a paper for you. Open it when you are ready.'}</p>`;
  const targetElement = target();
  if (targetElement) targetElement.innerHTML = frame(state.guided ? 'Guided homework shift' : 'The homework desk', content);
  bind();
}
function renderDesk(state: SenseiShiftState): void {
  if (deskView !== 'inspect' && !stampHandle) return renderDeskScene(state);
  const submission = currentSubmission(state);
  if (!submission) return renderSummary(state);
  const content = `<div class="sensei-desk-status"><span><b>Paper ${state.currentIndex + 1}</b> of ${state.submissions.length}</span><span>Quota <b>${state.quota.submitted}/${state.quota.total}</b></span><span>Reputation <b>${state.reputation}</b></span>${state.guided ? '<span class="sensei-guided-status">Guided shift · no timer</span>' : `<span class="sensei-clock">⌛ <b data-sensei-timer>${formatTime(state.deadlineAt)}</b></span>`}</div><section class="sensei-desk-workspace"><div class="sensei-workbench"><div class="sensei-workbench-label">Desk view · ${escapeHtml(submission.subject)}</div><div class="sensei-paper" style="--paper-art:url('${escapeHtml(submission.paperAsset)}')"><div class="sensei-paper-head"><img src="${escapeHtml(submission.pupil.portrait)}" alt="${escapeHtml(submission.pupil.name)}" class="sensei-pupil-portrait"><div><span class="eyebrow">${escapeHtml(submission.pupil.role)}</span><h2>${escapeHtml(submission.pupil.name)}’s homework</h2><p>${submission.lines.map(line => escapeHtml(line.correctJapanese)).join(' · ')}</p>${state.guided ? '<p class="sensei-guided-tip">Compare the Japanese sentence, reading, and meaning. Use the handbook if you are unsure.</p>' : ''}</div><span class="sensei-paper-stamp">未採点</span></div><div class="sensei-paper-lines">${submission.lines.map(line => lineMarkup(line, state)).join('')}</div></div></div><aside class="sensei-handbook ${handbookOpen ? 'is-open' : ''}">${handbookMarkup()}</aside></section><button type="button" class="sensei-submit" data-sensei-submit ${submission.lines.every(decisionReady) ? '' : 'disabled'}>Stamp this paper <span>判定</span></button>`;
  const targetElement = target();
  if (targetElement) {
    targetElement.innerHTML = frame(`Paper ${state.currentIndex + 1} · ${submission.subject}`, content);
    enhanceDesk(state, targetElement);
  }
  bind();
}
function renderCorrection(state: SenseiShiftState): void {
  const submission = currentSubmission(state);
  if (!submission) return renderSummary(state);
  const result = state.paperResults[submission.id];
  const content = `<section class="sensei-correction"><div class="sensei-correction-banner"><span class="sensei-seal">${result?.mistakes.length ? '学' : '良'}</span><div><span class="eyebrow">Correction review</span><h2>${result?.mistakes.length ? 'A few marks to study' : 'Excellent judgement'}</h2><p>${result?.correct ?? 0}/${result?.total ?? 0} lines matched. Read the feedback before the next pupil arrives.</p></div></div><div class="sensei-feedback-list">${submission.lines.map(line => { const mistake = result?.mistakes.includes(line.id); return `<article class="sensei-feedback ${mistake ? 'is-mistake' : 'is-correct'}"><div><b>${mistake ? 'Needs study' : 'Correct'}</b><strong lang="ja">${escapeHtml(line.correctJapanese)}</strong><span>${escapeHtml(line.correctReading)} · ${escapeHtml(line.correctMeaning)}</span></div><p>${escapeHtml(line.explanation)}</p>${line.audio ? `<button type="button" class="sensei-hear" data-sensei-hear="${escapeHtml(line.id)}">🔊 Hear it</button>` : ''}</article>`; }).join('')}</div><button type="button" class="sensei-submit" data-sensei-continue>${state.currentIndex + 1 === state.submissions.length ? 'Review shift summary' : 'Next homework'} <span>→</span></button></section>`;
  const targetElement = target();
  if (targetElement) targetElement.innerHTML = frame('Read the teacher’s notes', content);
  bind();
}
function renderSummary(state: SenseiShiftState): void {
  const score = shiftScore(state);
  const content = `<section class="sensei-summary"><span class="sensei-seal">集</span><span class="eyebrow">Shift summary · 採点結果</span><h2>Your desk report</h2><div class="sensei-score"><strong>${score.percent}%</strong><span>${score.correct}/${score.total} answers correctly identified</span></div><div class="sensei-report-grid"><span><b>${state.quota.submitted}/${state.quota.total}</b><small>Papers reviewed</small></span><span><b>${state.missedLineIds.length}</b><small>Lines to revisit</small></span><span><b>${state.reputation}</b><small>Reputation</small></span></div><p>${score.percent >= 80 ? 'Your judgement is ready for the next class. The words from this shift will return to regular review.' : 'The desk is still teaching you. Review the marked lines, then try another shift.'}</p><button type="button" class="sensei-primary" data-sensei-finish>Submit shift report <span>判</span></button></section>`;
  const targetElement = target();
  if (targetElement) targetElement.innerHTML = frame('Shift report', content);
  bind();
}
function renderEnd(state: SenseiShiftState): void {
  const passed = state.phase === 'passed';
  const content = `<section class="sensei-summary sensei-final sensei-lights-out"><span class="sensei-seal">${passed ? '合' : '学'}</span><span class="eyebrow">Desk closed for tonight · 机じまい</span><h2>${passed ? 'The class can continue.' : 'Every paper made you sharper.'}</h2><p>The final paper settles in the graded tray. The desk lamp clicks off, and your notes are saved for tomorrow.</p><div class="sensei-menu-actions"><button type="button" class="sensei-primary" data-sensei-start>Start another shift <span>5 papers</span></button><button type="button" class="sensei-secondary" data-sensei-journey>Return to Journey</button></div></section>`;
  const targetElement = target();
  if (targetElement) targetElement.innerHTML = frame(passed ? 'Well done, Sensei' : 'The desk remains open', content);
  bind();
}
function render(state: SenseiShiftState | null): void {
  resetViewport();
  bindTimer(tutorialActive ? null : state ?? ({ phase: 'passed' } as SenseiShiftState));
  if (tutorialActive) return renderTutorial(state);
  if (!state) return renderMenu();
  if (state.phase === 'desk') return renderDesk(state);
  if (state.phase === 'correction') return renderCorrection(state);
  if (state.phase === 'summary') return renderSummary(state);
  return renderEnd(state);
}
function bind(): void {
  const element = target();
  if (!element) return;
  element.querySelector<HTMLElement>('[data-sensei-start]')?.addEventListener('click', startShift);
  element.querySelector<HTMLElement>('[data-sensei-tutorial]')?.addEventListener('click', openTutorial);
  element.querySelector<HTMLElement>('[data-sensei-tutorial-start]')?.addEventListener('click', finishTutorial);
  element.querySelectorAll<HTMLElement>('[data-sensei-tutorial-choice]').forEach(button => button.addEventListener('click', () => { tutorialChoice = button.dataset.senseiTutorialChoice as GradeDecision['verdict']; renderTutorial(stateOrNull()); }));
  element.querySelectorAll<HTMLElement>('[data-sensei-handbook-toggle]').forEach(button => button.addEventListener('click', () => { handbookOpen = !handbookOpen; render(stateOrNull()); }));
  element.querySelector<HTMLFormElement>('[data-sensei-handbook-form]')?.addEventListener('submit', event => { event.preventDefault(); handbookQuery = element.querySelector<HTMLInputElement>('[data-sensei-handbook-search]')?.value.trim() ?? ''; render(stateOrNull()); });
  element.querySelectorAll<HTMLElement>('[data-sensei-handbook-word]').forEach(button => button.addEventListener('click', () => { handbookWordId = button.dataset.senseiHandbookWord; handbookOpen = true; render(stateOrNull()); }));
  element.querySelector<HTMLElement>('[data-sensei-handbook-hear]')?.addEventListener('click', () => { const word = availableWords().find(item => item.wordAudio === element.querySelector<HTMLElement>('[data-sensei-handbook-hear]')?.dataset.senseiHandbookHear); if (word) playSenseiDeskWordAudio(word.wordAudio, word.reading); });
  element.querySelector<HTMLElement>('[data-sensei-open-paper]')?.addEventListener('click', () => { deskView = 'inspect'; playSenseiDeskEffect('paper'); render(stateOrNull()); });
  element.querySelector<HTMLElement>('[data-sensei-resume]')?.addEventListener('click', () => { const state = stateOrNull(); if (state) { deskView = 'idle'; startSenseiDeskMusic(); render(state); } });
  element.querySelector<HTMLElement>('[data-sensei-exit]')?.addEventListener('click', exitDesk);
  element.querySelector<HTMLElement>('[data-sensei-journey]')?.addEventListener('click', exitDesk);
  element.querySelector<HTMLElement>('[data-sensei-submit]')?.addEventListener('click', () => { const state = stateOrNull(); if (state) submitPaper(state); });
  element.querySelector<HTMLElement>('[data-sensei-continue]')?.addEventListener('click', () => { const state = stateOrNull(); if (state) continueAfterReview(state); });
  element.querySelector<HTMLElement>('[data-sensei-finish]')?.addEventListener('click', () => { const state = stateOrNull(); if (state) finish(state); });
  element.querySelectorAll<HTMLElement>('[data-sensei-verdict]').forEach(button => button.addEventListener('click', () => selectVerdict(button.dataset.senseiVerdict ?? '', button.dataset.senseiValue as GradeDecision['verdict'])));
  element.querySelectorAll<HTMLElement>('[data-sensei-error]').forEach(button => button.addEventListener('click', () => selectError(button.dataset.senseiError ?? '', button.dataset.senseiErrorTag as GradeDecision['errorTag'])));
  element.querySelectorAll<HTMLElement>('[data-sensei-hear]').forEach(button => button.addEventListener('click', () => { const state = stateOrNull(); if (state) { const line = lineFor(state, button.dataset.senseiHear ?? ''); playSenseiDeskWordAudio(line?.audio, line?.reading ?? ''); } }));
  element.querySelector<HTMLInputElement>('[data-sensei-audio]')?.addEventListener('change', event => { const input = event.currentTarget as HTMLInputElement; setSenseiDeskAudioEnabled(input.checked); if (input.checked) startSenseiDeskMusic(); });
}

export function installSenseiDesk(): void {
  const nav = document.querySelector<HTMLElement>('[data-experimental-nav="sensei-desk"]');
  nav?.addEventListener('click', () => { if (!document.querySelector('#senseiDesk.active')) host().show?.('senseiDesk'); document.body.classList.add('experimental-immersive-active'); render(stateOrNull()); });
  window.addEventListener('kaishi-sensei-desk-host-ready', () => { if (document.querySelector('#senseiDesk.active')) render(stateOrNull()); });
}
