import { expect, test } from '@playwright/test';
test.setTimeout(60_000);

async function openSignalDesk(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => sessionStorage.removeItem('kaishi-kotoba-checkpoint'));
  await page.getByRole('button', { name: 'Explore Journey', exact: true }).click();
  await page.locator('#experimentalBottomNav [data-experimental-nav="games"]').click();
  await expect(page.locator('#gameHub')).toHaveClass(/active/);
  await page.locator('[data-games-checkpoint]').click();
  await expect(page.locator('#senseiDesk')).toHaveClass(/active/);
  await expect(page.locator('.signal-brief')).toBeVisible({ timeout: 15_000 });
}

test('a brand-new learner decodes and correctly escalates the first signal', async ({ page }) => {
  await openSignalDesk(page);
  await expect(page.getByText('Director Mori')).toBeVisible();
  await expect(page.locator('.signal-rule-card')).toContainText('RED');
  await expect(page.locator('.signal-director')).toHaveAttribute('src', /director-mori\.png/);
  await page.locator('[data-signal-start]').click();
  await expect(page.locator('.signal-paper')).toContainText('赤い');
  await expect(page.locator('.signal-paper')).not.toContainText('A red flower.');
  await expect(page.locator('.signal-reading')).toContainText('あかい はな');
  await expect(page.locator('[data-signal-token="0"]')).toHaveClass(/is-guided/);
  await expect(page.locator('[data-signal-translation]')).toContainText('training help');
  await page.locator('[data-signal-token="0"]').click();
  await expect(page.locator('.signal-dictionary-card')).toContainText('red');
  await expect(page.locator('[data-signal-evidence="red"]')).toHaveClass(/is-guided/);
  await page.locator('[data-signal-evidence="red"]').click();
  await expect(page.locator('.signal-evidence-list')).toContainText('red');
  await page.locator('[data-signal-verdict="escalate"]').click();
  await expect(page.locator('.signal-feedback')).toContainText('Good judgement');
  await expect(page.locator('.signal-feedback')).toContainText('Evidence identified correctly');
  await expect(page.locator('.signal-feedback-translation')).toContainText('A red flower.');
});

test('training manual, pause and Journey exit remain usable', async ({ page }) => {
  await openSignalDesk(page);
  await page.locator('[data-signal-tutorial]').click();
  await expect(page.locator('.signal-manual')).toContainText('Read. Mark. Decide.');
  await page.locator('[data-signal-tutorial-close]').click();
  await page.locator('[data-signal-start]').click();
  await page.locator('[data-signal-handbook]').click();
  await expect(page.locator('.signal-guide')).toContainText('How to decode a signal');
  await expect(page.locator('.signal-guide')).toContainText('Pin useful evidence');
  await page.locator('.signal-guide [data-signal-guide-close]').last().click();
  await expect(page.locator('.signal-guide')).toHaveCount(0);
  await page.locator('[data-signal-pause]').first().click();
  await expect(page.locator('.signal-pause')).toBeVisible();
  await page.locator('.signal-pause [data-signal-pause]').click();
  await page.locator('[data-signal-exit]').click();
  await expect(page.locator('#journey')).toHaveClass(/active/);
  await expect(page.locator('#dailyRoute')).not.toBeEmpty();
});

test('a complete training shift awards career progress and survives reload', async ({ page }) => {
  await openSignalDesk(page);
  await page.locator('[data-signal-start]').click();
  for (const verdict of ['escalate', 'standard', 'escalate', 'standard']) {
    await page.locator(`[data-signal-verdict="${verdict}"]`).click();
    await expect(page.locator('.signal-feedback')).toBeVisible();
    await page.locator('[data-signal-continue]').click();
  }
  await expect(page.locator('.signal-report')).toContainText('Shift cleared');
  await expect(page.locator('.signal-report')).toContainText('4/4');
  const career = await page.evaluate(() => JSON.parse(localStorage.getItem('kq-profile-v1:guest:kq-meta') || '{}').kotobaCheckpoint);
  expect(career.completedShiftIds).toContain('training-colour');
  expect(career.credits).toBe(24);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#experimentalBottomNav [data-experimental-nav="games"]').click();
  await page.locator('[data-games-checkpoint]').click();
  await expect(page.locator('.signal-report')).toContainText('Shift cleared');
});

