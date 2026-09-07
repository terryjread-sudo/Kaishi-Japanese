import { feedbackExplanation } from '../domains/lessons/feedback';
import type { AnswerFeedback } from '../domains/lessons/feedback';
import { lessonPhase } from '../domains/lessons/session';

export function showAnswerFeedback(host: HTMLElement, feedback: AnswerFeedback, proceed: () => void, replay?: () => void) {
  host.querySelector('.lesson-answer-feedback')?.remove();
  const panel = document.createElement('section');
  panel.className = `lesson-answer-feedback ${feedback.correct ? 'correct' : 'incorrect'}`;
  panel.setAttribute('aria-live', 'polite');
  const heading = document.createElement('h3');
  heading.textContent = feedback.correct ? 'Correct' : 'Let’s compare';
  const choices = document.createElement('p');
  choices.textContent = feedback.correct ? `Answer: ${feedback.answer}` : `Your choice: ${feedback.selected} · Correct answer: ${feedback.answer}`;
  const explanation = document.createElement('p');
  explanation.textContent = feedbackExplanation(feedback);
  panel.append(heading, choices, explanation);
  if (replay) {
    const audio = document.createElement('button');
    audio.type = 'button'; audio.className = 'audio'; audio.textContent = '🔊 Hear the answer'; audio.onclick = replay;
    panel.append(audio);
  }
  const next = document.createElement('button');
  next.type = 'button'; next.className = 'primary'; next.textContent = 'Continue';
  next.onclick = () => { next.disabled = true; proceed(); };
  panel.append(next); host.append(panel);
  panel.scrollIntoView({ block: 'nearest' });
  next.focus({ preventScroll: true });
}

export function decorateLesson(host: HTMLElement, info: { title: string; skill: string; strength: number; complete: boolean; help: () => void }) {
  host.classList.add('cohesive-lesson');
  host.querySelector('.lesson-shell-heading')?.remove();
  const heading = document.createElement('header'); heading.className = 'lesson-shell-heading';
  const title = document.createElement('strong'); title.textContent = info.title;
  const phase = document.createElement('span'); phase.textContent = info.complete ? 'Session complete' : lessonPhase(info.skill);
  const help = document.createElement('button'); help.type = 'button'; help.className = 'lesson-mastery-help';
  help.setAttribute('aria-label', 'How Sensei’s Path works'); help.textContent = `Long-term strength ${info.strength}% · ?`; help.onclick = info.help;
  heading.append(title, phase, help); host.prepend(heading);
  host.querySelectorAll<HTMLDetailsElement>('.meet-word-guidance').forEach(details => { details.open = false; });
  if (host.querySelector('.vms-scene img, .memory-scene img')) host.querySelectorAll<HTMLElement>(':scope > .picture').forEach(picture => { picture.hidden = true; });
  host.querySelectorAll<HTMLButtonElement>('.audio').forEach(button => {
    if (button.textContent?.trim() === '🔊') button.textContent = '🔊 Listen';
    if (!button.getAttribute('aria-label')) button.setAttribute('aria-label', button.textContent || 'Listen');
  });
  host.querySelectorAll<HTMLElement>('.eyebrow').forEach(node => {
    if (/First encounter|Meet the word/.test(node.textContent || '')) node.textContent = lessonPhase(info.skill);
  });
  host.querySelectorAll<HTMLImageElement>('img').forEach(img => {
    if (img.closest('.sensei-avatar')) return;
    const fallback = () => { img.hidden = true; if (!img.parentElement?.querySelector('.lesson-image-fallback')) { const text = document.createElement('p'); text.className = 'lesson-image-fallback'; text.textContent = 'Picture unavailable. Use the word and memory cue below.'; img.after(text); } };
    img.addEventListener('error', fallback, { once: true });
    if (img.complete && img.naturalWidth === 0) fallback();
  });
}
