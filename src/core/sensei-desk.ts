import { z } from 'zod';
import { createVersionedRepository, deviceStorage, sessionStorage } from '../platform/storage';
import { playSenseiDeskEffect, senseiDeskAudioEnabled, setSenseiDeskAudioEnabled, startSenseiDeskMusic, stopSenseiDeskMusic } from '../platform/sensei-desk-audio';
import { createShift, currentSubmission, finishShift, gradePaper, lineFor, reviewPaper, shiftScore } from '../domains/sensei-desk/desk';
import type { GradeDecision, HomeworkLine, SenseiShiftState, SenseiWord } from '../domains/sensei-desk/types';

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
  speak?: (text: string) => void;
};

let draftDecisions: Record<string, GradeDecision> = {};
let timerHandle: number | undefined;
let tutorialActive = false;
let tutorialChoice: GradeDecision['verdict'] | undefined;

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
  const unique = new Map<string, SenseiWord>();
  [...current, ...introduced].forEach(word => unique.set(word.id, word));
  return [...unique.values()];
}
function formatTime(deadline: number): string {
  const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
function stateOrNull(): SenseiShiftState | null {
  const saved = repository.load();
  return saved?.dateKey === today() ? saved : null;
}
function tutorialSeen(): boolean { return tutorialRepository.load()?.completed === true; }
function markTutorialSeen(): void { tutorialRepository.save({ schemaVersion: 1, completed: true }); }
function startSavedShift(): void {
  const state = createShift(availableWords(), today());
  repository.save(state);
  draftDecisions = {};
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
  startSavedShift();
}
function exitDesk(): void {
  const state = stateOrNull();
  const active = state?.phase === 'desk' || state?.phase === 'correction';
  if (active && !window.confirm('Leave Sensei’s Desk? Your current shift will be saved so you can return later.')) return;
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
  if (!submission || !submission.lines.every(decisionReady)) return;
  const next = gradePaper(state, draftDecisions);
  repository.save(next);
  draftDecisions = {};
  playSenseiDeskEffect('stamp');
  render(next);
}
function continueAfterReview(state: SenseiShiftState): void {
  const next = reviewPaper(state);
  repository.save(next);
  playSenseiDeskEffect(next.phase === 'summary' ? 'success' : 'paper');
  render(next);
}
function finish(state: SenseiShiftState): void {
  const next = finishShift(state);
  repository.save(next);
  if (next.phase === 'passed') {
    host().completeShift?.(availableWords().map(word => word.id));
    playSenseiDeskEffect('success');
  }
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
  return `<article class="sensei-homework-line ${verdict ? `is-${verdict}` : ''}" data-sensei-line="${escapeHtml(line.id)}"><div class="sensei-line-copy"><span class="sensei-line-number">${state.currentIndex + 1}.${line.id.split('-').at(-1)}</span><strong lang="ja">${escapeHtml(line.japanese)}</strong><span>${escapeHtml(line.reading)} · ${escapeHtml(line.meaning)}</span></div><div class="sensei-verdicts"><button type="button" class="sensei-verdict ${verdict === 'correct' ? 'is-selected' : ''}" data-sensei-verdict="${line.id}" data-sensei-value="correct">✓ Looks right</button><button type="button" class="sensei-verdict ${verdict === 'needs-correction' ? 'is-selected is-wrong' : ''}" data-sensei-verdict="${line.id}" data-sensei-value="needs-correction">✎ Needs correction</button></div>${correctionOptions}</article>`;
}
function frame(title: string, content: string): string {
  return `<div class="sensei-desk-shell"><header class="sensei-desk-header"><div><span class="eyebrow">SENSEI’S DESK · 先生の机</span><h1>${title}</h1><p>Grade one small answer at a time. Every correction teaches a word.</p></div><div class="sensei-desk-header-actions"><label class="sensei-audio-toggle"><input type="checkbox" data-sensei-audio ${senseiDeskAudioEnabled() ? 'checked' : ''}> Sound</label><button type="button" class="sensei-exit" data-sensei-exit>← Leave desk</button></div></header>${content}<p class="sensei-desk-note">A beginner can learn through the desk: read the pupil’s answer, identify the issue, then check the explanation.</p></div>`;
}
function renderTutorial(state: SenseiShiftState | null): void {
  const choice = tutorialChoice;
  const choiceFeedback = choice === 'correct'
    ? '<p class="sensei-tutorial-feedback is-correct" data-sensei-tutorial-feedback>Correct. The Japanese, reading, and meaning agree, so mark <b>Looks right</b>.</p>'
    : choice === 'needs-correction'
      ? '<p class="sensei-tutorial-feedback is-wrong" data-sensei-tutorial-feedback>Almost—but this example is consistent. On a real mistake, choose <b>Needs correction</b>, then name the issue: Meaning, Particle, or Kana.</p>'
      : '<p class="sensei-tutorial-prompt">Try the decision below. You can change your choice at any time.</p>';
  const actionLabel = state && (state.phase === 'desk' || state.phase === 'correction') ? 'Continue my shift' : 'Start my first shift';
  const content = `<section class="sensei-tutorial"><div class="sensei-tutorial-heading"><span class="sensei-seal">学</span><div><span class="eyebrow">First shift briefing · はじめに</span><h2>How to grade a paper</h2><p>You are the Sensei for a small class. Your job is to check each answer carefully—not to write a perfect essay.</p></div></div><div class="sensei-tutorial-grid"><ol class="sensei-tutorial-steps"><li><b>Read the three clues</b><span>Compare the Japanese answer, its reading, and the English meaning.</span></li><li><b>Make one decision</b><span>Choose <strong>Looks right</strong> when they agree, or <strong>Needs correction</strong> when they do not.</span></li><li><b>Label the lesson</b><span>For a mistake, select whether it is a Meaning, Particle, or Kana problem.</span></li><li><b>Stamp and learn</b><span>Submit the paper, then read Sensei’s feedback before the next pupil arrives.</span></li></ol><section class="sensei-tutorial-example" aria-labelledby="senseiTutorialExampleTitle"><span class="eyebrow">Worked example</span><h3 id="senseiTutorialExampleTitle">Does this answer match?</h3><article class="sensei-tutorial-line"><span class="sensei-line-number">EXAMPLE</span><strong lang="ja">わたしは みずを のみます</strong><span>わたしは みずを のみます · I drink water</span></article><div class="sensei-verdicts"><button type="button" class="sensei-verdict ${choice === 'correct' ? 'is-selected' : ''}" data-sensei-tutorial-choice="correct">✓ Looks right</button><button type="button" class="sensei-verdict ${choice === 'needs-correction' ? 'is-selected is-wrong' : ''}" data-sensei-tutorial-choice="needs-correction">✎ Needs correction</button></div>${choiceFeedback}<aside class="sensei-tutorial-mistake"><b>When it is wrong</b><span><span lang="ja">みずに おぼえます</span> · “I remember water”</span><small>The connector に is the issue here. Mark <b>Needs correction → Particle</b>.</small></aside></section></div><button type="button" class="sensei-primary sensei-tutorial-start" data-sensei-tutorial-start>${actionLabel} <span>判</span></button></section>`;
  const targetElement = target();
  if (targetElement) targetElement.innerHTML = frame('Your first paper, step by step', content);
  bind();
}
function renderMenu(): void {
  const saved = stateOrNull();
  const resume = saved && (saved.phase === 'desk' || saved.phase === 'correction') ? `<button type="button" class="sensei-primary" data-sensei-resume>Resume shift <span>${saved.quota.submitted}/${saved.quota.total} papers</span></button>` : '';
  const content = `<section class="sensei-desk-welcome"><div class="sensei-desk-welcome-art" role="img" aria-label="A calm teacher’s desk"></div><div><span class="sensei-seal">判</span><h2>Welcome to the homework desk</h2><p>Students have left five short papers for you. Decide what is correct, mark the kind of mistake, and read the Sensei’s explanation.</p><div class="sensei-rules"><span><b>01</b> Read the answer</span><span><b>02</b> Spot the issue</span><span><b>03</b> Learn the fix</span></div><div class="sensei-menu-actions">${resume}<button type="button" class="sensei-primary" data-sensei-start>Start a new shift <span>5 papers · 8 min</span></button><button type="button" class="sensei-secondary" data-sensei-tutorial>See an example</button></div></div></section>`;
  const targetElement = target();
  if (targetElement) targetElement.innerHTML = frame('The homework shift', content);
  bind();
}
function renderDesk(state: SenseiShiftState): void {
  const submission = currentSubmission(state);
  if (!submission) return renderSummary(state);
  const content = `<div class="sensei-desk-status"><span><b>Paper ${state.currentIndex + 1}</b> of ${state.submissions.length}</span><span>Quota <b>${state.quota.submitted}/${state.quota.total}</b></span><span>Reputation <b>${state.reputation}</b></span><span class="sensei-clock">⌛ <b data-sensei-timer>${formatTime(state.deadlineAt)}</b></span></div><section class="sensei-desk-workspace"><div class="sensei-workbench"><div class="sensei-workbench-label">Desk view · ${escapeHtml(submission.subject)}</div><div class="sensei-paper" style="--paper-art:url('${escapeHtml(submission.paperAsset)}')"><div class="sensei-paper-head"><img src="${escapeHtml(submission.pupil.portrait)}" alt="${escapeHtml(submission.pupil.name)}" class="sensei-pupil-portrait"><div><span class="eyebrow">${escapeHtml(submission.pupil.role)}</span><h2>${escapeHtml(submission.pupil.name)}’s homework</h2><p>${escapeHtml(submission.pupil.concern)}</p></div><span class="sensei-paper-stamp">未採点</span></div><div class="sensei-paper-lines">${submission.lines.map(line => lineMarkup(line, state)).join('')}</div></div></div><aside class="sensei-handbook"><span class="sensei-seal">辞</span><h2>Sensei’s handbook</h2><p>Look for agreement between the Japanese, reading, and meaning.</p><div class="sensei-handbook-rule"><b>Meaning</b><span>Does the English match the Japanese?</span></div><div class="sensei-handbook-rule"><b>Particle</b><span>Does the connector fit the sentence?</span></div><div class="sensei-handbook-rule"><b>Kana</b><span>Does every sound match?</span></div><p class="sensei-handbook-tip">You can hear a word after submitting a paper during the correction review.</p></aside></section><button type="button" class="sensei-submit" data-sensei-submit ${submission.lines.every(decisionReady) ? '' : 'disabled'}>Stamp this paper <span>判定</span></button>`;
  const targetElement = target();
  if (targetElement) targetElement.innerHTML = frame(`Paper ${state.currentIndex + 1} · ${submission.subject}`, content);
  bind();
}
function renderCorrection(state: SenseiShiftState): void {
  const submission = currentSubmission(state);
  if (!submission) return renderSummary(state);
  const result = state.paperResults[submission.id];
  const content = `<section class="sensei-correction"><div class="sensei-correction-banner"><span class="sensei-seal">${result?.mistakes.length ? '学' : '良'}</span><div><span class="eyebrow">Correction review</span><h2>${result?.mistakes.length ? 'A few marks to study' : 'Excellent judgement'}</h2><p>${result?.correct ?? 0}/${result?.total ?? 0} lines matched. Read the feedback before the next pupil arrives.</p></div></div><div class="sensei-feedback-list">${submission.lines.map(line => { const mistake = result?.mistakes.includes(line.id); return `<article class="sensei-feedback ${mistake ? 'is-mistake' : 'is-correct'}"><div><b>${mistake ? 'Needs study' : 'Correct'}</b><strong lang="ja">${escapeHtml(line.correctJapanese)}</strong><span>${escapeHtml(line.correctReading)} · ${escapeHtml(line.correctMeaning)}</span></div><p>${escapeHtml(line.explanation)}</p>${line.audio ? `<button type="button" class="sensei-hear" data-sensei-hear="${escapeHtml(line.audio)}">🔊 Hear it</button>` : ''}</article>`; }).join('')}</div><button type="button" class="sensei-submit" data-sensei-continue>${state.currentIndex + 1 === state.submissions.length ? 'Review shift summary' : 'Next homework'} <span>→</span></button></section>`;
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
  const content = `<section class="sensei-summary sensei-final"><span class="sensei-seal">${passed ? '合' : '学'}</span><span class="eyebrow">${passed ? 'Shift accepted' : 'Keep studying'}</span><h2>${passed ? 'The class can continue.' : 'Every paper made you sharper.'}</h2><p>${passed ? 'You identified the key Japanese patterns and sent the vocabulary back to your learning path.' : 'Your corrections are saved. Try again and aim for 80% or more.'}</p><div class="sensei-menu-actions"><button type="button" class="sensei-primary" data-sensei-start>Start another shift <span>5 papers</span></button><button type="button" class="sensei-secondary" data-sensei-journey>Return to Journey</button></div></section>`;
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
  element.querySelector<HTMLElement>('[data-sensei-resume]')?.addEventListener('click', () => { const state = stateOrNull(); if (state) { startSenseiDeskMusic(); render(state); } });
  element.querySelector<HTMLElement>('[data-sensei-exit]')?.addEventListener('click', exitDesk);
  element.querySelector<HTMLElement>('[data-sensei-journey]')?.addEventListener('click', exitDesk);
  element.querySelector<HTMLElement>('[data-sensei-submit]')?.addEventListener('click', () => { const state = stateOrNull(); if (state) submitPaper(state); });
  element.querySelector<HTMLElement>('[data-sensei-continue]')?.addEventListener('click', () => { const state = stateOrNull(); if (state) continueAfterReview(state); });
  element.querySelector<HTMLElement>('[data-sensei-finish]')?.addEventListener('click', () => { const state = stateOrNull(); if (state) finish(state); });
  element.querySelectorAll<HTMLElement>('[data-sensei-verdict]').forEach(button => button.addEventListener('click', () => selectVerdict(button.dataset.senseiVerdict ?? '', button.dataset.senseiValue as GradeDecision['verdict'])));
  element.querySelectorAll<HTMLElement>('[data-sensei-error]').forEach(button => button.addEventListener('click', () => selectError(button.dataset.senseiError ?? '', button.dataset.senseiErrorTag as GradeDecision['errorTag'])));
  element.querySelectorAll<HTMLElement>('[data-sensei-hear]').forEach(button => button.addEventListener('click', () => { const state = stateOrNull(); if (state) host().speak?.(lineFor(state, button.dataset.senseiHear ?? '')?.reading ?? ''); }));
  element.querySelector<HTMLInputElement>('[data-sensei-audio]')?.addEventListener('change', event => { const input = event.currentTarget as HTMLInputElement; setSenseiDeskAudioEnabled(input.checked); if (input.checked) startSenseiDeskMusic(); });
}

export function installSenseiDesk(): void {
  const nav = document.querySelector<HTMLElement>('[data-experimental-nav="sensei-desk"]');
  nav?.addEventListener('click', () => { if (!document.querySelector('#senseiDesk.active')) host().show?.('senseiDesk'); document.body.classList.add('experimental-immersive-active'); render(stateOrNull()); });
  window.addEventListener('kaishi-sensei-desk-host-ready', () => { if (document.querySelector('#senseiDesk.active')) render(stateOrNull()); });
}
