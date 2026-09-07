import { describe,it,expect } from 'vitest';
import { prepareLesson, sessionPosition } from './session';
import { feedbackExplanation } from './feedback';
const words=[{id:'yes',word:'はい',meaning:'yes'},{id:'no',word:'いいえ',meaning:'no'},{id:'ok',word:'大丈夫',meaning:'OK'}];
describe('lesson preparation',()=>{
  it('reserves a tested answer for every new word even when passive cards filled the cap',()=>{
    const input=words.flatMap(v=>['kanaUnlock','firstEncounter','intro','pronunciation','example'].map(skill=>({v,skill})));
    const steps=prepareLesson(input,w=>w.id==='yes'?['は','い']:w.id==='no'?['い','え']:['う']);
    expect(steps.filter(s=>s.requiredAssessment).map(s=>s.v.id)).toEqual(['yes','no','ok']);
    expect(steps.filter(s=>s.skill==='kanaUnlock').map(s=>s.character)).toEqual(['は','い','え','う']);
    expect(input).toHaveLength(15);expect(steps.length).toBeLessThanOrEqual(15);
  });
  it('keeps review-only sessions intact and labels inserted reinforcement separately',()=>{
    const base=words.map(v=>({v,skill:'meaning'}));expect(prepareLesson(base,()=>[])).toEqual(base);
    const steps=[...base,{v:words[0]!,skill:'listening',reinforcementRepair:true}];
    expect(sessionPosition(steps,3)).toEqual({total:3,completed:3,extra:true});
  });
  it('explains factual contrasts and never treats a guess as mastered',()=>{
    expect(feedbackExplanation({selected:'いいえ',answer:'はい',correct:false,word:words[0],selectedWord:words[1]})).toContain('いいえ is a polite “no”');
    expect(feedbackExplanation({selected:'はい',answer:'はい',correct:true,guessed:true})).toContain('return for practice');
  });
});
