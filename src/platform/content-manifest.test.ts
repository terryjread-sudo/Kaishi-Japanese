// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTENT_DATA_FILES, OFFLINE_CORE_FILES } from './content-manifest';

const root = path.resolve(import.meta.dirname, '..', '..');

describe('content manifest', () => {
  it('contains no duplicate offline entries', () => {
    expect(new Set(OFFLINE_CORE_FILES).size).toBe(OFFLINE_CORE_FILES.length);
  });

  it('references files that exist in the repository', () => {
    const missing = CONTENT_DATA_FILES
      .map((file) => file.replace(/^\.\//, ''))
      .filter((file) => !fs.existsSync(path.join(root, file)));

    expect(missing).toEqual([]);
  });

  it('keeps the automatic offline shell below 15 MB', () => {
    const files = OFFLINE_CORE_FILES
      .map((file) => file.replace(/^\.\//, '') || 'index.html')
      .filter((file, index, all) => all.indexOf(file) === index);
    const bytes = files.reduce((total, file) => total + fs.statSync(path.join(root, file)).size, 0);

    expect(bytes).toBeLessThan(15 * 1024 * 1024);
    expect(files.some((file) => file.startsWith('media/mnemonics/katakana-core-'))).toBe(false);
  });
});
