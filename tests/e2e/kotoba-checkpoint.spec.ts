import { expect, test, type Page } from '@playwright/test';
test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);

async function semanticClick(page: Page, selector: string): Promise<void> {
  await page.locator(`.signal-semantic ${selector}`).evaluate((element: HTMLElement) => element.click());
}

async function openSignalDesk(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => sessionStorage.removeItem('kaishi-kotoba-checkpoint'));
  await page.getByRole('button', { name: 'Explore Journey', exact: true }).click();
  await page.locator('#experimentalBottomNav [data-experimental-nav="games"]').click();
  await page.locator('[data-games-checkpoint]').click();
  await expect(page.locator('#senseiDesk')).toHaveClass(/active/);
  await expect(page.locator('#signalPhaserHost canvas')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#signalPhaserHost')).toHaveAttribute('data-signal-layout', /desktop|portrait|landscape/, { timeout: 20_000 });
  await expect(page.locator('.signal-semantic')).toContainText('The red condition');
}

test('Phaser owns the visible Signal Desk while a semantic control surface remains available', async ({ page }) => {
  await openSignalDesk(page);
  await expect(page.locator('#signalPhaserHost canvas')).toHaveCount(1);
  await expect(page.locator('.signal-semantic')).toHaveCSS('position', 'absolute');
  await expect(page.locator('.signal-semantic')).toContainText('ESCALATE if RED');
  await expect(page.locator('#senseiDesk')).toHaveAttribute('data-signal-phase', 'briefing');
});

test('a new learner inspects evidence, files a signal and receives a debrief', async ({ page }) => {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as typeof window & { __signalSpoken?: string[] }).__signalSpoken = spoken;
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { cancel: () => undefined, speak: (utterance: SpeechSynthesisUtterance) => spoken.push(utterance.text) } });
  });
  await openSignalDesk(page);
  await semanticClick(page, '[data-signal-start]');
  await expect(page.locator('#senseiDesk')).toHaveAttribute('data-signal-phase', 'decode');
  await expect(page.locator('.signal-semantic')).toContainText('赤い花');
  await semanticClick(page, '[data-signal-token="0"]');
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __signalSpoken?: string[] }).__signalSpoken || [])).toContain('赤い');
  await semanticClick(page, '[data-signal-evidence="red"]');
  await semanticClick(page, '[data-signal-confidence="fair"]');
  await semanticClick(page, '[data-signal-verdict="escalate"]');
  await expect(page.locator('#senseiDesk')).toHaveAttribute('data-signal-phase', 'feedback');
  await semanticClick(page, '[data-signal-continue]');
  await expect(page.locator('#senseiDesk')).toHaveAttribute('data-signal-active-case', 't1-2');
});

test('a complete training shift awards and persists the reset v2 career', async ({ page }) => {
  await openSignalDesk(page);
  await semanticClick(page, '[data-signal-start]');
  for (const verdict of ['escalate', 'standard', 'escalate', 'standard']) {
    await semanticClick(page, `[data-signal-verdict="${verdict}"]`);
    await expect(page.locator('#senseiDesk')).toHaveAttribute('data-signal-phase', 'feedback');
    await semanticClick(page, '[data-signal-continue]');
  }
  await expect(page.locator('#senseiDesk')).toHaveAttribute('data-signal-phase', 'report');
  const career = await page.evaluate(() => JSON.parse(localStorage.getItem('kq-profile-v1:guest:kq-meta') || '{}').kotobaCheckpoint);
  expect(career.schemaVersion).toBe(2);
  expect(career.completedShiftIds).toContain('training-colour');
  expect(career.credits).toBeGreaterThanOrEqual(24);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#experimentalBottomNav [data-experimental-nav="games"]').click();
  await page.locator('[data-games-checkpoint]').click();
  await expect(page.locator('#senseiDesk')).toHaveAttribute('data-signal-phase', 'report');
});

test('legacy Signal Desk progress deliberately starts the new Phaser campaign', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kq-profile-v1:guest:kq-meta', JSON.stringify({ kotobaCheckpoint: { schemaVersion: 1, credits: 90, attempts: 6, completedShiftIds: ['training-colour'], rank: 'Signal Analyst' } })));
  await openSignalDesk(page);
  const career = await page.evaluate(() => JSON.parse(localStorage.getItem('kq-profile-v1:guest:kq-meta') || '{}').kotobaCheckpoint);
  expect(career).toMatchObject({ schemaVersion: 2, credits: 0, attempts: 0, completedShiftIds: [] });
  await expect(page.locator('.signal-semantic')).toContainText('The red condition');
});

