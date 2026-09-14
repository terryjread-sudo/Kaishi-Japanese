import * as THREE from "three";
import "./device-repair.css";
import "./device-repair-mobile.css";
import {
  DEVICE_LABELS,
  canRevealNewWord,
  createRepairRun,
  nextFault,
  repairScore,
  type DeviceKind,
  type DeviceRepairRun,
  type RepairFault,
  type RepairSkill,
  type RepairTrack,
  type RepairWord,
} from "../domains/device-repair/run";

type Word = RepairWord & { introduced: boolean; due: boolean };
type Host = {
  show(id: string): void;
  words(): Word[];
  grade(id: string, s: RepairSkill, ok: boolean): void;
  introduce(id: string): void;
  saveRun(r: DeviceRepairRun): void;
  finishRun(r: DeviceRepairRun, ok: boolean, score: number): void;
  loadRun(): DeviceRepairRun | null;
};
let run: DeviceRepairRun | null = null,
  timer: number | null = null,
  clean: (() => void) | null = null;
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
  r.innerHTML = `<main class="device-repair-shell"><header class="device-repair-top"><button data-back>← Games</button><div><span class="eyebrow">Device Repair bench</span><h2>Repair it with Japanese</h2></div></header><section class="device-repair-intro"><div><span class="device-repair-icon">🔧</span><h3>The device and manual work together.</h3><p>Read Japanese repair instructions, inspect labels printed on the 3D device, then physically operate the correct component.</p></div><div class="device-repair-track">${saved ? '<button class="primary" data-resume>Resume repair</button>' : ""}<button class="primary" data-track="review">Learn &amp; Review</button><button data-track="japan-ready">Japan Ready</button></div></section></main>`;
  r.querySelector("[data-back]")?.addEventListener("click", () =>
    host()?.show("gameHub"),
  );
  r.querySelector("[data-resume]")?.addEventListener("click", () => {
    run = saved ?? null;
    draw();
  });
  r.querySelectorAll<HTMLButtonElement>("[data-track]").forEach(
    (b) =>
      (b.onclick = () =>
        void begin(
          b.dataset.track === "japan-ready" ? "japan-ready" : "review",
        )),
  );
}
async function begin(track: RepairTrack) {
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
  });
  host()?.saveRun(run);
  draw();
}
function kind(f: RepairFault | null) {
  return ["battery", "cell", "contacts", "film", "spool"].includes(f?.id ?? "")
    ? "battery"
    : ["controls", "equalizer", "tuner", "flash", "acknowledge"].includes(
          f?.id ?? "",
        )
      ? "dial"
      : "part";
}
function manual(
  w: RepairWord,
  f: RepairFault | null,
  k: string,
  final: boolean,
) {
  const ask =
    f?.skill === "reading"
      ? `「${esc(w.reading)}」と読むラベルを探す。`
      : f?.skill === "listening"
        ? "音声を聞いて、同じ日本語ラベルを探す。"
        : `「${esc(w.meaning)}」を表す日本語ラベルを探す。`;
  const act =
    k === "battery"
      ? "電池をタップして、＋と－の向きを直す。"
      : k === "dial"
        ? "ダイヤルをタップして、正しい目盛りに合わせる。"
        : "本体に印刷された部品をタップする。";
  return `<aside class="repair-manual"><b>サービスマニュアル · ${final ? "FINAL" : "REPAIR"}</b><h3>${final ? "最後の起動手順" : "修理指示"}</h3><p lang="ja">${ask}</p><p lang="ja">${act}</p><hr><strong>Target: <span lang="ja">${esc(w.word)}</span> · ${esc(w.reading)}</strong><small>${final ? `New word: ${esc(w.meaning)}` : "The Japanese on the physical device is part of the solution."}</small></aside>`;
}
function draw() {
  const r = run,
    t = root(),
    h = host();
  if (!r || !t || !h) return;
  clean?.();
  const f = nextFault(r),
    stage = r.solvedFaultIds.length,
    w = f ? r.knownWords[stage]! : r.newWord,
    k = kind(f),
    final = !f;
  t.innerHTML = `<main class="device-repair-shell"><header class="device-repair-top"><button data-quit>Quit repair</button><div><span class="eyebrow">${esc(DEVICE_LABELS[r.device])}</span><h2>${final ? "Power-on repair" : esc(f!.title)}</h2></div><strong id="deviceRepairTimer">10:00</strong></header><section class="device-repair-workbench"><div><div class="device-repair-canvas" id="deviceRepairCanvas"></div><p class="device-repair-gesture">Drag in any direction to inspect · tap a labelled physical part</p></div><section class="device-repair-instructions">${manual(w, f, k, final)}${f?.skill === "listening" || final ? '<button class="audio" data-audio>🔊 Play device audio</button>' : ""}<div class="device-repair-progress">${r.faults.map((x, i) => `<span class="${r.solvedFaultIds.includes(x.id) ? "done" : i === stage ? "current" : ""}">${i + 1}</span>`).join("")}<i></i><span class="${r.revealedNewWord ? "done" : ""}">新</span></div><button class="hint" data-hint>Translated hint</button><p id="deviceRepairFeedback">Inspect the model and use the Japanese service manual.</p></section></section></main>`;
  try {
    scene(
      document.querySelector<HTMLElement>("#deviceRepairCanvas")!,
      r,
      w,
      k,
      (ok) => operate(ok, w, f?.skill ?? "meaning"),
    );
  } catch {
    document.querySelector("#deviceRepairCanvas")!.textContent =
      "WebGL device view unavailable.";
  }
  t.querySelector("[data-quit]")?.addEventListener("click", () =>
    finish(false),
  );
  t.querySelector("[data-audio]")?.addEventListener("click", () => speak(w));
  t.querySelector("[data-hint]")?.addEventListener("click", () => {
    r.hintsUsed++;
    h.saveRun(r);
    document.querySelector("#deviceRepairFeedback")!.textContent =
      `Hint: operate the part labelled ${w.word} (${w.meaning}).`;
  });
  if (f?.skill === "listening" || final) speak(w);
  clock();
}
function operate(ok: boolean, w: RepairWord, s: RepairSkill) {
  const r = run;
  if (!r) return;
  host()?.grade(w.id, s, ok);
  if (!ok) {
    document.querySelector("#deviceRepairFeedback")!.textContent =
      "That is not the matching part. Read the Japanese label and manual again.";
    return;
  }
  const f = nextFault(r);
  if (f) {
    r.solvedFaultIds.push(f.id);
    if (canRevealNewWord(r)) {
      r.revealedNewWord = true;
      host()?.introduce(r.newWord.id);
    }
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
  clean?.();
  clean = null;
  const r = run,
    t = root();
  if (!r || !t) return;
  if (!r.completed) host()?.finishRun(r, false, 0);
  t.innerHTML = `<main class="device-repair-shell device-repair-result"><span class="device-repair-icon">${ok ? "✨" : "⏱️"}</span><h2>${ok ? "Device restored" : "Repair timed out"}</h2><p>${ok ? `You physically repaired it and learned ${esc(r.newWord.word)} — ${esc(r.newWord.meaning)}.` : "Your correct Japanese practice was saved."}</p><button class="primary" data-again>Another device</button><button data-back>Games</button></main>`;
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
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d, 24), mat(c));
  m.position.set(...p);
  g.add(m);
  return m;
}
function tag(g: THREE.Group, text: string, p: [number, number, number]) {
  const c = document.createElement("canvas");
  c.width = 400;
  c.height = 100;
  const x = c.getContext("2d")!;
  x.fillStyle = "#fff4cf";
  x.fillRect(0, 0, 400, 100);
  x.fillStyle = "#17233e";
  x.font = "700 42px sans-serif";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText(text, 200, 50);
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c) }),
  );
  s.position.set(...p);
  s.scale.set(1.45, 0.36, 1);
  g.add(s);
}
function body(type: DeviceKind, g: THREE.Group) {
  const dark = 0x16243a,
    steel = 0x71839a,
    cream = 0xe8d6a0,
    red = 0xc9414c;
  if (type === "handheld") {
    box(g, [5.5, 3.5, 0.7], [0, 0, 0], steel);
    face(g, type, 5.15, 3.15, 0.37);
    box(g, [2.45, 1.45, 0.15], [0.65, 0.3, 0.48], dark);
    box(g, [0.9, 0.9, 0.14], [-1.55, 0.25, 0.49], dark);
    [-0.35, 0.35].forEach((x) => {
      const m = cyl(g, 0.24, 0.15, [1.4 + x, -0.65, 0.5], red);
      m.rotation.x = Math.PI / 2;
    });
    box(g, [2.2, 0.42, 0.55], [0, 1.92, 0], cream);
    [-2.2, 2.2].forEach((x) => box(g, [0.6, 0.22, 0.3], [x, 1.58, 0], dark));
  }
  if (type === "cassette") {
    box(g, [5.4, 3.35, 0.7], [0, 0, 0], 0x48576b);
    face(g, type, 5.05, 3, 0.37);
    box(g, [3.5, 1.7, 0.14], [0, 0, 0.48], dark);
    [-0.9, 0.9].forEach((x) => {
      const m = cyl(g, 0.56, 0.18, [x, 0, 0.5], cream);
      m.rotation.x = Math.PI / 2;
    });
    [0, 0.65, 1.3].forEach((x) =>
      box(g, [0.44, 0.34, 0.18], [-1.5 + x, 1.75, 0], steel),
    );
    [-2.2, 2.2].forEach((x) =>
      [-1.25, 1.25].forEach((y) => {
        const screw = cyl(g, 0.1, 0.08, [x, y, 0.48], cream);
        screw.rotation.x = Math.PI / 2;
      }),
    );
  }
  if (type === "radio") {
    box(g, [5, 3.7, 0.85], [0, 0, 0], steel);
    face(g, type, 4.65, 3.35, 0.45);
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 5; x++) {
        const m = cyl(
          g,
          0.06,
          0.1,
          [-1.35 + x * 0.32, -0.7 + y * 0.42, 0.51],
          dark,
        );
        m.rotation.x = Math.PI / 2;
      }
    box(g, [1.65, 0.55, 0.13], [1, 0.75, 0.52], 0x99f6e4);
    const a = cyl(g, 0.035, 3.3, [1.85, 2.15, 0], cream);
    a.rotation.z = -0.45;
    [0.3, 0.85, 1.4].forEach((x) => {
      const knob = cyl(g, 0.17, 0.14, [x, -1.25, 0.53], cream);
      knob.rotation.x = Math.PI / 2;
    });
  }
  if (type === "camera") {
    box(g, [5.5, 3, 1.2], [0, 0, 0], 0x2d3d50);
    face(g, type, 5.1, 2.6, 0.62);
    const l = cyl(g, 1.12, 0.75, [0, -0.1, 0.92], dark);
    l.rotation.x = Math.PI / 2;
    const r = cyl(g, 0.72, 0.8, [0, -0.1, 1.3], cream);
    r.rotation.x = Math.PI / 2;
    const glass = cyl(g, 0.52, 0.08, [0, -0.1, 1.72], 0x172f45);
    glass.rotation.x = Math.PI / 2;
    box(g, [0.9, 0.52, 0.14], [-1.7, 0.65, 0.7], cream);
    box(g, [1.1, 0.42, 0.65], [1.55, 1.72, 0], cream);
    const shutter = cyl(g, 0.18, 0.13, [1.45, 1.55, 0.45], red);
    shutter.rotation.x = Math.PI / 2;
  }
  if (type === "pager") {
    box(g, [3.8, 5.3, 0.7], [0, 0, 0], 0x36465a);
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
  }
}
function scene(
  el: HTMLElement,
  r: DeviceRepairRun,
  w: RepairWord,
  k: string,
  done: (ok: boolean) => void,
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
    base = stage * 2;
  const add = (m: THREE.Object3D, f: () => void) => hits.push({ m, f });
  if (k === "part") {
    const cs = shuffled([
      w,
      ...shuffled(r.knownWords.filter((x) => x.id !== w.id)).slice(0, 2),
    ]);
    cs.forEach((x, i) => {
      const m = box(
        g,
        [1.15, 0.28, 0.72],
        [-1.5 + i * 1.5, -1.15, 0.82],
        i ? 0x71839a : 0x4f6d96,
      );
      tag(g, x.word, [-1.5 + i * 1.5, -0.95, 1.2]);
      add(m, () => done(x.id === w.id));
    });
  } else if (k === "battery") {
    const goals = [hash(w.id) % 2, hash(w.id + "b") % 2];
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
        )
          done(true);
        else draw();
      });
    });
  } else {
    const goal = hash(w.id) % 3,
      v = r.interactionValues[base] ?? 0,
      d = cyl(g, 0.75, 0.34, [0, -1.05, 0.86], 0xf4c869);
    d.rotation.x = Math.PI / 2;
    ["一", "二", "三"].forEach((x, i) =>
      tag(g, x, [-1.15 + i * 1.15, -0.45, 1.2]),
    );
    add(d, () => {
      r.interactionValues[base] = (v + 1) % 3;
      host()?.saveRun(r);
      if (r.interactionValues[base] === goal) done(true);
      else draw();
    });
  }
  const ray = new THREE.Raycaster(),
    p = new THREE.Vector2();
  let drag = false,
    lastX = 0,
    lastY = 0,
    moved = false,
    rot = 0.25,
    tilt = -0.25;
  const size = () => {
    const w = Math.max(el.clientWidth, 1),
      h = Math.max(el.clientHeight, 380);
    ren.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    ren.render(s, cam);
  };
  const down = (e: PointerEvent) => {
      drag = true;
      moved = false;
      lastX = e.clientX;
      lastY = e.clientY;
      ren.domElement.setPointerCapture(e.pointerId);
    },
    move = (e: PointerEvent) => {
      if (!drag) return;
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
      if (!drag) return;
      drag = false;
      if (moved) return;
      const q = ren.domElement.getBoundingClientRect();
      p.set(
        ((e.clientX - q.left) / q.width) * 2 - 1,
        (-(e.clientY - q.top) / q.height) * 2 + 1,
      );
      ray.setFromCamera(p, cam);
      hits.find((h) => ray.intersectObject(h.m, true).length)?.f();
    };
  ren.domElement.addEventListener("pointerdown", down);
  ren.domElement.addEventListener("pointermove", move);
  ren.domElement.addEventListener("pointerup", up);
  const ob = new ResizeObserver(size);
  ob.observe(el);
  size();
  clean = () => {
    ob.disconnect();
    ren.dispose();
    el.replaceChildren();
  };
}
export function launchDeviceRepair() {
  host()?.show("deviceRepair");
  setup();
}
