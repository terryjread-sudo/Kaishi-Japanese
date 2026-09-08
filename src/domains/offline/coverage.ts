import { z } from 'zod';
export const assetSchema=z.object({url:z.string(),bytes:z.number().nonnegative(),sha256:z.string().optional(),kind:z.enum(['text','images','audio'])});
export const catalogSchema=z.object({schemaVersion:z.literal(1),production:z.boolean(),core:z.array(z.string()),assets:z.array(assetSchema),groups:z.array(z.object({id:z.string(),title:z.string(),wordIds:z.array(z.string()),urls:z.array(z.string()),speechOnly:z.boolean()}))});
export type OfflineCatalog=z.infer<typeof catalogSchema>;
export type OfflineAsset=z.infer<typeof assetSchema>;
export type Pack='essential'|'standard'|'full';
export const downloadStateSchema=z.object({version:z.string(),pack:z.enum(['essential','standard','full']),downloadedAt:z.number(),required:z.array(z.string()),verified:z.record(z.string(),z.number()),failed:z.array(z.string()),status:z.enum(['partial','ready','unverified'])});
export type DownloadState=z.infer<typeof downloadStateSchema>;
export function selectPack(catalog:OfflineCatalog,pack:Pack,introducedIds:string[]) {
  const introduced=new Set(introducedIds);
  const next=catalog.groups.find(group=>group.id.startsWith('lesson-')&&group.wordIds.some(id=>!introduced.has(id)));
  const urls=new Set(catalog.core);
  for(const group of catalog.groups){if(group.id.startsWith('travel-')||pack==='full'||pack==='standard'&&group.wordIds.some(id=>introduced.has(id))||pack==='standard'&&group===next)group.urls.forEach(url=>urls.add(url));}
  if(pack==='full')catalog.assets.forEach(asset=>urls.add(asset.url));
  return catalog.assets.filter(asset=>urls.has(asset.url));
}
export function groupCoverage(group:OfflineCatalog['groups'][number],verified:Record<string,number>,catalog:OfflineCatalog) {
  const assets=catalog.assets.filter(a=>group.urls.includes(a.url));
  return (['text','images','audio'] as const).map(kind=>{const required=assets.filter(a=>a.kind===kind);return {kind,total:required.length,ready:required.filter(a=>verified[a.url]!==undefined).length};});
}
