import { z } from 'zod';

export const runtimeConfigSchema = z.object({
  schemaVersion: z.literal(1),
  announcement: z.object({
    enabled: z.boolean(),
    title: z.string().trim().max(80),
    message: z.string().trim().max(280),
    linkLabel: z.string().trim().max(40),
    linkUrl: z.string().trim().max(300),
  }),
  features: z.object({
    games: z.boolean(),
    signalDesk: z.boolean(),
    deviceRepair: z.boolean(),
    japanReady: z.boolean(),
    community: z.boolean(),
  }),
  gameHub: z.object({
    heading: z.string().trim().min(1).max(80),
    introduction: z.string().trim().max(180),
    signalTitle: z.string().trim().min(1).max(60),
    signalDescription: z.string().trim().max(180),
    deviceTitle: z.string().trim().min(1).max(60),
    deviceDescription: z.string().trim().max(180),
  }),
  avatarUnlocks: z.object({
    journeyGirlRhythmDays: z.coerce.number().int().min(0).max(365),
    journeyBoyRhythmDays: z.coerce.number().int().min(0).max(365),
    journeyFriendRhythmDays: z.coerce.number().int().min(0).max(365),
    harajukuGirlMasteredWords: z.coerce.number().int().min(0).max(2000),
    harajukuGuyMasteredWords: z.coerce.number().int().min(0).max(2000),
    izakayaCookMasteredWords: z.coerce.number().int().min(0).max(2000),
  }).default({
    journeyGirlRhythmDays: 5,
    journeyBoyRhythmDays: 20,
    journeyFriendRhythmDays: 30,
    harajukuGirlMasteredWords: 10,
    harajukuGuyMasteredWords: 25,
    izakayaCookMasteredWords: 50,
  }),
  support: z.object({
    enabled: z.boolean(),
    label: z.string().trim().max(50),
    url: z.string().trim().max(300),
  }),
});

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

export interface RuntimeConfigRecord {
  config: RuntimeConfig;
  revision: number;
  updatedAt: string | null;
}

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  schemaVersion: 1,
  announcement: { enabled: false, title: '', message: '', linkLabel: '', linkUrl: '' },
  features: { games: true, signalDesk: true, deviceRepair: true, japanReady: true, community: true },
  gameHub: {
    heading: 'Choose a Japanese challenge',
    introduction: 'Each game strengthens your Kaishi learning record.',
    signalTitle: 'Section K · Signal Desk',
    signalDescription: 'Decode Japanese intercepts, apply a changing codebook, and decide what must be escalated.',
    deviceTitle: 'Device Repair',
    deviceDescription: 'Restore a detailed cassette player with words you have already learned.',
  },
  avatarUnlocks: {
    journeyGirlRhythmDays: 5,
    journeyBoyRhythmDays: 20,
    journeyFriendRhythmDays: 30,
    harajukuGirlMasteredWords: 10,
    harajukuGuyMasteredWords: 25,
    izakayaCookMasteredWords: 50,
  },
  support: { enabled: false, label: 'Contact Kaishi support', url: '' },
};

export function parseRuntimeConfig(value: unknown): RuntimeConfig {
  const result = runtimeConfigSchema.safeParse(value);
  return result.success ? result.data : structuredClone(DEFAULT_RUNTIME_CONFIG);
}

export function validPublicUrl(value: string): boolean {
  if (!value) return true;
  try { const url = new URL(value, 'https://kaishi.invalid'); return ['http:', 'https:', 'mailto:'].includes(url.protocol); } catch { return false; }
}
