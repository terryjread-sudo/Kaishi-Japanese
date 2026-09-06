export type SyncPayload = {
  version: 4;
  progress: Record<string, Record<string, unknown>>;
  meta: Record<string, unknown>;
};

const EPHEMERAL_META_KEYS = new Set(['dailyJourneyRoute', 'dailyActivity', 'dailyReviewPlan', 'activeTopicBoss']);
const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const timestamp = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0;
const unique = <T>(items: T[], key: (item: T) => string): T[] => [...new Map(items.map(item => [key(item), item])).values()];

function newestRecord(left: unknown, right: unknown, leftFallback: number, rightFallback: number): Record<string, unknown> {
  const a = asRecord(left), b = asRecord(right);
  if (!Object.keys(a).length) return b;
  if (!Object.keys(b).length) return a;
  const aTime = timestamp(a.updatedAt) || leftFallback, bTime = timestamp(b.updatedAt) || rightFallback;
  return bTime >= aTime ? b : a;
}

function mergeRecordMap(left: unknown, right: unknown, leftFallback: number, rightFallback: number) {
  const a = asRecord(left), b = asRecord(right), result: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) result[key] = newestRecord(a[key], b[key], leftFallback, rightFallback);
  return result;
}

function mergeNotebook(left: unknown, right: unknown) {
  const entries = [...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])].filter(item => asRecord(item).wordId);
  return unique(entries.map(asRecord), item => String(item.wordId)).sort((a, b) => timestamp(b.savedAt) - timestamp(a.savedAt)).slice(0, 100);
}

function mergeHistory(left: unknown, right: unknown) {
  const entries = [...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])].map(asRecord).filter(item => item.id);
  return unique(entries, item => String(item.id)).sort((a, b) => timestamp(a.completedAt) - timestamp(b.completedAt)).slice(-200);
}

function mergeRhythmHistory(left: unknown, right: unknown) {
  const a = asRecord(left), b = asRecord(right), result: Record<string, unknown> = { ...a };
  for (const [day, entry] of Object.entries(b)) result[day] = newestRecord(result[day], entry, 0, 0);
  return result;
}

function rhythmDays(history: Record<string, unknown>, now = new Date()) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let count = 0;
  const key = () => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  while (history[key()]) { count++; date.setDate(date.getDate() - 1); }
  return count;
}

/** Merges only durable learner state. Device settings and active-session state stay local. */
export function mergeSyncPayloads(local: unknown, remote: unknown, now = new Date()): SyncPayload {
  const a = asRecord(local), b = asRecord(remote), localMeta = asRecord(a.meta), remoteMeta = asRecord(b.meta);
  const localUpdated = timestamp(localMeta.updatedAt), remoteUpdated = timestamp(remoteMeta.updatedAt);
  const latestMeta = remoteUpdated >= localUpdated ? remoteMeta : localMeta;
  const progress: Record<string, Record<string, unknown>> = {};
  const localProgress = asRecord(a.progress), remoteProgress = asRecord(b.progress);
  for (const id of new Set([...Object.keys(localProgress), ...Object.keys(remoteProgress)])) progress[id] = newestRecord(localProgress[id], remoteProgress[id], localUpdated, remoteUpdated);

  const rhythmHistory = mergeRhythmHistory(localMeta.rhythmHistory, remoteMeta.rhythmHistory);
  const meta: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(latestMeta)) if (!EPHEMERAL_META_KEYS.has(key)) meta[key] = value;
  meta.kanaProgress = mergeRecordMap(localMeta.kanaProgress, remoteMeta.kanaProgress, localUpdated, remoteUpdated);
  meta.grammarProgress = mergeRecordMap(localMeta.grammarProgress, remoteMeta.grammarProgress, localUpdated, remoteUpdated);
  meta.connectorProgress = mergeRecordMap(localMeta.connectorProgress, remoteMeta.connectorProgress, localUpdated, remoteUpdated);
  meta.mangaProgress = mergeRecordMap(localMeta.mangaProgress, remoteMeta.mangaProgress, localUpdated, remoteUpdated);
  meta.conversationProgress = mergeRecordMap(localMeta.conversationProgress, remoteMeta.conversationProgress, localUpdated, remoteUpdated);
  meta.theatreProgress = mergeRecordMap(localMeta.theatreProgress, remoteMeta.theatreProgress, localUpdated, remoteUpdated);
  meta.topicProgress = mergeRecordMap(localMeta.topicProgress, remoteMeta.topicProgress, localUpdated, remoteUpdated);
  meta.rhythmHistory = rhythmHistory;
  meta.streak = rhythmDays(rhythmHistory, now);
  meta.sessionHistory = mergeHistory(localMeta.sessionHistory, remoteMeta.sessionHistory);
  meta.notebook = { ...asRecord(latestMeta.notebook), words: mergeNotebook(asRecord(localMeta.notebook).words, asRecord(remoteMeta.notebook).words) };
  for (const key of ['pathUnlocks', 'canDoAwards', 'activityPurchases', 'unlockNoticesSeen', 'unlockNoticesDismissed']) {
    meta[key] = unique([...(Array.isArray(localMeta[key]) ? localMeta[key] : []), ...(Array.isArray(remoteMeta[key]) ? remoteMeta[key] : [])], item => JSON.stringify(item));
  }
  for (const key of ['totalAnswers', 'totalCorrect', 'kanaAnswers', 'kanaCorrect', 'totalMonsterVictories', 'adventurePointsSpent']) meta[key] = Math.max(timestamp(localMeta[key]), timestamp(remoteMeta[key]));
  meta.updatedAt = Math.max(localUpdated, remoteUpdated, now.getTime());
  return { version: 4, progress, meta };
}

export function hasStartedProgress(payload: unknown) {
  const data = asRecord(payload), progress = asRecord(data.progress), meta = asRecord(data.meta);
  return Object.keys(progress).length > 0 || timestamp(meta.totalAnswers) > 0 || Object.keys(asRecord(meta.rhythmHistory)).length > 0;
}