test('incoming files join the queue and pause freezes operational time', async ({ page }) => {
  await openSignalDesk(page);
  await semanticClick(page, '[data-signal-start]');
  await page.evaluate(() => {
    const envelope = JSON.parse(sessionStorage.getItem('kaishi-kotoba-checkpoint') || '{}');
    envelope.value.nextArrivalIn = 1;
    sessionStorage.setItem('kaishi-kotoba-checkpoint', JSON.stringify(envelope));
  });
  await expect.poll(() => page.locator('#senseiDesk').getAttribute('data-signal-queue'), { timeout: 4_000 }).toContain('t1-2');
  await semanticClick(page, '[data-signal-pause]');
  const before = await page.evaluate(() => JSON.parse(sessionStorage.getItem('kaishi-kotoba-checkpoint') || '{}').value.elapsed);
  await page.waitForTimeout(1_200);
  const after = await page.evaluate(() => JSON.parse(sessionStorage.getItem('kaishi-kotoba-checkpoint') || '{}').value.elapsed);
  expect(after).toBe(before);
  await semanticClick(page, '[data-signal-pause]');
});

test('keyboard filing and Journey exit work without DOM pointer controls', async ({ page }) => {
  await openSignalDesk(page);
  await semanticClick(page, '[data-signal-start]');
  await page.locator('#signalPhaserHost canvas').focus();
  await page.keyboard.press('e');
  await expect(page.locator('#senseiDesk')).toHaveAttribute('data-signal-phase', 'feedback');
  await semanticClick(page, '[data-signal-exit]');
  await expect(page.locator('#journey')).toHaveClass(/active/);
});

test('the canvas uses the full portrait phone viewport without document overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSignalDesk(page);
  await semanticClick(page, '[data-signal-start]');
  const layout = await page.evaluate(() => {
    const canvas = document.querySelector('#signalPhaserHost canvas')?.getBoundingClientRect();
    const host = document.querySelector<HTMLElement>('#signalPhaserHost');
    return { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, width: canvas?.width || 0, height: canvas?.height || 0, viewportWidth: innerWidth, viewportHeight: innerHeight, mode: host?.dataset.signalLayout };
  });
  expect(layout.overflow).toBeLessThanOrEqual(1);
  expect(layout.mode).toBe('portrait');
  expect(layout.width).toBeGreaterThanOrEqual(layout.viewportWidth - 1);
  expect(layout.height).toBeGreaterThanOrEqual(layout.viewportHeight - 1);
});

test('the desk reflows to a full-width landscape phone layout', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await openSignalDesk(page);
  await semanticClick(page, '[data-signal-start]');
  const layout = await page.evaluate(() => {
    const canvas = document.querySelector('#signalPhaserHost canvas')?.getBoundingClientRect();
    const host = document.querySelector<HTMLElement>('#signalPhaserHost');
    return { width: canvas?.width || 0, height: canvas?.height || 0, viewportWidth: innerWidth, viewportHeight: innerHeight, mode: host?.dataset.signalLayout };
  });
  expect(layout.mode).toBe('landscape');
  expect(layout.width).toBeGreaterThanOrEqual(layout.viewportWidth - 1);
  expect(layout.height).toBeGreaterThanOrEqual(layout.viewportHeight - 1);
});

test('leaving and repeatedly reopening recreates and resizes the Phaser scene', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSignalDesk(page);
  await semanticClick(page, '[data-signal-start]');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await semanticClick(page, '[data-signal-exit]');
    await expect(page.locator('#journey')).toHaveClass(/active/);
    await page.locator('#experimentalBottomNav [data-experimental-nav="games"]').click();
    await page.locator('[data-games-checkpoint]').click();
    await expect(page.locator('#senseiDesk')).toHaveClass(/active/);
    await expect(page.locator('#senseiDesk')).toHaveAttribute('data-signal-phase', 'decode');
    await expect(page.locator('#senseiDesk')).toHaveAttribute('data-signal-guidance', /paused/i);
    await expect.poll(async () => page.locator('#signalPhaserHost canvas').evaluate(canvas => ({ width: canvas.clientWidth, height: canvas.clientHeight, backingWidth: canvas.width, backingHeight: canvas.height, attached: canvas.parentElement?.id }))).toEqual({ width: 390, height: 844, backingWidth: expect.any(Number), backingHeight: expect.any(Number), attached: 'signalPhaserHost' });
    await expect.poll(async () => page.locator('#signalPhaserHost canvas').evaluate(canvas => Array.from(canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data).some((value, index) => index % 4 === 0 && value > 18))).toBe(true);
    await semanticClick(page, '[data-signal-pause]');
  }
});

