import { expect, test } from '@playwright/test';

test('new learners can open the Ascension Prologue without Activity Village', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore Journey', exact: true }).click();
  const nav = page.getByRole('navigation', { name: 'Primary navigation' });
  await expect(nav.locator('[data-experimental-nav="ascension"]')).toBeVisible();
  await nav.locator('[data-experimental-nav="ascension"]').click();
  await expect(page.locator('#ascension')).toHaveClass(/active/);
  await expect(page.locator('[data-ascension-start="prologue"]')).toContainText('Beginner Prologue');
  await expect(page.locator('#activityVillageMap')).toHaveCount(0);
  await expect(page.locator('script[src$="kotoba-activity.js"]')).toHaveCount(0);

  await page.locator('[data-ascension-start="prologue"]').click();
  await page.locator('[data-ascension-node]').click();
  await expect(page.locator('.ascension-battle-card')).toBeVisible();
  await expect(page.locator('.ascension-hand .ascension-card')).toHaveCount(5);

  const dialog = page.waitForEvent('dialog').then(async (event) => {
    expect(event.type()).toBe('confirm');
    await event.dismiss();
  });
  await page.locator('[data-ascension-exit]').click();
  await dialog;
});
