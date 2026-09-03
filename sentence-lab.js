'use strict';

let sentenceLabData=null;
let sentenceLabLesson=null;
let sentenceLabRun=null;

const SENTENCE_LAB_STEPS=['explore','build','particle','listening','transform','context','transfer'];
const SENTENCE_LAB_STEP_LABELS={explore:'Decode',build:'Build',particle:'Particles',listening:'Listen',transform:'Transform',context:'Context',transfer:'Create'};

function sentenceLabState(){
  meta.sentenceLabProgress=meta.sentenceLabProgress||{lessons:{},saved:[],mistakes:[],totalAnswers:0,totalCorrect:0};
  meta.sentenceLabProgress.lessons=meta.sentenceLabProgress.lessons||{};
  meta.sentenceLabProgress.saved=Array.isArray(meta.sentenceLabProgress.saved)?meta.sentenceLabProgress.saved:[];
  meta.sentenceLabProgress.mistakes=Array.isArray(meta.sentenceLabProgress.mistakes)?meta.sentenceLabProgress.mistakes:[];
  return meta.sentenceLabProgress;
}

function sentenceLessonState(id){
  const state=sentenceLabState();
  return state.lessons[id]||(state.lessons[id]={attempts:0,completed:0,best:0,lastScore:0,updatedAt:0});
}

async function ensureSentenceLabData(){
  if(sentenceLabData)return sentenceLabData;
  const url=`data/sentence-lab.json?v=${APP_VERSION}`;
  try{
    const response=await fetch(url);
    if(response.ok){ sentenceLabData=await response.json(); return sentenceLabData; }
  }catch(e){}
  if('caches' in window){
    try{
      const match=await caches.match(url,{ignoreSearch:true});
      if(match&&match.ok){ sentenceLabData=await match.json(); return sentenceLabData; }
    }catch(e){}
  }
  throw Error('Sentence Lab content could not be loaded');
}

function sentenceLabCompletedCount(){
  if(!sentenceLabData)return 0;
  return sentenceLabData.lessons.filter(lesson=>Number(meta.sentenceLabProgress?.lessons?.[lesson.id]?.completed||0)>0).length;
}

function sentenceLabLessonUnlocked(index){
  if(isAdminTestMode()||index===0)return true;
  return Number(meta.sentenceLabProgress?.lessons?.[sentenceLabData.lessons[index-1]?.id]?.completed||0)>0;
}

function sentenceLabSaved(sentence){
  return sentenceLabState().saved.some(item=>item.sentence===sentence);
}

function saveSentenceToNotebook(source){
  const state=sentenceLabState();
  const sentence=String(source?.sentence||'').trim();
  if(!sentence)return false;
  const existing=state.saved.findIndex(item=>item.sentence===sentence);
  if(existing>=0){
    state.saved.splice(existing,1);
    save();
    toast('Removed from Sentence Notebook');
    return false;
  }
  state.saved.unshift({
    id:source.id||`mined-${Date.now()}`,
    lessonId:source.lessonId||source.id||'',
    title:source.title||'Mined sentence',
    sentence,
    reading:source.reading||'',
    meaning:source.meaning||'',
    chunks:Array.isArray(source.chunks)?source.chunks:[],
    savedAt:Date.now()
  });
  state.saved=state.saved.slice(0,100);
  save();
  toast('Saved to Sentence Notebook');
  return true;
}

function sentenceLabTracker(active){
  return `<nav class="sl-stepper" aria-label="Sentence Lab progress">${SENTENCE_LAB_STEPS.map((step,index)=>`<span class="${step===active?'active':''} ${sentenceLabRun&&index<sentenceLabRun.step?'complete':''}"><i>${index+1}</i><b>${esc(SENTENCE_LAB_STEP_LABELS[step])}</b></span>`).join('')}</nav>`;
}

function sentenceLabShell(step,content){
  const saved=sentenceLabSaved(sentenceLabLesson.sentence);
  return `${sentenceLabTracker(step)}<div class="sl-lesson-toolbar"><span>Level ${sentenceLabLesson.level} · ${esc(sentenceLabLesson.canDo)}</span><button id="slSaveSentence" class="${saved?'saved':''}" type="button">${saved?'★ Saved':'☆ Save sentence'}</button></div>${content}`;
}

function wireSentenceSave(){
  const button=$('#slSaveSentence');
  if(!button)return;
  button.onclick=()=>{
    const saved=saveSentenceToNotebook({...sentenceLabLesson,lessonId:sentenceLabLesson.id});
    button.classList.toggle('saved',saved);
    button.textContent=saved?'★ Saved':'☆ Save sentence';
  };
}

