import { describe,it,expect } from 'vitest';
import { tripPlanSchema,recommendTrip,mergeTripPlan } from './trip-plan';
const plan={schemaVersion:1 as const,enabled:true,updatedAt:100,departureDate:'2026-09-15',dailyMinutes:10 as const,priorities:['food']};
const scenarios=[{id:'polite-basics',order:1,title:'Courtesy',phrases:[1,2]},{id:'transport',order:2,title:'Trains',phrases:[1]},{id:'food',order:3,title:'Food',phrases:[1]}];
describe('trip recommendations',()=>{
  it('keeps essential introductions first, then honours priorities ahead of unlock order',()=>{
    expect(recommendTrip(plan,scenarios,{},'2026-09-07').scenarioId).toBe('polite-basics');
    const route=recommendTrip(plan,scenarios,{'polite-basics':{completedAt:'done'}},'2026-09-07');
    expect(route.scenarioId).toBe('food');expect(route.unlockedIds).toContain('food');expect(route.remainingDays).toBe(8);
  });
  it('switches to during-trip mode on departure and rejects impossible dates',()=>{
    expect(recommendTrip(plan,scenarios,{},'2026-09-15').duringTrip).toBe(true);
    expect(tripPlanSchema.safeParse({...plan,departureDate:'2026-02-30'}).success).toBe(false);
    expect(tripPlanSchema.safeParse({...plan,priorities:[]}).success).toBe(false);
  });
  it('preserves a removal across merges even when another device has newer unrelated progress',()=>{
    expect(mergeTripPlan(plan,{...plan,enabled:false,updatedAt:101})?.enabled).toBe(false);
    expect(mergeTripPlan({...plan,enabled:false,updatedAt:101},plan)?.enabled).toBe(false);
  });
});
