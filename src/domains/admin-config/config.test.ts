import { describe, expect, it } from 'vitest';
import { DEFAULT_RUNTIME_CONFIG, parseRuntimeConfig, runtimeConfigSchema, validPublicUrl } from './config';

describe('live application configuration', () => {
  it('accepts a complete safe configuration', () => {
    expect(runtimeConfigSchema.parse(DEFAULT_RUNTIME_CONFIG)).toEqual(DEFAULT_RUNTIME_CONFIG);
  });

  it('falls back atomically when remote configuration is incomplete', () => {
    const parsed = parseRuntimeConfig({ schemaVersion: 1, features: { games: false } });
    expect(parsed).toEqual(DEFAULT_RUNTIME_CONFIG);
    expect(parsed).not.toBe(DEFAULT_RUNTIME_CONFIG);
  });

  it('limits owner-editable text before it reaches the interface', () => {
    expect(runtimeConfigSchema.safeParse({ ...DEFAULT_RUNTIME_CONFIG, announcement: { ...DEFAULT_RUNTIME_CONFIG.announcement, message: 'x'.repeat(281) } }).success).toBe(false);
  });

  it('rejects executable links while allowing web and email destinations', () => {
    expect(validPublicUrl('javascript:alert(1)')).toBe(false);
    expect(validPublicUrl('https://kaishi.uk/help')).toBe(true);
    expect(validPublicUrl('mailto:help@kaishi.uk')).toBe(true);
  });
});
