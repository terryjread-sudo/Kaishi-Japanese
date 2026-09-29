import { describe,it,expect } from 'vitest';
import { communicativeOutcomePlacement, prepareLesson, sessionPosition } from './session';
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
  it('places communicative listening after new targets have been taught',()=>{
    const steps=words.flatMap(v=>['firstEncounter','intro','pronunciation'].map(skill=>({v,skill}))).concat(words.map(v=>({v,skill:'meaning'})));
    expect(communicativeOutcomePlacement(steps,words.map(v=>v.id),()=>false)).toEqual({kind:'after-teaching',index:9});
  });
  it('allows a listening opener when all targets are already introduced',()=>{
    const steps=words.map(v=>({v,skill:'meaning'}));
    expect(communicativeOutcomePlacement(steps,words.map(v=>v.id),()=>true)).toEqual({kind:'opening',index:0});
  });
  it('waits only for the unseen targets in a mixed-progress lesson',()=>{
    const steps=[{v:words[1]!,skill:'firstEncounter'},{v:words[1]!,skill:'intro'},{v:words[0]!,skill:'meaning'},{v:words[1]!,skill:'meaning'}];
    expect(communicativeOutcomePlacement(steps,['yes','no'],id=>id==='yes')).toEqual({kind:'after-teaching',index:2});
  });
  it('omits an outcome when an unseen target is not taught in the session',()=>{
    const steps=[{v:words[0]!,skill:'firstEncounter'},{v:words[0]!,skill:'intro'}];
    expect(communicativeOutcomePlacement(steps,['yes','no'],id=>id==='yes')).toEqual({kind:'unavailable'});
  });
  it('explains factual contrasts and never treats a guess as mastered',()=>{
    expect(feedbackExplanation({selected:'いいえ',answer:'はい',correct:false,word:words[0],selectedWord:words[1]})).toContain('いいえ is a polite “no”');
    expect(feedbackExplanation({selected:'はい',answer:'はい',correct:true,guessed:true})).toContain('return for practice');
  });
});
