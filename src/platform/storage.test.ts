import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createVersionedRepository, type StorageLike } from './storage';

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

describe('createVersionedRepository', () => {
  it('round-trips validated versioned data', () => {
    const repository = createVersionedRepository({
      storage: memoryStorage(),
      key: 'progress',
      version: 2,
      schema: z.object({ answers: z.number().int().nonnegative() }),
    });

    repository.save({ answers: 12 });
    expect(repository.load()).toEqual({ answers: 12 });
  });

  it('returns null for corrupt data instead of crashing app startup', () => {
    const storage = memoryStorage();
    storage.setItem('progress', '{broken');
    const repository = createVersionedRepository({
      storage,
      key: 'progress',
      version: 1,
      schema: z.object({ answers: z.number() }),
    });

    expect(repository.load()).toBeNull();
  });

  it('runs an explicit migration for older envelopes', () => {
    const storage = memoryStorage();
    storage.setItem('progress', JSON.stringify({ version: 1, value: { count: 4 } }));
    const repository = createVersionedRepository({
      storage,
      key: 'progress',
      version: 2,
      schema: z.object({ answers: z.number() }),
      migrate: (value, version) => version === 1 && typeof value === 'object' && value !== null
        ? { answers: Number((value as { count?: unknown }).count ?? 0) }
        : null,
    });

    expect(repository.load()).toEqual({ answers: 4 });
  });
});
