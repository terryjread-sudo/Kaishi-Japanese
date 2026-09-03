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
});
