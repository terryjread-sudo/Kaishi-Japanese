import { DEFAULT_RUNTIME_CONFIG, runtimeConfigSchema, validPublicUrl, type RuntimeConfig } from '../domains/admin-config/config';
import { applyRuntimeConfig, getRuntimeConfigRecord, loadRuntimeConfigHistory, publishRuntimeConfig, refreshRuntimeConfig, rollbackRuntimeConfig } from '../platform/runtime-config';
import './admin-config-panel.css';

const root = (): HTMLElement | null => document.querySelector('#adminConfigRoot');
const field = <T extends HTMLInputElement | HTMLTextAreaElement>(id: string): T | null => document.querySelector<T>(`#${id}`);
const bool = (id: string): boolean => Boolean(field<HTMLInputElement>(id)?.checked);
const value = (id: string): string => field<HTMLInputElement | HTMLTextAreaElement>(id)?.value.trim() || '';
const numberValue = (id: string): number => Number(field<HTMLInputElement>(id)?.value || 0);
let revision = 0;

function setStatus(message: string, state = ''): void { const target = document.querySelector<HTMLElement>('#adminConfigStatus'); if (target) { target.textContent = message; target.dataset.state = state; } }
function setValue(id: string, next: string): void { const target = field(id); if (target) target.value = next; }
function setBool(id: string, next: boolean): void { const target = field<HTMLInputElement>(id); if (target) target.checked = next; }

function populate(config: RuntimeConfig): void {
  setBool('adminAnnouncementEnabled', config.announcement.enabled); setValue('adminAnnouncementTitle', config.announcement.title); setValue('adminAnnouncementMessage', config.announcement.message); setValue('adminAnnouncementLinkLabel', config.announcement.linkLabel); setValue('adminAnnouncementLinkUrl', config.announcement.linkUrl);
  setBool('adminFeatureGames', config.features.games); setBool('adminFeatureSignal', config.features.signalDesk); setBool('adminFeatureRepair', config.features.deviceRepair); setBool('adminFeatureJapan', config.features.japanReady); setBool('adminFeatureCommunity', config.features.community);
  setValue('adminGameHeading', config.gameHub.heading); setValue('adminGameIntro', config.gameHub.introduction); setValue('adminSignalTitle', config.gameHub.signalTitle); setValue('adminSignalDescription', config.gameHub.signalDescription); setValue('adminRepairTitle', config.gameHub.deviceTitle); setValue('adminRepairDescription', config.gameHub.deviceDescription);
  setValue('adminAvatarJourneyGirl', String(config.avatarUnlocks.journeyGirlRhythmDays)); setValue('adminAvatarJourneyBoy', String(config.avatarUnlocks.journeyBoyRhythmDays)); setValue('adminAvatarJourneyFriend', String(config.avatarUnlocks.journeyFriendRhythmDays));
  setValue('adminAvatarHarajukuGirl', String(config.avatarUnlocks.harajukuGirlMasteredWords)); setValue('adminAvatarHarajukuGuy', String(config.avatarUnlocks.harajukuGuyMasteredWords)); setValue('adminAvatarIzakayaCook', String(config.avatarUnlocks.izakayaCookMasteredWords));
  setBool('adminSupportEnabled', config.support.enabled); setValue('adminSupportLabel', config.support.label); setValue('adminSupportUrl', config.support.url);
}

function readDraft(): RuntimeConfig {
  const draft = {
    schemaVersion: 1 as const,
    announcement: { enabled: bool('adminAnnouncementEnabled'), title: value('adminAnnouncementTitle'), message: value('adminAnnouncementMessage'), linkLabel: value('adminAnnouncementLinkLabel'), linkUrl: value('adminAnnouncementLinkUrl') },
    features: { games: bool('adminFeatureGames'), signalDesk: bool('adminFeatureSignal'), deviceRepair: bool('adminFeatureRepair'), japanReady: bool('adminFeatureJapan'), community: bool('adminFeatureCommunity') },
    gameHub: { heading: value('adminGameHeading'), introduction: value('adminGameIntro'), signalTitle: value('adminSignalTitle'), signalDescription: value('adminSignalDescription'), deviceTitle: value('adminRepairTitle'), deviceDescription: value('adminRepairDescription') },
    avatarUnlocks: { journeyGirlRhythmDays: numberValue('adminAvatarJourneyGirl'), journeyBoyRhythmDays: numberValue('adminAvatarJourneyBoy'), journeyFriendRhythmDays: numberValue('adminAvatarJourneyFriend'), harajukuGirlMasteredWords: numberValue('adminAvatarHarajukuGirl'), harajukuGuyMasteredWords: numberValue('adminAvatarHarajukuGuy'), izakayaCookMasteredWords: numberValue('adminAvatarIzakayaCook') },
    support: { enabled: bool('adminSupportEnabled'), label: value('adminSupportLabel'), url: value('adminSupportUrl') },
  };
  const parsed = runtimeConfigSchema.parse(draft);
  if (!validPublicUrl(parsed.announcement.linkUrl) || !validPublicUrl(parsed.support.url)) throw new Error('Announcement and support links must use http, https or mailto.');
  return parsed;
}

