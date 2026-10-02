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
