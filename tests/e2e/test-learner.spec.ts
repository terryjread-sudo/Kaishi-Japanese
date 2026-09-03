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

test('Journey previews immersive missions through its ten-lesson horizon', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('kq-admin-test-mode', '1');
  });
  await page.goto('/');
  await page.locator('#adminTestLessonInput').fill('20');
  await page.locator('#adminTestLessonGo').click();

  await expect(page.locator('#journeyHistoryTrack')).toBeVisible();
  const journeyBackground = await page.locator('#journeyHistoryTrack').evaluate(element => getComputedStyle(element).backgroundImage);
  expect(journeyBackground).toContain('bamboo-scroll-tile.png');
  await expect(page.locator('#journeyHistoryTrack .kq-chapter-scene')).toHaveCount(0);
  await expect(page.locator('#journeyHistoryTrack .kq-activity-badge').first()).toBeVisible();
  await expect(page.locator('#journeyHistoryTrack .kq-unified-node.future .kq-activity-badge').first()).toContainText('Immersive mission ahead');
  await page.getByRole('button', { name: 'Why this route?' }).click();
  await expect(page.locator('#journeyHistoryTrack .kq-mission-detail').first()).toContainText('Reinforces');
});

test('Journey shows ten upcoming lessons and explains that the path continues', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('kq-admin-test-mode', '1');
  });
  await page.goto('/');
  await page.locator('#adminTestLessonInput').fill('1');
  await page.locator('#adminTestLessonGo').click();

  await expect(page.locator('#journeyHistoryTrack [data-kq-id^="lesson-"]')).toHaveCount(11);
  await expect(page.getByText('The path continues', { exact: true })).toBeVisible();
  await expect(page.getByText('Complete lessons to reveal more of your Journey ahead.', { exact: true })).toBeVisible();
});

test('Journey Dashboard control floats only from its title-row position', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('kq-admin-test-mode', '1');
  });
  await page.goto('/');
  await page.locator('#adminTestLessonInput').fill('1');
  await page.locator('#adminTestLessonGo').click();

  const dashboard = page.locator('#journeyBack');
  const originTop = await dashboard.evaluate(element => element.getBoundingClientRect().top);
  const scrollY = await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    window.dispatchEvent(new Event('scroll'));
    return window.scrollY;
  });
  expect(scrollY).toBeGreaterThan(4);
  await expect(dashboard).toHaveClass(/kq-floating-dashboard/);
  const floatingTop = await dashboard.evaluate(element => element.getBoundingClientRect().top);
  expect(Math.abs(floatingTop - originTop)).toBeLessThanOrEqual(1);

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(dashboard).not.toHaveClass(/kq-floating-dashboard/);
});
