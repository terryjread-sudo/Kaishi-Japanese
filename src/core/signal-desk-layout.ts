export type SignalDeskLayoutMode = 'portrait' | 'landscape' | 'desktop';
export type SignalDeskPortraitTab = 'queue' | 'evidence' | 'tools';

export interface SignalDeskRect { x: number; y: number; width: number; height: number }
export interface SignalDeskLayout {
  mode: SignalDeskLayoutMode;
  viewport: SignalDeskRect;
  header: SignalDeskRect;
  guidance: SignalDeskRect;
  queue: SignalDeskRect;
  codebook: SignalDeskRect;
  file: SignalDeskRect;
  evidence: SignalDeskRect;
  trays: SignalDeskRect;
  tabs?: SignalDeskRect;
}

const rect = (x: number, y: number, width: number, height: number): SignalDeskRect => ({ x, y, width, height });

export function signalDeskLayout(width: number, height: number): SignalDeskLayout {
  const w = Math.max(320, width);
  const h = Math.max(360, height);
  const mode: SignalDeskLayoutMode = h > w && w <= 820 ? 'portrait' : h <= 620 && w > h ? 'landscape' : 'desktop';
  if (mode === 'portrait') {
    const gap = 6, headerHeight = 54, guidanceHeight = 52, tabsHeight = 48, traysHeight = 76;
    const codebookHeight = Math.min(92, Math.max(76, h * .105));
    const fileTop = headerHeight + guidanceHeight + codebookHeight + gap * 3;
    const tabsTop = h - traysHeight - tabsHeight - gap;
    const workspaceHeight = Math.max(228, tabsTop - fileTop - gap);
    const fileHeight = Math.max(116, Math.floor(workspaceHeight * .50));
    const auxiliaryTop = fileTop + fileHeight + gap;
    return {
      mode, viewport: rect(0, 0, w, h), header: rect(6, 4, w - 12, headerHeight - 4),
      guidance: rect(6, headerHeight + gap, w - 12, guidanceHeight),
      codebook: rect(6, headerHeight + guidanceHeight + gap * 2, w - 12, codebookHeight),
      file: rect(8, fileTop, w - 16, fileHeight),
      tabs: rect(6, tabsTop, w - 12, tabsHeight),
      queue: rect(6, auxiliaryTop, w - 12, Math.max(62, tabsTop - auxiliaryTop - gap)),
      evidence: rect(6, auxiliaryTop, w - 12, Math.max(62, tabsTop - auxiliaryTop - gap)),
      trays: rect(4, h - traysHeight, w - 8, traysHeight - 4),
    };
  }
  if (mode === 'landscape') {
    const gap = 6, headerHeight = 52, guidanceHeight = 44, traysHeight = 64;
    const top = headerHeight + guidanceHeight + gap * 2, contentHeight = Math.max(160, h - top - traysHeight - gap);
    const queueWidth = Math.max(150, w * .21), centreWidth = Math.max(285, w * .43);
    const evidenceX = gap * 3 + queueWidth + centreWidth;
    return {
      mode, viewport: rect(0, 0, w, h), header: rect(6, 4, w - 12, headerHeight - 4),
      guidance: rect(6, headerHeight + gap, w - 12, guidanceHeight),
      queue: rect(6, top, queueWidth, contentHeight), codebook: rect(queueWidth + gap * 2, top, centreWidth, 76),
      file: rect(queueWidth + gap * 2, top + 82, centreWidth, Math.max(78, contentHeight - 82)),
      evidence: rect(evidenceX, top, Math.max(180, w - evidenceX - gap), contentHeight),
      trays: rect(queueWidth + gap * 2, h - traysHeight, w - queueWidth - gap * 3, traysHeight - 4),
    };
  }
  return {
    mode, viewport: rect(0, 0, 1440, 900), header: rect(22, 12, 1396, 64), guidance: rect(320, 675, 500, 55),
    queue: rect(20, 110, 280, 590), codebook: rect(315, 108, 480, 135), file: rect(320, 255, 500, 390),
    evidence: rect(890, 140, 510, 560), trays: rect(540, 740, 740, 120),
  };
}

export function rectsOverlap(a: SignalDeskRect, b: SignalDeskRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