test('portrait tabs expose queue, evidence, and verify tools without changing the active file', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await openSignalDesk(page);
  await semanticClick(page, '[data-signal-start]');
  const activeCase = await page.locator('#senseiDesk').getAttribute('data-signal-active-case');
  for (const tab of ['evidence', 'tools', 'queue']) {
    await semanticClick(page, `[data-signal-tab="${tab}"]`);
    await expect(page.locator('#senseiDesk')).toHaveAttribute('data-signal-portrait-tab', tab);
    await expect(page.locator('#senseiDesk')).toHaveAttribute('data-signal-active-case', activeCase || '');
  }
  await expect(page.locator('#senseiDesk')).toHaveAttribute('data-signal-guidance', /Inspect the active file/i);
  await semanticClick(page, '[data-signal-confidence="fair"]');
  await expect(page.locator('#senseiDesk')).toHaveAttribute('data-signal-guidance', /SUPPORTED/i);
});

test('exit mission can be cancelled or confirmed without erasing career progress', async ({ page }) => {
  await openSignalDesk(page);
  await semanticClick(page, '[data-signal-start]');
  await page.evaluate(() => {
    const envelope = JSON.parse(sessionStorage.getItem('kaishi-kotoba-checkpoint') || '{}');
    envelope.value.career.credits = 17;
    sessionStorage.setItem('kaishi-kotoba-checkpoint', JSON.stringify(envelope));
  });
  await semanticClick(page, '[data-signal-pause]');
  await semanticClick(page, '[data-signal-request-exit]');
  await expect(page.locator('#senseiDesk')).toHaveAttribute('data-signal-exit-pending', 'true');
  await semanticClick(page, '[data-signal-cancel-exit]');
  await expect(page.locator('#senseiDesk')).toHaveAttribute('data-signal-exit-pending', 'false');
  await semanticClick(page, '[data-signal-request-exit]');
  await semanticClick(page, '[data-signal-confirm-exit]');
  await expect(page.locator('#journey')).toHaveClass(/active/);
  const run = await page.evaluate(() => JSON.parse(sessionStorage.getItem('kaishi-kotoba-checkpoint') || '{}').value);
  expect(run).toMatchObject({ phase: 'briefing', index: 0, decisions: [], career: { credits: 17 } });
});

test('orientation changes refresh the live canvas and reduced motion is exposed', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await openSignalDesk(page);
  await expect(page.locator('#signalPhaserHost')).toHaveAttribute('data-signal-animation', 'reduced');
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('#signalPhaserHost')).toHaveAttribute('data-signal-layout', 'landscape');
  await expect.poll(async () => page.locator('#signalPhaserHost canvas').evaluate(canvas => ({ width: canvas.clientWidth, height: canvas.clientHeight }))).toEqual({ width: 844, height: 390 });
});

test('Signal Desk stays inside the Pixel 10 and representative mobile bounds', async ({ page }) => {
  for (const size of [[320, 568], [360, 640], [390, 844], [412, 915], [667, 375], [844, 390], [1024, 768], [1440, 900]] as const) {
    await page.setViewportSize({ width: size[0], height: size[1] });
    await openSignalDesk(page);
    await semanticClick(page, '[data-signal-start]');
    const metrics = await page.evaluate(() => {
      const canvas = document.querySelector('#signalPhaserHost canvas')?.getBoundingClientRect();
      return { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, width: canvas?.width || 0, height: canvas?.height || 0, mode: document.querySelector<HTMLElement>('#signalPhaserHost')?.dataset.signalLayout };
    });
    expect(metrics.overflow).toBeLessThanOrEqual(1);
    expect(metrics.width).toBeGreaterThanOrEqual(size[0] - 1);
    expect(metrics.height).toBeGreaterThanOrEqual(size[1] - 1);
    expect(metrics.mode).toMatch(/portrait|landscape|desktop/);
  }
});

test('rotation preserves briefing, pause, and feedback states', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await openSignalDesk(page);
  await page.setViewportSize({ width: 915, height: 412 });
  await expect(page.locator('#senseiDesk')).toHaveAttribute('data-signal-phase', 'briefing');
  await semanticClick(page, '[data-signal-start]');
  await page.setViewportSize({ width: 412, height: 915 });
  await semanticClick(page, '[data-signal-pause]');
  await expect(page.locator('#senseiDesk')).toHaveAttribute('data-signal-guidance', /paused/i);
  await page.setViewportSize({ width: 915, height: 412 });
  await expect(page.locator('#senseiDesk')).toHaveAttribute('data-signal-guidance', /paused/i);
  await semanticClick(page, '[data-signal-pause]');
  await semanticClick(page, '[data-signal-verdict="escalate"]');
  await expect(page.locator('#senseiDesk')).toHaveAttribute('data-signal-phase', 'feedback');
  await page.setViewportSize({ width: 412, height: 915 });
  await expect(page.locator('#senseiDesk')).toHaveAttribute('data-signal-phase', 'feedback');
});