function downloadConfig(): void {
  try { const blob = new Blob([JSON.stringify(readDraft(), null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `kaishi-live-config-r${revision}.json`; link.click(); URL.revokeObjectURL(url); setStatus('Configuration exported.', 'ok'); } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not export configuration.', 'error'); }
}

async function importConfig(event: Event): Promise<void> {
  const input = event.currentTarget as HTMLInputElement; const file = input.files?.[0]; if (!file) return;
  try { const imported = runtimeConfigSchema.parse(JSON.parse(await file.text())); populate(imported); setStatus('Configuration imported as a draft. Preview or publish it when ready.', 'ok'); } catch { setStatus('That file is not a valid Kaishi live configuration.', 'error'); } finally { input.value = ''; }
}

async function renderHistory(): Promise<void> {
  const list = document.querySelector<HTMLElement>('#adminConfigHistory'); if (!list) return;
  list.innerHTML = '<p class="muted">Loading revision history…</p>';
  try {
    const entries = await loadRuntimeConfigHistory(); list.replaceChildren();
    if (!entries.length) { list.innerHTML = '<p class="muted">No earlier published revisions yet.</p>'; return; }
    entries.forEach(entry => { const article = document.createElement('article'); const copy = document.createElement('div'); const title = document.createElement('strong'); title.textContent = `Revision ${entry.revision}`; const meta = document.createElement('small'); meta.textContent = `${new Date(entry.changedAt).toLocaleString()}${entry.changedBy ? ` · ${entry.changedBy}` : ''}`; copy.append(title, meta); const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Restore'; button.onclick = async () => { if (!confirm(`Restore revision ${entry.revision} for all learners?`)) return; button.disabled = true; try { const record = await rollbackRuntimeConfig(entry.revision); revision = record.revision; populate(record.config); setStatus(`Revision ${entry.revision} restored and published as revision ${revision}.`, 'ok'); await renderHistory(); } catch (error) { setStatus(error instanceof Error ? error.message : 'Rollback failed.', 'error'); } finally { button.disabled = false; } }; article.append(copy, button); list.append(article); });
  } catch (error) { list.innerHTML = ''; setStatus(error instanceof Error ? error.message : 'Could not load revision history.', 'error'); }
}

function renderShell(): void {
  const target = root(); if (!target || target.dataset.ready === 'true') return; target.dataset.ready = 'true';
  target.innerHTML = `<div class="admin-config-grid"><section><span class="eyebrow">Release communication</span><h4>Announcement banner</h4><label class="admin-config-toggle"><input id="adminAnnouncementEnabled" type="checkbox"><span>Show to every learner</span></label><label>Title<input id="adminAnnouncementTitle" maxlength="80"></label><label>Message<textarea id="adminAnnouncementMessage" maxlength="280" rows="3"></textarea></label><div class="admin-config-pair"><label>Link label<input id="adminAnnouncementLinkLabel" maxlength="40"></label><label>Link URL<input id="adminAnnouncementLinkUrl" maxlength="300" inputmode="url"></label></div></section><section><span class="eyebrow">Availability</span><h4>Feature controls</h4><div class="admin-config-switches"><label><input id="adminFeatureGames" type="checkbox"> Games navigation</label><label><input id="adminFeatureSignal" type="checkbox"> Signal Desk</label><label><input id="adminFeatureRepair" type="checkbox"> Device Repair</label><label><input id="adminFeatureJapan" type="checkbox"> Japan Ready</label><label><input id="adminFeatureCommunity" type="checkbox"> Community</label></div><p class="muted">Disabling an area removes its entry points for learners. Re-enable it here at any time.</p></section><section class="admin-config-wide"><span class="eyebrow">Editable copy</span><h4>Games page</h4><div class="admin-config-pair"><label>Page heading<input id="adminGameHeading" maxlength="80"></label><label>Introduction<input id="adminGameIntro" maxlength="180"></label><label>Signal Desk title<input id="adminSignalTitle" maxlength="60"></label><label>Signal Desk description<textarea id="adminSignalDescription" maxlength="180" rows="2"></textarea></label><label>Device Repair title<input id="adminRepairTitle" maxlength="60"></label><label>Device Repair description<textarea id="adminRepairDescription" maxlength="180" rows="2"></textarea></label></div></section><section><span class="eyebrow">Learner help</span><h4>Support shortcut</h4><label class="admin-config-toggle"><input id="adminSupportEnabled" type="checkbox"><span>Show support link</span></label><label>Link label<input id="adminSupportLabel" maxlength="50"></label><label>URL or email link<input id="adminSupportUrl" maxlength="300" inputmode="url"></label></section><section><span class="eyebrow">Safety</span><h4>Portable configuration</h4><div class="admin-config-file-actions"><button id="adminConfigExport" type="button">Export JSON</button><label class="file">Import JSON<input id="adminConfigImport" type="file" accept="application/json"></label><button id="adminConfigDefaults" type="button">Load safe defaults</button></div><p class="muted">Import and defaults only change the draft until you publish.</p></section></div><div class="admin-config-actions"><button id="adminConfigRefresh" type="button">Discard draft</button><button id="adminConfigPreview" type="button">Preview on this device</button><button id="adminConfigPublish" type="button" class="primary">Publish to all learners</button></div><details class="admin-config-history-wrap"><summary>Published revision history and rollback</summary><div id="adminConfigHistory" class="admin-config-history"></div></details>`;
  target.querySelector('.admin-config-wide')?.insertAdjacentHTML('afterend', `<section class="admin-config-wide"><span class="eyebrow">Progression</span><h4>Avatar unlock limits</h4><p class="muted">Set when each bonus character becomes available to every learner. Use 0 for immediate availability.</p><div class="admin-config-unlocks"><label>Sakura Guide · rhythm days<input id="adminAvatarJourneyGirl" type="number" min="0" max="365" step="1"></label><label>Lake Explorer · rhythm days<input id="adminAvatarJourneyBoy" type="number" min="0" max="365" step="1"></label><label>Cherry Friend · rhythm days<input id="adminAvatarJourneyFriend" type="number" min="0" max="365" step="1"></label><label>Harajuku Girl · mastered words<input id="adminAvatarHarajukuGirl" type="number" min="0" max="2000" step="1"></label><label>Harajuku Guy · mastered words<input id="adminAvatarHarajukuGuy" type="number" min="0" max="2000" step="1"></label><label>Izakaya Cook · mastered words<input id="adminAvatarIzakayaCook" type="number" min="0" max="2000" step="1"></label></div></section>`);
  document.querySelector('#adminConfigExport')?.addEventListener('click', downloadConfig);
  field('adminConfigImport')?.addEventListener('change', event => void importConfig(event));
  document.querySelector('#adminConfigDefaults')?.addEventListener('click', () => { populate(structuredClone(DEFAULT_RUNTIME_CONFIG)); setStatus('Safe defaults loaded as a draft.', 'ok'); });
  document.querySelector('#adminConfigPreview')?.addEventListener('click', () => { try { applyRuntimeConfig(readDraft()); setStatus('Preview applied on this device only. Publish when satisfied.', 'ok'); } catch (error) { setStatus(error instanceof Error ? error.message : 'Preview failed.', 'error'); } });
  document.querySelector('#adminConfigRefresh')?.addEventListener('click', () => void openPanel());
  document.querySelector('#adminConfigPublish')?.addEventListener('click', async event => { const button = event.currentTarget as HTMLButtonElement; if (!confirm('Publish these controls to all learners?')) return; button.disabled = true; setStatus('Publishing configuration…', 'working'); try { const record = await publishRuntimeConfig(readDraft(), revision); revision = record.revision; populate(record.config); setStatus(`Published revision ${revision}. Learners receive it on refresh.`, 'ok'); await renderHistory(); } catch (error) { setStatus(error instanceof Error ? error.message : 'Publishing failed.', 'error'); } finally { button.disabled = false; } });
}

async function openPanel(): Promise<void> {
  renderShell(); setStatus('Loading the published configuration…', 'working');
  try { const record = await refreshRuntimeConfig(); revision = record.revision; populate(record.config); setStatus(`Published revision ${revision}${record.updatedAt ? ` · updated ${new Date(record.updatedAt).toLocaleString()}` : ''}.`, 'ok'); await renderHistory(); } catch (error) { const fallback = getRuntimeConfigRecord(); revision = fallback.revision; populate(fallback.config); setStatus(error instanceof Error ? error.message : 'Could not load live controls.', 'error'); }
}

export function installAdminConfigPanel(): void {
  window.addEventListener('kaishi-admin-config-open', () => void openPanel());
}
