import * as THREE from "three";
import "./device-repair.css";
import "./device-repair-mobile.css";
import {
  DEVICE_LABELS,
  canRevealNewWord,
  createServiceTags,
  createRepairRun,
  nextRepairModule,
  repairScore,
  type DeviceKind,
  type DeviceRepairRun,
  type RepairSkill,
  type RepairTrack,
  type RepairWord,
} from "../domains/device-repair/run";
import type { RepairWorkshopState } from "../domains/device-repair/workshop";

type Word = RepairWord & { introduced: boolean; due: boolean };
type Host = {
  show(id: string): void;
  words(): Word[];
  grade(id: string, s: RepairSkill, ok: boolean): void;
  introduce(id: string): void;
  saveRun(r: DeviceRepairRun): void;
  finishRun(r: DeviceRepairRun, ok: boolean, score: number): void;
  loadRun(): DeviceRepairRun | null;
  workshop?(): RepairWorkshopState;
};
let run: DeviceRepairRun | null = null,
  timer: number | null = null,
  clean: (() => void) | null = null,
  visibilityHandler: (() => void) | null = null,
  hiddenAt = 0;
const root = () => document.querySelector<HTMLElement>("#deviceRepairRoot");
const host = () =>
  (window as Window & { KaishiActivityPolicy?: { deviceRepair?: Host } })
    .KaishiActivityPolicy?.deviceRepair;
const esc = (s: string) =>
  s.replace(
    /[&<>'"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        c
      ]!,
  );
const hash = (s: string) =>
  [...s].reduce((n, c) => (n * 31 + c.codePointAt(0)!) >>> 0, 7);
