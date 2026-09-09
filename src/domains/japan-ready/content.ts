import { z } from 'zod';
const phrase = z.object({ npc: z.string(), npcEnglish: z.string().optional(), npcRomaji: z.string().optional(), prompt: z.string(), accepted: z.array(z.string()).min(1), acceptedEnglish: z.array(z.string()).optional(), romaji: z.array(z.string()).optional(), explanation: z.string().optional() });
export const travelContentSchema = z.object({
  scenarios: z.array(z.object({ id: z.string(), order: z.number(), title: z.string(), icon: z.string(), region: z.string(), description: z.string(), confidenceGoal: z.string(), cultureTip: z.string(), wordIds: z.array(z.string()).optional(), wordHints: z.array(z.string()).optional().default([]), cheatSheetGroup: z.string().optional(), phrases: z.array(phrase).min(1) })).min(1),
  cheatSheet: z.array(z.object({ title: z.string(), icon: z.string(), phrases: z.array(z.object({ jp: z.string(), en: z.string(), romaji: z.string() })) })),
});
export type TravelContent = z.infer<typeof travelContentSchema>;
export type Scenario = TravelContent['scenarios'][number];
export interface ScenarioVocabularyWord { id: string; meaning: string; topic?: string }
export function resolveScenarioWords<T extends ScenarioVocabularyWord>(scenario: Scenario,vocabulary: T[]) {
  const byId=new Map(vocabulary.map(word=>[word.id,word]));
  const exact=(scenario.wordIds||[]).map(id=>byId.get(id)).filter((word):word is T=>Boolean(word));
  if(exact.length)return exact;
  return vocabulary.filter(word=>(scenario.wordHints||[]).some(hint=>`${word.meaning} ${word.topic||''}`.toLowerCase().includes(hint.toLowerCase()))).slice(0,12);
}
export function normalizeResponse(value: string) { return value.normalize('NFKC').replace(/[\s。、！？!?「」『』]/g,''); }
