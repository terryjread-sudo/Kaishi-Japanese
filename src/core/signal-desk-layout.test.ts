import { describe, expect, it } from 'vitest';
import { rectsOverlap, signalDeskLayout, type SignalDeskRect } from './signal-desk-layout';

const sizes = [[320, 568], [360, 640], [390, 844], [667, 375], [844, 390], [768, 1024], [1024, 768], [1440, 900], [1920, 1080]] as const;

describe('signalDeskLayout', () => {
  it.each(sizes)('keeps critical controls inside %ix%i', (width, height) => {
    const layout = signalDeskLayout(width, height);
    const bounds: SignalDeskRect = layout.mode === 'desktop' ? { x: 0, y: 0, width: 1440, height: 900 } : { x: 0, y: 0, width, height };
    for (const area of [layout.header, layout.guidance, layout.codebook, layout.file, layout.trays, layout.tabs].filter(Boolean) as SignalDeskRect[]) {
      expect(area.x).toBeGreaterThanOrEqual(bounds.x);
      expect(area.y).toBeGreaterThanOrEqual(bounds.y);
      expect(area.x + area.width).toBeLessThanOrEqual(bounds.width);
      expect(area.y + area.height).toBeLessThanOrEqual(bounds.height);
      expect(area.height).toBeGreaterThanOrEqual(42);
    }
    expect(rectsOverlap(layout.file, layout.trays)).toBe(false);
    expect(rectsOverlap(layout.guidance, layout.trays)).toBe(false);
    expect(layout.trays.height).toBeGreaterThanOrEqual(44);
    if (layout.tabs) expect(layout.tabs.height).toBeGreaterThanOrEqual(44);
    expect(rectsOverlap(layout.codebook, layout.file)).toBe(false);
  });

  it('collapses a quiet portrait queue while keeping the active file dominant', () => {
    const quiet = signalDeskLayout(412, 915, 1);
    const busy = signalDeskLayout(412, 915, 4);
    expect(quiet.file.height).toBeGreaterThan(quiet.queue.height);
    expect(busy.file.height).toBeGreaterThanOrEqual(116);
    expect(busy.queue.height).toBeGreaterThan(quiet.queue.height);
  });

  it('uses tabbed portrait, compact landscape, and desktop modes', () => {
    expect(signalDeskLayout(390, 844)).toMatchObject({ mode: 'portrait' });
    expect(signalDeskLayout(390, 844).tabs).toBeDefined();
    expect(signalDeskLayout(844, 390)).toMatchObject({ mode: 'landscape' });
    expect(signalDeskLayout(1024, 768)).toMatchObject({ mode: 'desktop' });
  });
});
