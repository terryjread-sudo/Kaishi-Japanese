import { expect, test } from '@playwright/test';

async function openCheckpoint(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => sessionStorage.removeItem('kaishi-kotoba-checkpoint'));
  await page.getByRole('button', { name: 'Explore Journey', exact: true }).click();
  await page.locator('#experimentalBottomNav [data-experimental-nav="games"]').click();
  await expect(page.locator('#gameHub')).toHaveClass(/active/);
  await page.locator('[data-games-checkpoint]').click();
  await expect(page.locator('#senseiDesk')).toHaveClass(/active/);
  await expect(page.locator('.checkpoint-brief')).toBeVisible({ timeout: 15_000 });
}

test('a brand-new learner can start the day-one kana checkpoint', async ({ page }) => {
  await openCheckpoint(page);
  await expect(page.locator('.checkpoint-shift-title')).toBeVisible();
  await expect(page.getByText(/Senior Officer Mori/)).toBeVisible();
  await expect(page.getByText(/Worked examples/i)).toBeVisible();
  await expect(page.locator('[data-checkpoint-lesson-audio]')).toHaveCount(2);
  await expect(page.locator('[data-checkpoint-start]')).toBeVisible();
  await page.locator('[data-checkpoint-start]').click();
  await expect(page.locator('.checkpoint-rulebook')).toContainText('hiragana');
  await expect(page.locator('.checkpoint-document')).toHaveCount(1);
  await expect(page.locator('.checkpoint-passport')).toBeVisible();
  await expect(page.locator('.checkpoint-passport')).toContainText('Passport No.');
  await expect(page.locator('.checkpoint-passport-record')).toBeVisible();
  await expect(page.locator('[data-checkpoint-stamp="approve"]')).toBeVisible();
  await page.keyboard.press('d');
  await expect(page.locator('.checkpoint-feedback')).toBeVisible();
});

test('inspection feedback, handbook and pause controls remain usable', async ({ page }) => {
  await openCheckpoint(page);
  await page.locator('[data-checkpoint-start]').click();
  await page.locator('[data-checkpoint-handbook]').click();
  await expect(page.locator('.checkpoint-handbook')).toBeVisible();
  await page.locator('[data-checkpoint-handbook-close]').click();
  await page.locator('[data-checkpoint-pause]').first().click();
  await expect(page.locator('.checkpoint-pause')).toBeVisible();
  await page.locator('.checkpoint-pause [data-checkpoint-pause]').click();
  await page.locator('[data-checkpoint-stamp="deny"]').click();
  await expect(page.locator('.checkpoint-feedback')).toBeVisible();
  await page.locator('[data-checkpoint-continue]').click();
  await expect(page.locator('.checkpoint-traveller')).toBeVisible();
});

test('the tutorial and exit route do not strand an active game overlay', async ({ page }) => {
  await openCheckpoint(page);
  await page.locator('[data-checkpoint-tutorial]').click();
  await expect(page.locator('.checkpoint-tutorial')).toBeVisible();
  await page.locator('[data-checkpoint-tutorial-close]').click();
  await page.locator('[data-checkpoint-exit]').click();
  await expect(page.locator('#journey')).toHaveClass(/active/);
  await expect(page.locator('.checkpoint-pause')).toHaveCount(0);
});