async function openSentenceLab(){
  show('sentenceLab');
  $('#sentenceLabHome').hidden=false;
  $('#sentenceLabReader').hidden=true;
  $('#sentenceLabHome').innerHTML='<section class="sl-loading"><span>文</span><h2>Preparing your Sentence Lab…</h2></section>';
  try{
    await ensureSentenceLabData();
    sentenceLabState();
    renderSentenceLabHome();
  }catch(error){
    $('#sentenceLabHome').innerHTML=`<section class="sl-empty"><span>⚠️</span><h2>Sentence Lab could not open</h2><p>${esc(error.message)}</p><button id="slRetry" class="primary">Try again</button></section>`;
    $('#slRetry').onclick=()=>{sentenceLabData=null;openSentenceLab()};
  }
}

function renderSentenceLabHome(){
  sentenceLabLesson=null;
  sentenceLabRun=null;
  const state=sentenceLabState();
  const total=Number(state.totalAnswers||0),accuracy=total?Math.round(Number(state.totalCorrect||0)/total*100):0;
  $('#sentenceLabHome').hidden=false;
  $('#sentenceLabReader').hidden=true;
  $('#sentenceLabHome').innerHTML=`
    <section class="sl-hero">
      <img src="media/sentence-lab/sentence-lab-hero.webp?v=${APP_VERSION}" alt="A tanuki teacher assembling glowing phrase tiles above an open notebook">
      <div><span class="eyebrow">Understand how Japanese fits together</span><h2>Sentence Lab</h2><p>Decode, hear, rebuild and transform useful Japanese until its structure feels natural.</p><button id="slContinue" class="primary">${sentenceLabCompletedCount()?'Continue next lab':'Begin guided lab'} →</button></div>
    </section>
    <div class="sl-stats"><article><strong>${sentenceLabCompletedCount()}/${sentenceLabData.lessons.length}</strong><span>Labs complete</span></article><article><strong>${accuracy}%</strong><span>Accuracy</span></article><article><strong>${state.saved.length}</strong><span>Saved sentences</span></article></div>
    <div class="sl-home-actions"><button id="slNotebook">📓 Open Sentence Notebook <small>Hear and revisit mined sentences</small></button><button id="slMistakes">🔎 Review my mistakes <small>See the exact misunderstanding</small></button></div>
    <section class="sl-course"><span class="eyebrow">Real-world sentence missions</span><h2>Choose a lab</h2><div class="sl-lesson-grid">${sentenceLabData.lessons.map((lesson,index)=>{
      const lessonState=sentenceLessonState(lesson.id),unlocked=sentenceLabLessonUnlocked(index);
      return `<button class="sl-lesson-card ${lessonState.completed?'complete':''}" data-sl-lesson="${index}" ${unlocked?'':'disabled'}><span>${unlocked?`L${lesson.level}`:'🔒'}</span><div><strong>${esc(lesson.title)}</strong><small lang="ja">${esc(lesson.japaneseTitle)}</small><p>${esc(lesson.canDo)}</p><b>${lessonState.completed?`✓ Best ${lessonState.best}%`:unlocked?'Ready to explore':'Complete the previous lab'}</b></div></button>`;
    }).join('')}</div></section>`;
  document.querySelectorAll('[data-sl-lesson]').forEach(button=>button.onclick=()=>startSentenceLabLesson(+button.dataset.slLesson));
  $('#slContinue').onclick=()=>{
    const next=sentenceLabData.lessons.findIndex((lesson,index)=>sentenceLabLessonUnlocked(index)&&!sentenceLessonState(lesson.id).completed);
    startSentenceLabLesson(next<0?0:next);
  };
  $('#slNotebook').onclick=()=>window.KaishiNotebook?.open('sentences');
  $('#slMistakes').onclick=renderSentenceMistakes;
}

function startSentenceLabLesson(index){
  if(!sentenceLabLessonUnlocked(index)){toast('Complete the previous Sentence Lab first');return}
  sentenceLabLesson=sentenceLabData.lessons[index];
  sentenceLabRun={lessonIndex:index,step:0,correct:0,total:0,answered:false,selected:[],revealIndex:0};
  $('#sentenceLabHome').hidden=true;
  $('#sentenceLabReader').hidden=false;
  renderSentenceLabStep();
}

function sentenceLabAdvance(){
  sentenceLabRun.step++;
  sentenceLabRun.answered=false;
  sentenceLabRun.selected=[];
  sentenceLabRun.revealIndex=0;
  renderSentenceLabStep();
}

function renderSentenceLabStep(){
  if(sentenceLabRun.step>=SENTENCE_LAB_STEPS.length){finishSentenceLabLesson();return}
  const step=SENTENCE_LAB_STEPS[sentenceLabRun.step];
  $('#sentenceLabCounter').textContent=`${sentenceLabRun.step+1} / ${SENTENCE_LAB_STEPS.length} · ${SENTENCE_LAB_STEP_LABELS[step]}`;
  if(step==='explore')renderSentenceExplore();
  else if(step==='build')renderSentenceBuilder('builder');
  else if(step==='particle')renderSentenceParticle();
  else if(step==='listening')renderSentenceListening();
  else if(step==='transform')renderSentenceChoice('transform');
  else if(step==='context')renderSentenceContext();
  else renderSentenceBuilder('transfer');
}

