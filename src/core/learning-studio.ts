import { z } from "zod";
import { loadContent } from "../platform/content";
import { scoreComposition, filterGrammarLessons, type CompositionExercise } from "../domains/grammar-atlas/run";
import { scoreReadingAnswer, type ReadingPassage } from "../domains/reading-dojo/run";
import { scoreTypingAnswer, type TypingPrompt } from "../domains/typing-lab/run";
import "./learning-studio.css";

const readingSchema = z.object({ schemaVersion: z.number(), passages: z.array(z.any()) });
const grammarSchema = z.object({ lessons: z.array(z.any()) });
const typingPrompts: TypingPrompt[] = [
  { id: "typing-greeting", japanese: "おはよう", reading: "おはよう", meaning: "Good morning", hint: "お・は・よ・う" },
  { id: "typing-thanks", japanese: "ありがとうございます", reading: "ありがとうございます", meaning: "Thank you very much", hint: "あり・がとう・ございます" },
  { id: "typing-station", japanese: "駅はどこですか。", reading: "えきはどこですか。", meaning: "Where is the station?", hint: "駅 = えき" },
];
const compositionExercises: CompositionExercise[] = [
  { id: "atlas-desu", japanese: "これは本です。", prompt: "Say: This is a book.", tiles: ["これは", "本", "です。"], accepted: ["これは本です。"], explanation: "これは introduces the topic; です gives the polite ‘is’." },
  { id: "atlas-wo", japanese: "水を飲みます。", prompt: "Say: I drink water.", tiles: ["水", "を", "飲みます。"], accepted: ["水を飲みます。"], explanation: "を marks the object receiving the action." },
  { id: "atlas-de", japanese: "駅で会います。", prompt: "Say: We meet at the station.", tiles: ["駅", "で", "会います。"], accepted: ["駅で会います。"], explanation: "で marks the place where an action happens." },
];
const kanaRows = [
  ["あ", "か", "さ", "た", "な", "は", "ま", "や", "ら", "わ"],
  ["い", "き", "し", "ち", "に", "ひ", "み", "ゆ", "り", "を"],
  ["う", "く", "す", "つ", "ぬ", "ふ", "む", "よ", "る", "ん"],
  ["え", "け", "せ", "て", "ね", "へ", "め", "も", "れ", "、"],
  ["お", "こ", "そ", "と", "の", "ほ", "も", "よ", "ろ", "。"],
];
type GrammarLesson = { id?: string; title?: string; japanese?: string; summary?: string };
type StudioTab = "reading" | "typing" | "grammar";
const host = () => (window as Window & { KaishiActivityPolicy?: { deviceRepair?: { show?: (id: string) => void } } }).KaishiActivityPolicy?.deviceRepair;
const esc = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
const speak = (text: string) => { if (!("speechSynthesis" in window)) return; speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "ja-JP"; speechSynthesis.speak(utterance); };

