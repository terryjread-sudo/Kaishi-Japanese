'use strict';

(()=>{
 const bridge=window.KaishiBonsaiBridge;
 const card=document.querySelector('#bonsaiProgressCard');
 const quick=document.querySelector('#bonsaiQuickStep');
 if(!bridge||!card||!quick)return;
 let lastStage=-1;

 function render(){
  const state=bridge.state();
  const tree=document.querySelector('#bonsaiTree');
  const primary=document.querySelector('#bonsaiPrimaryAction');
  card.classList.toggle('new-learner',state.newLearner);
  if(lastStage>=0&&state.stage>lastStage){
   card.classList.remove('stage-grown');
   requestAnimationFrame(()=>card.classList.add('stage-grown'));
  }
  lastStage=state.stage;
  tree.dataset.stage=String(state.stage);
  tree.setAttribute('aria-label',`${state.stageName} bonsai stage`);
  document.querySelector('#bonsaiStageCount').textContent=`Stage ${state.stage+1} of 5`;
  document.querySelector('#bonsaiStageName').textContent=state.stageName;
  document.querySelector('#bonsaiDescription').textContent=state.newLearner
   ?'Your first guided lesson teaches only two useful words, with no assumed knowledge.'
   :state.description;
  document.querySelector('#bonsaiGrowthFill').style.width=`${state.progress}%`;
  document.querySelector('#bonsaiNextMilestone').textContent=state.stage===4
   ?'Your bonsai is in bloom. Continued practice strengthens long-term recall.'
   :state.newLearner
    ?'Begin your first lesson to grow new leaves.'
    :`${Math.max(0,state.nextScore-state.score)} growth points until the next bonsai stage.`;
  document.querySelector('#bonsaiStats').innerHTML=`<span><strong>${state.words}</strong>words started</span><span><strong>${state.mastered}</strong>mastered</span><span><strong>${state.streak}</strong>day rhythm</span>`;
  document.querySelector('#streak').textContent=`${state.streak} day${state.streak===1?'':'s'} · Learning rhythm${state.behind?` · ${state.behind}/3 cushion used`:''}`;
  primary.textContent=state.newLearner?'Start my first lesson':'Continue today’s lesson';
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
 window.KaishiBonsai={render};
 render();
})();