function sentenceChunksHtml(lesson,interactive=true){
  return `<div class="sl-chunks" role="group" aria-label="Japanese sentence broken into meaningful chunks">${lesson.chunks.map((chunk,index)=>`<button type="button" class="sl-chunk role-${esc(chunk.role)}" data-sl-chunk="${index}" ${interactive?'':'tabindex="-1"'}><strong lang="ja">${esc(chunk.text)}</strong><small>${esc(chunk.reading)}</small><span>${esc(chunk.meaning)}</span></button>`).join('')}</div>`;
}

function renderSentenceExplore(){
  const lesson=sentenceLabLesson;
  $('#sentenceLabContent').innerHTML=sentenceLabShell('explore',`
    <section class="sl-intro"><span class="eyebrow">1 · Decode the complete thought</span><h2>${esc(lesson.title)}</h2><p class="sl-main-sentence" lang="ja">${esc(lesson.sentence)}</p><p class="sl-reading">${esc(lesson.reading)}</p><p class="sl-meaning">${esc(lesson.meaning)}</p><button id="slHearWhole" class="audio primary">🔊 Hear the sentence</button></section>
    <section class="sl-breakdown"><div class="sl-section-heading"><div><span class="eyebrow">Interactive breakdown</span><h3>Tap a chunk to follow its job</h3></div><button id="slRevealMode">✨ Progressive reveal</button></div>${sentenceChunksHtml(lesson)}<aside id="slChunkDetail" class="sl-chunk-detail" aria-live="polite"><span>Choose any coloured chunk.</span><p>Its meaning, particle role and connection will appear here.</p></aside></section>
    <section id="slProgressive" class="sl-progressive" hidden><span class="eyebrow">Build meaning one layer at a time</span><div id="slProgressiveSentence" lang="ja"></div><p id="slProgressiveMeaning"></p><div><button id="slRevealReset">Reset</button><button id="slRevealNext" class="primary">Add the first idea →</button></div></section>
    <button id="slExploreNext" class="primary reveal">Build it yourself →</button>`);
  wireSentenceSave();
  $('#slHearWhole').onclick=()=>speakJapanese(lesson.sentence);
  document.querySelectorAll('[data-sl-chunk]').forEach(button=>button.onclick=()=>{
    document.querySelectorAll('[data-sl-chunk]').forEach(item=>item.classList.remove('active'));
    button.classList.add('active');
    const chunk=lesson.chunks[+button.dataset.slChunk];
    $('#slChunkDetail').innerHTML=`<span class="role-${esc(chunk.role)}">${esc(sentenceLabData.roles[chunk.role]||chunk.role)}</span><h4 lang="ja">${esc(chunk.text)} <small>${esc(chunk.reading)}</small></h4><strong>${esc(chunk.meaning)}</strong><p>${esc(chunk.note)}</p><div>Connects to <b lang="ja">${esc(chunk.connectsTo)}</b></div>`;
    speakJapanese(chunk.text);
  });
  $('#slRevealMode').onclick=()=>{$('#slProgressive').hidden=false;$('#slProgressive').scrollIntoView({behavior:'smooth',block:'nearest'});renderProgressiveSentence()};
  $('#slRevealReset').onclick=()=>{sentenceLabRun.revealIndex=0;renderProgressiveSentence()};
  $('#slRevealNext').onclick=()=>{if(sentenceLabRun.revealIndex<lesson.progressive.length)sentenceLabRun.revealIndex++;renderProgressiveSentence()};
  $('#slExploreNext').onclick=sentenceLabAdvance;
}

function renderProgressiveSentence(){
  const lesson=sentenceLabLesson,index=sentenceLabRun.revealIndex,target=$('#slProgressiveSentence'),button=$('#slRevealNext');
  if(!target||!button)return;
  target.innerHTML=index?`<span>${esc(lesson.progressive[index-1])}</span>`:'<small>Start with the final action, then add context.</small>';
  $('#slProgressiveMeaning').textContent=index?`${index} of ${lesson.progressive.length} layers · ${index===lesson.progressive.length?lesson.meaning:'What new information appeared?'}`:'Japanese often becomes easier when you locate the final action first.';
  button.textContent=index>=lesson.progressive.length?'Complete sentence ✓':index?'Add another detail →':'Add the first idea →';
  button.disabled=index>=lesson.progressive.length;
  if(index)speakJapanese(lesson.progressive[index-1]);
}

