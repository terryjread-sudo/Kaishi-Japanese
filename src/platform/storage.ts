import { z } from 'zod';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface StoredEnvelope<T> {
  version: number;
  value: T;
}

export interface VersionedRepository<T> {
  load(): T | null;
  save(value: T): void;
  remove(): void;
}

export function createVersionedRepository<T>(options: {
  storage: StorageLike;
  key: string;
  version: number;
  schema: z.ZodType<T>;
  migrate?: (unknownValue: unknown, fromVersion: number) => T | null;
}): VersionedRepository<T> {
  const envelopeSchema = z.object({
    version: z.number().int().nonnegative(),
    value: z.unknown(),
  });

  return {
    load() {
      const raw = options.storage.getItem(options.key);
      if (!raw) return null;

      try {
        const envelope = envelopeSchema.parse(JSON.parse(raw));
        if (envelope.version === options.version) {
          return options.schema.parse(envelope.value);
        }
        return options.migrate?.(envelope.value, envelope.version) ?? null;
      } catch {
        return null;
      }
    },
    save(value) {
      const validated = options.schema.parse(value);
      const envelope: StoredEnvelope<T> = { version: options.version, value: validated };
      options.storage.setItem(options.key, JSON.stringify(envelope));
    },
    remove() {
      options.storage.removeItem(options.key);
    },
  };
}
