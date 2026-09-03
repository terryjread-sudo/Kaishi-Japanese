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
  await expect(page.locator('#restorePointsBtn')).toBeHidden();
  await expect(banner).toBeVisible();
  await expect(launch).toBeEnabled({ timeout: 30_000 });
  await expect(launch).toHaveText('Launch');

  await page.locator('#adminTestActivity').selectOption('sentenceLab');
  await launch.click();

  expect(runtimeErrors).toEqual([]);
  await expect(page.locator('#sentenceLab')).toHaveClass(/active/);
  await expect(page.locator('#sentenceLabHome')).toContainText('Sentence Lab');

  await page.locator('#adminTestActivity').selectOption('colosseum');
  await launch.click();
  await expect(page.locator('#listenBattle')).toHaveClass(/active/);
});

test('test learner lesson jump renders the same early Journey flow', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('kq-admin-test-mode', '1');
  });
  await page.goto('/');
  await page.locator('#adminTestLessonInput').fill('1');
  await page.locator('#adminTestLessonGo').click();

  await expect(page.locator('#journey')).toHaveClass(/active/);
  await expect(page.locator('#journeyHistoryTrack .kq-unified-timeline')).toBeVisible();
  await expect(page.locator('#journeyHistoryTrack')).not.toContainText('Your lessons will appear here as you progress.');
  await expect(page.locator('#journeyHistoryTrack [data-kq-activity="colosseum"]')).toHaveCount(0);
  await expect(page.getByText('Next immersive event:', { exact: false })).toHaveCount(0);
});

test('Journey shows a scheduled immersive mission within its chapter scene', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('kq-admin-test-mode', '1');
  });
  await page.goto('/');
  await page.locator('#adminTestLessonInput').fill('20');
  await page.locator('#adminTestLessonGo').click();

  await expect(page.locator('#journeyHistoryTrack [data-kq-scene]').first()).toBeVisible();
  await expect(page.locator('#journeyHistoryTrack .kq-activity-badge').first()).toBeVisible();
  await page.getByRole('button', { name: 'Why this route?' }).click();
  await expect(page.locator('#journeyHistoryTrack .kq-mission-detail').first()).toContainText('Reinforces');
});