function renderSentenceBuilder(kind){
  const exercise=sentenceLabLesson[kind],isTransfer=kind==='transfer';
  sentenceLabRun.selected=[];
  $('#sentenceLabContent').innerHTML=sentenceLabShell(isTransfer?'transfer':'build',`
    <section class="sl-task"><span class="eyebrow">${isTransfer?'7 · Transfer to a new situation':'2 · Meaning-first construction'}</span><h2>${esc(exercise.prompt)}</h2><p>${isTransfer?'Build a new sentence from the pattern. More than one natural answer may be accepted.':'Choose phrase blocks in a natural Japanese order.'}</p>
      <div id="slBuiltSentence" class="sl-built" aria-live="polite"><span>Tap a phrase below to begin</span></div>
      <div id="slTileBank" class="sl-tile-bank">${exercise.tiles.map((tile,index)=>`<button data-sl-tile="${index}" lang="ja">${esc(tile)}</button>`).join('')}</div>
      <div class="sl-builder-actions"><button id="slUndoTile">↶ Undo</button><button id="slResetTiles">Reset</button><button id="slCheckBuild" class="primary">Check sentence</button></div>
      <section id="slFeedback" class="sl-feedback" hidden aria-live="polite"></section>
    </section>`);
  wireSentenceSave();
  document.querySelectorAll('[data-sl-tile]').forEach(button=>button.onclick=()=>{
    if(sentenceLabRun.answered||sentenceLabRun.selected.includes(+button.dataset.slTile))return;
    sentenceLabRun.selected.push(+button.dataset.slTile);renderSentenceBuildSelection(exercise);
  });
  $('#slUndoTile').onclick=()=>{if(!sentenceLabRun.answered){sentenceLabRun.selected.pop();renderSentenceBuildSelection(exercise)}};
  $('#slResetTiles').onclick=()=>{if(!sentenceLabRun.answered){sentenceLabRun.selected=[];renderSentenceBuildSelection(exercise)}};
  $('#slCheckBuild').onclick=()=>resolveSentenceBuild(exercise,isTransfer);
}

function renderSentenceBuildSelection(exercise){
  const selected=sentenceLabRun.selected.map(index=>exercise.tiles[index]);
  $('#slBuiltSentence').innerHTML=selected.length?selected.map((tile,index)=>`<button data-sl-remove="${index}" lang="ja">${esc(tile)}</button>`).join(''):'<span>Tap a phrase below to begin</span>';
  document.querySelectorAll('[data-sl-tile]').forEach(button=>button.disabled=sentenceLabRun.selected.includes(+button.dataset.slTile));
  document.querySelectorAll('[data-sl-remove]').forEach(button=>button.onclick=()=>{if(!sentenceLabRun.answered){sentenceLabRun.selected.splice(+button.dataset.slRemove,1);renderSentenceBuildSelection(exercise)}});
}

function resolveSentenceBuild(exercise,isTransfer){
  if(sentenceLabRun.answered)return;
  if(!sentenceLabRun.selected.length){toast('Build a sentence before checking');return}
  const built=sentenceLabRun.selected.map(index=>exercise.tiles[index]),key=built.join('|'),ok=exercise.accepted.includes(key);
  const accepted=exercise.accepted.map(order=>order.split('|').join('')).join(' or ');
  resolveSentenceLabAnswer(ok,isTransfer?'Create':'Build',ok?exercise.explanation:`Your answer was ${built.join('')}. A natural model is ${accepted}. ${exercise.explanation}`);
  $('#slFeedback').innerHTML=`<p class="game-result ${ok?'game-result-correct':'game-result-wrong'}">${ok?'Natural sentence!':'The roles need a different order.'}</p><p>${esc(ok?exercise.explanation:`Your answer: ${built.join('')} — ${exercise.explanation}`)}</p><div class="sl-model"><span>Natural model${exercise.accepted.length>1?'s':''}</span>${exercise.accepted.map(order=>`<strong lang="ja">${esc(order.split('|').join(''))}</strong>`).join('')}</div><button id="slAnswerNext" class="primary reveal">${isTransfer?'Finish this lab →':'Particle experiment →'}</button>`;
  $('#slFeedback').hidden=false;
  document.querySelectorAll('[data-sl-tile], [data-sl-remove]').forEach(button=>button.disabled=true);
  $('#slCheckBuild').disabled=true;
  $('#slAnswerNext').onclick=sentenceLabAdvance;
  speakJapanese(exercise.accepted[0].split('|').join(''));
}

