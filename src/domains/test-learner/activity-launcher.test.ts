import { describe, expect, it, vi } from 'vitest';
import { launchTestActivity } from './activity-launcher';

describe('launchTestActivity', () => {
  it('launches a supported activity when the app is ready', async () => {
    const launch = vi.fn();

    await expect(launchTestActivity('sentenceLab', { isReady: () => true, launch }))
      .resolves.toEqual({ ok: true });
    expect(launch).toHaveBeenCalledWith('sentenceLab');
  });

  it('does not launch while learning content is loading', async () => {
    const launch = vi.fn();

    await expect(launchTestActivity('picture', { isReady: () => false, launch }))
      .resolves.toEqual({ ok: false, reason: 'not-ready' });
    expect(launch).not.toHaveBeenCalled();
  });

  it('rejects unknown activity identifiers', async () => {
    const launch = vi.fn();

    await expect(launchTestActivity('unknown', { isReady: () => true, launch }))
      .resolves.toEqual({ ok: false, reason: 'invalid-activity' });
  });

  it('turns a legacy launcher exception into a visible failure result', async () => {
    const error = new Error('legacy activity failed');

    const result = await launchTestActivity('manga', {
      isReady: () => true,
      launch: () => { throw error; },
    });

    expect(result).toEqual({ ok: false, reason: 'launch-failed', error });
  });
});
