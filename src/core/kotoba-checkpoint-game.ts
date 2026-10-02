import Phaser from 'phaser';
import type { SignalCase, SignalEvidenceStatus, SignalRun, SignalShift, SignalVerdict, SignalVerificationAction } from '../domains/kotoba-checkpoint/types';

export interface SignalDeskSnapshot {
  run: SignalRun;
  shift: SignalShift;
  active?: SignalCase;
  openTokenIndex: number | null;
  dictionaryRevealed: boolean;
  notice?: string;
}

export interface SignalDeskController {
  snapshot(): SignalDeskSnapshot;
  subscribe(listener: () => void): () => void;
  start(): void;
  exit(): void;
  pause(): void;
  selectCase(id: string): void;
  inspectToken(index: number): void;
  revealDictionary(): void;
  pinEvidence(fact: string): void;
  setEvidenceStatus(fact: string, status: SignalEvidenceStatus): void;
  verify(action: SignalVerificationAction): void;
  setConfidence(value: 'uncertain' | 'fair' | 'confident'): void;
  file(verdict: SignalVerdict): void;
  continue(): void;
  next(): void;
  operate(action: 'monitor' | 'verify' | 'dispatch'): void;
  speak(text: string, rate?: number): void;
  specialise(value: 'linguist' | 'listener' | 'field' | 'cryptographer'): void;
  equip(tool: string): void;
  toggleTimer(): void;
  inspectMap(): void;
}

const W = 1440;
const H = 900;
const C = { ink: 0x211a16, paper: 0xeadbb8, paperLight: 0xfff5d8, brass: 0xd8a44d, red: 0x8f302c, green: 0x285543, cream: '#fff1cf', muted: '#c8b99d', black: 0x090b0e };

class SignalDeskScene extends Phaser.Scene {
  private unsubscribe?: () => void;
  private dragFile?: Phaser.GameObjects.Container;
  private standardZone = new Phaser.Geom.Rectangle(540, 740, 360, 120);
  private escalateZone = new Phaser.Geom.Rectangle(920, 740, 360, 120);

  constructor(private readonly controller: SignalDeskController) { super('signal-desk'); }

  preload(): void {
    this.load.image('office-dusk', 'media/kotoba-checkpoint/signal-office-dusk.webp');
    this.load.image('office-night', 'media/kotoba-checkpoint/signal-office-night.webp');
    this.load.image('mori', 'media/kotoba-checkpoint/director-mori.png');
    this.load.image('kuroda', 'media/kotoba-checkpoint/agent-kuroda.webp');
    this.load.image('crane', 'media/kotoba-checkpoint/informant-crane.webp');
    this.load.audio('stamp', 'media/kotoba-checkpoint/stamp.wav');
    this.load.audio('file', 'media/kotoba-checkpoint/file-open.wav');
    this.load.audio('pin', 'media/kotoba-checkpoint/evidence-pin.wav');
    this.load.audio('clear', 'media/kotoba-checkpoint/clear.mp3');
    this.load.audio('ready', 'media/kotoba-checkpoint/tray-ready.wav');
    this.load.audio('ambience', 'media/kotoba-checkpoint/terminal-ambience.ogg');
  }