function renderSentenceParticle(){
  const exercise=sentenceLabLesson.particle;
  $('#sentenceLabContent').innerHTML=sentenceLabShell('particle',`
    <section class="sl-task"><span class="eyebrow">3 · Particle replacement lab</span><h2>Which particle expresses the intended relationship?</h2><p class="sl-particle-sentence" lang="ja"><span>${esc(exercise.before)}</span><b id="slParticleGap">＿</b><span>${esc(exercise.after)}</span></p><div class="sl-particle-options">${exercise.options.map(option=>`<button data-sl-particle="${encodeURIComponent(option)}" lang="ja">${esc(option)}</button>`).join('')}</div><section id="slFeedback" class="sl-feedback" hidden aria-live="polite"></section></section>`);
  wireSentenceSave();
  document.querySelectorAll('[data-sl-particle]').forEach(button=>button.onclick=()=>{
    if(sentenceLabRun.answered)return;
    const answer=decodeURIComponent(button.dataset.slParticle),ok=answer===exercise.answer;
    $('#slParticleGap').textContent=answer;
    document.querySelectorAll('[data-sl-particle]').forEach(item=>{item.disabled=true;if(decodeURIComponent(item.dataset.slParticle)===exercise.answer)item.classList.add('correct')});
    button.classList.add(ok?'correct':'wrong');
    resolveSentenceLabAnswer(ok,'Particles',exercise.explanations[answer]);
    $('#slFeedback').innerHTML=`<p class="game-result ${ok?'game-result-correct':'game-result-wrong'}">${ok?'Correct relationship':'That particle changes the relationship'}</p><p>${esc(exercise.explanations[answer])}</p>${ok?'':`<p><strong>Why ${esc(exercise.answer)} works:</strong> ${esc(exercise.explanations[exercise.answer])}</p>`}<button id="slAnswerNext" class="primary reveal">Listen without text →</button>`;
    $('#slFeedback').hidden=false;$('#slAnswerNext').onclick=sentenceLabAdvance;
    speakJapanese(`${exercise.before}${exercise.answer}${exercise.after}`);
  });
}

function renderSentenceListening(){
  const exercise=sentenceLabLesson.listening;
  $('#sentenceLabContent').innerHTML=sentenceLabShell('listening',`
    <section class="sl-task sl-listen-task"><span class="eyebrow">4 · Listen, predict, reveal</span><div class="sl-listen-orb" aria-hidden="true"><i></i><span>聴</span></div><h2>${esc(exercise.prompt)}</h2><p>Listen before revealing any Japanese text.</p><button id="slPlayHidden" class="audio primary">🔊 Play sentence</button><div class="choices">${exercise.choices.map(choice=>`<button class="choice" data-sl-listen-answer="${encodeURIComponent(choice)}">${esc(choice)}</button>`).join('')}</div><section id="slFeedback" class="sl-feedback" hidden aria-live="polite"></section></section>`);
  wireSentenceSave();
  $('#slPlayHidden').onclick=()=>speakJapanese(sentenceLabLesson.sentence);
  document.querySelectorAll('[data-sl-listen-answer]').forEach(button=>button.onclick=()=>{
    if(sentenceLabRun.answered)return;
    const answer=decodeURIComponent(button.dataset.slListenAnswer),ok=answer===exercise.answer;
    document.querySelectorAll('[data-sl-listen-answer]').forEach(item=>{item.disabled=true;if(decodeURIComponent(item.dataset.slListenAnswer)===exercise.answer)item.classList.add('correct')});button.classList.add(ok?'correct':'wrong');
    resolveSentenceLabAnswer(ok,'Listen',exercise.explanation,true);
    $('#slFeedback').innerHTML=`<p class="game-result ${ok?'game-result-correct':'game-result-wrong'}">${ok?'You caught the complete meaning':'Now connect the sound to its structure'}</p><p>${esc(exercise.explanation)}</p><div id="slListenChunks" class="sl-listen-reveal">${sentenceLabLesson.chunks.map((chunk,index)=>`<span data-sl-listen-chunk="${index}" class="role-${esc(chunk.role)}"><b lang="ja">${esc(chunk.text)}</b><small>${esc(chunk.meaning)}</small></span>`).join('')}</div><button id="slReplayChunks" class="audio">🔊 Replay and follow each phrase</button><button id="slAnswerNext" class="primary reveal">Transform the sentence →</button>`;
    $('#slFeedback').hidden=false;$('#slReplayChunks').onclick=playSentenceLabChunks;$('#slAnswerNext').onclick=sentenceLabAdvance;
  });
}

function playSentenceLabChunks(){
  const chunks=sentenceLabLesson.chunks;let index=0;
  const next=()=>{
    document.querySelectorAll('[data-sl-listen-chunk]').forEach(item=>item.classList.remove('speaking'));
    if(index>=chunks.length)return;
    document.querySelector(`[data-sl-listen-chunk="${index}"]`)?.classList.add('speaking');
    speakJapanese(chunks[index++].text,next);
  };
  next();
}

function renderSentenceChoice(kind){
  const exercise=sentenceLabLesson[kind];
  $('#sentenceLabContent').innerHTML=sentenceLabShell(kind,`
    <section class="sl-task"><span class="eyebrow">5 · Sentence transformation</span><h2>${esc(exercise.prompt)}</h2><p>Change only the requested property and preserve every other relationship.</p><div class="choices sl-japanese-choices">${exercise.choices.map(choice=>`<button class="choice" data-sl-choice="${encodeURIComponent(choice)}" lang="ja">${esc(choice)}</button>`).join('')}</div><section id="slFeedback" class="sl-feedback" hidden aria-live="polite"></section></section>`);
  wireSentenceSave();wireSentenceChoice(exercise,'Transform','Use the conversation to recover what Japanese leaves unsaid →');
}

