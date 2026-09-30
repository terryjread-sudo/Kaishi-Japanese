import { beforeEach, describe, expect, it } from 'vitest';
import { installAdminConfigPanel } from './admin-config-panel';

describe('admin live application panel', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<p id="adminConfigStatus"></p><div id="adminConfigRoot"></div><button data-experimental-nav="games"></button><button data-experimental-nav="community"></button><button data-experimental-nav="progress"></button>';
    installAdminConfigPanel();
  });

  it('renders safe defaults and previews an announcement locally', async () => {
    window.dispatchEvent(new Event('kaishi-admin-config-open'));
    await new Promise(resolve => window.setTimeout(resolve, 0));
    const enabled = document.querySelector<HTMLInputElement>('#adminAnnouncementEnabled')!;
    const title = document.querySelector<HTMLInputElement>('#adminAnnouncementTitle')!;
    const message = document.querySelector<HTMLTextAreaElement>('#adminAnnouncementMessage')!;
    enabled.checked = true; title.value = 'Service update'; message.value = 'New lessons are ready.';
    document.querySelector<HTMLButtonElement>('#adminConfigPreview')!.click();
    expect(document.querySelector('#runtimeAnnouncement')?.textContent).toContain('Service update');
    expect(document.querySelector('#adminConfigStatus')?.textContent).toContain('Preview applied');
  });
});
