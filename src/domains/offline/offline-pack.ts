import { z } from 'zod';

export const offlinePackSchema = z.object({
  version: z.string().min(1),
  pack: z.enum(['standard', 'complete']).default('standard'),
  downloadedAt: z.number().int().positive().optional(),
});

export type OfflinePack = z.infer<typeof offlinePackSchema>;

export type OfflinePackStatus =
  | { kind: 'none' }
  | { kind: 'current'; pack: OfflinePack }
  | { kind: 'outdated'; pack: OfflinePack };

export function offlinePackStatus(value: unknown, appVersion: string): OfflinePackStatus {
  const parsed = offlinePackSchema.safeParse(value);
  if (!parsed.success) return { kind: 'none' };
  if (parsed.data.version === appVersion) return { kind: 'current', pack: parsed.data };
  return { kind: 'outdated', pack: parsed.data };
}