function renderSentenceContext(){
  const exercise=sentenceLabLesson.context;
  $('#sentenceLabContent').innerHTML=sentenceLabShell('context',`
    <section class="sl-task"><span class="eyebrow">6 · Context and omitted words</span><h2>Who—or what—is understood?</h2><div class="sl-dialogue">${exercise.lines.map((line,index)=>`<button data-sl-context-line="${index}" lang="ja">${esc(line)} <span>🔊</span></button>`).join('')}</div><h3>${esc(exercise.question)}</h3><div class="choices">${exercise.choices.map(choice=>`<button class="choice" data-sl-choice="${encodeURIComponent(choice)}">${esc(choice)}</button>`).join('')}</div><section id="slFeedback" class="sl-feedback" hidden aria-live="polite"></section></section>`);
  wireSentenceSave();document.querySelectorAll('[data-sl-context-line]').forEach(button=>button.onclick=()=>speakJapanese(exercise.lines[+button.dataset.slContextLine].replace(/^.+?：/,'')));
  wireSentenceChoice(exercise,'Context','Create a new sentence →');
}

function wireSentenceChoice(exercise,skill,nextLabel){
  document.querySelectorAll('[data-sl-choice]').forEach(button=>button.onclick=()=>{
    if(sentenceLabRun.answered)return;
    const answer=decodeURIComponent(button.dataset.slChoice),ok=answer===exercise.answer;
    document.querySelectorAll('[data-sl-choice]').forEach(item=>{item.disabled=true;if(decodeURIComponent(item.dataset.slChoice)===exercise.answer)item.classList.add('correct')});button.classList.add(ok?'correct':'wrong');
    resolveSentenceLabAnswer(ok,skill,exercise.explanation);
    $('#slFeedback').innerHTML=`<p class="game-result ${ok?'game-result-correct':'game-result-wrong'}">${ok?'Exactly':'A different clue controls the answer'}</p><p>${esc(exercise.explanation)}</p>${ok?'':`<div class="sl-model"><span>Model answer</span><strong>${esc(exercise.answer)}</strong></div>`}<button id="slAnswerNext" class="primary reveal">${esc(nextLabel)}</button>`;
    $('#slFeedback').hidden=false;$('#slAnswerNext').onclick=sentenceLabAdvance;
    if(skill==='Transform')speakJapanese(exercise.answer);
  });
}

function resolveSentenceLabAnswer(ok,skill,explanation,listening=false){
  sentenceLabRun.answered=true;sentenceLabRun.total++;if(ok)sentenceLabRun.correct++;
  const state=sentenceLabState();state.totalAnswers=Number(state.totalAnswers||0)+1;if(ok)state.totalCorrect=Number(state.totalCorrect||0)+1;
  meta.totalAnswers=Number(meta.totalAnswers||0)+1;if(ok)meta.totalCorrect=Number(meta.totalCorrect||0)+1;
  recordMeaningfulActivity('sentenceLab');
  const targets=(sentenceLabLesson.targetWords||[]).map(target=>vocab.find(word=>word.word===target||word.word?.includes(target))).filter(word=>word&&wordIntroduced(word));
  targets.forEach(word=>{
    const wordState=pFor(word.id),metric=wordState.skills.sentence;metric.attempts++;if(ok)metric.correct++;metric.strength=Math.max(0,Math.min(1,Number(metric.strength||0)*.75+(ok?.25:.05)));
    if(listening){const listeningMetric=wordState.skills.listening;listeningMetric.attempts++;if(ok)listeningMetric.correct++;listeningMetric.strength=Math.max(0,Math.min(1,Number(listeningMetric.strength||0)*.82+(ok?.18:.04)))}
  });
  if(!ok){state.mistakes.unshift({lessonId:sentenceLabLesson.id,title:sentenceLabLesson.title,sentence:sentenceLabLesson.sentence,skill,explanation,time:Date.now()});state.mistakes=state.mistakes.slice(0,30)}
  save();window.KaishiCloud?.flush?.();
}