const shuffled = <T>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
function speak(w: RepairWord) {
  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(w.word);
    u.lang = "ja-JP";
    speechSynthesis.speak(u);
  }
}
function tactileSound(kind: "click" | "snap" | "strike" | "tape") {
  try {
    const audio = new AudioContext();
    const o = audio.createOscillator(),
      gain = audio.createGain();
    o.type = kind === "strike" ? "sawtooth" : "square";
    o.frequency.setValueAtTime(
      kind === "strike" ? 115 : kind === "tape" ? 90 : 280,
      audio.currentTime,
    );
    o.frequency.exponentialRampToValueAtTime(
      kind === "snap" ? 520 : 55,
      audio.currentTime + (kind === "tape" ? 0.28 : 0.09),
    );
    gain.gain.setValueAtTime(0.075, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audio.currentTime + (kind === "tape" ? 0.3 : 0.11),
    );
    o.connect(gain).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + (kind === "tape" ? 0.31 : 0.12));
  } catch {
    /* Audio is optional on restricted browsers. */
  }
}
function playDiagnostic(w: RepairWord) {
  tactileSound("tape");
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(w.word);
  u.lang = "ja-JP";
  u.rate = 0.72;
  u.pitch = 0.82;
  speechSynthesis.speak(u);
}
async function words(track: RepairTrack) {
  const all = host()?.words() ?? [];
  let pool = all;
  if (track === "japan-ready")
    try {
      const d = (await (await fetch("data/japan-ready-v90.json")).json()) as {
        scenarios?: { wordIds?: string[] }[];
      };
      const ids = new Set(d.scenarios?.flatMap((s) => s.wordIds ?? []) ?? []);
      pool = all.filter((w) => ids.has(w.id));
    } catch {
      pool = all;
    }
  const known = [
      ...pool.filter((w) => w.introduced && w.due),
      ...pool.filter((w) => w.introduced && !w.due),
      ...all.filter((w) => w.introduced),
    ]
      .filter((w, i, a) => a.findIndex((x) => x.id === w.id) === i)
      .slice(0, 3),
    fresh = pool.find((w) => !w.introduced) ?? all.find((w) => !w.introduced);
  return known.length === 3 && fresh ? { known, fresh } : null;
}
function setup() {
  const r = root();
  if (!r) return;
  clean?.();
  clean = null;
  const saved = host()?.loadRun();
  const resumable = saved && saved.schemaVersion >= 2 ? saved : null;
  const workshop = host()?.workshop?.();
  r.innerHTML = `<main class="device-repair-shell"><header class="device-repair-top"><button data-back>← Games</button><div><span class="eyebrow">Device Repair bench</span><h2>Japanese maintenance challenge</h2></div></header><section class="device-repair-intro"><div><span class="device-repair-icon">🔧</span><h3>Read the handbook. Operate the machine.</h3><p>Earlier modules unlock later ones. Incorrect actions cost time, but never end your repair.</p>${workshop ? `<p class="repair-workshop-badge">Workshop level ${workshop.level} · ${workshop.xp} XP · ${workshop.unlockedSkins.length} bench skins</p>` : ""}</div><div class="device-repair-track">${resumable ? `<button class="primary" data-resume>Resume ${esc(DEVICE_LABELS[resumable.device])}</button>` : ""}<div class="device-repair-device-grid">${(Object.keys(DEVICE_LABELS) as DeviceKind[]).map((device, index) => `<button data-device="${device}" class="${index === 0 ? "selected" : ""}"><b>${DEVICE_LABELS[device]}</b><small>${device === "cassette" ? "Reels & transport" : device === "handheld" ? "Cells & cartridge" : device === "radio" ? "Signal & tuning" : device === "camera" ? "Film & focus" : "Codes & relay"}</small></button>`).join("")}</div><button class="primary" data-track="review">Start timed Journey repair</button><button data-track="japan-ready">Start timed Japan Ready repair</button></div></section></main>`;
  r.querySelector("[data-back]")?.addEventListener("click", () =>
    host()?.show("gameHub"),
  );
  r.querySelector("[data-resume]")?.addEventListener("click", () => {
    run = resumable;
    if (run && !run.serviceTags?.length) {
      run.serviceTags = createServiceTags(run.knownWords);
      host()?.saveRun(run);
    }
    draw();
  });
  r.querySelectorAll<HTMLButtonElement>("[data-track]").forEach(
    (b) =>
      (b.onclick = () =>
        void begin(
          b.dataset.track === "japan-ready" ? "japan-ready" : "review",
          (r.querySelector<HTMLButtonElement>("[data-device].selected")?.dataset.device as DeviceKind) ?? "cassette",
        )),
  );
  r.querySelectorAll<HTMLButtonElement>("[data-device]").forEach((button) => button.addEventListener("click", () => {
    r.querySelectorAll("[data-device]").forEach((item) => item.classList.remove("selected"));
    button.classList.add("selected");
  }));
}
async function begin(track: RepairTrack, device: DeviceKind) {
  const picked = await words(track);
  if (!picked) {
    root()!.innerHTML =
      '<main class="device-repair-shell"><h2>Learn three words first</h2><p>Complete a little Journey practice, then return.</p></main>';
    return;
  }
  run = createRepairRun({
    seed: Math.floor(Math.random() * 2 ** 31),
    track,
    knownWords: picked.known,
    newWord: picked.fresh,
    device,
    advanced: picked.known.every((word) => word.due) || Boolean(host()?.workshop?.().unlockedModules.includes("advanced")),
  });
  host()?.saveRun(run);
  draw();
}
function manual(
  w: RepairWord,
  f: { skill: RepairSkill } | null,
  k: string,
  final: boolean,
) {
  const tags = run?.serviceTags ?? [];
  const cassetteMode = run?.device === "cassette";
  const ask = cassetteMode
    ? `整備コード「${esc(w.word)}」を さがしてください。`
    :
    f?.skill === "reading"
      ? `「${esc(w.reading)}」と読むラベルを探す。`
      : f?.skill === "listening"
        ? "音声を聞いて、同じ日本語ラベルを探す。"
        : `「${esc(w.meaning)}」を表す日本語ラベルを探す。`;
  const act = cassetteMode
    ? "同じコードが付いた部品を 操作してください。"
    :
    k === "battery"
      ? "電池をタップして、＋と－の向きを直す。"
      : k === "tape"
        ? "カセットを入れて、再生ボタンを押して音を聞く。"
        : k === "dial"
          ? "ダイヤルをタップして、正しい目盛りに合わせる。"
          : "本体に印刷された部品をタップする。";
  const tagList = tags.map((tag) => `<button data-term="${esc(`${tag.word}|${tag.reading}|${tag.meaning}`)}" data-repair-hear="${esc(tag.word)}"><b lang="ja">${esc(tag.word)}</b><small>${esc(tag.reading)}</small></button>`).join("");
  return `<aside class="repair-manual" id="repairManual"><button class="manual-close" data-manual-close aria-label="Close manual">×</button><b>サービスマニュアル · ${final ? "FINAL" : "REPAIR"}</b><h3>${final ? "最後の起動手順" : "修理指示"}</h3><p lang="ja">${ask}</p><p lang="ja">${act}</p><div class="manual-terms">${tagList}</div><hr><strong>${final ? "New word preview" : "Maintenance code"}: <span lang="ja">${esc(final ? run?.newWord.word ?? w.word : w.word)}</span> · ${esc(final ? run?.newWord.reading ?? w.reading : w.reading)}</strong><small>${final ? `You will meet ${esc(run?.newWord.meaning ?? "this word")} in a future repair.` : "This is an introduced Japanese maintenance code; match it to the machine and handbook state."}</small><output id="repairDictionary" aria-live="polite"></output></aside>`;
}
function draw() {
  const r = run,
    t = root(),
    h = host();
  if (!r || !t || !h) return;
  clean?.();
  const activeModule = nextRepairModule(r),
    stage = r.solvedFaultIds.length,
    w = activeModule ? r.knownWords[activeModule.wordIndex]! : r.knownWords[r.knownWords.length - 1]!,
    k = activeModule?.interaction ?? "press",
    final = !activeModule;
  t.innerHTML = `<main class="device-repair-shell"><header class="device-repair-top"><button data-quit>Quit repair</button><div><span class="eyebrow">${esc(DEVICE_LABELS[r.device])} · module ${Math.min(stage + 1, r.modules.length)}/${r.modules.length}</span><h2>${final ? "Power-on repair" : esc(activeModule!.title)}</h2></div><strong id="deviceRepairTimer">10:00</strong></header><section class="device-repair-workbench"><div class="device-repair-model"><div class="device-repair-canvas" id="deviceRepairCanvas"></div><p class="device-repair-gesture">Drag to inspect · operate the highlighted component</p><p class="device-repair-step">${final ? "Run the final device test" : esc(activeModule!.instruction)}</p></div><section class="device-repair-instructions"><button class="manual-toggle" data-manual>☰ Service manual</button>${manual(w, activeModule, k, final)}${activeModule?.skill === "listening" || final ? '<button class="audio" data-audio>▶ Hear maintenance code</button>' : ""}<div class="device-repair-progress">${r.modules.map((x, i) => `<span class="${r.solvedFaultIds.includes(x.id) ? "done" : i === stage ? "current" : ""}">${i + 1}</span>`).join("")}<i></i><span class="${r.revealedNewWord ? "done" : ""}">新</span></div><button class="hint" data-hint>Translated hint</button><p id="deviceRepairFeedback">Use the handbook code and physical machine state together.</p></section></section></main>`;
  try {
    scene(
      document.querySelector<HTMLElement>("#deviceRepairCanvas")!,
      r,
      w,
      k,
      (ok) => operate(ok, w, activeModule?.skill ?? "meaning"),
      () => {
        r.diagnosticStep = (r.diagnosticStep ?? 0) + 1;
        h.saveRun(r);
        draw();
      },
    );
  } catch {
    document.querySelector("#deviceRepairCanvas")!.textContent =
      "WebGL device view unavailable.";
  }
  t.querySelector("[data-quit]")?.addEventListener("click", () =>
    finish(false),
  );
  t.querySelector("[data-audio]")?.addEventListener("click", () => playDiagnostic(w));
  const drawer = t.querySelector<HTMLElement>("#repairManual");
  const setManual = (open: boolean) =>
    drawer?.classList.toggle("manual-open", open);
  t.querySelector("[data-manual]")?.addEventListener("click", () =>
    setManual(true),
  );
  t.querySelector("[data-manual-close]")?.addEventListener("click", () =>
    setManual(false),
  );
  t.querySelectorAll<HTMLButtonElement>("[data-term]").forEach((button) =>
    button.addEventListener("click", () => {
      const [word, reading, meaning] = button.dataset.term!.split("|");
      const dictionary = t.querySelector("#repairDictionary");
      if (dictionary)
        dictionary.textContent = `${word}（${reading}）— ${meaning}`;
    }),
  );
  t.querySelectorAll<HTMLButtonElement>("[data-repair-hear]").forEach((button) =>
    button.addEventListener("click", () =>
      playDiagnostic({ ...w, word: button.dataset.repairHear ?? w.word }),
    ),
  );
  t.querySelector("[data-hint]")?.addEventListener("click", () => {
    r.hintsUsed++;
    h.saveRun(r);
    document.querySelector("#deviceRepairFeedback")!.textContent =
      `Hint: operate the part labelled ${w.word} (${w.meaning}).`;
  });
  if (activeModule?.skill === "listening" || final) speak(w);
  clock();
}
function operate(ok: boolean, w: RepairWord, s: RepairSkill) {
  const r = run;
  if (!r) return;
  host()?.grade(w.id, s, ok);
  if (!ok) {
    r.timePenalties++;
    r.deadlineAt = Math.max(Date.now(), r.deadlineAt - 15_000);
    host()?.saveRun(r);
    document.querySelector("#deviceRepairFeedback")!.textContent =
      "Incorrect code — 15 seconds deducted. Re-read the Japanese clue and inspect the machine state.";
    return;
  }
  const activeModule = nextRepairModule(r);
  if (activeModule) {
    r.solvedFaultIds.push(activeModule.id);
    if (canRevealNewWord(r)) r.revealedNewWord = true;
    r.diagnosticStep = 0;
    host()?.saveRun(r);
    draw();
  } else {
    r.completed = true;
    host()?.finishRun(r, true, repairScore(r));
    finish(true);
  }
}
function clock() {
  if (timer) clearInterval(timer);
  if (visibilityHandler) document.removeEventListener("visibilitychange", visibilityHandler);
  visibilityHandler = () => {
    if (!run) return;
    if (document.hidden) hiddenAt = Date.now();
    else if (hiddenAt) {
      run.deadlineAt += Date.now() - hiddenAt;
      hiddenAt = 0;
      host()?.saveRun(run);
    }
  };
  document.addEventListener("visibilitychange", visibilityHandler);
  const tick = () => {
    if (!run) return;
    const left = Math.max(0, run.deadlineAt - Date.now()),
      e = document.querySelector("#deviceRepairTimer");
    if (e)
      e.textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, "0")}`;
    if (!left) finish(false);
  };
  tick();
  timer = window.setInterval(tick, 250);
}
function finish(ok: boolean) {
  if (timer) clearInterval(timer);
  timer = null;
  if (visibilityHandler) document.removeEventListener("visibilitychange", visibilityHandler);
  visibilityHandler = null;
  hiddenAt = 0;
  clean?.();
  clean = null;
  const r = run,
    t = root();
  if (!r || !t) return;
  if (!r.completed) host()?.finishRun(r, false, 0);
  t.innerHTML = `<main class="device-repair-shell device-repair-result"><span class="device-repair-icon">${ok ? "✨" : "⏱️"}</span><h2>${ok ? "Device restored" : "Repair timed out"}</h2><p>${ok ? `You repaired the player using words already in your Journey. Previewed next: ${esc(r.newWord.word)} — ${esc(r.newWord.meaning)}.` : "Your correct Japanese practice was saved."}</p><button class="primary" data-again>Another device</button><button data-back>Games</button></main>`;
  t.querySelector("[data-again]")?.addEventListener("click", setup);
  t.querySelector("[data-back]")?.addEventListener("click", () =>
    host()?.show("gameHub"),
  );
  run = null;
}
const panelTextures = new Map<DeviceKind, THREE.CanvasTexture>();

function panelTexture(type: DeviceKind) {
  const existing = panelTextures.get(type);
  if (existing) return existing;
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 560;
  const c = canvas.getContext("2d")!;
  const colours: Record<DeviceKind, [string, string]> = {
    handheld: ["#304b70", "#a5c7ea"],
    cassette: ["#5b4555", "#edc98d"],
    radio: ["#3f6c67", "#d9e6c3"],
    camera: ["#4b3a35", "#f0c77a"],
    pager: ["#3e4964", "#8ce0ce"],
  };
  const [base, accent] = colours[type];
  c.fillStyle = base;
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = "rgba(255,255,255,.08)";
  for (let x = 0; x < canvas.width; x += 46) c.fillRect(x, 0, 2, canvas.height);
  for (let y = 0; y < canvas.height; y += 46) c.fillRect(0, y, canvas.width, 2);
  c.strokeStyle = accent;
  c.globalAlpha = 0.65;
  c.lineWidth = 7;
  c.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);
  c.globalAlpha = 1;
  c.fillStyle = accent;
  c.font = "700 44px sans-serif";
  c.fillText("KAISHI", 58, 90);
  c.font = "600 23px sans-serif";
  c.fillText(`${DEVICE_LABELS[type].toUpperCase()} / SERVICE PANEL`, 58, 130);
  c.globalAlpha = 0.35;
  c.font = "700 150px sans-serif";
  c.fillText(
    type === "camera" ? "写" : type === "radio" ? "音" : "機",
    650,
    410,
  );
  c.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  panelTextures.set(type, texture);
  return texture;
}

function mat(c: number) {
  return new THREE.MeshStandardMaterial({
    color: c,
    roughness: 0.42,
    metalness: 0.16,
  });
}
function box(
  g: THREE.Group,
  s: [number, number, number],
  p: [number, number, number],
  c: number,
  material?: THREE.Material,
) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...s), material ?? mat(c));
  m.position.set(...p);
  g.add(m);
  return m;
}
function face(
  g: THREE.Group,
  type: DeviceKind,
  width: number,
  height: number,
  z: number,
) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({
      map: panelTexture(type),
      roughness: 0.55,
      metalness: 0.08,
    }),
  );
  m.position.z = z;
  g.add(m);
  return m;
}
function cyl(
  g: THREE.Group,
  r: number,
  d: number,
  p: [number, number, number],
  c: number,
) {
  // 40 sides reads as a smooth manufactured component on a phone while
  // keeping even the most detailed repair bench comfortably lightweight.
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d, 40), mat(c));
  m.position.set(...p);
  g.add(m);
  return m;
}
function screw(g: THREE.Group, p: [number, number, number], c = 0xc8d0dc) {
  const head = cyl(g, 0.1, 0.09, p, c);
  head.rotation.x = Math.PI / 2;
  const slot = box(g, [0.12, 0.018, 0.018], [p[0], p[1], p[2] + 0.06], 0x223247);
  return { head, slot };
}
function grill(g: THREE.Group, origin: [number, number, number], columns: number, rows: number, gap = 0.15) {
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++) {
      const hole = cyl(g, 0.045, 0.06, [origin[0] + column * gap, origin[1] + row * gap, origin[2]], 0x0c1525);
      hole.rotation.x = Math.PI / 2;
    }
}
function tag(g: THREE.Group, text: string, p: [number, number, number]) {
  const c = document.createElement("canvas");
  c.width = 400;
  c.height = 100;
  const x = c.getContext("2d")!;
  x.fillStyle = "#fff4cf";
  x.fillRect(4, 4, 392, 92);
  x.strokeStyle = "#b98b39";
  x.lineWidth = 8;
  x.strokeRect(4, 4, 392, 92);
  x.fillStyle = "#17233e";
  x.font = "700 42px sans-serif";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText(text, 200, 50);
  const s = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 0.3),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(c),
      transparent: true,
    }),
  );
  s.position.set(...p);
  g.add(s);
}
function body(type: DeviceKind, g: THREE.Group) {
  const dark = 0x16243a,
    steel = 0x71839a,
    cream = 0xe8d6a0,
    red = 0xc9414c;
  if (type === "handheld") {
    box(g, [5.5, 3.5, 0.7], [0, 0, 0], steel);
    box(g, [5.28, 3.28, 0.12], [0, 0, 0.39], 0x293b55);
    face(g, type, 5.15, 3.15, 0.37);
    box(g, [2.45, 1.45, 0.15], [0.65, 0.3, 0.48], dark);
    box(g, [0.9, 0.22, 0.14], [-1.55, 0.25, 0.53], dark);
    box(g, [0.22, 0.9, 0.14], [-1.55, 0.25, 0.55], dark);
    [-0.35, 0.35].forEach((x) => {
      const m = cyl(g, 0.24, 0.15, [1.4 + x, -0.65, 0.5], red);
      m.rotation.x = Math.PI / 2;
    });
    box(g, [2.2, 0.42, 0.55], [0, 1.92, 0], cream);
    [-2.2, 2.2].forEach((x) => box(g, [0.6, 0.22, 0.3], [x, 1.58, 0], dark));
    grill(g, [-2.05, -1.15, 0.5], 5, 2, 0.14);
    [-2.45, 2.45].forEach((x) => [-1.45, 1.45].forEach((y) => screw(g, [x, y, 0.48])));
  }
  if (type === "cassette") {
    box(g, [5.4, 3.35, 0.7], [0, 0, 0], 0x48576b);
    face(g, type, 5.05, 3, 0.37);
    // A layered transport window gives the player a believable cassette
    // mechanism rather than a flat panel.
    box(g, [3.72, 1.92, 0.1], [0, -0.08, 0.48], 0x101827);
    box(g, [3.5, 1.7, 0.14], [0, -0.08, 0.56], dark);
    [-0.9, 0.9].forEach((x) => {
      const m = cyl(g, 0.56, 0.18, [x, -0.08, 0.65], cream);
      m.rotation.x = Math.PI / 2;
      m.name = "cassette-reel";
      const hub = cyl(g, 0.17, 0.2, [x, -0.08, 0.77], 0x48576b);
      hub.rotation.x = Math.PI / 2;
      for (let spoke = 0; spoke < 8; spoke++) {
        const spokePart = box(g, [0.06, 0.36, 0.04], [x, -0.08, 0.79], 0xb8a66f);
        spokePart.rotation.z = (Math.PI / 4) * spoke;
      }
    });
    [0, 0.65, 1.3, 1.95].forEach((x) =>
      box(g, [0.44, 0.34, 0.18], [-1.72 + x, 1.75, 0], steel),
    );
    grill(g, [1.85, -1.08, 0.54], 8, 2, 0.11);
    const dial = cyl(g, 0.34, 0.2, [-2.05, -1.07, 0.62], cream);
    dial.rotation.x = Math.PI / 2;
    box(g, [0.05, 0.28, 0.06], [-2.05, -0.96, 0.76], red);
    [-2.2, 2.2].forEach((x) =>
      [-1.25, 1.25].forEach((y) => {
        screw(g, [x, y, 0.48], cream);
      }),
    );
  }
  if (type === "radio") {
    box(g, [5, 3.7, 0.85], [0, 0, 0], steel);
    box(g, [4.82, 3.52, 0.11], [0, 0, 0.46], 0x294958);
    face(g, type, 4.65, 3.35, 0.45);
    grill(g, [-1.5, -0.8, 0.52], 6, 5, 0.27);
    box(g, [1.65, 0.55, 0.13], [1, 0.75, 0.52], 0x99f6e4);
    box(g, [1.92, 0.12, 0.06], [0.88, 0.93, 0.61], 0x182d44);
    for (let tick = 0; tick < 9; tick++) box(g, [0.025, 0.12, 0.035], [0.1 + tick * 0.2, 0.93, 0.65], cream);
    const a = cyl(g, 0.035, 3.3, [1.85, 2.15, 0], cream);
    a.rotation.z = -0.45;
    [0.3, 0.85, 1.4].forEach((x) => {
      const knob = cyl(g, 0.17, 0.14, [x, -1.25, 0.53], cream);
      knob.rotation.x = Math.PI / 2;
      box(g, [0.03, 0.13, 0.03], [x, -1.17, 0.64], red);
    });
    [-2.2, 2.2].forEach((x) => [-1.5, 1.5].forEach((y) => screw(g, [x, y, 0.52])));
  }
  if (type === "camera") {
    box(g, [5.5, 3, 1.2], [0, 0, 0], 0x2d3d50);
    box(g, [5.22, 2.72, 0.12], [0, 0, 0.64], 0x17243a);
    face(g, type, 5.1, 2.6, 0.62);
    const l = cyl(g, 1.18, 0.78, [0, -0.1, 0.92], dark);
    l.rotation.x = Math.PI / 2;
    const r = cyl(g, 0.72, 0.8, [0, -0.1, 1.3], cream);
    r.rotation.x = Math.PI / 2;
    const glass = cyl(g, 0.52, 0.08, [0, -0.1, 1.72], 0x172f45);
    glass.rotation.x = Math.PI / 2;
    box(g, [0.9, 0.52, 0.14], [-1.7, 0.65, 0.7], cream);
    box(g, [1.1, 0.42, 0.65], [1.55, 1.72, 0], cream);
    const shutter = cyl(g, 0.18, 0.13, [1.45, 1.55, 0.45], red);
    shutter.rotation.x = Math.PI / 2;
    const focusRing = cyl(g, 0.92, 0.16, [0, -0.1, 1.45], 0x8393a8);
    focusRing.rotation.x = Math.PI / 2;
    for (let groove = 0; groove < 12; groove++) {
      const ridge = box(g, [0.06, 0.18, 0.05], [0, -0.1, 1.57], 0xd5b67a);
      ridge.rotation.z = (Math.PI * 2 * groove) / 12;
    }
    box(g, [1.72, 0.08, 0.05], [-1.25, -1.05, 0.7], 0x0f1a2c);
    screw(g, [-2.3, 1.15, 0.72]);
    screw(g, [2.3, -1.15, 0.72]);
  }
  if (type === "pager") {
    box(g, [3.8, 5.3, 0.7], [0, 0, 0], 0x36465a);
    box(g, [3.58, 5.08, 0.1], [0, 0, 0.39], 0x202f47);
    face(g, type, 3.45, 4.95, 0.37);
    box(g, [2.5, 1.3, 0.13], [0, 1.1, 0.48], 0xa7f3d0);
    for (let y = 0; y < 3; y++)
      for (let x = 0; x < 3; x++) {
        const b = cyl(
          g,
          0.16,
          0.1,
          [-0.55 + x * 0.55, -0.45 + y * 0.55, 0.5],
          cream,
        );
        b.rotation.x = Math.PI / 2;
      }
    box(g, [1.4, 0.3, 0.35], [0, 2.85, 0], dark);
    grill(g, [-0.9, 2.15, 0.5], 7, 1, 0.22);
    box(g, [0.32, 0.42, 0.11], [1.35, -1.75, 0.5], cream);
    [-1.55, 1.55].forEach((x) => [-2.3, 2.3].forEach((y) => screw(g, [x, y, 0.48])));
  }
}
function scene(
  el: HTMLElement,
  r: DeviceRepairRun,
  w: RepairWord,
  k: string,
  done: (ok: boolean) => void,
  progress: () => void,
) {
  const s = new THREE.Scene();
  s.background = new THREE.Color("#07152b");
  const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  cam.position.set(0, 1.8, 9.2);
  const ren = new THREE.WebGLRenderer({ antialias: true });
  ren.setPixelRatio(Math.min(devicePixelRatio, 2));
  el.append(ren.domElement);
  s.add(new THREE.HemisphereLight(0xdbeafe, 0x07111f, 2.4));
  const light = new THREE.DirectionalLight(0xffffff, 2.2);
  light.position.set(4, 6, 5);
  s.add(light);
  const g = new THREE.Group();
  g.rotation.x = -0.25;
  s.add(g);
  body(r.device, g);
  const hits: { m: THREE.Object3D; f: () => void }[] = [],
    stage = r.solvedFaultIds.length,
    base = stage * 2,
    step = r.diagnosticStep ?? 0;
  const ledMaterial = new THREE.MeshStandardMaterial({
    color: 0x3f1118,
    emissive: 0x120005,
  });
  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 16, 12),
    ledMaterial,
  );
  led.position.set(2.2, 1.15, 0.75);
  g.add(led);
  const glow = (object: THREE.Object3D, on: boolean) =>
    object.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const materials = Array.isArray(node.material)
        ? node.material
        : [node.material];
      materials.forEach((material) => {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.emissive.setHex(on ? 0x3b93ff : 0x000000);
          material.emissiveIntensity = on ? 0.7 : 0;
        }
      });
    });
  const strike = () => {
    ledMaterial.color.setHex(0xff2538);
    ledMaterial.emissive.setHex(0xaa0015);
    ledMaterial.emissiveIntensity = 2;
    tactileSound("strike");
    window.setTimeout(() => {
      ledMaterial.color.setHex(0x3f1118);
      ledMaterial.emissive.setHex(0x120005);
      ledMaterial.emissiveIntensity = 1;
      ren.render(s, cam);
    }, 360);
  };
  const add = (m: THREE.Object3D, f: () => void) => hits.push({ m, f });
  const testStart = () => {
    const test = cyl(g, 0.32, 0.18, [2.05, -1.15, 0.82], 0x4ade80);
    test.rotation.x = Math.PI / 2;
    tag(g, "START", [2.05, -1.15, 1.02]);
    add(test, () => {
      tactileSound("snap");
      ledMaterial.color.setHex(0x42f57b);
      ledMaterial.emissive.setHex(0x1ecb5b);
      ledMaterial.emissiveIntensity = 2;
      done(true);
    });
  };
  const activeModule = nextRepairModule(r);
  const final = !activeModule;
  let draggablePart: THREE.Object3D | null = null;
  let dragSlot: THREE.Object3D | null = null;
  let draggingPart = false;
  let finishDrag: (() => void) | null = null;
  let dragOrigin: THREE.Vector3 | null = null;
  if (activeModule) {
    const choices = shuffled([
      w,
      ...r.knownWords.filter((item) => item.id !== w.id),
    ]).slice(0, 3);
    const complete = (mesh: THREE.Object3D) => {
      tactileSound(activeModule.interaction === "dial" ? "click" : "snap");
      glow(mesh, true);
      window.setTimeout(() => done(true), 280);
    };
    const codeControl = (item: RepairWord, index: number, shape: "button" | "switch" = "button") => {
      const mesh = shape === "switch"
        ? box(g, [0.78, 0.28, 0.24], [-1.35 + index * 1.35, -1.18, 0.82], index === 1 ? 0x4ade80 : 0x71839a)
        : cyl(g, 0.34, 0.2, [-1.35 + index * 1.35, -1.18, 0.82], index === 1 ? 0x4ade80 : 0x71839a);
      if (shape === "button") mesh.rotation.x = Math.PI / 2;
      tag(g, item.word, [-1.35 + index * 1.35, -0.75, 1.05]);
      add(mesh, () => item.id === w.id ? complete(mesh) : (strike(), done(false)));
    };
    if (activeModule.interaction === "drag") {
      const part = box(g, [1.2, 0.7, 0.35], [-1.55, -1.05, 0.86], 0xe8d6a0);
      const slot = box(g, [1.35, 0.82, 0.16], [1.5, -1.05, 0.7], 0x263a55);
      tag(g, w.word, [-1.55, -1.56, 1.05]);
      tag(g, "INSERT", [1.5, -1.56, 0.92]);
      draggablePart = part;
      dragSlot = slot;
      dragOrigin = part.position.clone();
      finishDrag = () => { part.position.copy(slot.position).add(new THREE.Vector3(0, 0, 0.24)); complete(slot); };
      add(part, () => undefined);
      add(slot, () => { if (!draggingPart) { strike(); done(false); } });
    } else if (activeModule.interaction === "dial") {
      const dial = cyl(g, 0.82, 0.26, [0, -1.08, 0.82], 0xf4c869);
      dial.rotation.x = Math.PI / 2;
      choices.forEach((item, index) => tag(g, item.word, [-1.35 + index * 1.35, -0.35, 1.06]));
      const target = choices.findIndex((item) => item.id === w.id);
      add(dial, () => {
        const value = ((r.interactionValues[stage] ?? 0) + 1) % choices.length;
        r.interactionValues[stage] = value;
        dial.rotation.z += (Math.PI * 2) / choices.length;
        host()?.saveRun(r);
        if (value === target) complete(dial); else ren.render(s, cam);
      });
    } else if (activeModule.interaction === "sequence") {
      const ordered = [w, ...r.knownWords.filter((item) => item.id !== w.id)].slice(0, 3);
      const entered = r.interactionValues[stage] ?? 0;
      choices.forEach((item, index) => {
        const mesh = box(g, [0.86, 0.52, 0.22], [-1.35 + index * 1.35, -1.12, 0.82], 0x71839a);
        tag(g, item.word, [-1.35 + index * 1.35, -0.7, 1.04]);
        add(mesh, () => {
          if (item.id !== ordered[entered]!.id) { r.interactionValues[stage] = 0; host()?.saveRun(r); strike(); done(false); return; }
          r.interactionValues[stage] = entered + 1;
          host()?.saveRun(r);
          if (entered + 1 === ordered.length) complete(mesh); else { tactileSound("click"); document.querySelector("#deviceRepairFeedback")!.textContent = `Code ${entered + 1}/3 accepted — continue the Japanese sequence.`; }
        });
      });
    } else {
      choices.forEach((item, index) => codeControl(item, index, activeModule.interaction === "switch" ? "switch" : "button"));
    }
  } else if (final) {
    testStart();
  } else if (r.device === "cassette") {
    if (final) {
      testStart();
    } else {
      const controls: Record<string, { mesh: THREE.Object3D; label: [number, number, number] }> = {
        "cassette-door": {
          mesh: box(g, [3.65, 1.85, 0.12], [0, -0.08, 0.8], 0x263a55),
          label: [0, -1.24, 1.02],
        },
        "play-button": {
          mesh: box(g, [0.62, 0.4, 0.25], [-1.7, 1.75, 0.35], 0x4ade80),
          label: [-1.7, 1.3, 0.76],
        },
        "volume-dial": {
          mesh: cyl(g, 0.43, 0.26, [-2.05, -1.07, 0.82], 0xf4c869),
          label: [-2.05, -1.52, 1.02],
        },
      };
      (controls["volume-dial"]!.mesh as THREE.Mesh).rotation.x = Math.PI / 2;
      r.serviceTags.forEach((serviceTag) => {
        const control = controls[serviceTag.component];
        if (!control) return;
        tag(g, serviceTag.word, control.label);
        add(control.mesh, () => {
          if (serviceTag.wordId !== w.id) {
            strike();
            done(false);
            return;
          }
          tactileSound(serviceTag.component === "volume-dial" ? "click" : "snap");
          if (serviceTag.component === "cassette-door") control.mesh.rotation.x = -0.82;
          if (serviceTag.component === "play-button") {
            control.mesh.scale.z = 0.45;
            g.getObjectsByProperty("name", "cassette-reel").forEach((reel) => {
              reel.rotation.z += Math.PI * 5;
            });
          }
          if (serviceTag.component === "volume-dial") control.mesh.rotation.z += Math.PI / 2;
          glow(control.mesh, true);
          window.setTimeout(() => done(true), 280);
        });
      });
    }
  } else if (k === "part") {
    const cs = shuffled([
      w,
      ...shuffled(r.knownWords.filter((x) => x.id !== w.id)).slice(0, 2),
    ]);
    if (step === 0)
      cs.forEach((x, i) => {
        const m = box(
          g,
          [1.15, 0.28, 0.72],
          [-1.5 + i * 1.5, -1.15, 0.82],
          i ? 0x71839a : 0x4f6d96,
        );
        tag(g, x.word, [-1.5 + i * 1.5, -1.15, 1.2]);
        add(m, () => {
          if (x.id === w.id) {
            tactileSound("click");
            progress();
          } else {
            strike();
            done(false);
          }
        });
      });
    else testStart();
  } else if (k === "tape") {
    if (step === 0) {
      const tape = box(g, [3.3, 1.8, 0.42], [0, -0.5, 0.82], 0x4f3150);
      [-0.9, 0.9].forEach((x) => {
        const reel = cyl(g, 0.38, 0.12, [x, -0.5, 1.08], 0xe8d6a0);
        reel.rotation.x = Math.PI / 2;
      });
      tag(g, w.word, [0, -1.05, 1.08]);
      add(tape, () => {
        tactileSound("snap");
        progress();
      });
    } else if (step === 1) {
      const play = box(g, [1.25, 0.5, 0.28], [0, -1.15, 0.85], 0x4ade80);
      tag(g, "▶ PLAY", [0, -1.15, 1.02]);
      add(play, () => {
        playDiagnostic(w);
        window.setTimeout(progress, 420);
      });
    } else testStart();
  } else if (k === "battery") {
    const goals = [
      hash(`${r.seed}:${stage}:a`) % 2,
      hash(`${r.seed}:${stage}:b`) % 2,
    ];
    const hatch = new THREE.Group();
    hatch.position.set(-1.62, 0.1, 0.62);
    const door = box(hatch, [3.2, 1.8, 0.14], [1.62, 0, 0], 0x263a55);
    tag(hatch, "＋        －", [1.62, 0.48, 0.1]);
    if (step === 1 || step === 2) {
      hatch.rotation.y = -1.1;
      hatch.position.x -= 0.18;
    }
    g.add(hatch);
    if (step === 0 || step === 2)
      add(door, () => {
        tactileSound("snap");
        progress();
      });
    if (step === 1)
      [-1.1, 1.1].forEach((x, i) => {
        const v = r.interactionValues[base + i] ?? 0,
          m = cyl(g, 0.3, 1.75, [x, -1.1, 0.85], v ? 0xf87171 : 0xfacc15);
        m.rotation.z = v ? Math.PI / 2 : -Math.PI / 2;
        tag(g, v ? "＋" : "－", [x, -0.75, 1.2]);
        add(m, () => {
          r.interactionValues[base + i] = v ? 0 : 1;
          host()?.saveRun(r);
          if (
            (r.interactionValues[base] ?? 0) === goals[0] &&
            (r.interactionValues[base + 1] ?? 0) === goals[1]
          ) {
            tactileSound("snap");
            progress();
          } else draw();
        });
      });
    if (step === 3) testStart();
  } else {
    const goal = hash(`${r.seed}:${stage}:dial`) % 3,
      v = r.interactionValues[base] ?? 0,
      d = cyl(g, 0.75, 0.34, [0, -1.05, 0.86], 0xf4c869);
    d.rotation.x = Math.PI / 2;
    ["一", "二", "三"].forEach((x, i) =>
      tag(g, x, [-1.15 + i * 1.15, -0.45, 1.2]),
    );
    if (step === 0)
      add(d, () => {
        r.interactionValues[base] = (v + 1) % 3;
        host()?.saveRun(r);
        if (r.interactionValues[base] === goal) {
          tactileSound("snap");
          progress();
        } else draw();
      });
    else testStart();
  }
  const ray = new THREE.Raycaster(),
    p = new THREE.Vector2();
  let drag = false,
    lastX = 0,
    lastY = 0,
    moved = false,
    rot = 0.25,
    tilt = -0.25,
    hovered: THREE.Object3D | null = null;
  const targetAt = (e: PointerEvent) => {
    const q = ren.domElement.getBoundingClientRect();
    p.set(
      ((e.clientX - q.left) / q.width) * 2 - 1,
      (-(e.clientY - q.top) / q.height) * 2 + 1,
    );
    ray.setFromCamera(p, cam);
    return hits.find((h) => ray.intersectObject(h.m, true).length) ?? null;
  };
  const setHover = (target: { m: THREE.Object3D } | null) => {
    if (hovered === target?.m) return;
    if (hovered) glow(hovered, false);
    hovered = target?.m ?? null;
    if (hovered) glow(hovered, true);
    ren.domElement.style.cursor = hovered ? "pointer" : "grab";
    ren.render(s, cam);
  };
  const size = () => {
    const w = Math.max(el.clientWidth, 1),
      h = Math.max(el.clientHeight, 380);
    ren.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    ren.render(s, cam);
  };
  const down = (e: PointerEvent) => {
      const target = targetAt(e);
      if (draggablePart && target?.m === draggablePart) {
        draggingPart = true;
        lastX = e.clientX;
        lastY = e.clientY;
        ren.domElement.setPointerCapture(e.pointerId);
        tactileSound("click");
        document.querySelector("#deviceRepairFeedback")!.textContent = `Holding 「${w.word}」— drag it into the illuminated guide.`;
        return;
      }
      drag = true;
      moved = false;
      lastX = e.clientX;
      lastY = e.clientY;
      ren.domElement.setPointerCapture(e.pointerId);
    },
    move = (e: PointerEvent) => {
      if (draggingPart && draggablePart) {
        draggablePart.position.x += (e.clientX - lastX) * 0.012;
        draggablePart.position.y -= (e.clientY - lastY) * 0.012;
        lastX = e.clientX;
        lastY = e.clientY;
        ren.render(s, cam);
        return;
      }
      if (!drag) {
        setHover(targetAt(e));
        return;
      }
      const deltaX = e.clientX - lastX,
        deltaY = e.clientY - lastY;
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) moved = true;
      rot += deltaX * 0.012;
      tilt = THREE.MathUtils.clamp(tilt + deltaY * 0.009, -0.85, 0.5);
      g.rotation.y = rot;
      g.rotation.x = tilt;
      lastX = e.clientX;
      lastY = e.clientY;
      ren.render(s, cam);
    },
    up = (e: PointerEvent) => {
      if (draggingPart && draggablePart && dragSlot) {
        draggingPart = false;
        const closeEnough = draggablePart.position.distanceTo(dragSlot.position) < 1.35;
        if (closeEnough) finishDrag?.();
        else {
          draggablePart.position.copy(dragOrigin!);
          strike();
          done(false);
        }
        return;
      }
      if (!drag) return;
      drag = false;
      if (moved) return;
      targetAt(e)?.f();
    };
  ren.domElement.addEventListener("pointerdown", down);
  ren.domElement.addEventListener("pointermove", move);
  ren.domElement.addEventListener("pointerup", up);
  const ob = new ResizeObserver(size);
  ob.observe(el);
  size();
  clean = () => {
    ob.disconnect();
    s.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (material instanceof THREE.Material) {
          const map = (material as THREE.MeshStandardMaterial).map;
          if (map && ![...panelTextures.values()].some((texture) => texture === map)) map.dispose();
          material.dispose();
        }
      });
    });
    ren.dispose();
    el.replaceChildren();
  };
}
export function launchDeviceRepair() {
  host()?.show("deviceRepair");
  setup();
}
