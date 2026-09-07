import { z } from 'zod';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Choose a valid departure date');
export const tripPlanSchema = z.object({
  schemaVersion: z.literal(1), updatedAt: z.number().finite().nonnegative(),
  enabled: z.boolean(), departureDate: date, dailyMinutes: z.union([z.literal(5), z.literal(10), z.literal(15)]),
  priorities: z.array(z.string().min(1)).min(1),
});
export type TripPlan = z.infer<typeof tripPlanSchema>;
export interface TravelScenario { id: string; title: string; order: number; phrases: unknown[] }
export interface ScenarioProgress { completedAt?: string | null; confidence?: number; completedActivities?: string[]; conversationAttempts?: number; [key: string]: unknown }
export function readTripPlan(value: unknown): TripPlan | null {
  const parsed = tripPlanSchema.safeParse(value); return parsed.success ? parsed.data : null;
}
export function mergeTripPlan(a: unknown, b: unknown): TripPlan | null {
  const left = readTripPlan(a), right = readTripPlan(b);
  return !left ? right : !right ? left : right.updatedAt >= left.updatedAt ? right : left;
}
export function recommendTrip(plan: TripPlan, scenarios: TravelScenario[], progress: Record<string, ScenarioProgress>, today: string) {
  const remainingDays = Math.max(0, Math.ceil((Date.parse(`${plan.departureDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000));
  const essentials = scenarios.find(s => s.id === 'polite-basics') || scenarios[0];
  const ordered = [...scenarios].sort((a,b) => Number(!plan.priorities.includes(a.id)) - Number(!plan.priorities.includes(b.id)) || a.order-b.order);
  const pending = ordered.filter(s => !progress[s.id]?.completedAt);
  const next = essentials && !progress[essentials.id]?.completedAt ? essentials : pending[0] || ordered.slice().sort((a,b) => (progress[a.id]?.confidence || 0)-(progress[b.id]?.confidence || 0) || a.order-b.order)[0];
  const estimatedMinutes = pending.reduce((sum,s) => sum + Math.max(5,s.phrases.length * 2 + 5),0);
  return { scenarioId: next?.id || '', remainingDays, duringTrip: remainingDays === 0, dailyMinutes: plan.dailyMinutes,
    estimatedMinutes, availableMinutes: remainingDays * plan.dailyMinutes,
    sessions: Math.max(1,Math.ceil(estimatedMinutes/plan.dailyMinutes)),
    unlockedIds: essentials && !progress[essentials.id]?.completedAt ? [essentials.id] : ordered.map(s=>s.id),
  };
}