function finishSentenceLabLesson(){
  const state=sentenceLessonState(sentenceLabLesson.id),score=Math.round(sentenceLabRun.correct/Math.max(1,sentenceLabRun.total)*100),passed=score>=65;
  const finishLabel=activityReturnScreen==='journey'?(activeJourneyMission?'Complete Journey mission':'Return to Journey'):'Back to Sentence Lab';
  state.attempts++;state.lastScore=score;state.best=Math.max(Number(state.best||0),score);state.updatedAt=Date.now();if(passed)state.completed=Number(state.completed||0)+1;
  save();refreshPathUnlocks();
  $('#sentenceLabCounter').textContent='Lab complete';
  $('#sentenceLabContent').innerHTML=`<section class="sl-summary"><div class="sl-summary-orbit"><span>文</span><i></i><i></i><i></i></div><span class="eyebrow">${passed?'Sentence pattern understood':'Pattern developing'}</span><h2>${sentenceLabRun.correct} of ${sentenceLabRun.total} challenges correct</h2><p>${passed?`You can now ${esc(sentenceLabLesson.canDo.toLowerCase())}.`:'Your mistakes are saved with exact explanations. Revisit the pattern once more to make it reliable.'}</p><div class="sl-stats"><article><strong>${score}%</strong><span>This lab</span></article><article><strong>${state.best}%</strong><span>Personal best</span></article><article><strong>${sentenceLabState().saved.length}</strong><span>Notebook</span></article></div><section class="sl-mastered-pattern"><span>Pattern to keep</span><strong lang="ja">${esc(sentenceLabLesson.sentence)}</strong><small>${esc(sentenceLabLesson.meaning)}</small><button id="slSummaryAudio" class="audio">🔊 Hear it again</button></section><div class="sl-summary-actions"><button id="slRetryLesson">Practise again</button><button id="slFinishLesson" class="primary">${esc(finishLabel)}</button></div></section>`;
  $('#slSummaryAudio').onclick=()=>speakJapanese(sentenceLabLesson.sentence);
  $('#slRetryLesson').onclick=()=>startSentenceLabLesson(sentenceLabRun.lessonIndex);
  $('#slFinishLesson').onclick=()=>{if(activityReturnScreen==='journey')returnToActivitySource('home');else renderSentenceLabHome()};
}

function renderSentenceNotebook(){
  const saved=sentenceLabState().saved;
  $('#sentenceLabHome').hidden=true;$('#sentenceLabReader').hidden=false;$('#sentenceLabCounter').textContent='Sentence Notebook';
  $('#sentenceLabContent').innerHTML=`<section class="sl-notebook"><div class="sl-section-heading"><div><span class="eyebrow">Sentence mining notebook</span><h2>Your useful Japanese</h2></div><button id="slNotebookBack">← Labs</button></div><p>Save patterns from Sentence Lab now; other Kaishi activities can add sentences through the shared notebook.</p>${saved.length?`<div class="sl-notebook-list">${saved.map((item,index)=>`<article><div><strong lang="ja">${esc(item.sentence)}</strong><small>${esc(item.reading)}</small><p class="sl-notebook-english">${esc(item.meaning)}</p></div><div><button data-sl-notebook-audio="${index}">🔊</button><button data-sl-notebook-english="${index}">EN</button><button data-sl-notebook-practice="${index}">Practise</button><button data-sl-notebook-remove="${index}" aria-label="Remove sentence">×</button></div></article>`).join('')}</div>`:'<div class="sl-empty"><span>📓</span><h3>No mined sentences yet</h3><p>Use ☆ Save sentence during any guided lab.</p></div>'}</section>`;
  $('#slNotebookBack').onclick=renderSentenceLabHome;
  document.querySelectorAll('[data-sl-notebook-audio]').forEach(button=>button.onclick=()=>speakJapanese(saved[+button.dataset.slNotebookAudio].sentence));
  document.querySelectorAll('[data-sl-notebook-english]').forEach(button=>button.onclick=()=>button.closest('article').querySelector('.sl-notebook-english').classList.toggle('visible'));
  document.querySelectorAll('[data-sl-notebook-practice]').forEach(button=>button.onclick=()=>{const item=saved[+button.dataset.slNotebookPractice],index=sentenceLabData.lessons.findIndex(lesson=>lesson.id===item.lessonId);if(index>=0)startSentenceLabLesson(index);else speakJapanese(item.sentence)});
  document.querySelectorAll('[data-sl-notebook-remove]').forEach(button=>button.onclick=()=>{saveSentenceToNotebook(saved[+button.dataset.slNotebookRemove]);renderSentenceNotebook()});
}

function renderSentenceMistakes(){
  const mistakes=sentenceLabState().mistakes;
  $('#sentenceLabHome').hidden=true;$('#sentenceLabReader').hidden=false;$('#sentenceLabCounter').textContent='Mistake review';
  $('#sentenceLabContent').innerHTML=`<section class="sl-notebook sl-mistakes"><div class="sl-section-heading"><div><span class="eyebrow">Explain my mistake</span><h2>Your recent misunderstandings</h2></div><button id="slMistakesBack">← Labs</button></div><p>Each entry identifies the relationship that needs attention—not just the correct answer.</p>${mistakes.length?`<div class="sl-mistake-list">${mistakes.map((item,index)=>`<article><span>${esc(item.skill)}</span><strong>${esc(item.title)}</strong><p lang="ja">${esc(item.sentence)}</p><div>${esc(item.explanation)}</div><button data-sl-mistake-practice="${index}">Practise this pattern</button></article>`).join('')}</div>`:'<div class="sl-empty"><span>✨</span><h3>No saved misunderstandings</h3><p>When an answer is incorrect, its targeted explanation will appear here.</p></div>'}</section>`;
  $('#slMistakesBack').onclick=renderSentenceLabHome;
  document.querySelectorAll('[data-sl-mistake-practice]').forEach(button=>button.onclick=()=>{const index=sentenceLabData.lessons.findIndex(lesson=>lesson.id===mistakes[+button.dataset.slMistakePractice].lessonId);if(index>=0)startSentenceLabLesson(index)});
}

