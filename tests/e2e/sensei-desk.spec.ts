import { expect, test, type Page } from '@playwright/test';

async function completeFirstRunTutorial(page: Page): Promise<void> {
  const tutorialStart = page.locator('[data-sensei-tutorial-start]');
  await expect(tutorialStart).toBeVisible();
  await page.locator('[data-sensei-tutorial-choice="correct"]').click();
  await expect(page.locator('[data-sensei-tutorial-feedback]')).toContainText('Correct');
  await tutorialStart.click();
}

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
  await completeFirstRunTutorial(page);
  await expect(page.locator('.sensei-desk-workspace')).toBeVisible();
  await expect(page.locator('[data-sensei-line]')).toHaveCount(2);
  await expect(page.locator('[data-sensei-submit]')).toBeDisabled();
  await expect(page.locator('[data-sensei-audio]')).toBeChecked();
  await page.locator('[data-sensei-handbook-toggle]').first().click();
  await expect(page.locator('.sensei-handbook.is-open')).toBeVisible();
  await expect(page.locator('[data-sensei-handbook-form]')).toBeVisible();
});

test('a completed paper shows the stamping transition before feedback', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore Journey', exact: true }).click();
  await page.locator('#experimentalBottomNav [data-experimental-nav="sensei-desk"]').click();
  await page.locator('[data-sensei-start]').click();
  await completeFirstRunTutorial(page);

  const firstLine = page.locator('[data-sensei-line]').nth(0);
  const secondLine = page.locator('[data-sensei-line]').nth(1);
  await firstLine.locator('[data-sensei-value="correct"]').click();
  await secondLine.locator('[data-sensei-value="needs-correction"]').click();
  await secondLine.locator('[data-sensei-error-tag="particle"]').click();
  const submit = page.locator('[data-sensei-submit]');
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.locator('.sensei-paper.is-stamping')).toBeVisible();
  await expect(page.locator('.sensei-stamp-drop')).toBeVisible();
  await expect(submit).toContainText('Stamping paper');
  await expect(page.locator('.sensei-correction')).toBeVisible({ timeout: 2000 });
});

test('leaving an active shift asks for confirmation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore Journey', exact: true }).click();
  await page.locator('#experimentalBottomNav [data-experimental-nav="sensei-desk"]').click();
  await page.locator('[data-sensei-start]').click();
  await completeFirstRunTutorial(page);
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('[data-sensei-exit]').click();
  await expect(page.locator('#senseiDesk')).toHaveClass(/active/);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-sensei-exit]').click();
  await expect(page.locator('#journey')).toHaveClass(/active/);
});
