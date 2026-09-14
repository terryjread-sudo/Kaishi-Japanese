import * as THREE from 'three';
import './device-repair.css';
import { DEVICE_LABELS, canRevealNewWord, createRepairRun, nextFault, repairScore, type DeviceRepairRun, type RepairSkill, type RepairTrack, type RepairWord } from '../domains/device-repair/run';

type HostWord = RepairWord & { introduced: boolean; due: boolean };
type DeviceRepairHost = {
  show(id: string): void;
  words(): HostWord[];
  grade(wordId: string, skill: RepairSkill, correct: boolean): void;
  introduce(wordId: string): void;
  saveRun(run: DeviceRepairRun): void;
  finishRun(run: DeviceRepairRun, success: boolean, score: number): void;
  loadRun(): DeviceRepairRun | null;
};

let current: DeviceRepairRun | null = null;
let timer: number | null = null;
let sceneCleanup: (() => void) | null = null;

const root = () => document.querySelector<HTMLElement>('#deviceRepairRoot');
const host = () => (window as Window & { KaishiActivityPolicy?: { deviceRepair?: DeviceRepairHost } }).KaishiActivityPolicy?.deviceRepair;
const escape = (text: string) => text.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!);

function randomSeed() { return Math.floor(Math.random() * 0x7fffffff); }
function shuffled<T>(items: T[]) { return [...items].sort(() => Math.random() - .5); }

async function selectWords(track: RepairTrack) {
  const words = host()?.words() ?? [];
  let pool = words;
  if (track === 'japan-ready') {
    try {
      const response = await fetch('data/japan-ready-v90.json');
      const content = await response.json() as { scenarios?: Array<{ wordIds?: string[] }> };
      const ids = new Set(content.scenarios?.flatMap((scenario) => scenario.wordIds ?? []) ?? []);
      pool = words.filter((word) => ids.has(word.id));
    } catch { /* The standard vocabulary pool is a safe online-content fallback. */ }
  }
  const known = [...pool.filter((word) => word.introduced && word.due), ...pool.filter((word) => word.introduced && !word.due)]
    .filter((word, index, list) => list.findIndex((candidate) => candidate.id === word.id) === index);
  const fallbackKnown = words.filter((word) => word.introduced);
  const selectedKnown = (known.length >= 3 ? known : [...known, ...fallbackKnown.filter((word) => !known.some((candidate) => candidate.id === word.id))]).slice(0, 3);
  const newWord = pool.find((word) => !word.introduced) ?? words.find((word) => !word.introduced);
  return selectedKnown.length === 3 && newWord ? { known: selectedKnown, newWord } : null;
}

function speak(word: RepairWord) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word.word || word.reading);
  utterance.lang = 'ja-JP';
  window.speechSynthesis.speak(utterance);
}

function showSetup() {
  const element = root();
  if (!element) return;
  sceneCleanup?.(); sceneCleanup = null;
  const savedRun = host()?.loadRun() ?? null;
  element.innerHTML = `<main class="device-repair-shell"><header class="device-repair-top"><button type="button" data-repair-back>← Games</button><div><span class="eyebrow">Device Repair</span><h2>Restore a Japanese device</h2></div></header><section class="device-repair-intro"><div><span class="device-repair-icon">🔧</span><h3>One device. One linked repair chain.</h3><p>Test three known words through physical repairs. Powering the device reveals one new Japanese word, which you need for the final fix.</p><p class="muted">A 10-minute countdown is active once you begin. Hints lower your score, but your learning progress is always saved.</p></div><div class="device-repair-track">${savedRun ? '<button type="button" class="primary" data-repair-resume>Resume saved repair</button><small>Your timer continues while a repair is paused.</small>' : ''}<button type="button" class="primary" data-repair-track="review">Learn &amp; Review</button><small>Due and learned words first</small><button type="button" data-repair-track="japan-ready">Japan Ready</button><small>Travel words and phrases first</small></div></section></main>`;
  element.querySelector('[data-repair-back]')?.addEventListener('click', () => host()?.show('games'));
  element.querySelector('[data-repair-resume]')?.addEventListener('click', () => { current = savedRun; renderRun(); });
  element.querySelectorAll<HTMLButtonElement>('[data-repair-track]').forEach((button) => button.addEventListener('click', () => { void begin(button.dataset.repairTrack === 'japan-ready' ? 'japan-ready' : 'review'); }));
}

async function begin(track: RepairTrack) {
  const selection = await selectWords(track);
  if (!selection) { root()!.innerHTML = `<main class="device-repair-shell"><p role="status">Learn at least three words before starting Device Repair. Your next new word will then be introduced through the repair.</p><button type="button" data-repair-back>← Games</button></main>`; root()?.querySelector('[data-repair-back]')?.addEventListener('click', () => host()?.show('games')); return; }
  current = createRepairRun({ seed: randomSeed(), track, knownWords: selection.known, newWord: selection.newWord });
  host()?.saveRun(current);
  renderRun();
}

