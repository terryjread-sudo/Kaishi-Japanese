export const TEST_ACTIVITY_IDS = [
  'picture',
  'karuta',
  'conversation',
  'sentenceLab',
  'theatre',
  'builder',
  'manga',
  'battle',
  'colosseum',
  'kotobaEcho',
] as const;

export type TestActivityId = (typeof TEST_ACTIVITY_IDS)[number];

export interface ActivityLauncherPort {
  isReady(): boolean;
  launch(activityId: TestActivityId): void | Promise<void>;
}

export type ActivityLaunchResult =
  | { ok: true }
  | { ok: false; reason: 'not-ready' | 'invalid-activity' | 'launch-failed'; error?: unknown };

export function isTestActivityId(value: string): value is TestActivityId {
  return TEST_ACTIVITY_IDS.some((activityId) => activityId === value);
}

export async function launchTestActivity(
  value: string,
  port: ActivityLauncherPort,
): Promise<ActivityLaunchResult> {
  if (!isTestActivityId(value)) return { ok: false, reason: 'invalid-activity' };
  if (!port.isReady()) return { ok: false, reason: 'not-ready' };

  try {
    await port.launch(value);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'launch-failed', error };
  }
}
