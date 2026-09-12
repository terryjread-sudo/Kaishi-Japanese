import { expect, test } from '@playwright/test';

test('new learners can open Sensei’s Desk and review a paper', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore Journey', exact: true }).click();
  const nav = page.locator('#experimentalBottomNav');
  const desk = nav.locator('[data-experimental-nav="sensei-desk"]');
  await expect(desk).toBeVisible();
  await desk.click();
  await expect(page.locator('#senseiDesk')).toHaveClass(/active/);
  await expect(page.locator('[data-sensei-start]')).toBeVisible();
  await page.locator('[data-sensei-start]').click();
  await expect(page.locator('.sensei-desk-workspace')).toBeVisible();
  await expect(page.locator('[data-sensei-line]')).toHaveCount(2);
  await expect(page.locator('[data-sensei-submit]')).toBeDisabled();
  await expect(page.locator('[data-sensei-audio]')).toBeChecked();
});

test('leaving an active shift asks for confirmation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore Journey', exact: true }).click();
  await page.locator('#experimentalBottomNav [data-experimental-nav="sensei-desk"]').click();
  await page.locator('[data-sensei-start]').click();
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('[data-sensei-exit]').click();
  await expect(page.locator('#senseiDesk')).toHaveClass(/active/);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-sensei-exit]').click();
  await expect(page.locator('#journey')).toHaveClass(/active/);
});