function choices(word: RepairWord, all: RepairWord[]) {
  return shuffled([word, ...shuffled(all.filter((candidate) => candidate.id !== word.id)).slice(0, 3)]);
}

function promptFor(word: RepairWord, skill: RepairSkill) {
  if (skill === 'reading') return { label: 'Manual reading', question: `Which component reads “${escape(word.reading)}”?`, replay: false };
  if (skill === 'listening') return { label: 'Audio diagnostic', question: 'Which Japanese component name did you hear?', replay: true };
  return { label: 'Service slip', question: `Which Japanese label means “${escape(word.meaning)}”?`, replay: false };
}

function renderRun() {
  const run = current, element = root(), api = host();
  if (!run || !element || !api) return;
  sceneCleanup?.();
  const fault = nextFault(run);
  const word = fault ? run.knownWords[run.solvedFaultIds.length]! : run.newWord;
  const final = !fault;
  const prompt = final ? { label: 'Boot screen', question: `Use the new word to finish the repair: which label is “${escape(word.meaning)}”?`, replay: true } : promptFor(word, fault.skill);
  const answerOptions = choices(word, [...run.knownWords, run.newWord]);
  element.innerHTML = `<main class="device-repair-shell"><header class="device-repair-top"><button type="button" data-repair-quit>Quit repair</button><div><span class="eyebrow">${escape(DEVICE_LABELS[run.device])} · ${run.track === 'review' ? 'Learn & Review' : 'Japan Ready'}</span><h2>${final ? 'Final boot repair' : escape(fault!.title)}</h2></div><strong id="deviceRepairTimer" aria-live="polite">10:00</strong></header><section class="device-repair-board"><div class="device-repair-canvas" id="deviceRepairCanvas" aria-label="Interactive 3D ${escape(DEVICE_LABELS[run.device])}"></div><section class="device-repair-panel"><div class="device-repair-progress">${run.faults.map((item, index) => `<span class="${run.solvedFaultIds.includes(item.id) ? 'done' : index === run.solvedFaultIds.length ? 'current' : ''}">${index + 1}</span>`).join('')}<i></i><span class="${run.revealedNewWord ? 'done' : ''}">新</span></div><span class="eyebrow">${prompt.label}</span><h3>${prompt.question}</h3>${prompt.replay ? '<button type="button" class="audio" data-repair-audio>🔊 Hear Japanese</button>' : ''}<div class="device-repair-choices">${answerOptions.map((choice) => `<button type="button" data-repair-answer="${escape(choice.id)}" lang="ja"><strong>${escape(choice.word)}</strong><small>${escape(choice.reading)}</small></button>`).join('')}</div><button type="button" class="hint" data-repair-hint>Open repair hint</button><p id="deviceRepairFeedback" class="muted">${fault ? `Repairing the ${escape(fault.subsystem)}. Each successful repair unlocks the next subsystem.` : `New word: ${escape(word.word)} · ${escape(word.reading)} · ${escape(word.meaning)}`}</p></section></section></main>`;
  const canvas = document.querySelector<HTMLElement>('#deviceRepairCanvas')!;
  try { mountDeviceScene(canvas, run, run.solvedFaultIds.length, final); }
  catch { canvas.innerHTML = `<div class="device-repair-fallback"><span>🔧</span><strong>${escape(DEVICE_LABELS[run.device])}</strong><p>Interactive repair controls are available beside the device.</p></div>`; }
  element.querySelector('[data-repair-quit]')?.addEventListener('click', failRun);
  element.querySelector('[data-repair-audio]')?.addEventListener('click', () => speak(word));
  element.querySelector('[data-repair-hint]')?.addEventListener('click', () => { run.hintsUsed++; api.saveRun(run); const feedback = document.querySelector('#deviceRepairFeedback'); if (feedback) feedback.textContent = final ? `The boot screen needs ${word.meaning}: ${word.word}.` : `${fault!.instruction} Hint used: final score reduced.`; });
  element.querySelectorAll<HTMLButtonElement>('[data-repair-answer]').forEach((button) => button.addEventListener('click', () => answer(button.dataset.repairAnswer === word.id, word, fault?.skill ?? 'meaning')));
  if (prompt.replay) speak(word);
  startTimer();
}

function answer(correct: boolean, word: RepairWord, skill: RepairSkill) {
  const run = current, api = host(); if (!run || !api) return;
  api.grade(word.id, skill, correct);
  const feedback = document.querySelector('#deviceRepairFeedback');
  if (!correct) { if (feedback) feedback.textContent = `Not quite. The correct Japanese is ${word.word} · ${word.reading}. Try again before time runs out.`; return; }
  const fault = nextFault(run);
  if (fault) { run.solvedFaultIds.push(fault.id); if (canRevealNewWord(run)) { run.revealedNewWord = true; api.introduce(run.newWord.id); } api.saveRun(run); renderRun(); return; }
  run.completed = true; api.finishRun(run, true, repairScore(run)); finish(true);
}

