import { describe,expect,it } from 'vitest';
import { seasonalHeroForDate } from './seasonal-hero';

describe('seasonal hero selection',()=>{
  it('prioritises event artwork over the surrounding season',()=>{
    expect(seasonalHeroForDate(new Date(2026,9,31)).id).toBe('halloween');
    expect(seasonalHeroForDate(new Date(2026,11,24)).id).toBe('christmas');
    expect(seasonalHeroForDate(new Date(2026,11,31)).id).toBe('new-year');
  });

  it('selects seasonal artwork and wraps winter across the year boundary',()=>{
    expect(seasonalHeroForDate(new Date(2026,6,7)).id).toBe('tanabata');
    expect(seasonalHeroForDate(new Date(2026,7,20)).id).toBe('summer');
    expect(seasonalHeroForDate(new Date(2026,9,10)).id).toBe('autumn');
    expect(seasonalHeroForDate(new Date(2027,0,20)).id).toBe('winter');
  });

  it('falls back to the spring hero outside special windows',()=>{
    expect(seasonalHeroForDate(new Date(2026,2,15)).id).toBe('spring');
  });
});
