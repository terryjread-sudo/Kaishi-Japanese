import { DEFAULT_RUNTIME_CONFIG, parseRuntimeConfig, runtimeConfigSchema, validPublicUrl, type RuntimeConfig, type RuntimeConfigRecord } from '../domains/admin-config/config';
import { deviceStorage } from './storage';

const CACHE_KEY = 'kq-runtime-config-cache-v1';

interface RpcError { message: string }
interface RpcClient { rpc(name: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: RpcError | null }> }
interface RuntimeRow { config?: unknown; revision?: unknown; updated_at?: unknown; updatedAt?: unknown }
export interface RuntimeConfigHistory { revision: number; config: RuntimeConfig; changedAt: string; changedBy: string | null }

let current: RuntimeConfigRecord = { config: structuredClone(DEFAULT_RUNTIME_CONFIG), revision: 0, updatedAt: null };
function remoteControlsAllowed(): boolean { try { return window.sessionStorage.getItem('kq-admin-test-mode') !== '1'; } catch { return true; } }

function cloudClient(): RpcClient | null {
  const cloud = (window as Window & { KaishiCloud?: { client?: () => RpcClient | null } }).KaishiCloud;
  return cloud?.client?.() || null;
}

function rowRecord(value: unknown): RuntimeConfigRecord {
  const row = (Array.isArray(value) ? value[0] : value) as RuntimeRow | null;
  return {
    config: parseRuntimeConfig(row?.config),
    revision: Math.max(0, Number(row?.revision) || 0),
    updatedAt: typeof (row?.updated_at ?? row?.updatedAt) === 'string' ? String(row?.updated_at ?? row?.updatedAt) : null,
  };
}

function loadCache(): RuntimeConfigRecord | null {
  try { const raw = deviceStorage().getItem(CACHE_KEY); return raw ? rowRecord(JSON.parse(raw)) : null; } catch { return null; }
}

function saveCache(record: RuntimeConfigRecord): void {
  deviceStorage().setItem(CACHE_KEY, JSON.stringify({ config: record.config, revision: record.revision, updated_at: record.updatedAt }));
}

function toggleFeature(selector: string, enabled: boolean): void {
  document.querySelectorAll<HTMLElement>(selector).forEach(element => {
    element.hidden = !enabled;
    element.setAttribute('aria-hidden', String(!enabled));
  });
}

function renderAnnouncement(config: RuntimeConfig): void {
  let banner = document.querySelector<HTMLElement>('#runtimeAnnouncement');
  if (!config.announcement.enabled || (!config.announcement.title && !config.announcement.message)) { banner?.remove(); return; }
  if (!banner) { banner = document.createElement('aside'); banner.id = 'runtimeAnnouncement'; banner.className = 'runtime-announcement'; banner.setAttribute('role', 'status'); document.body.prepend(banner); }
  banner.replaceChildren();
  const copy = document.createElement('div');
  const title = document.createElement('strong'); title.textContent = config.announcement.title;
  const message = document.createElement('span'); message.textContent = config.announcement.message;
  copy.append(title, message); banner.append(copy);
  if (config.announcement.linkLabel && config.announcement.linkUrl && validPublicUrl(config.announcement.linkUrl)) { const link = document.createElement('a'); link.textContent = config.announcement.linkLabel; link.href = config.announcement.linkUrl; link.target = '_blank'; link.rel = 'noopener'; banner.append(link); }
  const close = document.createElement('button'); close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', 'Dismiss announcement'); close.onclick = () => banner?.remove(); banner.append(close);
}

function renderSupport(config: RuntimeConfig): void {
  let link = document.querySelector<HTMLAnchorElement>('#runtimeSupportLink');
  if (!config.support.enabled || !config.support.label || !config.support.url || !validPublicUrl(config.support.url)) { link?.remove(); return; }
  if (!link) { link = document.createElement('a'); link.id = 'runtimeSupportLink'; link.className = 'runtime-support-link'; link.target = '_blank'; link.rel = 'noopener'; document.body.append(link); }
  link.textContent = config.support.label; link.href = config.support.url;
}

export function applyRuntimeConfig(config: RuntimeConfig): void {
  renderAnnouncement(config); renderSupport(config);
  toggleFeature('[data-experimental-nav="games"]', config.features.games);
  toggleFeature('[data-experimental-nav="community"]', config.features.community);
  toggleFeature('[data-experimental-nav="progress"]', config.features.japanReady);
  toggleFeature('[data-games-checkpoint]', config.features.signalDesk);
  toggleFeature('[data-device-repair-launch]', config.features.deviceRepair);
  document.dispatchEvent(new CustomEvent('kaishi-runtime-config-changed', { detail: config }));
}

export function getRuntimeConfig(): RuntimeConfig { return current.config; }
export function getRuntimeConfigRecord(): RuntimeConfigRecord { return current; }

export async function refreshRuntimeConfig(): Promise<RuntimeConfigRecord> {
  if (!remoteControlsAllowed()) { const cached = loadCache(); if (cached) current = cached; applyRuntimeConfig(current.config); return current; }
  const client = cloudClient();
  if (!client) { const cached = loadCache(); if (cached) current = cached; applyRuntimeConfig(current.config); return current; }
  const { data, error } = await client.rpc('get_kaishi_runtime_config');
  if (error) { const cached = loadCache(); if (cached) current = cached; applyRuntimeConfig(current.config); return current; }
  current = rowRecord(data); saveCache(current); applyRuntimeConfig(current.config); return current;
}

export async function publishRuntimeConfig(config: RuntimeConfig, expectedRevision: number): Promise<RuntimeConfigRecord> {
  const validated = runtimeConfigSchema.parse(config); const client = cloudClient(); if (!client) throw new Error('Cloud administration is not available yet.');
  const { data, error } = await client.rpc('set_kaishi_runtime_config', { p_config: validated, p_expected_revision: expectedRevision });
  if (error) throw new Error(error.message); current = rowRecord(data); saveCache(current); applyRuntimeConfig(current.config); return current;
}

export async function loadRuntimeConfigHistory(): Promise<RuntimeConfigHistory[]> {
  const client = cloudClient(); if (!client) throw new Error('Cloud administration is not available yet.');
  const { data, error } = await client.rpc('get_kaishi_runtime_config_history', { p_limit: 20 }); if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data : []).map(value => { const row = value as Record<string, unknown>; return { revision: Number(row.revision) || 0, config: parseRuntimeConfig(row.config), changedAt: String(row.changed_at || ''), changedBy: typeof row.changed_by === 'string' ? row.changed_by : null }; });
}

export async function rollbackRuntimeConfig(revision: number): Promise<RuntimeConfigRecord> {
  const client = cloudClient(); if (!client) throw new Error('Cloud administration is not available yet.');
  const { data, error } = await client.rpc('rollback_kaishi_runtime_config', { p_revision: revision }); if (error) throw new Error(error.message);
  current = rowRecord(data); saveCache(current); applyRuntimeConfig(current.config); return current;
}

export function installRuntimeConfig(): void {
  const cached = loadCache(); if (cached) current = cached; applyRuntimeConfig(current.config);
  window.setTimeout(() => void refreshRuntimeConfig(), 0);
  window.addEventListener('kaishi-auth-change', () => void refreshRuntimeConfig());
}
