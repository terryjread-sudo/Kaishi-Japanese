import { describe, expect, it } from 'vitest';
import { offlinePackStatus } from './offline-pack';

describe('offlinePackStatus', () => {
  it('does not show a warning when no pack exists', () => {
    expect(offlinePackStatus(null, '11.27.0')).toEqual({ kind: 'none' });
  });

  it('recognises a current pack', () => {
    expect(offlinePackStatus({ version: '11.27.0', pack: 'standard' }, '11.27.0').kind)
      .toBe('current');
  });

  it('marks a downloaded older release as outdated', () => {
    expect(offlinePackStatus({ version: '11.26.0', pack: 'complete' }, '11.27.0').kind)
      .toBe('outdated');
  });

  it('treats corrupt metadata as no installed pack', () => {
    expect(offlinePackStatus({ version: 4 }, '11.27.0')).toEqual({ kind: 'none' });
  });
});