test('telephone shifts offer replay and an explicitly assisted transcript', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kq-profile-v1:guest:kq-meta', JSON.stringify({ kotobaCheckpoint: { schemaVersion: 1, credits: 90, attempts: 6, completedShiftIds: ['training-colour','training-place','training-pair','signals-three-clues','signals-transit','signals-cancellation'], rank: 'Signal Analyst', commendations: [], strikes: 0, timerDisabled: true } })));
  await openSignalDesk(page);
  await expect(page.locator('.signal-brief')).toContainText('Numbers on the line');
  await page.locator('[data-signal-start]').click();
  await expect(page.locator('.signal-audio-only')).toBeVisible();
  await page.locator('[data-signal-audio]').click();
  await expect(page.locator('#senseiDesk')).toHaveClass(/is-playing/);
  await page.locator('[data-signal-transcript]').click();
  await expect(page.locator('.signal-message-line')).toContainText('七時');
  await expect(page.locator('.signal-paper')).toContainText('Replay call');
});

test('the sequel arc introduces Kuroda and interrupts a shift with a temporary order', async ({ page }) => {
  const completedShiftIds = ['training-colour','training-place','training-pair','signals-three-clues','signals-transit','signals-cancellation','phone-numbers','phone-identity','phone-danger','night-weather','night-colour-count','night-morning-exception','counter-two-paths','counter-location-exception','counter-final'];
  await page.addInitScript(ids => localStorage.setItem('kq-profile-v1:guest:kq-meta', JSON.stringify({ kotobaCheckpoint: { schemaVersion: 1, credits: 220, attempts: 15, completedShiftIds: ids, rank: 'Intelligence Officer', commendations: [], strikes: 0, timerDisabled: true } })), completedShiftIds);
  await openSignalDesk(page);
  await expect(page.locator('.signal-brief')).toContainText('The missing courier');
  await expect(page.locator('.signal-story-quote')).toContainText('Agent Emi Kuroda');
  await expect(page.locator('.signal-director')).toHaveAttribute('src', /agent-kuroda\.webp/);
  await page.locator('[data-signal-start]').click();
  await page.locator('[data-signal-verdict="escalate"]').click();
  await page.locator('[data-signal-continue]').click();
  await page.locator('[data-signal-verdict="standard"]').click();
  await page.locator('[data-signal-continue]').click();
  await expect(page.locator('.signal-event')).toContainText('RED PHONE');
  await expect(page.locator('.signal-codebook.is-amended')).toContainText('PASSPORT');
  await page.locator('[data-signal-transcript]').click();
  await expect(page.locator('.signal-paper')).toContainText('旅券');
});

test('legacy checkpoint sessions migrate credits into a new Signal Desk career', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => sessionStorage.setItem('kaishi-kotoba-checkpoint', JSON.stringify({ version: 2, value: { credits: 42, completedLevels: [1, 2], level: 3 } })));
  await page.getByRole('button', { name: 'Explore Journey', exact: true }).click();
  await page.locator('#experimentalBottomNav [data-experimental-nav="games"]').click();
  await page.locator('[data-games-checkpoint]').click();
  await expect(page.locator('.signal-masthead')).toContainText('42');
  await expect(page.locator('.signal-brief')).toContainText('The red condition');
});

test('the active desk fits a phone viewport without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSignalDesk(page);
  await page.locator('[data-signal-start]').click();
  const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, trayWidth: document.querySelector('.signal-trays')?.getBoundingClientRect().width || 0 }));
  expect(layout.overflow).toBeLessThanOrEqual(1);
  expect(layout.trayWidth).toBeLessThanOrEqual(390);
  await expect(page.locator('[data-signal-verdict="standard"]')).toBeVisible();
  await expect(page.locator('[data-signal-verdict="escalate"]')).toBeVisible();
});
