import { describe,expect,it } from 'vitest';
import { resolveScenarioWords,travelContentSchema } from './content';

const scenario=(overrides:Record<string,unknown>={})=>travelContentSchema.shape.scenarios.element.parse({
  id:'test',order:1,title:'Test',icon:'🗾',region:'Test',description:'Test',confidenceGoal:'Test',cultureTip:'Test',wordHints:['help'],phrases:[{npc:'はい',prompt:'Reply',accepted:['はい']}],...overrides,
});

describe('Japan Ready scenario vocabulary',()=>{
  it('uses explicit word IDs in their curated order',()=>{
    const words=[{id:'b',meaning:'second'},{id:'a',meaning:'first'},{id:'noise',meaning:'helpful'}];
    expect(resolveScenarioWords(scenario({wordIds:['a','b']}),words).map(word=>word.id)).toEqual(['a','b']);
  });

  it('uses capped legacy hint matching only when no explicit word resolves',()=>{
    const words=Array.from({length:15},(_,index)=>({id:String(index),meaning:`help ${index}`}));
    expect(resolveScenarioWords(scenario(),words)).toHaveLength(12);
  });
});
