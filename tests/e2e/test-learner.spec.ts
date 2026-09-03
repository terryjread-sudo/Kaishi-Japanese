import { expect, test } from '@playwright/test';

test('test learner can launch an immersive activity after app initialization', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  await page.addInitScript(() => {
    window.sessionStorage.setItem('kq-admin-test-mode', '1');
  });

  await page.goto('/');

  const banner = page.locator('#adminTestBanner');
  const launch = page.locator('#adminTestActivityGo');
  await expect(banner).toBeVisible();
  await expect(launch).toBeEnabled({ timeout: 30_000 });
  await expect(launch).toHaveText('Launch');

  await page.locator('#adminTestActivity').selectOption('sentenceLab');
  await launch.click();

  expect(runtimeErrors).toEqual([]);
  await expect(page.locator('#sentenceLab')).toHaveClass(/active/);
  await expect(page.locator('#sentenceLabHome')).toContainText('Sentence Lab');
});
