import type { z } from 'zod';
import { deviceStorage } from './storage';
export async function loadContent<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const forcedOffline = deviceStorage().getItem('kq-force-offline') === '1';
  if (!forcedOffline) try { const response = await fetch(path); if (response.ok) return schema.parse(await response.json()); } catch { /* Try the verified local copy. */ }
  if (typeof caches !== 'undefined') { const cached = await caches.match(path,{ignoreSearch:true}); if(cached?.ok) return schema.parse(await cached.json()); }
  throw new Error('This content is unavailable. Connect and retry, or download it before travelling.');
}
