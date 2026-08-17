'use strict';

(()=>{
 const bridge=window.KaishiBonsaiBridge;
 const card=document.querySelector('#bonsaiProgressCard');
 const quick=document.querySelector('#bonsaiQuickStep');
 if(!bridge||!card||!quick)return;
 let lastStage=-1,lastCondition='';

 function render(){
  const state=bridge.state();
  const tree=document.querySelector('#bonsaiTree');
  const aura=document.querySelector('#bonsaiConditionAura');
  const condition=document.querySelector('#bonsaiCondition');
  const conditionTrigger=document.querySelector('#bonsaiConditionTrigger');
  const primary=document.querySelector('#bonsaiPrimaryAction');
  card.classList.toggle('new-learner',state.newLearner);
  if(lastStage>=0&&state.stage>lastStage){
   card.classList.remove('stage-grown');
   requestAnimationFrame(()=>card.classList.add('stage-grown'));
  }
  if(lastCondition&&lastCondition!==state.key){
   card.classList.remove('condition-changed');
   requestAnimationFrame(()=>card.classList.add('condition-changed'));
  }
  lastStage=state.stage;
  lastCondition=state.key;
  card.dataset.condition=state.key;
  aura.dataset.condition=state.key;
  condition.dataset.condition=state.key;
  conditionTrigger.setAttribute('aria-label',`${state.name} bonsai condition. Open explanation`);
  tree.dataset.stage=String(state.stage);
  tree.setAttribute('aria-label',`${state.stageName} bonsai, ${state.name.toLowerCase()}`);
  document.querySelector('#bonsaiStageCount').textContent=`Stage ${state.stage+1}/5`;
  document.querySelector('#bonsaiStageName').textContent=state.stageName;
  document.querySelector('#bonsaiDescription').textContent=state.newLearner
   ?'Your first guided lesson teaches only two useful words, with no assumed knowledge.'
   :state.description;
  document.querySelector('#bonsaiConditionName').textContent=state.name;
  document.querySelector('#bonsaiConditionNote').textContent=state.note;
  document.querySelector('#bonsaiGrowthFill').style.width=`${state.progress}%`;
  document.querySelector('#bonsaiNextMilestone').textContent=state.stage===4
   ?'Your bonsai is in bloom. Continued practice strengthens long-term recall.'
   :state.newLearner
    ?'Begin your first lesson to grow new leaves.'
    :`Start more words, master them and complete topics to reach ${state.nextStageName}.`;
  document.querySelector('#bonsaiStats').innerHTML=`<span><strong>${state.words}</strong>words started</span><span><strong>${state.mastered}</strong>mastered</span><span><strong>${state.streak}</strong>day rhythm</span>`;
  document.querySelector('#streak').textContent=`${state.streak} day${state.streak===1?'':'s'} · Learning rhythm${state.behind?` · ${state.behind}/3 cushion used`:''}`;
  primary.textContent=state.newLearner?'Start my first lesson':'Continue learning';
  primary.onclick=()=>state.newLearner?bridge.startFirst():startTopicSession(currentTopic().id);
  quick.hidden=state.newLearner;
  quick.disabled=state.qualified||!state.quickRemaining;
  quick.textContent=state.qualified
   ?'✓ Today complete'
   :state.quickRemaining
    ?`Quick Step · 3 reviews (${state.quickRemaining} left)`
    :'Quick Steps used this week';
 }

 quick.addEventListener('click',()=>bridge.startQuick());
 document.querySelector('#bonsaiConditionTrigger')?.addEventListener('click',()=>document.querySelector('#bonsaiConditionDialog')?.showModal());
 document.querySelector('#bonsaiConditionClose')?.addEventListener('click',()=>document.querySelector('#bonsaiConditionDialog')?.close());
 document.querySelector('#bonsaiConditionDialog')?.addEventListener('click',event=>{if(event.target===event.currentTarget)event.currentTarget.close()});
 window.KaishiBonsai={render};
 render();
})();