function startTimer() {
  if (timer !== null) window.clearInterval(timer);
  const tick = () => { const run = current, target = document.querySelector('#deviceRepairTimer'); if (!run || !target) return; const remaining = Math.max(0, run.deadlineAt - Date.now()); target.textContent = `${Math.floor(remaining / 60000)}:${String(Math.floor(remaining / 1000) % 60).padStart(2, '0')}`; if (remaining === 0) failRun(); };
  tick(); timer = window.setInterval(tick, 250);
}

function failRun() { const run = current; if (!run) return; host()?.finishRun(run, false, 0); finish(false); }
function finish(success: boolean) {
  if (timer !== null) { window.clearInterval(timer); timer = null; }
  sceneCleanup?.(); sceneCleanup = null;
  const run = current, element = root(); if (!run || !element) return;
  const score = success ? repairScore(run) : 0;
  element.innerHTML = `<main class="device-repair-shell device-repair-result"><span class="device-repair-icon">${success ? '✨' : '⏱️'}</span><span class="eyebrow">${success ? 'Repair complete' : 'Repair timed out'}</span><h2>${success ? `${escape(DEVICE_LABELS[run.device])} restored` : 'The bench powers down'}</h2><p>${success ? `You repaired every subsystem and learned ${escape(run.newWord.word)} — ${escape(run.newWord.meaning)}.` : 'Your correct answers were saved. Try another random device whenever you are ready.'}</p>${success ? `<strong class="device-repair-score">${score} points</strong>` : ''}<div><button type="button" class="primary" data-repair-again>Repair another device</button><button type="button" data-repair-back>Back to Games</button></div></main>`;
  element.querySelector('[data-repair-again]')?.addEventListener('click', () => showSetup());
  element.querySelector('[data-repair-back]')?.addEventListener('click', () => host()?.show('games'));
  current = null;
}

function mountDeviceScene(container: HTMLElement, run: DeviceRepairRun, completed: number, final: boolean) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#0c1731');
  const camera = new THREE.PerspectiveCamera(42, 1, .1, 100); camera.position.set(0, 2.2, 6);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); container.append(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xdbeafe, 0x111827, 2)); const light = new THREE.DirectionalLight(0xffffff, 2); light.position.set(3, 5, 4); scene.add(light);
  const device = new THREE.Group(); scene.add(device);
  const shell = new THREE.Mesh(new THREE.BoxGeometry(4.8, .55, 3), new THREE.MeshStandardMaterial({ color: run.device === 'handheld' ? 0x5c75a5 : 0x6b7280, roughness: .55 })); device.add(shell);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(2.1, .08, 1.2), new THREE.MeshStandardMaterial({ color: completed >= 3 ? 0x67e8f9 : 0x13223a, emissive: completed >= 3 ? 0x0e7490 : 0x000000 })); screen.position.set(0, .34, -.35); device.add(screen);
  const dpad = new THREE.Mesh(new THREE.BoxGeometry(.85, .1, .85), new THREE.MeshStandardMaterial({ color: 0x18233b })); dpad.position.set(-1.25, .34, .85); device.add(dpad);
  [-.35, .35].forEach((x) => { const button = new THREE.Mesh(new THREE.CylinderGeometry(.23, .23, .12, 20), new THREE.MeshStandardMaterial({ color: final ? 0xfbbf24 : 0xef4444 })); button.rotation.x = Math.PI / 2; button.position.set(1.25 + x, .36, .85); device.add(button); });
  if (completed === 0) [-.55, .55].forEach((x) => { const battery = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, 1.3, 16), new THREE.MeshStandardMaterial({ color: 0xfacc15 })); battery.rotation.z = Math.PI / 2; battery.position.set(x, -.42, 0); device.add(battery); });
  let angle = .28, dragging = false, lastX = 0;
  const resize = () => { const width = Math.max(1, container.clientWidth), height = Math.max(260, container.clientHeight); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); };
  const draw = () => { device.rotation.y = angle; renderer.render(scene, camera); }; resize(); draw();
  const down = (event: PointerEvent) => { dragging = true; lastX = event.clientX; renderer.domElement.setPointerCapture(event.pointerId); };
  const move = (event: PointerEvent) => { if (!dragging) return; angle += (event.clientX - lastX) * .012; lastX = event.clientX; draw(); };
  const up = () => { dragging = false; };
  renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointermove', move); renderer.domElement.addEventListener('pointerup', up);
  const observer = new ResizeObserver(() => { resize(); draw(); }); observer.observe(container);
  sceneCleanup = () => { observer.disconnect(); renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointermove', move); renderer.domElement.removeEventListener('pointerup', up); renderer.dispose(); container.replaceChildren(); };
}

export function launchDeviceRepair() { host()?.show('deviceRepair'); showSetup(); }
