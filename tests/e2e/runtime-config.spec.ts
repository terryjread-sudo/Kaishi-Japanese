import { expect, test } from '@playwright/test';

test('cached live controls customise learner entry points without a deployment', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('kq-runtime-config-cache-v1', JSON.stringify({
      revision: 7,
      updated_at: '2026-09-30T12:00:00.000Z',
      config: {
        schemaVersion: 1,
        announcement: { enabled: true, title: 'New practice available', message: 'Try the updated listening desk today.', linkLabel: 'Read more', linkUrl: 'https://example.com/update' },
        features: { games: true, signalDesk: true, deviceRepair: false, japanReady: true, community: false },
        gameHub: { heading: 'Choose today’s mission', introduction: 'Short missions, lasting Japanese.', signalTitle: 'Listening Bureau', signalDescription: 'Decode a classified Japanese signal.', deviceTitle: 'Workshop', deviceDescription: 'Repair a device.' },
        support: { enabled: true, label: 'Ask for help', url: 'mailto:help@example.com' },
      },
    }));
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#runtimeAnnouncement')).toContainText('New practice available');
  await expect(page.locator('#runtimeSupportLink')).toHaveText('Ask for help');
  await page.getByRole('button', { name: 'Explore Journey', exact: true }).click();
  await expect(page.locator('[data-experimental-nav="community"]')).toBeHidden();
  await page.locator('[data-experimental-nav="games"]').click();
  await expect(page.locator('.game-hub-heading')).toContainText('Choose today’s mission');
  await expect(page.locator('[data-games-checkpoint]')).toContainText('Listening Bureau');
  await expect(page.locator('.game-hub [data-device-repair-launch]')).toHaveCount(0);
});
