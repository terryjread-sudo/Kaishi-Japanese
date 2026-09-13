import { expect, test } from '@playwright/test';

async function openCheckpoint(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore Journey', exact: true }).click();
  await page.locator('#experimentalBottomNav [data-experimental-nav="sensei-desk"]').click();
  await expect(page.locator('#senseiDesk')).toHaveClass(/active/);
  await expect(page.locator('.checkpoint-brief')).toBeVisible({ timeout: 15_000 });
}

test('a brand-new learner can start the day-one kana checkpoint', async ({ page }) => {
  await openCheckpoint(page);
  await expect(page.getByRole('heading', { name: 'Kana arrivals' })).toBeVisible();
  await expect(page.getByText(/Senior Officer Mori/)).toBeVisible();
  await expect(page.getByText(/Worked examples/)).toBeVisible();
  await expect(page.locator('[data-checkpoint-lesson-audio]')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /Start shift/ })).toBeVisible();
  await page.getByRole('button', { name: /Start shift/ }).click();
  await expect(page.locator('.checkpoint-rulebook')).toContainText('hiragana');
  await expect(page.locator('.checkpoint-document')).toHaveCount(2);
  await expect(page.locator('.checkpoint-passport')).toBeVisible();
  await expect(page.locator('.checkpoint-passport')).toContainText('Passport No.');
  await expect(page.locator('.checkpoint-passport-record')).toBeVisible();
  await expect(page.locator('[data-checkpoint-stamp="approve"]')).toBeVisible();
  await page.keyboard.press('d');
  await expect(page.locator('.checkpoint-feedback')).toBeVisible();
});

test('inspection feedback, handbook and pause controls remain usable', async ({ page }) => {
  await openCheckpoint(page);
  await page.getByRole('button', { name: /Start shift/ }).click();
  await page.getByRole('button', { name: 'Open handbook' }).click();
  await expect(page.locator('.checkpoint-handbook')).toBeVisible();
  await page.locator('[data-checkpoint-handbook-close]').click();
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.locator('.checkpoint-pause')).toBeVisible();
  await page.getByRole('button', { name: /Resume inspection/ }).click();
  await page.locator('[data-checkpoint-stamp="deny"]').click();
  await expect(page.locator('.checkpoint-feedback')).toBeVisible();
  await page.getByRole('button', { name: /Next traveller/ }).click();
  await expect(page.locator('.checkpoint-traveller')).toBeVisible();
});

test('the tutorial and exit route do not strand an active game overlay', async ({ page }) => {
  await openCheckpoint(page);
  await page.getByRole('button', { name: 'Tutorial & controls' }).click();
  await expect(page.getByRole('heading', { name: 'One rule. One stamp.' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to shift briefing' }).click();
  await page.getByRole('button', { name: 'Return to Journey' }).click();
  await expect(page.locator('#journey')).toHaveClass(/active/);
  await expect(page.locator('.checkpoint-pause')).toHaveCount(0);
});