async function practiseSavedSentence(item){
  await openSentenceLab();
  const index=sentenceLabData?.lessons?.findIndex(lesson=>lesson.id===item?.lessonId);
  if(index>=0)startSentenceLabLesson(index);
  else speakJapanese(item?.sentence);
}

function makeSentenceMineButton(label,sourceFactory){
  const button=document.createElement('button');button.type='button';button.className='sl-mine-external';button.textContent=label;
  button.onclick=event=>{event.stopPropagation();const made=sourceFactory(),sources=(Array.isArray(made)?made:[made]).filter(Boolean),fresh=sources.filter(source=>!sentenceLabSaved(source.sentence));fresh.forEach(saveSentenceToNotebook);if(!fresh.length)toast('Already in Sentence Notebook');button.textContent='★ Sent to Notebook'};
  return button;
}

function installExternalSentenceMining(){
  document.querySelectorAll('.theatre-line').forEach((article,index)=>{
    if(article.querySelector('.sl-mine-external'))return;
    const toolbar=article.querySelector('.theatre-line-top');if(!toolbar)return;
    toolbar.append(makeSentenceMineButton('☆ Mine line',()=>{
      const lineIndex=Number(article.querySelector('[data-theatre-line]')?.dataset.theatreLine??index),line=theatreScene?.timeline?.[lineIndex];
      return line?{id:`theatre-${theatreScene.id}-${lineIndex}`,title:theatreScene.title,sentence:line.line,reading:line.reading,meaning:line.meaning}:null;
    }));
  });
  const mangaCard=document.querySelector('.manga-reading-card');
  if(mangaCard&&!mangaCard.querySelector('.sl-mine-external')){
    const panel=mangaStory?.panels?.[mangaPanelIndex];
    if(panel)mangaCard.prepend(makeSentenceMineButton('☆ Mine this manga sentence',()=>({id:`manga-${mangaStory.id}-${mangaPanelIndex}`,title:mangaStory.englishTitle,sentence:panel.sentence,reading:panel.reading,meaning:panel.translation})));
  }
  const comicHeader=document.querySelector('.manga-comic-header');
  if(comicHeader&&!comicHeader.querySelector('.sl-mine-external')){
    comicHeader.append(makeSentenceMineButton('☆ Mine page dialogue',()=>{
      const page=mangaStory?.pages?.[mangaPanelIndex];
      return (page?.balloons||[]).map((balloon,index)=>({id:`manga-${mangaStory.id}-${mangaPanelIndex}-${index}`,title:mangaStory.englishTitle,sentence:(balloon.words||[]).map(word=>word.text).join(''),reading:(balloon.words||[]).map(word=>word.reading||word.text).join(' '),meaning:balloon.english||''}));
    }));
  }
  document.querySelectorAll('.conversation-transcript article').forEach((article,index)=>{
    if(article.querySelector('.sl-mine-external'))return;const turn=conversation?.turns?.[index];if(!turn)return;
    article.append(makeSentenceMineButton('☆ Mine this exchange',()=>[
      {id:`conversation-${conversation.id}-${index}-prompt`,title:conversation.title,sentence:turn.line,meaning:turn.meaning},
      {id:`conversation-${conversation.id}-${index}-reply`,title:conversation.title,sentence:turn.response,meaning:turn.responseMeaning}
    ]));
  });
}

let sentenceMiningTimer=0;
new MutationObserver(()=>{clearTimeout(sentenceMiningTimer);sentenceMiningTimer=setTimeout(installExternalSentenceMining,20)}).observe(document.body,{childList:true,subtree:true});
installExternalSentenceMining();

window.KaishiSentenceLab={
  open:openSentenceLab,
  startLesson:startSentenceLabLesson,
  practiseSavedSentence,
  saveSentence:source=>saveSentenceToNotebook(source),
  saved:()=>structuredClone(sentenceLabState().saved)
};

$('#sentenceLabBack').onclick=()=>{
  speechSynthesis?.cancel?.();
  if(activityReturnScreen==='journey')returnToActivitySource('home');
  else returnToActivitySource('games');
};
$('#sentenceLabLibraryBack').onclick=renderSentenceLabHome;
$('#sentenceLabMode').onclick=()=>{activityReturnScreen='games';openSentenceLab()};