  create(): void {
    this.unsubscribe = this.controller.subscribe(() => this.draw());
    this.input.on('drag', (_pointer: Phaser.Input.Pointer, object: Phaser.GameObjects.GameObject, x: number, y: number) => {
      const target = object as Phaser.GameObjects.Container; target.setPosition(x, y);
    });
    this.input.on('dragend', (_pointer: Phaser.Input.Pointer, object: Phaser.GameObjects.GameObject) => {
      const target = object as Phaser.GameObjects.Container;
      if (target === this.dragFile) {
        if (this.standardZone.contains(target.x, target.y)) this.controller.file('standard');
        else if (this.escalateZone.contains(target.x, target.y)) this.controller.file('escalate');
        else this.draw();
        return;
      }
      const fact = target.getData('evidence') as string | undefined;
      if (fact) this.controller.setEvidenceStatus(fact, target.x < 1100 ? target.x < 965 ? 'confirmed' : 'doubtful' : 'contradiction');
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe?.());
    this.draw();
  }

  private label(x: number, y: number, value: string, size = 18, color = C.cream, style: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.GameObjects.Text {
    return this.add.text(x, y, value, { fontFamily: 'Inter, Arial, sans-serif', fontSize: `${size}px`, color, ...style });
  }

  private panel(x: number, y: number, width: number, height: number, fill = 0x171513, alpha = .94, stroke = C.brass): Phaser.GameObjects.Rectangle {
    return this.add.rectangle(x, y, width, height, fill, alpha).setStrokeStyle(2, stroke, .8);
  }

  private button(x: number, y: number, width: number, height: number, value: string, action: () => void, fill = 0x342b22, color = C.cream): Phaser.GameObjects.Container {
    const box = this.add.rectangle(0, 0, width, height, fill, .98).setStrokeStyle(2, C.brass, .9);
    const text = this.label(0, 0, value, Math.min(20, Math.max(14, height * .26)), color, { fontStyle: 'bold', align: 'center', wordWrap: { width: width - 18 } }).setOrigin(.5);
    const container = this.add.container(x, y, [box, text]).setSize(width, height).setInteractive({ useHandCursor: true });
    container.on('pointerover', () => box.setFillStyle(0x59422c));
    container.on('pointerout', () => box.setFillStyle(fill));
    container.on('pointerdown', action);
    return container;
  }

  private background(night: boolean): void {
    const key = night ? 'office-night' : 'office-dusk';
    if (this.textures.exists(key)) this.add.image(W / 2, H / 2, key).setDisplaySize(W, H).setTint(night ? 0xaab5d1 : 0xffdfb2);
    else this.add.rectangle(W / 2, H / 2, W, H, 0x120f0d);
    this.add.rectangle(W / 2, H / 2, W, H, C.black, .38);
    for (let y = 0; y < H; y += 5) this.add.rectangle(W / 2, y, W, 1, 0xffffff, .018);
  }

  private header(snapshot: SignalDeskSnapshot): void {
    this.panel(W / 2, 44, W - 44, 64, 0x101214, .96);
    this.label(42, 25, 'ことば局  ·  SECTION K', 18, '#e8b85f', { fontStyle: 'bold' });
    this.label(42, 49, `${snapshot.shift.department.toUpperCase()} · SHIFT ${snapshot.shift.sequence}`, 13, C.muted);
    this.label(1050, 25, snapshot.run.career.rank.toUpperCase(), 15, C.cream, { fontStyle: 'bold' });
    this.label(1050, 50, `◎ ${snapshot.run.career.credits}   VERIFY ${snapshot.run.verification}/${snapshot.run.maxVerification}`, 14, '#e8b85f');
    this.button(1310, 44, 84, 38, 'LEAVE', () => this.controller.exit(), 0x3a2822);
  }

  private draw(): void {
    this.children.removeAll(true);
    const snapshot = this.controller.snapshot();
    this.background(snapshot.shift.sequence >= 10);
    this.header(snapshot);
    if (snapshot.run.phase === 'briefing') this.briefing(snapshot);
    else if (snapshot.run.phase === 'report' || snapshot.run.phase === 'failed') this.report(snapshot);
    else this.desk(snapshot);
  }

  private briefing(snapshot: SignalDeskSnapshot): void {
    const { shift, run } = snapshot;
    const portraitKey = shift.story?.portrait || 'mori';
    if (this.textures.exists(portraitKey)) this.add.image(260, 535, portraitKey).setOrigin(.5, 1).setDisplaySize(430, 650);
    this.panel(905, 470, 800, 650, C.paper, .98, 0xb29662);
    this.label(545, 175, `SHIFT ${shift.sequence} · ${shift.department.toUpperCase()}`, 15, '#81322e', { fontStyle: 'bold' });
    this.label(545, 210, shift.title, 48, '#241c17', { fontFamily: 'Georgia, serif', fontStyle: 'bold', wordWrap: { width: 700 } });
    this.label(545, 285, shift.briefing, 21, '#4c4036', { wordWrap: { width: 690 }, lineSpacing: 8 });
    if (shift.story?.text) this.label(545, 370, `“${shift.story.text}”\n— ${shift.story.speaker}`, 18, '#5c302b', { fontFamily: 'Georgia, serif', fontStyle: 'italic', wordWrap: { width: 680 }, lineSpacing: 6 });
    this.add.rectangle(905, 520, 700, 125, 0xfff5d8, .85).setStrokeStyle(3, C.red);
    this.label(580, 475, 'TODAY’S CODEBOOK', 14, '#8f302c', { fontStyle: 'bold' });
    this.label(580, 510, shift.ruleText, 23, '#211a16', { fontStyle: 'bold', wordWrap: { width: 640 } });
    this.label(580, 575, shift.guidance, 16, '#55493e', { wordWrap: { width: 640 } });
    const timing = shift.seconds === null || run.career.timerDisabled ? 'UNTIMED TRAINING' : `${Math.ceil((shift.seconds || 0) / 60)} MINUTE SHIFT`;
    this.label(580, 635, `${shift.cases.length} FILES   ·   ${timing}   ·   ${shift.location}`, 14, '#655748');
    this.label(580, 668, 'SPECIALISATION', 12, '#762d29', { fontStyle: 'bold' });
    (['linguist', 'listener', 'field', 'cryptographer'] as const).forEach((value, index) => this.button(635 + index * 145, 700, 132, 34, value.toUpperCase(), () => this.controller.specialise(value), run.career.specialisation === value ? C.red : 0x5b4b3c));
    const tools = [{ id: 'phrasebook', at: 0 }, { id: 'tape-machine', at: 3 }, { id: 'evidence-lamp', at: 7 }, { id: 'night-map', at: 10 }, { id: 'red-phone', at: 15 }].filter(item => run.career.completedShiftIds.length >= item.at);
    tools.forEach((tool, index) => this.button(625 + index * 155, 744, 145, 32, tool.id.toUpperCase(), () => this.controller.equip(tool.id), run.career.equippedTools.includes(tool.id) ? C.green : 0x5b4b3c));
    this.button(680, 802, 220, 58, 'CLOCK IN  →', () => { this.sound.play('file', { volume: .25 }); this.controller.start(); }, C.red);
    this.button(915, 802, 200, 58, run.career.timerDisabled ? 'ENABLE TIMER' : 'DISABLE TIMER', () => this.controller.toggleTimer());
    this.button(1135, 802, 210, 58, 'RETURN TO JOURNEY', () => this.controller.exit());
  }

  private desk(snapshot: SignalDeskSnapshot): void {
    const { run, shift, active } = snapshot;
    this.queue(snapshot);
    this.codebook(snapshot);
    if (active) this.file(snapshot, active);
    this.evidence(snapshot);
    this.trays(snapshot);
    this.label(36, 82, `QUEUE ${run.queuedCaseIds.length} · INCOMING ${run.unreleasedCaseIds.length} · EXPIRED ${run.expiredCaseIds.length}`, 13, '#e8b85f', { fontStyle: 'bold' });
    if (shift.seconds !== null && !run.career.timerDisabled) this.label(1210, 88, `${run.remaining}s`, 25, run.remaining < 45 ? '#ff7c6b' : C.cream, { fontStyle: 'bold' });
    this.button(1325, 104, 96, 34, run.paused ? 'RESUME' : 'PAUSE', () => this.controller.pause());
    if (run.phase === 'feedback') this.feedback(snapshot);
    if (run.paused) this.pauseOverlay();
    if (snapshot.notice) this.label(720, 708, snapshot.notice, 16, '#ffd576', { align: 'center', wordWrap: { width: 700 } }).setOrigin(.5);
  }

  private queue(snapshot: SignalDeskSnapshot): void {
    this.panel(160, 405, 280, 590);
    this.label(42, 126, 'INCOMING SIGNALS', 15, '#e8b85f', { fontStyle: 'bold' });
    snapshot.run.queuedCaseIds.forEach((id, index) => {
      const item = snapshot.shift.cases.find(candidate => candidate.id === id)!;
      const active = id === snapshot.run.activeCaseId;
      const age = snapshot.run.queueAge[id] || 0;
      this.button(160, 190 + index * 105, 235, 82, `${item.event?.kind === 'priority' ? '☎ PRIORITY' : item.channel.toUpperCase()}\nFILE ${String(snapshot.shift.cases.indexOf(item) + 1).padStart(3, '0')} · ${age}s`, () => this.controller.selectCase(id), active ? C.red : 0x2f2923);
    });
    if (!snapshot.run.queuedCaseIds.length) this.label(65, 185, 'Receiver waiting…', 17, C.muted);
    if (snapshot.run.unreleasedCaseIds.length) this.label(54, 650, `NEXT SIGNAL IN ${snapshot.run.nextArrivalIn}s`, 13, '#dcb366');
  }

  private codebook(snapshot: SignalDeskSnapshot): void {
    const rule = snapshot.active?.event?.ruleText || snapshot.shift.ruleText;
    this.panel(555, 175, 480, 135, 0x211c18);
    this.label(335, 122, snapshot.active?.event?.ruleOverride ? 'EMERGENCY AMENDMENT' : 'ACTIVE CODEBOOK', 14, snapshot.active?.event?.ruleOverride ? '#ff7668' : '#e8b85f', { fontStyle: 'bold' });
    this.label(335, 153, rule, 20, C.cream, { fontStyle: 'bold', wordWrap: { width: 430 } });
    this.button(710, 207, 94, 30, 'SOURCE', () => this.controller.verify('source-check'));
    this.button(603, 207, 105, 30, 'RED PHONE', () => this.controller.verify('director-hint'));
  }

  private file(snapshot: SignalDeskSnapshot, active: SignalCase): void {
    const file = this.add.container(570, 450);
    const paper = this.add.rectangle(0, 0, 500, 390, active.channel === 'intercept' ? 0xd1c5aa : C.paper, 1).setStrokeStyle(3, 0x8f7952);
    file.add(paper);
    file.add(this.label(-225, -170, `${active.channel.toUpperCase()} · ${active.speaker || 'SOURCE CLASSIFIED'}`, 13, '#5e4a38', { fontStyle: 'bold' }));
    file.add(this.label(205, -170, `${String(snapshot.shift.cases.indexOf(active) + 1).padStart(3, '0')} / K`, 13, '#5e4a38', { fontStyle: 'bold' }).setOrigin(1, 0));
    if (active.channel === 'telephone' && !snapshot.run.assisted) {
      file.add(this.label(0, -75, '☎', 72, '#4c3828').setOrigin(.5));
      file.add(this.label(0, 10, 'LISTEN FOR MEANING', 17, '#47392d', { fontStyle: 'bold' }).setOrigin(.5));
      file.add(this.button(0, 75, 220, 48, 'PLAY INTERCEPT', () => { this.controller.speak(active.japanese, .78); }, C.green));
      file.add(this.button(-118, 135, 215, 42, 'SLOW REPLAY · 1', () => this.controller.verify('slow-replay'), 0x5b4b3c));
      file.add(this.button(118, 135, 215, 42, 'SHOW TRANSCRIPT · 1', () => this.controller.verify('translation'), C.red));
    } else {
      const startX = -(active.tokens.length - 1) * 52;
      active.tokens.forEach((token, index) => {
        const inspected = snapshot.run.lookedUpTokens.includes(token.surface);
        const tokenButton = this.button(startX + index * 104, -35, 96, 58, token.surface, () => this.controller.inspectToken(index), inspected ? 0x8a4434 : 0xefe2c2, inspected ? '#fff1cf' : '#201a17');
        file.add(tokenButton);
      });
      if (snapshot.run.readingVisible) file.add(this.label(0, 18, active.reading, 17, '#615344', { align: 'center', wordWrap: { width: 440 } }).setOrigin(.5));
      const token = snapshot.openTokenIndex === null ? undefined : active.tokens[snapshot.openTokenIndex];
      if (token) {
        file.add(this.label(0, 72, snapshot.dictionaryRevealed ? `${token.reading} · ${token.meaning}` : `${token.reading} · recall the meaning`, 19, '#762d29', { fontStyle: 'bold', align: 'center' }).setOrigin(.5));
        if (!snapshot.dictionaryRevealed) file.add(this.button(-75, 126, 185, 40, 'REVEAL · 1', () => this.controller.revealDictionary(), C.red));
        if (token.fact) file.add(this.button(130, 126, 185, 40, snapshot.run.selectedEvidence.includes(token.fact) ? 'UNPIN EVIDENCE' : 'PIN EVIDENCE', () => { this.sound.play('pin', { volume: .25 }); this.controller.pinEvidence(token.fact!); }, C.green));
      }
    }
    file.setSize(500, 390).setInteractive({ useHandCursor: true });
    this.input.setDraggable(file);
    this.dragFile = file;
  }

  private evidence(snapshot: SignalDeskSnapshot): void {
    this.panel(1145, 420, 510, 560, 0x171513);
    this.label(915, 132, 'EVIDENCE WALL', 15, '#e8b85f', { fontStyle: 'bold' });
    this.label(925, 170, 'CONFIRMED', 12, '#8fc6a4', { fontStyle: 'bold' });
    this.label(1055, 170, 'DOUBTFUL', 12, '#e2c47b', { fontStyle: 'bold' });
    this.label(1182, 170, 'CONTRADICTION', 12, '#ef8b80', { fontStyle: 'bold' });
    this.add.line(0, 0, 1035, 190, 1035, 445, 0x6d5a45, .7).setOrigin(0);
    this.add.line(0, 0, 1160, 190, 1160, 445, 0x6d5a45, .7).setOrigin(0);
    const columns: Record<SignalEvidenceStatus, number> = { confirmed: 970, doubtful: 1095, contradiction: 1225 };
    const counts: Record<SignalEvidenceStatus, number> = { confirmed: 0, doubtful: 0, contradiction: 0 };
    snapshot.run.selectedEvidence.forEach(fact => {
      const status = snapshot.run.evidenceStatus?.[fact] || 'confirmed';
      const chip = this.button(columns[status], 225 + counts[status]++ * 58, 112, 44, fact.toUpperCase(), () => undefined, status === 'confirmed' ? C.green : status === 'doubtful' ? 0x715c2b : C.red);
      chip.setData('evidence', fact); this.input.setDraggable(chip);
    });
    this.label(925, 490, 'CONFIDENCE', 13, '#e8b85f', { fontStyle: 'bold' });
    (['uncertain', 'fair', 'confident'] as const).forEach((value, index) => this.button(972 + index * 130, 535, 118, 38, value.toUpperCase(), () => this.controller.setConfidence(value), snapshot.run.confidence === value ? C.red : 0x332b25));
    this.label(925, 588, `THREADS ${Object.keys(snapshot.run.career.investigation.threads).length} · SOURCES ${Object.keys(snapshot.run.career.investigation.sources).length}`, 13, C.muted);
    if (snapshot.run.career.equippedTools.length) this.label(925, 620, `EQUIPPED: ${snapshot.run.career.equippedTools.join(' · ').toUpperCase()}`, 12, '#d8b76c', { wordWrap: { width: 430 } });
    if (snapshot.run.career.equippedTools.includes('night-map')) this.button(1160, 670, 220, 36, 'OPEN NIGHT MAP', () => this.controller.inspectMap(), 0x3e4b4d);
  }

  private trays(snapshot: SignalDeskSnapshot): void {
    const disabled = snapshot.run.phase !== 'decode';
    this.standardZone = new Phaser.Geom.Rectangle(540, 740, 360, 120);
    this.escalateZone = new Phaser.Geom.Rectangle(920, 740, 360, 120);
    this.button(720, 800, 350, 110, '通常\nSTANDARD', () => { if (!disabled) { this.sound.play('stamp', { volume: .35 }); this.controller.file('standard'); } }, C.green);
    this.button(1100, 800, 350, 110, '至急\nESCALATE', () => { if (!disabled) { this.sound.play('stamp', { volume: .35 }); this.controller.file('escalate'); } }, C.red);
    this.label(350, 770, 'DRAG THE ACTIVE FILE\nOR PRESS S / E', 14, C.muted, { align: 'center' }).setOrigin(.5);
  }

  private feedback(snapshot: SignalDeskSnapshot): void {
    const decision = snapshot.run.decisions.at(-1)!;
    const active = snapshot.active;
    this.add.rectangle(W / 2, H / 2, W, H, 0x050505, .78);
    this.panel(W / 2, H / 2, 820, 520, C.paper, 1, decision.correct ? C.green : C.red);
    this.label(350, 230, decision.correct ? 'CORRECT FILING' : decision.expired ? 'SIGNAL EXPIRED' : 'CODEBOOK ERROR', 17, decision.correct ? '#285543' : '#8f302c', { fontStyle: 'bold' });
    this.label(350, 275, decision.correct ? 'Good judgement' : 'Review the decisive evidence', 38, '#211a16', { fontFamily: 'Georgia, serif', fontStyle: 'bold' });
    this.label(350, 340, `${active?.english || ''}\n\n${active?.explanation || ''}`, 19, '#4d4035', { wordWrap: { width: 720 }, lineSpacing: 7 });
    this.label(350, 455, `${decision.quickFiled && decision.correct ? 'QUICK-FILE BONUS · ' : ''}${decision.evidenceCorrect ? 'EVIDENCE SOUND' : 'EVIDENCE INCOMPLETE'}`, 14, '#762d29', { fontStyle: 'bold' });
    (['monitor', 'verify', 'dispatch'] as const).forEach((action, index) => this.button(455 + index * 190, 520, 170, 46, action.toUpperCase(), () => this.controller.operate(action), decision.operationalAction === action ? C.red : 0x554534));
    this.button(W / 2, 635, 300, 60, snapshot.run.queuedCaseIds.length + snapshot.run.unreleasedCaseIds.length > 1 ? 'NEXT SIGNAL →' : 'OPEN REPORT →', () => this.controller.continue(), C.red);
  }

  private pauseOverlay(): void {
    this.add.rectangle(W / 2, H / 2, W, H, 0x050505, .9);
    this.label(W / 2, 385, 'SHIFT PAUSED', 44, C.cream, { fontFamily: 'Georgia, serif', fontStyle: 'bold' }).setOrigin(.5);
    this.label(W / 2, 445, 'The office can wait. Your queue is held safely.', 19, C.muted).setOrigin(.5);
    this.button(W / 2, 530, 250, 60, 'RESUME SHIFT', () => this.controller.pause(), C.red);
  }

  private report(snapshot: SignalDeskSnapshot): void {
    const correct = snapshot.run.decisions.filter(item => item.correct).length;
    const passed = snapshot.run.phase === 'report';
    this.panel(W / 2, 470, 940, 710, C.paper, .99, passed ? C.green : C.red);
    this.label(300, 155, passed ? 'SHIFT CLEARED' : 'TRAINING REASSIGNMENT', 17, passed ? '#285543' : '#8f302c', { fontStyle: 'bold' });
    this.label(300, 205, snapshot.shift.title, 45, '#211a16', { fontFamily: 'Georgia, serif', fontStyle: 'bold' });
    this.label(300, 275, `${correct}/${snapshot.shift.cases.length} filings correct   ·   ${snapshot.run.expiredCaseIds.length} expired   ·   ${snapshot.run.quickFiledCaseIds.length} quick files`, 20, '#514337');
    this.label(300, 330, `CAREER CREDITS  ◎ ${snapshot.run.career.credits}\nRANK  ${snapshot.run.career.rank}\nINVESTIGATION THREADS  ${Object.keys(snapshot.run.career.investigation.threads).length}`, 18, '#6f2d29', { fontStyle: 'bold', lineSpacing: 12 });
    snapshot.run.decisions.slice(0, 6).forEach((decision, index) => {
      const item = snapshot.shift.cases.find(candidate => candidate.id === decision.caseId);
      this.label(310, 450 + index * 38, `${decision.correct ? '✓' : '×'}  ${item?.japanese || decision.caseId}  ·  ${decision.expired ? 'EXPIRED' : decision.verdict.toUpperCase()}`, 17, decision.correct ? '#285543' : '#8f302c');
    });
    this.button(590, 750, 300, 62, passed ? 'NEXT ASSIGNMENT →' : 'REPEAT SHIFT →', () => this.controller.next(), C.red);
    this.button(920, 750, 260, 62, 'RETURN TO JOURNEY', () => this.controller.exit());
  }
}

export function createSignalDeskGame(parent: HTMLElement, controller: SignalDeskController): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: W,
    height: H,
    backgroundColor: '#090b0e',
    transparent: false,
    render: { antialias: true, pixelArt: false, powerPreference: 'high-performance' },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
    input: { keyboard: true, mouse: true, touch: true },
    audio: { disableWebAudio: false },
    scene: [new SignalDeskScene(controller)],
  });
}