export function installLearningStudio() {
  const root = document.querySelector<HTMLElement>("#learningStudioRoot");
  if (!root) return;
  let tab: StudioTab = "reading", passages: ReadingPassage[] = [], lessons: GrammarLesson[] = [], loading: Promise<void> | null = null;
  const open = () => {
    host()?.show?.("learningStudio");
    render();
    if (!loading) {
      loading = Promise.all([loadContent("./data/reading-dojo.json", readingSchema), loadContent("./data/grammar-path.json", grammarSchema)]).then(([reading, grammar]) => { passages = reading.passages as ReadingPassage[]; lessons = grammar.lessons as GrammarLesson[]; render(); }).catch(() => render("Content is unavailable offline. Download the offline pack and try again."));
    }
  };
  const render = (message = "") => {
    root.innerHTML = `<main class="learning-studio"><header class="learning-studio-heading"><button type="button" data-studio-back>← Games</button><div><span class="eyebrow">Learning Studio · 学習工房</span><h1>Read, type, compose</h1><p>Short loops for turning recognition into usable Japanese.</p></div></header><nav class="learning-studio-tabs" aria-label="Learning Studio modes"><button type="button" data-studio-tab="reading" class="${tab === "reading" ? "selected" : ""}">📖 Reading Dojo</button><button type="button" data-studio-tab="typing" class="${tab === "typing" ? "selected" : ""}">⌨ Typing Lab</button><button type="button" data-studio-tab="grammar" class="${tab === "grammar" ? "selected" : ""}">文 Grammar Atlas</button></nav><p class="learning-studio-status" aria-live="polite">${esc(message || (loading && !passages.length ? "Loading original stories and grammar guides…" : ""))}</p><section id="learningStudioPanel"></section></main>`;
    root.querySelector("[data-studio-back]")?.addEventListener("click", () => host()?.show?.("games"));
    root.querySelectorAll<HTMLButtonElement>("[data-studio-tab]").forEach((button) => button.addEventListener("click", () => { tab = button.dataset.studioTab as StudioTab; render(); }));
    const panel = root.querySelector<HTMLElement>("#learningStudioPanel");
    if (panel) {
      if (tab === "reading") renderReading(panel);
      else if (tab === "typing") renderTyping(panel);
      else renderGrammar(panel);
    }
  };
  const renderReading = (panel: HTMLElement) => {
    if (!passages.length) { panel.innerHTML = "<article class=\"learning-studio-card\"><h2>Reading Dojo</h2><p>Short stories with line-by-line support, vocabulary, and comprehension checks are loading…</p></article>"; return; }
    let passage = passages[0]!, questionIndex = 0, score = 0;
    const draw = (feedback = "") => {
      const question = passage.questions[questionIndex]!;
      panel.innerHTML = `<article class="learning-studio-card"><div class="studio-card-heading"><div><span class="eyebrow">${esc(passage.source)} · ${esc(passage.level)}</span><h2>${esc(passage.title)}</h2></div><label>Story<select id="studioStory">${passages.map((item) => `<option value="${esc(item.id)}"${item.id === passage.id ? " selected" : ""}>${esc(item.title)}</option>`).join("")}</select></label></div><div class="reading-lines">${passage.japanese.map((line, index) => `<article><button type="button" data-speak-reading="${esc(line)}">▶</button><div><p lang="ja">${esc(line)}</p><small>${esc(passage.translation[index] ?? "")}</small></div></article>`).join("")}</div><div class="reading-vocabulary">${passage.vocabulary.map((word) => `<button type="button" data-reading-word="${esc(word.word)}"><b lang="ja">${esc(word.word)}</b><span>${esc(word.reading)}</span><small>${esc(word.meaning)}</small></button>`).join("")}</div><hr><div class="studio-question"><span class="eyebrow">Check your understanding · ${questionIndex + 1}/${passage.questions.length}</span><h3>${esc(question.prompt)}</h3><div class="studio-answer-grid">${question.answers.map((answer, index) => `<button type="button" data-reading-answer="${index}">${esc(answer)}</button>`).join("")}</div><p class="learning-studio-feedback" aria-live="polite">${esc(feedback)}</p></div></article>`;
      panel.querySelector<HTMLSelectElement>("#studioStory")?.addEventListener("change", (event) => { passage = passages.find((item) => item.id === (event.target as HTMLSelectElement).value) ?? passages[0]!; questionIndex = 0; score = 0; draw(); });
      panel.querySelectorAll<HTMLButtonElement>("[data-speak-reading]").forEach((button) => button.addEventListener("click", () => speak(button.dataset.speakReading ?? "")));
      panel.querySelectorAll<HTMLButtonElement>("[data-reading-word]").forEach((button) => button.addEventListener("click", () => speak(button.dataset.readingWord ?? "")));
      panel.querySelectorAll<HTMLButtonElement>("[data-reading-answer]").forEach((button) => button.addEventListener("click", () => { const correct = scoreReadingAnswer(question, Number(button.dataset.readingAnswer)); panel.querySelectorAll<HTMLButtonElement>("[data-reading-answer]").forEach((answer) => { answer.disabled = true; if (Number(answer.dataset.readingAnswer) === question.correct) answer.classList.add("correct"); }); if (correct) score += 1; const result = questionIndex + 1 === passage.questions.length ? `Story complete — ${score}/${passage.questions.length} checks correct.` : `${correct ? "Correct." : "Review the highlighted answer."} ${question.explanation}`; if (questionIndex + 1 < passage.questions.length) setTimeout(() => { questionIndex += 1; draw(result); }, 650); else panel.querySelector(".learning-studio-feedback")!.textContent = result; }));
    };
    draw();
  };
  const renderTyping = (panel: HTMLElement) => {
    let promptIndex = 0, answer = "";
    const draw = (feedback = "") => {
      const prompt = typingPrompts[promptIndex]!;
      panel.innerHTML = `<article class="learning-studio-card typing-lab-card"><div class="studio-card-heading"><div><span class="eyebrow">Japanese keyboard · ${promptIndex + 1}/${typingPrompts.length}</span><h2>${esc(prompt.meaning)}</h2></div><button type="button" data-typing-hear>🔊 Hear it</button></div><p class="typing-target" lang="ja">${esc(prompt.reading)}</p><input id="typingAnswer" class="typing-answer" value="${esc(answer)}" readonly aria-label="Japanese answer"><div class="kana-keyboard">${kanaRows.flat().map((key) => `<button type="button" data-kana-key="${key}">${key}</button>`).join("")}<button type="button" data-kana-key=" ">space</button><button type="button" data-kana-backspace>⌫</button><button type="button" data-kana-clear>Clear</button></div><button type="button" class="primary typing-check" data-typing-check>Check answer</button><p class="learning-studio-feedback" aria-live="polite">${esc(feedback)}</p><p class="typing-hint">Hint: ${esc(prompt.hint ?? prompt.reading)}</p></article>`;
      panel.querySelector("[data-typing-hear]")?.addEventListener("click", () => speak(prompt.japanese));
      panel.querySelectorAll<HTMLButtonElement>("[data-kana-key]").forEach((button) => button.addEventListener("click", () => { answer += button.dataset.kanaKey ?? ""; draw(); }));
      panel.querySelector("[data-kana-backspace]")?.addEventListener("click", () => { answer = [...answer].slice(0, -1).join(""); draw(); });
      panel.querySelector("[data-kana-clear]")?.addEventListener("click", () => { answer = ""; draw(); });
      panel.querySelector("[data-typing-check]")?.addEventListener("click", () => { const result = scoreTypingAnswer(prompt.japanese, answer); const text = result.correct ? "Correct — the Japanese string matches." : `Not quite (${result.accuracy}% match). Compare the target and try again.`; if (result.correct && promptIndex < typingPrompts.length - 1) { promptIndex += 1; answer = ""; setTimeout(() => draw(text), 600); } else panel.querySelector(".learning-studio-feedback")!.textContent = text; });
    };
    draw();
  };
  const renderGrammar = (panel: HTMLElement) => {
    let query = "", exercise = compositionExercises[0]!, selectedTiles: string[] = [];
    const draw = (feedback = "") => {
      const visibleLessons = filterGrammarLessons(lessons, query).slice(0, 8);
      panel.innerHTML = `<article class="learning-studio-card"><div class="studio-card-heading"><div><span class="eyebrow">Searchable grammar reference</span><h2>Grammar Atlas</h2></div><input id="grammarAtlasSearch" type="search" placeholder="Search particles or ideas" value="${esc(query)}"></div><div class="grammar-atlas-grid">${visibleLessons.length ? visibleLessons.map((lesson) => `<button type="button" class="grammar-atlas-item"><b>${esc(lesson.title ?? "Grammar point")}</b><span lang="ja">${esc(lesson.japanese ?? "")}</span><small>${esc(lesson.summary ?? "Open this grammar point in the full path.")}</small></button>`).join("") : "<p class=\"muted\">Start typing to search the grammar path.</p>"}</div><hr><section class="composition-lab"><span class="eyebrow">Instant composition</span><h3>${esc(exercise.prompt)}</h3><p class="composition-answer" lang="ja">${esc(selectedTiles.join("")) || "Choose tiles to build your answer"}</p><div class="composition-tiles">${exercise.tiles.map((tile, index) => `<button type="button" data-composition-tile="${index}"${selectedTiles.includes(tile) ? " disabled" : ""}>${esc(tile)}</button>`).join("")}</div><div class="composition-free"><input id="compositionFree" placeholder="Or type your own answer"><button type="button" data-composition-check>Check</button><button type="button" data-composition-next>Next prompt</button></div><p class="learning-studio-feedback" aria-live="polite">${esc(feedback)}</p><small>${esc(exercise.explanation)}</small></section></article>`;
      panel.querySelector<HTMLInputElement>("#grammarAtlasSearch")?.addEventListener("input", (event) => { query = (event.target as HTMLInputElement).value; draw(); });
      panel.querySelectorAll<HTMLButtonElement>("[data-composition-tile]").forEach((button) => button.addEventListener("click", () => { selectedTiles.push(exercise.tiles[Number(button.dataset.compositionTile)]!); draw(); }));
      panel.querySelector("[data-composition-check]")?.addEventListener("click", () => { const typed = panel.querySelector<HTMLInputElement>("#compositionFree")?.value ?? selectedTiles.join(""); draw(scoreComposition(exercise, typed) ? "Correct — the sentence is natural." : "Try the particle or word order again."); });
      panel.querySelector("[data-composition-next]")?.addEventListener("click", () => { exercise = compositionExercises[(compositionExercises.indexOf(exercise) + 1) % compositionExercises.length]!; selectedTiles = []; draw(); });
    };
    draw();
  };
  document.querySelectorAll<HTMLElement>("[data-learning-studio]").forEach((button) => button.addEventListener("click", open));
}
