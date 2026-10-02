import Phaser from 'phaser';
import type { SignalCase, SignalEvidenceStatus, SignalRun, SignalShift, SignalVerdict, SignalVerificationAction } from '../domains/kotoba-checkpoint/types';
import { signalDeskLayout, type SignalDeskPortraitTab, type SignalDeskRect } from './signal-desk-layout';

export interface SignalDeskSnapshot {
  run: SignalRun;
  shift: SignalShift;
  active?: SignalCase;
  openTokenIndex: number | null;
  dictionaryRevealed: boolean;
  notice?: string;
  portraitTab: SignalDeskPortraitTab;
  exitPending: boolean;
}

export interface SignalDeskController {
  snapshot(): SignalDeskSnapshot;
  subscribe(listener: () => void): () => void;
  start(): void;
  exit(): void;
  requestExit(): void;
  cancelExit(): void;
  confirmExit(): void;
  setPortraitTab(tab: SignalDeskPortraitTab): void;
  refreshLayout(): void;
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
const SPECIALISATIONS = [
  { id: 'linguist', label: 'LINGUIST', compact: '+1 VERIFY', description: 'One extra verification charge after Basic Training.' },
  { id: 'listener', label: 'LISTENER', compact: 'SLOWER AUDIO', description: 'Slower replay when you inspect spoken Japanese.' },
  { id: 'field', label: 'FIELD', compact: 'FAIR CONFIDENCE', description: 'Begins each file with Fair confidence selected.' },
  { id: 'cryptographer', label: 'CRYPTOGRAPHER', compact: 'SHOW READINGS', description: 'Shows readings on written intercepts.' },
] as const;

class SignalDeskScene extends Phaser.Scene {
  private unsubscribe?: () => void;
  private dragFile?: Phaser.GameObjects.Container;
  private standardZone = new Phaser.Geom.Rectangle(540, 740, 360, 120);
  private escalateZone = new Phaser.Geom.Rectangle(920, 740, 360, 120);
  private evidenceBreaks: [number, number] = [965, 1100];
  private previousPhase = '';
  private previousActive = '';
  private previousQueue = new Set<string>();
  private previousEvidence = new Set<string>();
  private previousVerification = -1;
  private reducedMotion = false;
  private activeChanged = false;
  private newQueue = new Set<string>();
  private newEvidence = new Set<string>();
  private standardTray?: Phaser.GameObjects.Container;
  private escalateTray?: Phaser.GameObjects.Container;

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
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.unsubscribe = this.controller.subscribe(() => this.draw());
    this.scale.on(Phaser.Scale.Events.RESIZE, this.draw, this);
    this.input.on('drag', (_pointer: Phaser.Input.Pointer, object: Phaser.GameObjects.GameObject, x: number, y: number) => {
      const target = object as Phaser.GameObjects.Container; target.setPosition(x, y);
      if (target === this.dragFile) {
        const standardBox = this.standardTray?.first as Phaser.GameObjects.Rectangle | undefined;
        const escalateBox = this.escalateTray?.first as Phaser.GameObjects.Rectangle | undefined;
        standardBox?.setFillStyle(this.standardZone.contains(x, y) ? 0x4b8a6a : 0x285543);
        escalateBox?.setFillStyle(this.escalateZone.contains(x, y) ? 0xb54b3e : 0x8f302c);
      }
    });
    this.input.on('dragend', (_pointer: Phaser.Input.Pointer, object: Phaser.GameObjects.GameObject) => {
      const target = object as Phaser.GameObjects.Container;
      if (target === this.dragFile) {
        const standardBox = this.standardTray?.first as Phaser.GameObjects.Rectangle | undefined;
        const escalateBox = this.escalateTray?.first as Phaser.GameObjects.Rectangle | undefined;
        standardBox?.setFillStyle(0x285543);
        escalateBox?.setFillStyle(0x8f302c);
        if (this.standardZone.contains(target.x, target.y)) this.controller.file('standard');
        else if (this.escalateZone.contains(target.x, target.y)) this.controller.file('escalate');
        else this.draw();
        return;
      }
      const fact = target.getData('evidence') as string | undefined;
      if (fact) this.controller.setEvidenceStatus(fact, target.x < this.evidenceBreaks[1] ? target.x < this.evidenceBreaks[0] ? 'confirmed' : 'doubtful' : 'contradiction');
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.draw, this);
    });
    this.draw();
  }

  refreshLayout(): void { this.draw(); }

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
    container.on('pointerdown', () => { if (!this.reducedMotion) this.tweens.add({ targets: container, scale: .97, duration: 70 }); });
    container.on('pointerup', () => { if (!this.reducedMotion) this.tweens.add({ targets: container, scale: 1, duration: 100, ease: 'Back.Out' }); });
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
    const width = this.scale.width;
    const height = this.scale.height;
    const layout = signalDeskLayout(width, height, snapshot.run.queuedCaseIds.length);
    const mobile = layout.mode !== 'desktop';
    this.activeChanged = Boolean(this.previousActive && this.previousActive !== snapshot.run.activeCaseId);
    this.newQueue = new Set(snapshot.run.queuedCaseIds.filter(id => !this.previousQueue.has(id)));
    this.newEvidence = new Set(snapshot.run.selectedEvidence.filter(id => !this.previousEvidence.has(id)));
    const host = this.game.canvas.closest<HTMLElement>('#signalPhaserHost');
    if (host) { host.dataset.signalLayout = layout.mode; host.dataset.signalAnimation = this.reducedMotion ? 'reduced' : 'full'; }
    if (mobile) {
      this.cameras.main.setZoom(1).setScroll(0, 0);
      this.drawMobile(snapshot, width, height, layout.mode === 'portrait');
      this.afterDraw(snapshot);
      return;
    }
    const zoom = Math.min(width / W, height / H);
    this.cameras.main.setZoom(zoom).centerOn(W / 2, H / 2);
    this.background(snapshot.shift.sequence >= 10);
    this.header(snapshot);
    if (snapshot.run.phase === 'briefing') this.briefing(snapshot);
    else if (snapshot.run.phase === 'report' || snapshot.run.phase === 'failed') this.report(snapshot);
    else this.desk(snapshot);
    this.afterDraw(snapshot);
  }

  private afterDraw(snapshot: SignalDeskSnapshot): void {
    const phaseChanged = snapshot.run.phase !== this.previousPhase;
    if (!this.reducedMotion && phaseChanged) this.cameras.main.fadeIn(180, 5, 5, 5);
    if (phaseChanged && snapshot.run.phase === 'feedback') { if (this.cache.audio.exists('stamp')) this.sound.play('stamp', { volume: .3 }); if (!this.reducedMotion) this.cameras.main.shake(90, .0025); }
    if (this.newQueue.size && this.previousQueue.size && this.cache.audio.exists('ready')) this.sound.play('ready', { volume: .22 });
    if (this.newEvidence.size && this.cache.audio.exists('pin')) this.sound.play('pin', { volume: .2 });
    if (this.previousVerification >= 0 && snapshot.run.verification < this.previousVerification && !this.reducedMotion) this.cameras.main.flash(100, 216, 164, 77, false);
    this.previousPhase = snapshot.run.phase;
    this.previousActive = snapshot.run.activeCaseId || '';
    this.previousQueue = new Set(snapshot.run.queuedCaseIds);
    this.previousEvidence = new Set(snapshot.run.selectedEvidence);
    this.previousVerification = snapshot.run.verification;
  }

  private guidance(snapshot: SignalDeskSnapshot): string {
    if (snapshot.notice) return snapshot.notice.toUpperCase();
    if (snapshot.run.phase === 'briefing') return 'READ THE CODEBOOK · CHOOSE YOUR SETUP · CLOCK IN';
    if (snapshot.run.phase === 'feedback') return 'REVIEW THE RESULT · CHOOSE A RESPONSE · CONTINUE';
    if (snapshot.run.paused) return 'PAUSED · RESUME, LEAVE SAFELY, OR EXIT THE MISSION';
    if (!snapshot.active) return '1  SELECT AN INCOMING SIGNAL';
    if (!snapshot.run.lookedUpTokens.length && !snapshot.run.assisted) return '2  INSPECT THE FILE OR PLAY THE INTERCEPT';
    if (!snapshot.run.selectedEvidence.length) return '3  PIN THE DECISIVE CLUE · CLASSIFY IT ON THE WALL';
    if (!snapshot.run.confidence || snapshot.run.confidence === 'uncertain') return '4  SET CONFIDENCE · THEN CHOOSE A FILING';
    return '5  FILE STANDARD OR ESCALATE · VERIFY CHARGES BUY ASSISTANCE';
  }

  private guidanceBar(snapshot: SignalDeskSnapshot, area: SignalDeskRect): void {
    this.panel(area.x + area.width / 2, area.y + area.height / 2, area.width, area.height, 0x121619, .97, 0x6f5934);
    this.label(area.x + 12, area.y + 8, 'DESK PROCEDURE', 10, '#e8b85f', { fontStyle: 'bold' });
    this.label(area.x + 12, area.y + 23, this.guidance(snapshot), Math.max(10, Math.min(13, area.height * .25)), C.cream, { fontStyle: 'bold', wordWrap: { width: area.width - 24 } });
  }

  private mobileBackground(width: number, height: number, night: boolean): void {
    const key = night ? 'office-night' : 'office-dusk';
    if (this.textures.exists(key)) {
      const source = this.textures.get(key).getSourceImage() as HTMLImageElement;
      const scale = Math.max(width / source.width, height / source.height);
      this.add.image(width / 2, height / 2, key).setDisplaySize(source.width * scale, source.height * scale).setTint(night ? 0xaab5d1 : 0xffdfb2);
    } else this.add.rectangle(width / 2, height / 2, width, height, 0x120f0d);
    this.add.rectangle(width / 2, height / 2, width, height, C.black, .46);
  }

  private mobileHeader(snapshot: SignalDeskSnapshot, width: number): void {
    this.panel(width / 2, 27, width - 12, 48, 0x101214, .97);
    this.label(13, 10, 'ことば局 · SECTION K', 12, '#e8b85f', { fontStyle: 'bold' });
    this.label(13, 29, `${snapshot.shift.department.toUpperCase()} · ${snapshot.run.career.rank.toUpperCase()}`, 10, C.muted);
    this.label(Math.max(112, width - 208), 11, `◎ ${snapshot.run.career.credits} · V ${snapshot.run.verification}/${snapshot.run.maxVerification}`, 10, '#e8b85f', { fontStyle: 'bold' });
    if (snapshot.run.phase === 'decode') this.button(width - 113, 27, 46, 36, snapshot.run.paused ? 'RESUME' : 'PAUSE', () => this.controller.pause(), 0x342b22);
    this.button(snapshot.run.phase === 'decode' ? width - 54 : width - 42, 27, snapshot.run.phase === 'decode' ? 48 : 68, 36, 'LEAVE', () => this.controller.exit(), 0x3a2822);
  }

  private drawMobile(snapshot: SignalDeskSnapshot, width: number, height: number, portrait: boolean): void {
    this.mobileBackground(width, height, snapshot.shift.sequence >= 10);
    this.mobileHeader(snapshot, width);
    if (snapshot.run.phase === 'briefing') this.mobileBriefing(snapshot, width, height, portrait);
    else if (snapshot.run.phase === 'report' || snapshot.run.phase === 'failed') this.mobileReport(snapshot, width, height, portrait);
    else this.mobileDesk(snapshot, width, height, portrait);
  }

  private mobileBriefing(snapshot: SignalDeskSnapshot, width: number, height: number, portrait: boolean): void {
    const { shift, run } = snapshot;
    if (!portrait) {
      const portraitKey = shift.story?.portrait || 'mori';
      const portraitWidth = Math.min(190, width * .21), contentX = portraitWidth + 18, contentWidth = width - contentX - 12;
      if (this.textures.exists(portraitKey)) this.add.image(portraitWidth / 2 + 4, height, portraitKey).setOrigin(.5, 1).setDisplaySize(portraitWidth, height - 58);
      this.panel(contentX + contentWidth / 2, height / 2 + 2, contentWidth, height - 66, C.paper, .98, 0xb29662);
      this.label(contentX + 18, 66, `SHIFT ${shift.sequence} · ${shift.department.toUpperCase()}`, 11, '#81322e', { fontStyle: 'bold' });
      this.label(contentX + 18, 86, shift.title, 27, '#241c17', { fontFamily: 'Georgia, serif', fontStyle: 'bold', wordWrap: { width: contentWidth - 36 } });
      this.label(contentX + 18, 120, shift.briefing, 13, '#4c4036', { wordWrap: { width: contentWidth - 36 }, lineSpacing: 3 });
      const ruleY = Math.min(210, height * .53);
      this.add.rectangle(contentX + contentWidth / 2, ruleY, contentWidth - 36, 68, 0xfff5d8, .9).setStrokeStyle(2, C.red);
      this.label(contentX + 26, ruleY - 25, 'TODAY’S CODEBOOK', 10, '#8f302c', { fontStyle: 'bold' });
      this.label(contentX + 26, ruleY - 3, shift.ruleText, 16, '#211a16', { fontStyle: 'bold', wordWrap: { width: contentWidth - 52 } });
      this.mobileSpecialisations(contentX + 18, ruleY + 44, contentWidth - 36, 64, run, false);
      this.button(contentX + contentWidth * .31, height - 27, contentWidth * .50, 40, 'CLOCK IN →', () => this.controller.start(), C.red);
      this.button(contentX + contentWidth * .74, height - 27, contentWidth * .33, 40, run.career.timerDisabled ? 'ENABLE TIMER' : 'DISABLE TIMER', () => this.controller.toggleTimer());
      return;
    }
    this.panel(width / 2, (height + 57) / 2, width - 14, height - 65, C.paper, .98, 0xb29662);
    this.label(20, 70, `SHIFT ${shift.sequence} · ${shift.department.toUpperCase()}`, 12, '#81322e', { fontStyle: 'bold' });
    this.label(20, 94, shift.title, 28, '#241c17', { fontFamily: 'Georgia, serif', fontStyle: 'bold', wordWrap: { width: width - 40 } });
    this.label(20, 135, shift.briefing, 15, '#4c4036', { wordWrap: { width: width - 40 }, lineSpacing: 3 });
    const ruleY = 246;
    this.add.rectangle(width / 2, ruleY, width - 34, 94, 0xfff5d8, .9).setStrokeStyle(2, C.red);
    this.label(29, ruleY - 38, 'TODAY’S CODEBOOK', 11, '#8f302c', { fontStyle: 'bold' });
    this.label(29, ruleY - 13, shift.ruleText, 18, '#211a16', { fontStyle: 'bold', wordWrap: { width: width - 58 } });
    this.mobileSpecialisations(20, ruleY + 62, width - 40, Math.max(215, height - ruleY - 190), run, true);
    this.button(width * .31, height - 49, width * .55, 66, 'CLOCK IN →', () => this.controller.start(), C.red);
    this.button(width * .79, height - 49, width * .34, 66, run.career.timerDisabled ? 'TIMER ON' : 'TIMER OFF', () => this.controller.toggleTimer());
  }

  private mobileSpecialisations(x: number, y: number, width: number, height: number, run: SignalRun, portrait: boolean): void {
    this.label(x, y, 'CHOOSE YOUR SPECIALISATION', 11, '#762d29', { fontStyle: 'bold' });
    this.label(x, y + 16, 'Each role changes how the desk helps you.', 10, '#55493e');
    const cardTop = y + 40;
    const columns = portrait ? 2 : 4;
    const rows = Math.ceil(SPECIALISATIONS.length / columns);
    const gap = 7;
    const cardWidth = (width - gap * (columns - 1)) / columns;
    const detailHeight = portrait ? 34 : 0;
    const cardHeight = Math.max(portrait ? 66 : 42, Math.min(portrait ? 84 : 44, (height - 42 - detailHeight - gap * (rows - 1)) / rows));
    SPECIALISATIONS.forEach((role, index) => {
      const column = index % columns, row = Math.floor(index / columns);
      const cardX = x + column * (cardWidth + gap) + cardWidth / 2;
      const cardY = cardTop + row * (cardHeight + gap) + cardHeight / 2;
      const selected = run.career.specialisation === role.id;
      this.button(cardX, cardY, cardWidth, cardHeight, `${role.label}\n${role.compact}`, () => this.controller.specialise(role.id), selected ? C.red : 0x5b4b3c);
    });
    if (portrait) {
      const selected = SPECIALISATIONS.find(role => role.id === run.career.specialisation) || SPECIALISATIONS[0];
      this.label(x, cardTop + rows * cardHeight + (rows - 1) * gap + 8, `WHAT THIS CHANGES · ${selected.description}`, 9, '#55493e', { wordWrap: { width } });
    }
  }

  private mobileDesk(snapshot: SignalDeskSnapshot, width: number, height: number, portrait: boolean): void {
    const layout = signalDeskLayout(width, height, snapshot.run.queuedCaseIds.length);
    this.guidanceBar(snapshot, layout.guidance);
    if (portrait) this.mobilePortraitDesk(snapshot, width, height);
    else this.mobileLandscapeDesk(snapshot, width, height);
    if (snapshot.run.phase === 'feedback') this.mobileFeedback(snapshot, width, height);
    if (snapshot.run.paused) this.mobilePause(snapshot, width, height);
  }

  private mobileQueue(snapshot: SignalDeskSnapshot, x: number, y: number, width: number, height: number, horizontal: boolean): void {
    this.panel(x + width / 2, y + height / 2, width, height);
    this.label(x + 9, y + 7, `INCOMING · ${snapshot.run.queuedCaseIds.length} QUEUED`, 11, '#e8b85f', { fontStyle: 'bold' });
    this.label(x + 9, y + 24, 'INCOMING SIGNALS', 8, C.muted, { fontStyle: 'bold' });
    const visible = snapshot.run.queuedCaseIds.slice(0, horizontal ? 3 : 4);
    visible.forEach((id, index) => {
      const item = snapshot.shift.cases.find(candidate => candidate.id === id)!;
      const active = id === snapshot.run.activeCaseId;
      if (horizontal) {
        const cardWidth = (width - 18 - (visible.length - 1) * 5) / Math.max(1, visible.length);
        const urgency = snapshot.run.queueAge[id] || 0;
        const card = this.button(x + 9 + cardWidth / 2 + index * (cardWidth + 5), y + height - 29, cardWidth, 48, `${item.channel.toUpperCase()} ${urgency}s`, () => this.controller.selectCase(id), active ? C.red : urgency > 20 ? 0x6d382d : 0x2f2923);
        if (!this.reducedMotion && this.newQueue.has(id)) this.tweens.add({ targets: card, x: card.x + 18, alpha: { from: 0, to: 1 }, duration: 260, ease: 'Back.Out' });
      } else {
        const urgency = snapshot.run.queueAge[id] || 0;
        const card = this.button(x + width / 2, y + 57 + index * 58, width - 18, 50, `${item.channel.toUpperCase()} · FILE ${String(snapshot.shift.cases.indexOf(item) + 1).padStart(3, '0')} · ${urgency}s`, () => this.controller.selectCase(id), active ? C.red : urgency > 20 ? 0x6d382d : 0x2f2923);
        if (!this.reducedMotion && this.newQueue.has(id)) this.tweens.add({ targets: card, x: card.x + 20, alpha: { from: 0, to: 1 }, duration: 260, ease: 'Back.Out' });
      }
    });
  }

  private mobileCodebook(snapshot: SignalDeskSnapshot, x: number, y: number, width: number, height: number): void {
    const rule = snapshot.active?.event?.ruleText || snapshot.shift.ruleText;
    this.panel(x + width / 2, y + height / 2, width, height, 0x211c18);
    this.label(x + 10, y + 7, snapshot.active?.event?.ruleOverride ? 'EMERGENCY AMENDMENT' : 'ACTIVE CODEBOOK', 11, snapshot.active?.event?.ruleOverride ? '#ff7668' : '#e8b85f', { fontStyle: 'bold' });
    this.label(x + 10, y + 28, rule, 15, C.cream, { fontStyle: 'bold', wordWrap: { width: width - 120 } });
    this.button(x + width - 48, y + height - 24, 86, 36, 'VERIFY', () => this.controller.verify('source-check'));
  }

  private mobileFile(snapshot: SignalDeskSnapshot, active: SignalCase, x: number, y: number, width: number, height: number): void {
    const file = this.add.container(x + width / 2, y + height / 2);
    file.add(this.add.rectangle(0, 0, width, height, active.channel === 'intercept' ? 0xd1c5aa : C.paper, 1).setStrokeStyle(2, 0x8f7952));
    file.add(this.label(-width / 2 + 10, -height / 2 + 9, `${active.channel.toUpperCase()} · ${active.speaker || 'SOURCE CLASSIFIED'}`, 10, '#5e4a38', { fontStyle: 'bold' }));
    file.add(this.label(-width / 2 + 10, -height / 2 + 25, 'TAP A WORD TO INSPECT', 8, '#8f302c', { fontStyle: 'bold' }));
    if (active.channel === 'telephone' && !snapshot.run.assisted) {
      file.add(this.label(0, -height * .20, '☎', Math.min(56, height * .25), '#4c3828').setOrigin(.5));
      file.add(this.button(0, height * .12, Math.min(220, width - 30), 44, 'PLAY INTERCEPT', () => this.controller.speak(active.japanese, .78), C.green));
      file.add(this.button(0, height * .34, Math.min(250, width - 30), 40, 'SHOW TRANSCRIPT · 1', () => this.controller.verify('translation'), C.red));
    } else {
      const tokenWidth = Math.min(92, (width - 30) / Math.max(1, active.tokens.length));
      const startX = -(active.tokens.length - 1) * tokenWidth / 2;
      const compactFile = height < 160;
      const tokenY = compactFile ? -20 : -height * .11;
      active.tokens.forEach((token, index) => {
        const inspected = snapshot.run.lookedUpTokens.includes(token.surface);
        file.add(this.button(startX + index * tokenWidth, tokenY, tokenWidth - 5, compactFile ? 42 : 48, token.surface, () => this.controller.inspectToken(index), inspected ? 0x8a4434 : 0xefe2c2, inspected ? '#fff1cf' : '#201a17'));
      });
      const token = snapshot.openTokenIndex === null ? undefined : active.tokens[snapshot.openTokenIndex];
      if (snapshot.run.readingVisible && !(compactFile && token)) file.add(this.label(0, compactFile ? 26 : height * .05, active.reading, 14, '#615344', { align: 'center', wordWrap: { width: width - 20 } }).setOrigin(.5));
      if (token) {
        file.add(this.label(0, compactFile ? 24 : height * .18, snapshot.dictionaryRevealed ? `${token.reading} · ${token.meaning}` : `${token.reading} · recall the meaning`, compactFile ? 13 : 15, '#762d29', { fontStyle: 'bold', align: 'center', wordWrap: { width: width - 20 } }).setOrigin(.5));
        if (!snapshot.dictionaryRevealed) file.add(this.button(-width * .19, height * .36, width * .34, 38, 'REVEAL · 1', () => this.controller.revealDictionary(), C.red));
        if (token.fact) file.add(this.button(width * .19, height * .36, width * .34, 38, snapshot.run.selectedEvidence.includes(token.fact) ? 'UNPIN' : 'PIN EVIDENCE', () => this.controller.pinEvidence(token.fact!), C.green));
      }
    }
    file.setSize(width, height).setInteractive({ useHandCursor: true });
    this.input.setDraggable(file); this.dragFile = file;
    if (!this.reducedMotion && this.activeChanged) this.tweens.add({ targets: file, y: file.y + 18, alpha: { from: 0, to: 1 }, duration: 240, ease: 'Cubic.Out' });
  }

  private mobileEvidence(snapshot: SignalDeskSnapshot, x: number, y: number, width: number, height: number): void {
    this.panel(x + width / 2, y + height / 2, width, height, 0x171513);
    this.label(x + 9, y + 7, 'EVIDENCE WALL', 11, '#e8b85f', { fontStyle: 'bold' });
    this.label(x + 9, y + 23, 'DRAG EVIDENCE TO CLASSIFY', 8, C.muted, { fontStyle: 'bold' });
    const columns: [number, number, number] = [x + width * .18, x + width * .50, x + width * .82];
    this.evidenceBreaks = [x + width * .34, x + width * .66];
    ['CONFIRMED', 'DOUBTFUL', 'CONTRADICTION'].forEach((value, index) => this.label(columns[index]!, y + 42, value, 9, index === 0 ? '#8fc6a4' : index === 1 ? '#e2c47b' : '#ef8b80', { fontStyle: 'bold' }).setOrigin(.5));
    const counts: [number, number, number] = [0, 0, 0];
    snapshot.run.selectedEvidence.slice(0, 6).forEach(fact => {
      const status = snapshot.run.evidenceStatus?.[fact] || 'confirmed';
      const column = status === 'confirmed' ? 0 : status === 'doubtful' ? 1 : 2;
      const chip = this.button(columns[column], y + 53 + counts[column]++ * 39, width * .28, 34, fact.toUpperCase(), () => undefined, column === 0 ? C.green : column === 1 ? 0x715c2b : C.red);
      chip.setData('evidence', fact); this.input.setDraggable(chip);
      if (!this.reducedMotion && this.newEvidence.has(fact)) this.tweens.add({ targets: chip, scale: { from: .7, to: 1 }, duration: 220, ease: 'Back.Out' });
    });
    if (!snapshot.run.selectedEvidence.length) this.label(x + width / 2, y + height * .52, 'PIN A CLUE TO CLASSIFY IT', 11, C.muted, { align: 'center', wordWrap: { width: width - 24 } }).setOrigin(.5);
    const confidenceY = y + height - 24;
    this.label(x + 9, confidenceY - 38, 'CONFIDENCE BEFORE FILING', 8, C.muted, { fontStyle: 'bold' });
    (['uncertain', 'fair', 'confident'] as const).forEach((value, index) => this.button(columns[index]!, confidenceY, width * .28, 36, value.toUpperCase(), () => this.controller.setConfidence(value), snapshot.run.confidence === value ? C.red : 0x332b25));
  }

  private mobilePortraitDesk(snapshot: SignalDeskSnapshot, width: number, height: number): void {
    const layout = signalDeskLayout(width, height, snapshot.run.queuedCaseIds.length);
    this.mobileCodebook(snapshot, layout.codebook.x, layout.codebook.y, layout.codebook.width, layout.codebook.height);
    if (snapshot.active) this.mobileFile(snapshot, snapshot.active, layout.file.x, layout.file.y, layout.file.width, layout.file.height);
    const auxiliary = snapshot.portraitTab === 'queue' ? layout.queue : layout.evidence;
    if (snapshot.portraitTab === 'queue') this.mobileQueue(snapshot, auxiliary.x, auxiliary.y, auxiliary.width, auxiliary.height, true);
    else if (snapshot.portraitTab === 'evidence') this.mobileEvidence(snapshot, auxiliary.x, auxiliary.y, auxiliary.width, auxiliary.height);
    else this.mobileTools(snapshot, auxiliary);
    const tabs = layout.tabs!;
    (['queue', 'evidence', 'tools'] as const).forEach((tab, index) => {
      const selected = snapshot.portraitTab === tab;
      const label = tab === 'queue' ? `${selected ? '● ' : ''}QUEUE · ${snapshot.run.queuedCaseIds.length}` : `${selected ? '● ' : ''}${tab.toUpperCase()}`;
      this.button(tabs.x + tabs.width * ((index + .5) / 3), tabs.y + tabs.height / 2, tabs.width / 3 - 4, Math.max(44, tabs.height - 2), label, () => this.controller.setPortraitTab(tab), selected ? C.red : 0x2f2923);
    });
    const trays = layout.trays;
    this.standardZone = new Phaser.Geom.Rectangle(trays.x, trays.y, trays.width / 2 - 3, trays.height);
    this.escalateZone = new Phaser.Geom.Rectangle(trays.x + trays.width / 2 + 3, trays.y, trays.width / 2 - 3, trays.height);
    this.standardTray = this.button(trays.x + trays.width * .25, trays.y + trays.height / 2, trays.width * .49, trays.height, '通常 · STANDARD', () => this.controller.file('standard'), C.green);
    this.escalateTray = this.button(trays.x + trays.width * .75, trays.y + trays.height / 2, trays.width * .49, trays.height, '至急 · ESCALATE', () => this.controller.file('escalate'), C.red);
  }

  private mobileTools(snapshot: SignalDeskSnapshot, area: SignalDeskRect): void {
    this.panel(area.x + area.width / 2, area.y + area.height / 2, area.width, area.height, 0x171513);
    this.label(area.x + 10, area.y + 7, `VERIFY TOOLS · ${snapshot.run.verification}/${snapshot.run.maxVerification} CHARGES`, 10, '#e8b85f', { fontStyle: 'bold' });
    this.label(area.x + 10, area.y + 25, 'Optional help costs a charge and marks the filing assisted.', 10, C.muted, { wordWrap: { width: area.width - 20 } });
    const y = area.y + area.height - 24;
    this.button(area.x + area.width * .22, y, area.width * .39, 44, 'SOURCE CHECK', () => this.controller.verify('source-check'));
    this.button(area.x + area.width * .68, y, area.width * .46, 44, 'DIRECTOR HINT', () => this.controller.verify('director-hint'), C.red);
  }

  private mobileLandscapeDesk(snapshot: SignalDeskSnapshot, width: number, height: number): void {
    const layout = signalDeskLayout(width, height, snapshot.run.queuedCaseIds.length);
    this.mobileQueue(snapshot, layout.queue.x, layout.queue.y, layout.queue.width, layout.queue.height, false);
    this.mobileCodebook(snapshot, layout.codebook.x, layout.codebook.y, layout.codebook.width, layout.codebook.height);
    if (snapshot.active) this.mobileFile(snapshot, snapshot.active, layout.file.x, layout.file.y, layout.file.width, layout.file.height);
    this.mobileEvidence(snapshot, layout.evidence.x, layout.evidence.y, layout.evidence.width, layout.evidence.height);
    const trays = layout.trays;
    this.standardZone = new Phaser.Geom.Rectangle(trays.x, trays.y, trays.width / 2 - 3, trays.height);
    this.escalateZone = new Phaser.Geom.Rectangle(trays.x + trays.width / 2 + 3, trays.y, trays.width / 2 - 3, trays.height);
    this.standardTray = this.button(trays.x + trays.width * .25, trays.y + trays.height / 2, trays.width * .49, trays.height, '通常 · STANDARD', () => this.controller.file('standard'), C.green);
    this.escalateTray = this.button(trays.x + trays.width * .75, trays.y + trays.height / 2, trays.width * .49, trays.height, '至急 · ESCALATE', () => this.controller.file('escalate'), C.red);
  }

  private mobileFeedback(snapshot: SignalDeskSnapshot, width: number, height: number): void {
    const decision = snapshot.run.decisions.at(-1)!;
    const active = snapshot.active;
    this.add.rectangle(width / 2, height / 2, width, height, 0x050505, .85);
    const panelWidth = Math.min(width - 20, 650);
    const panelHeight = Math.min(height - 74, 440);
    this.panel(width / 2, height / 2 + 15, panelWidth, panelHeight, C.paper, 1, decision.correct ? C.green : C.red);
    const left = (width - panelWidth) / 2 + 20;
    const top = (height - panelHeight) / 2 + 20;
    this.label(left, top, decision.correct ? 'CORRECT FILING' : decision.expired ? 'SIGNAL EXPIRED' : 'CODEBOOK ERROR', 14, decision.correct ? '#285543' : '#8f302c', { fontStyle: 'bold' });
    this.label(left, top + 35, decision.correct ? 'Good judgement' : 'Review the evidence', 27, '#211a16', { fontFamily: 'Georgia, serif', fontStyle: 'bold' });
    this.label(left, top + 82, `${active?.english || ''}\n\n${active?.explanation || ''}`, 15, '#4d4035', { wordWrap: { width: panelWidth - 40 }, lineSpacing: 4 });
    this.button(width / 2, height / 2 + panelHeight / 2 - 32, Math.min(280, panelWidth - 40), 54, snapshot.run.queuedCaseIds.length + snapshot.run.unreleasedCaseIds.length > 1 ? 'NEXT SIGNAL →' : 'OPEN REPORT →', () => this.controller.continue(), C.red);
  }

  private mobilePause(snapshot: SignalDeskSnapshot, width: number, height: number): void {
    this.add.rectangle(width / 2, height / 2, width, height, 0x050505, .92);
    if (snapshot.exitPending) { this.exitConfirmation(width, height); return; }
    this.label(width / 2, height / 2 - 105, 'SHIFT PAUSED', 32, C.cream, { fontFamily: 'Georgia, serif', fontStyle: 'bold' }).setOrigin(.5);
    this.label(width / 2, height / 2 - 65, 'Your queue is held safely.', 15, C.muted).setOrigin(.5);
    this.button(width / 2, height / 2, Math.min(280, width - 40), 52, 'RESUME SHIFT', () => this.controller.pause(), C.red);
    this.button(width / 2, height / 2 + 62, Math.min(280, width - 40), 48, 'LEAVE · RESUME LATER', () => this.controller.exit());
    this.button(width / 2, height / 2 + 120, Math.min(280, width - 40), 48, 'EXIT MISSION', () => this.controller.requestExit(), 0x612523);
  }

  private exitConfirmation(width: number, height: number): void {
    const panel = this.panel(width / 2, height / 2, Math.min(width - 24, 600), Math.min(330, height - 36), 0x171513, .99, C.red);
    if (!this.reducedMotion) this.tweens.add({ targets: panel, alpha: { from: 0, to: 1 }, duration: 160 });
    this.label(width / 2, height / 2 - 105, 'EXIT THIS MISSION?', 27, C.cream, { fontFamily: 'Georgia, serif', fontStyle: 'bold' }).setOrigin(.5);
    this.label(width / 2, height / 2 - 55, 'The unfinished shift will be discarded.\nCompleted career progress will remain safe.', 15, C.muted, { align: 'center', wordWrap: { width: Math.min(width - 60, 500) } }).setOrigin(.5);
    this.button(width / 2, height / 2 + 38, Math.min(280, width - 50), 52, 'CONFIRM EXIT MISSION', () => this.controller.confirmExit(), C.red);
    this.button(width / 2, height / 2 + 103, Math.min(220, width - 70), 46, 'CANCEL', () => this.controller.cancelExit());
  }

  private mobileReport(snapshot: SignalDeskSnapshot, width: number, height: number, portrait: boolean): void {
    const correct = snapshot.run.decisions.filter(item => item.correct).length;
    const passed = snapshot.run.phase === 'report';
    const panelWidth = portrait ? width - 16 : Math.min(width * .78, 900);
    this.panel(width / 2, height / 2 + 25, panelWidth, height - 64, C.paper, .99, passed ? C.green : C.red);
    const left = (width - panelWidth) / 2 + 20;
    this.label(left, 73, passed ? 'SHIFT CLEARED' : 'TRAINING REASSIGNMENT', 14, passed ? '#285543' : '#8f302c', { fontStyle: 'bold' });
    this.label(left, 104, snapshot.shift.title, portrait ? 28 : 34, '#211a16', { fontFamily: 'Georgia, serif', fontStyle: 'bold', wordWrap: { width: panelWidth - 40 } });
    this.label(left, 157, `${correct}/${snapshot.shift.cases.length} correct · ${snapshot.run.expiredCaseIds.length} expired · ◎ ${snapshot.run.career.credits}`, 15, '#514337');
    snapshot.run.decisions.slice(0, portrait ? 6 : 4).forEach((decision, index) => {
      const item = snapshot.shift.cases.find(candidate => candidate.id === decision.caseId);
      this.label(left + 5, 215 + index * 34, `${decision.correct ? '✓' : '×'}  ${item?.japanese || decision.caseId} · ${decision.verdict.toUpperCase()}`, 15, decision.correct ? '#285543' : '#8f302c');
    });
    this.button(width / 2, height - 48, Math.min(300, panelWidth - 40), 60, passed ? 'NEXT ASSIGNMENT →' : 'REPEAT SHIFT →', () => this.controller.next(), C.red);
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
    this.label(580, 668, 'CHOOSE YOUR SPECIALISATION', 12, '#762d29', { fontStyle: 'bold' });
    this.label(580, 685, 'A desk role changes how the shift helps you: +1 verify · slower audio · Fair confidence · written readings.', 12, '#55493e', { wordWrap: { width: 650 } });
    SPECIALISATIONS.forEach((role, index) => this.button(635 + index * 145, 722, 132, 38, `${role.label}\n${role.compact}`, () => this.controller.specialise(role.id), run.career.specialisation === role.id ? C.red : 0x5b4b3c));
    const tools = [{ id: 'phrasebook', at: 0 }, { id: 'tape-machine', at: 3 }, { id: 'evidence-lamp', at: 7 }, { id: 'night-map', at: 10 }, { id: 'red-phone', at: 15 }].filter(item => run.career.completedShiftIds.length >= item.at);
    tools.forEach((tool, index) => this.button(625 + index * 155, 755, 145, 24, tool.id.toUpperCase(), () => this.controller.equip(tool.id), run.career.equippedTools.includes(tool.id) ? C.green : 0x5b4b3c));
    this.button(680, 802, 220, 58, 'CLOCK IN  →', () => { this.sound.play('file', { volume: .25 }); this.controller.start(); }, C.red);
    this.button(915, 802, 200, 58, run.career.timerDisabled ? 'ENABLE TIMER' : 'DISABLE TIMER', () => this.controller.toggleTimer());
    this.button(1135, 802, 210, 58, 'RETURN TO JOURNEY', () => this.controller.exit());
  }

  private desk(snapshot: SignalDeskSnapshot): void {
    const { run, shift, active } = snapshot;
    this.guidanceBar(snapshot, signalDeskLayout(W, H).guidance);
    this.queue(snapshot);
    this.codebook(snapshot);
    if (active) this.file(snapshot, active);
    this.evidence(snapshot);
    this.trays(snapshot);
    this.label(36, 82, `QUEUE ${run.queuedCaseIds.length} · INCOMING ${run.unreleasedCaseIds.length} · EXPIRED ${run.expiredCaseIds.length}`, 13, '#e8b85f', { fontStyle: 'bold' });
    if (shift.seconds !== null && !run.career.timerDisabled) this.label(1210, 88, `${run.remaining}s`, 25, run.remaining < 45 ? '#ff7c6b' : C.cream, { fontStyle: 'bold' });
    this.button(1325, 104, 96, 34, run.paused ? 'RESUME' : 'PAUSE', () => this.controller.pause());
    if (run.phase === 'feedback') this.feedback(snapshot);
    if (run.paused) this.pauseOverlay(snapshot);
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
    this.standardTray = this.button(720, 800, 350, 110, '通常\nSTANDARD', () => { if (!disabled) { this.sound.play('stamp', { volume: .35 }); this.controller.file('standard'); } }, C.green);
    this.escalateTray = this.button(1100, 800, 350, 110, '至急\nESCALATE', () => { if (!disabled) { this.sound.play('stamp', { volume: .35 }); this.controller.file('escalate'); } }, C.red);
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

  private pauseOverlay(snapshot: SignalDeskSnapshot): void {
    this.add.rectangle(W / 2, H / 2, W, H, 0x050505, .9);
    if (snapshot.exitPending) { this.exitConfirmation(W, H); return; }
    this.label(W / 2, 330, 'SHIFT PAUSED', 44, C.cream, { fontFamily: 'Georgia, serif', fontStyle: 'bold' }).setOrigin(.5);
    this.label(W / 2, 390, 'The office can wait. Your queue is held safely.', 19, C.muted).setOrigin(.5);
    this.button(W / 2, 475, 300, 60, 'RESUME SHIFT', () => this.controller.pause(), C.red);
    this.button(W / 2, 550, 300, 54, 'LEAVE · RESUME LATER', () => this.controller.exit());
    this.button(W / 2, 620, 300, 54, 'EXIT MISSION', () => this.controller.requestExit(), 0x612523);
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
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.NO_CENTER, width: parent.clientWidth || W, height: parent.clientHeight || H },
    input: { keyboard: true, mouse: true, touch: true },
    audio: { disableWebAudio: false },
    scene: [new SignalDeskScene(controller)],
  });
}
