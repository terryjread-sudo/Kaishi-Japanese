import { describe, expect, it } from 'vitest';
import type { OfflineCatalog } from './coverage';
import { selectPack } from './coverage';

const catalog: OfflineCatalog = {
  schemaVersion: 1,
  production: true,
  core: ['index.html'],
  assets: [
    { url: 'index.html', bytes: 10, sha256: 'a', kind: 'text' },
    { url: 'travel.json', bytes: 20, sha256: 'b', kind: 'text' },
    { url: 'lesson.webp', bytes: 30, sha256: 'c', kind: 'images' },
    { url: 'optional-game.png', bytes: 40, sha256: 'd', kind: 'images' },
  ],
  groups: [
    { id: 'lesson-1', title: 'Lesson 1', wordIds: ['word-1'], urls: ['lesson.webp'], speechOnly: false },
    { id: 'travel-courtesy', title: 'Courtesy', wordIds: [], urls: ['travel.json'], speechOnly: true },
  ],
};

describe('offline pack selection', () => {
  it('keeps essential downloads to the shell and travel tools', () => {
    expect(selectPack(catalog, 'essential', []).map((asset) => asset.url))
      .toEqual(['index.html', 'travel.json']);
  });

  it('reserves unrelated optional media for the full pack', () => {
    expect(selectPack(catalog, 'full', []).map((asset) => asset.url))
      .toContain('optional-game.png');
  });
});
