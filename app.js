'use strict';
const $=s=>document.querySelector(s), screens=[...document.querySelectorAll('.screen')];
const APP_VERSION='5.9.0';
const SKILLS=['meaning','production','listening','reading','kanji','sentence','picture'];
const BATTLE_MONSTERS=[{id:'kappa',name:'Kappa'},{id:'tanuki',name:'Tanuki'},{id:'kitsune',name:'Kitsune'},{id:'karakasa',name:'Karakasa-obake'}];
const LABELS={meaning:'Meaning',production:'English → Japanese',listening:'Listening',reading:'Reading',kanji:'Kanji recognition',sentence:'Sentence',picture:'Picture match'};
const SKILL_HELP={
 meaning:'How often you correctly recognise the English meaning of a Japanese word.',
 production:'How often you correctly recall the Japanese word from its English meaning.',
 listening:'How often you identify the correct meaning after hearing the Japanese word.',
 reading:'How often you recall or select the correct Japanese reading.',
 kanji:'How often you recognise the correct written Japanese form.',
 sentence:'How often you choose the correct word from the context of a sentence.',
 picture:'How often you connect a mnemonic picture with the correct word and meaning.'
};
let vocab=[], session=[], index=0, current=null, revealed=false, startedAt=0, hintUsed=false, memoryScenes={};
let waitingWorker=null, latestVersionInfo=null, pictureGameActive=false, karutaActive=false, karuta=null, battleActive=false, battle=null;
const defaults={newLimit:5,sessionSize:15,activeWords:4,pictureDifficulty:4,mnemonicStyle:'clear',autoAudio:true};
let settings={...defaults,...loadJSON('kq-settings',{})};
let progress=loadJSON('kq-progress',{});
const META_DEFAULTS={lastStudy:'',streak:0,totalAnswers:0,totalCorrect:0,monsterVictories:[],totalMonsterVictories:0,streakRescue:null,updatedAt:0};
let meta={...META_DEFAULTS,...loadJSON('kq-meta',{})};
function loadJSON(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}
function save(sync=true){if(sync)meta.updatedAt=Date.now();localStorage.setItem('kq-progress',JSON.stringify(progress));localStorage.setItem('kq-settings',JSON.stringify(settings));localStorage.setItem('kq-meta',JSON.stringify(meta));if(sync)window.KaishiCloud?.scheduleSync?.()}
function show(id){screens.forEach(s=>s.classList.toggle('active',s.id===id));scrollTo(0,0)}
function openCharacterSettings(){show('settings');requestAnimationFrame(()=>{const picker=$('#avatarPicker');if(!picker)return;picker.scrollIntoView({behavior:'smooth',block:'center'});picker.classList.add('profile-target');setTimeout(()=>picker.classList.remove('profile-target'),1600)})}
function toast(t){const e=$('#toast');e.textContent=t;e.style.display='block';setTimeout(()=>e.style.display='none',1800)}
function day(date=new Date()){const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');return `${y}-${m}-${d}`}
function esc(value=''){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function pFor(id){const p=progress[id]||(progress[id]={stage:0,due:0,interval:0,ease:2.5,reps:0,lapses:0,mnemonic:'',skills:{}});p.skills=p.skills||{};SKILLS.forEach(s=>p.skills[s]||(p.skills[s]={attempts:0,correct:0,strength:0}));return p}
function dueWords(){const now=Date.now();return vocab.filter(v=>{const p=progress[v.id];return p&&p.due<=now})}
function dailyDueWords(){
 const today=day(),limit=Math.max(5,Math.min(50,+settings.sessionSize||15));
 if(!meta.dailyReviewPlan||meta.dailyReviewPlan.date!==today||!Array.isArray(meta.dailyReviewPlan.ids)){
  const ids=dueWords().sort((a,b)=>pFor(a.id).due-pFor(b.id).due).slice(0,limit).map(v=>v.id);
  meta.dailyReviewPlan={date:today,ids,limit};
  save(false);
 }
 const byId=new Map(vocab.map(v=>[v.id,v])),now=Date.now();
 return meta.dailyReviewPlan.ids.map(id=>byId.get(id)).filter(v=>v&&progress[v.id]?.due<=now);
}
function started(){return Object.keys(progress).length}
function accuracy(){return meta.totalAnswers?Math.round(meta.totalCorrect/meta.totalAnswers*100):0}
function mastery(p){return p&&p.interval>=21&&SKILLS.every(s=>(p.skills?.[s]?.strength||0)>=.65)}
function recentMonsterVictories(){const cutoff=Date.now()-86400000;meta.monsterVictories=(Array.isArray(meta.monsterVictories)?meta.monsterVictories:[]).filter(t=>Number(t)>cutoff);return meta.monsterVictories.length}
function detectLostStreak(){
 if(!meta.lastStudy||Number(meta.streak)<=0)return;
 const last=new Date(`${meta.lastStudy}T00:00:00`),today=new Date(`${day()}T00:00:00`),gap=Math.floor((today-last)/86400000);
 if(gap<2||meta.streakRescue?.lastStudyBeforeLoss===meta.lastStudy)return;
 const lostAt=last.getTime()+2*86400000;
 meta.streakRescue={lostStreak:Number(meta.streak),lastStudyBeforeLoss:meta.lastStudy,lostAt,expiresAt:lostAt+7*86400000,attempted:false};
 meta.streak=0;save(false);
}
function activeStreakRescue(){const r=meta.streakRescue;return Boolean(r&&!r.attempted&&!r.success&&Date.now()<=Number(r.expiresAt||0))}
function updateStreakRescue(){
 const button=$('#streakRescueMode'),message=$('#streakRescueMessage');if(!button||!message)return;
 const active=activeStreakRescue();button.hidden=!active;message.hidden=!active;
 if(active){const days=Math.max(1,Math.ceil((meta.streakRescue.expiresAt-Date.now())/86400000));message.textContent=`One attempt available for ${days} more day${days===1?'':'s'}: defeat Kaidōra with 10 correct answers and no mistakes to restore your ${meta.streakRescue.lostStreak}-day streak.`}
}
window.KaishiQuestCloudAdapter={
 snapshot:()=>({version:2,progress,meta,settings}),
 restore:data=>{progress=data?.progress||{};meta={...META_DEFAULTS,...(data?.meta||{})};delete meta.dailyReviewPlan;settings={...defaults,...(data?.settings||{})};save(false);if($('#newLimit')){$('#newLimit').value=settings.newLimit;$('#sessionSize').value=settings.sessionSize;$('#activeWords').value=settings.activeWords;$('#pictureDifficulty').value=settings.pictureDifficulty;$('#mnemonicStyle').value=settings.mnemonicStyle;$('#autoAudio').checked=settings.autoAudio}updateHome();toast('Cloud progress restored')},
 stats:()=>{const mastered=Object.values(progress).filter(mastery).length,reviews=Number(meta.totalAnswers||0),correct=Number(meta.totalCorrect||0),monsters=Number(meta.totalMonsterVictories||meta.monsterVictories?.length||0),streak=Number(meta.streak||0);return{xp:Math.max(0,correct*10+mastered*50+monsters*100+streak*20),mastered,accuracy:reviews?Math.round(correct/reviews*100):0,reviews,monsters_defeated:monsters,streak}}
};
function updateHome(){detectLostStreak();const due=dailyDueWords().length,dailyLimit=meta.dailyReviewPlan?.limit||settings.sessionSize;$('#dueCount').textContent=due;$('#dueCount').parentElement.setAttribute('aria-label',`${due} reviews remaining today; daily limit ${dailyLimit}`);$('#dueCount').parentElement.title=`Reviews remaining today (maximum ${dailyLimit}). Missed days do not add extra reviews.`;$('#learnedCount').textContent=started();$('#accuracy').textContent=accuracy()+'%';$('#mastered').textContent=Object.values(progress).filter(mastery).length;$('#totalWords').textContent=vocab.length;$('#monsters24h').textContent=recentMonsterVictories();$('#streak').textContent=`🔥 ${meta.streak} day${meta.streak===1?'':'s'} streak`;$('#summary').textContent=due?`${due} of today's reviews are ready.`:`Today's reviews are complete. Add new words or practise weak skills.`;$('#skills').innerHTML=SKILLS.map(s=>{let a=0,c=0;Object.values(progress).forEach(p=>{a+=p.skills[s]?.attempts||0;c+=p.skills[s]?.correct||0});const pct=a?Math.round(c/a*100):0,detail=a?`${pct}% correct across ${a} attempt${a===1?'':'s'}.`:'No attempts yet.';return `<div class="skill-row" tabindex="0" role="group" aria-label="${esc(LABELS[s])}: ${detail} ${esc(SKILL_HELP[s])}"><b>${LABELS[s]} <span class="skill-info" aria-hidden="true">?</span></b><div class="bar" aria-hidden="true"><i style="width:${pct}%"></i></div><span>${pct}%</span><p class="skill-help"><strong>${detail}</strong> ${SKILL_HELP[s]}</p></div>`}).join('');updateStreakRescue();window.KaishiCloud?.renderDashboardAvatar?.()}
function similarity(a='',b=''){a=String(a);b=String(b);let score=0;if(a.length===b.length)score+=3;if(a.slice(-1)===b.slice(-1))score+=2;if(a.slice(-2)===b.slice(-2))score+=3;for(const ch of new Set(a))if(b.includes(ch))score+=1;return score}
function distractors(v,key,n=3){const pool=vocab.filter(x=>x.id!==v.id&&x[key]&&x[key]!==v[key]);const target=v[key]||'';return shuffle(pool.map(x=>({x,score:similarity(target,x[key])+(Math.abs((x.frequency||9999)-(v.frequency||9999))<250?2:0)})).sort((a,b)=>b.score-a.score).slice(0,35)).slice(0,n).map(o=>o.x[key])}
function shuffle(a){return [...a].sort(()=>Math.random()-.5)}
function chooseSkill(v){const p=pFor(v.id);const usable=v.word===v.reading?SKILLS.filter(s=>s!=='kanji'):SKILLS;const weak=usable.map(s=>({s,w:(1-(p.skills[s].strength||0))*(.7+Math.random()*.6)})).sort((a,b)=>b.w-a.w);if(p.stage===0)return'intro';if(p.interval>=21&&Math.random()<.7)return Math.random()<.5?'meaning':'production';return weak[0].s}
function abortSession(destination='home'){
 pictureGameActive=false;karutaActive=false;karuta=null;battleActive=false;battle=null;
 session=[];
 index=0;
 current=null;
 revealed=false;
 hintUsed=false;
 const card=$('#card');
 if(card)card.innerHTML='';
 updateHome();
 show(destination);
}
function makeSession(){
 pictureGameActive=false;session=[];index=0;current=null;
 const due=dailyDueWords().sort((a,b)=>pFor(a.id).due-pFor(b.id).due);
 const unseen=vocab.filter(v=>!progress[v.id]).slice(0,settings.newLimit);
 let selected=[...due.slice(0,settings.sessionSize),...unseen];
 if(!selected.length)selected=vocab.slice(0,settings.newLimit);
 const activeCount=Math.max(2,Math.min(4,+settings.activeWords||4));
 const queue=selected.map(v=>{
   const p=pFor(v.id);
   let skills=p.stage===0?['intro','meaning','reading','picture','sentence','listening','kanji','production']:[chooseSkill(v)];
   skills=skills.filter(s=>s!=='kanji'||v.word!==v.reading).filter(s=>s!=='picture'||memoryScenes[sceneKey(v)]);
   return {v,skills};
 });
 session=[];
 while(queue.some(q=>q.skills.length)&&session.length<Math.max(settings.sessionSize,settings.newLimit*7)){
   const active=queue.filter(q=>q.skills.length).slice(0,activeCount);
   shuffle(active).forEach(q=>{if(q.skills.length)session.push({v:q.v,skill:q.skills.shift()})});
   queue.push(...queue.splice(0,Math.min(activeCount,queue.length)));
 }
 // Prevent immediate repeats where possible.
 for(let i=1;i<session.length;i++)if(session[i].v.id===session[i-1].v.id){
   const j=session.findIndex((x,k)=>k>i&&x.v.id!==session[i-1].v.id);
   if(j>i)[session[i],session[j]]=[session[j],session[i]];
 }
 index=0;show('study');renderCurrent()
}
function media(name){return name?`media/${encodeURIComponent(name).replace(/%2F/g,'/')}`:''}
function play(name){if(!name)return;new Audio(media(name)).play().catch(()=>{})}
function visual(v){return `${v.picture?`<img class="picture" src="${media(v.picture)}" alt="Illustration">`:''}`}
function sceneKey(v){return `${v.word}|${v.reading}`}
function sceneImageUrl(scene){
 if(!scene?.file)return'';
 const url=new URL(scene.file,document.baseURI);
 url.searchParams.set('v',APP_VERSION);
 return url.href;
}
function sceneSprite(scene,extraClass=''){
 const src=sceneImageUrl(scene);
 if(!src)return `<div class="scene-image-error">No image is mapped for this word.</div>`;
 const filename=esc(scene.file||'unknown');
 return `<figure class="scene-image-wrap ${extraClass}-wrap">
   <img class="scene-image ${extraClass}"
     src="${esc(src)}"
     alt="${esc(scene.alt||'Memory scene')}"
     data-scene-file="${filename}"
     loading="eager"
     decoding="async">
   <figcaption class="scene-image-fallback" hidden>Image failed to load: ${filename}</figcaption>
 </figure>`;
}
function wireSceneImages(root=document){
 root.querySelectorAll('img.scene-image').forEach(img=>{
  const fallback=img.parentElement?.querySelector('.scene-image-fallback');
  const showError=()=>{
   img.hidden=true;
   if(fallback)fallback.hidden=false;
   console.error('Scene image failed',img.dataset.sceneFile,img.currentSrc||img.src);
  };
  img.addEventListener('error',showError,{once:true});
  if(img.complete&&!img.naturalWidth)showError();
 });
}

function memoryScene(v){
 const s=memoryScenes[sceneKey(v)]||Object.values(memoryScenes).find(x=>x.word===v.word&&x.reading===v.reading);
 if(!s)return'';
 return `<section class="memory-scene"><h3>🖼️ Memory Scene</h3>${sceneSprite(s,'memory-scene-image')}${s.soundMnemonic?`<p class="memory-sound"><b>Sounds like:</b> ${esc(s.soundMnemonic)}</p>`:''}<p class="memory-caption">${esc(s.caption||'')}</p>${s.kanjiNote?`<p class="memory-note">${esc(s.kanjiNote)}</p>`:''}</section>`;
}
function sceneEmoji(v){const m=(v.meaning||'').toLowerCase();if(/eat|food|meal/.test(m))return'🍜';if(/drink|water|tea|coffee/.test(m))return'🥤';if(/school|study|learn|teacher|student/.test(m))return'🎓';if(/go|come|walk|run|travel/.test(m))return'🚶';if(/see|look|watch|eye/.test(m))return'👀';if(/say|speak|talk|word/.test(m))return'💬';if(/person|friend|family|child/.test(m))return'👤';if(/time|day|week|year/.test(m))return'⏰';if(/money|buy|shop|price/.test(m))return'🛍️';if(/love|like|happy|fun/.test(m))return'✨';return'🎬'}
function cleanText(t=''){return String(t).replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim()}
function generatedMnemonic(v){const emoji=sceneEmoji(v),meaning=cleanText(v.meaning),context=cleanText(v.sentenceMeaning||v.sentence||'');const written=v.word===v.reading?`The kana ${v.reading} flashes across the scene like a subtitle.`:`The written form ${v.word} appears as a huge sign in the middle of the action.`;const base=`${emoji} Picture this exaggerated scene: ${context||`something unmistakably showing “${meaning}”`}. ${written} A character points at it and clearly calls out “${v.reading}!” three times. Freeze the picture, the sound ${v.reading}, and the meaning “${meaning}” together.`;const additions={clear:'',funny:' Make one detail absurdly oversized or embarrassingly funny.',gamer:' Turn it into a game level: collecting the glowing word unlocks the meaning.',ghibli:' Imagine it as a warm hand-drawn fantasy moment with wind, movement and a striking visual reveal.',pokemon:' Imagine a friendly creature using the word as a named move that produces the meaning.'};return base+(additions[settings.mnemonicStyle]||'')}
function mnemonic(v){const p=pFor(v.id);if(p.mnemonic)return p.mnemonic;const d=cleanText(v.defaultMnemonic);const generic=/Say .* aloud|Picture the written shape|written in kana|strong visual label|connect the sound directly/i.test(d);return generic?generatedMnemonic(v):d}
function mnemonicVisual(v){return `<div class="memory-stage" aria-hidden="true"><span class="memory-emoji">${sceneEmoji(v)}</span><span class="memory-word">${v.word}</span><span class="memory-pulse">${v.reading}</span></div>`}
function memorySupport(v){const scene=memoryScene(v);return scene||`${mnemonicVisual(v)}<div class="mnemonic"><b>Memory link</b><p>${mnemonic(v)}</p><button id="editMnemonic">Edit mnemonic</button></div>`}
function wireMemoryEditor(v){const b=$('#editMnemonic');if(b)b.onclick=()=>editMnemonic(v)}
function renderCurrentUnsafe(){
 if(index>=session.length){finishSession();return}
 current=session[index];
 const game=(current.skill==='picture'&&pictureGameActive)||karutaActive||battleActive;
 $('#exitBtn').textContent=game?'← Game menu':'← Exit';
 $('#sessionCounter').setAttribute('aria-label',game?'Game progress':'Study progress');revealed=false;hintUsed=false;startedAt=Date.now();const {v,skill}=current;$('#sessionCounter').textContent=`${index+1}/${session.length}`;$('#progressFill').style.width=`${index/session.length*100}%`;const c=$('#card');
if(current.battle){renderBattleQuestion(v);return}
if(current.karuta){renderKarutaQuestion(v);return}
if(skill==='intro'){c.innerHTML=`<div class="eyebrow">Meet the word</div><div class="jp">${v.word}</div><div class="reading">${v.reading}</div><div class="meaning">${v.meaning}</div>${visual(v)}${memorySupport(v)}<button id="introAudio" class="audio">🔊 Play word</button><button id="continueBtn" class="primary reveal">Got it →</button>`;if(settings.autoAudio)play(v.wordAudio);$('#introAudio').onclick=()=>play(v.wordAudio);$('#continueBtn').onclick=next;wireMemoryEditor(v);return}
if(skill==='meaning')recallCard(v,'What does this mean?',v.word,`${v.meaning}<div class="reading">${v.reading}</div>`,skill);
if(skill==='production')recallCard(v,'Recall the Japanese word',v.meaning,`<div class="jp">${v.word}</div><div class="reading">${v.reading}</div>`,skill);
if(skill==='listening'){const choices=shuffle([v.meaning,...distractors(v,'meaning')]);c.innerHTML=`<div class="eyebrow">Listening</div><h2>Which meaning matches the audio?</h2><button id="playBtn" class="audio primary">🔊 Play audio</button><div class="choices">${choices.map(x=>`<button class="choice" data-answer="${encodeURIComponent(x)}">${x}</button>`).join('')}</div><button id="hintBtn" class="hint">Show memory hint</button>`;$('#playBtn').onclick=()=>play(v.wordAudio);if(settings.autoAudio)play(v.wordAudio);bindChoices(v.meaning,skill);$('#hintBtn').onclick=()=>showHint(v)}
if(skill==='reading'){const mature=pFor(v.id).interval>=21;if(mature){recallCard(v,'Recall the Japanese reading',v.meaning,`<div class="reading">${v.reading}</div><div class="jp small-jp">${v.word}</div>`,skill)}else{const choices=shuffle([v.reading,...distractors(v,'reading')]);c.innerHTML=`<div class="eyebrow">Reading from meaning</div><div class="meaning prompt-meaning">${v.meaning}</div><h2>Which Japanese reading matches?</h2><div class="choices">${choices.map(x=>`<button class="choice" data-answer="${encodeURIComponent(x)}">${x}</button>`).join('')}</div><button id="playAfter" class="audio" hidden>🔊 Hear the answer</button><button id="hintBtn" class="hint">Show memory hint</button>`;bindChoices(v.reading,skill,()=>{$('#playAfter').hidden=false;$('#playAfter').onclick=()=>play(v.wordAudio)});$('#hintBtn').onclick=()=>showHint(v)}}
if(skill==='kanji'){const mature=pFor(v.id).interval>=21;if(mature){recallCard(v,'Recall the written Japanese word',`${v.reading}<div class="meaning">${v.meaning}</div>`,`<div class="jp">${v.word}</div>`,skill)}else{const choices=shuffle([v.word,...distractors(v,'word')]);c.innerHTML=`<div class="eyebrow">Kanji recognition</div><div class="reading large-reading">${v.reading}</div><div class="meaning prompt-meaning">${v.meaning}</div><h2>Choose the correct written form</h2><div class="choices kanji-choices">${choices.map(x=>`<button class="choice" data-answer="${encodeURIComponent(x)}">${x}</button>`).join('')}</div><button id="hintBtn" class="hint">Show memory hint</button>`;bindChoices(v.word,skill);$('#hintBtn').onclick=()=>showHint(v)}}
if(skill==='picture'){renderPictureQuestion(v,current.pictureMode||'picture-word');}
if(skill==='sentence'){let sentence=v.sentence||`「${v.word}」 means ____.`;let prompt=sentence.includes(v.word)?sentence.replace(v.word,'＿＿＿'):sentence.replace(/<b>|<\/b>/g,'');const choices=shuffle([v.word,...distractors(v,'word')]);c.innerHTML=`<div class="eyebrow">Sentence context</div><div class="sentence">${prompt}</div><p class="meaning">${v.sentenceMeaning||v.meaning}</p><div class="choices">${choices.map(x=>`<button class="choice" data-answer="${encodeURIComponent(x)}">${x}</button>`).join('')}</div><button id="sentenceAudio" class="audio">🔊 Full sentence</button>`;bindChoices(v.word,skill);$('#sentenceAudio').onclick=()=>play(v.sentenceAudio)}}
function renderCurrent(){
 try{
  renderCurrentUnsafe();
  wireSceneImages($('#card')||document);
 }catch(error){
  console.error('Card rendering failed',error);
  const c=$('#card');
  if(c){
   c.innerHTML=`<div class="eyebrow">Something went wrong</div><h2>This card could not be displayed.</h2><p class="muted">${esc(error?.message||'Unknown rendering error')}</p><button id="skipBrokenCard" class="primary">Skip this card</button>`;
   const b=$('#skipBrokenCard');
   if(b)b.onclick=()=>{index++;renderCurrent()};
  }
 }
}
function recallCard(v,title,front,answer,skill){$('#card').innerHTML=`<div class="eyebrow">Active recall</div><h2>${title}</h2><div class="jp">${front}</div><button id="hintBtn" class="hint">Show memory hint</button><div id="answer" hidden><hr>${answer}${visual(v)}${memorySupport(v)}<button class="audio" id="answerAudio">🔊 Play audio</button></div><button id="revealBtn" class="primary reveal">Reveal answer</button><div id="ratingsWrap" hidden><p class="rating-title">How easily did you remember this <em>before</em> revealing the answer?</p><div id="ratings" class="ratings"><button class="again" data-rating="1">Again</button><button class="hard" data-rating="2">Hard</button><button class="good" data-rating="3">Good</button><button class="easy" data-rating="4">Easy</button></div></div>`;$('#hintBtn').onclick=()=>showHint(v);$('#revealBtn').onclick=()=>{$('#answer').hidden=false;$('#ratingsWrap').hidden=false;$('#revealBtn').hidden=true;$('#answerAudio').onclick=()=>play(v.wordAudio);wireMemoryEditor(v);wireSceneImages($('#answer'))};document.querySelectorAll('[data-rating]').forEach(b=>b.onclick=()=>grade(v,skill,+b.dataset.rating,+b.dataset.rating>=3))}
function showHint(v){hintUsed=true;const s=memoryScenes[sceneKey(v)];alert(s?s.caption:mnemonic(v))}
function bindChoices(answer,skill,onReveal){document.querySelectorAll('.choice').forEach(b=>b.onclick=()=>{if(revealed)return;revealed=true;const val=decodeURIComponent(b.dataset.answer);const ok=val===answer;b.classList.add(ok?'correct':'wrong');document.querySelectorAll('.choice').forEach(x=>{if(decodeURIComponent(x.dataset.answer)===answer)x.classList.add('correct');x.disabled=true});if(onReveal)onReveal(ok);setTimeout(()=>grade(current.v,skill,ok?(hintUsed?2:3):1,ok),900)})}
function bindGameChoices(answer,v){
 document.querySelectorAll('.choice').forEach(b=>b.onclick=()=>{
  if(revealed)return;
  revealed=true;
  const val=decodeURIComponent(b.dataset.answer),ok=val===answer;
  b.classList.add(ok?'correct':'wrong');
  document.querySelectorAll('.choice').forEach(x=>{
   if(decodeURIComponent(x.dataset.answer)===answer)x.classList.add('correct');
   x.disabled=true;
  });
  grade(v,'picture',ok?3:1,ok,false);
  const feedback=$('#gameFeedback');
  feedback.innerHTML=`<p class="game-result ${ok?'game-result-correct':'game-result-wrong'}">${ok?'Correct!':'Not quite — here is the answer.'}</p><div class="game-answer"><div class="jp">${esc(v.word)}</div><div class="reading">${esc(v.reading)}</div><div class="meaning">${esc(v.meaning)}</div></div>${v.wordAudio?'<button id="gameAnswerAudio" class="audio">🔊 Play Japanese audio</button>':'<p class="muted">Audio is not available for this word.</p>'}<button id="gameNext" class="primary reveal">${index===session.length-1?'Finish game':'Next question →'}</button>`;
  feedback.hidden=false;
  const audio=$('#gameAnswerAudio');
  if(audio)audio.onclick=()=>play(v.wordAudio);
  $('#gameNext').onclick=next;
  feedback.scrollIntoView({behavior:'smooth',block:'nearest'});
  $('#gameNext').focus({preventScroll:true});
 });
}
function grade(v,skill,rating,correct,advance=true){const p=pFor(v.id),sp=p.skills[skill];const response=(Date.now()-startedAt)/1000;sp.attempts++;if(correct)sp.correct++;const quality=rating/4*(hintUsed?.72:1)*(response>15?.9:1);sp.strength=Math.max(0,Math.min(1,sp.strength*.75+quality*.25));meta.totalAnswers++;if(correct)meta.totalCorrect++;p.reps++;if(rating===1){p.lapses++;p.interval=0;p.stage=1;p.due=Date.now()+10*60*1000;p.ease=Math.max(1.3,p.ease-.2)}else if(p.stage<2){p.stage=2;p.interval=rating===2?1:rating===3?2:4;p.due=Date.now()+p.interval*86400000}else{const mult=rating===2?1.2:rating===3?p.ease:p.ease*1.35;p.interval=Math.max(1,Math.round(Math.max(1,p.interval)*mult));p.ease=Math.max(1.3,p.ease+(rating===2?-.15:rating===4?.15:0));p.due=Date.now()+p.interval*86400000}save();if(advance)next()}
function next(){index++;renderCurrent()}
function finishSession(){if(battleActive){showBattleSummary();return}if(karutaActive){showKarutaSummary();return}if(pictureGameActive){abortSession('games');toast('Game complete 🎉');return}const today=day();if(meta.lastStudy!==today){const y=day(new Date(Date.now()-86400000));meta.streak=meta.lastStudy===y?meta.streak+1:1;meta.lastStudy=today}save();updateHome();show('home');toast('Session complete 🎉')}
function editMnemonic(v){const p=pFor(v.id);const text=prompt('Edit your personal mnemonic:',p.mnemonic||mnemonic(v));if(text!==null){p.mnemonic=text.trim();save();renderCurrent()}}

function illustratedWords(){return vocab.filter(v=>memoryScenes[sceneKey(v)]?.file)}
function pictureChoices(v,n){
 const pool=shuffle(illustratedWords().filter(x=>x.id!==v.id));
 return shuffle([v,...pool.slice(0,Math.max(1,n-1))]);
}
function renderPictureQuestion(v,mode='picture-word'){
 const count=Math.max(2,Math.min(6,+settings.pictureDifficulty||4));
 const choices=pictureChoices(v,count),scene=memoryScenes[sceneKey(v)],c=$('#card');
 let prompt='',answer='',buttons='';
 if(mode==='picture-word'){
  prompt=`${sceneSprite(scene,'quiz-picture')}<h2>Which word matches this picture?</h2>`;
  answer=v.id;buttons=choices.map(x=>`<button class="choice" data-answer="${encodeURIComponent(x.id)}">${esc(x.word)}</button>`).join('');
 }else if(mode==='picture-kanji-meaning'){
  prompt=`<div class="picture-kanji-prompt">${sceneSprite(scene,'quiz-picture')}<div class="picture-kanji-word" lang="ja">${esc(v.word)}</div></div><h2>Which English meaning matches?</h2>`;
  answer=v.id;buttons=choices.map(x=>`<button class="choice" data-answer="${encodeURIComponent(x.id)}">${esc(x.meaning)}</button>`).join('');
 }else if(mode==='listen-meaning'){
  prompt=`<div class="listen-prompt"><div class="listen-icon" aria-hidden="true">🔊</div><h2>Listen and choose the English meaning</h2><button id="gameReplayAudio" class="audio primary">Play Japanese word</button></div>`;
  answer=v.id;buttons=choices.map(x=>{const s=memoryScenes[sceneKey(x)];return `<button class="choice picture-choice" data-answer="${encodeURIComponent(x.id)}">${sceneSprite(s,'choice-sprite')}<span>${esc(x.meaning)}</span></button>`}).join('');
 }else{
  prompt=`<div class="jp">${esc(v.word)}</div><div class="reading">${esc(v.reading)}</div><h2>Choose the matching picture</h2>`;
  answer=v.id;buttons=choices.map(x=>{const s=memoryScenes[sceneKey(x)];return `<button class="choice picture-choice" data-answer="${encodeURIComponent(x.id)}">${sceneSprite(s,'choice-sprite')}<span>${esc(x.meaning)}</span></button>`}).join('');
 }
 c.innerHTML=`<div class="eyebrow">Vocabulary game</div>${prompt}<div class="choices picture-choices">${buttons}</div><section id="gameFeedback" class="game-feedback" aria-live="polite" hidden></section>`;
 wireSceneImages(c);
 bindGameChoices(answer,v);
 const replay=$('#gameReplayAudio');
 if(replay){
  replay.onclick=()=>play(v.wordAudio);
  play(v.wordAudio);
 }
}
async function startPictureGame(mode){
 abortSession('games');
 const all=illustratedWords().filter(v=>mode!=='listen-meaning'||v.wordAudio);
 if(all.length<2){toast('More illustrated vocabulary is needed');return}

 const pool=shuffle(all.filter(v=>progress[v.id]?.stage>=1));
 const available=pool.length>=2?pool:shuffle(all);
 session=available
  .slice(0,Math.min(settings.sessionSize,available.length))
  .map(v=>({v,skill:'picture',pictureMode:mode}));

 pictureGameActive=true;
 index=0;
 current=null;
 show('study');
 renderCurrent();
}

function karutaHud(){return `<div class="karuta-hud"><span><b id="karutaScore">${karuta.score.toLocaleString()}</b> points</span><span><b id="karutaCombo">${karuta.combo}</b> speed combo</span><span><b>${karuta.bestCombo}</b> best</span></div>`}
function updateKarutaHud(){if($('#karutaScore'))$('#karutaScore').textContent=karuta.score.toLocaleString();if($('#karutaCombo'))$('#karutaCombo').textContent=karuta.combo}
function playKarutaPrompt(v,replay=false){
 if(!karutaActive||revealed)return;
 if(replay){karuta.replayed=true;karuta.combo=0;updateKarutaHud()}
 karuta.roundStarted=performance.now();
 document.querySelectorAll('.karuta-card').forEach(card=>card.disabled=false);
 play(v.wordAudio);
 const button=$('#karutaReplay');if(button)button.textContent=replay?'🔊 Playing again — timer restarted':'🔊 Replay word — restarts timer';
}
function renderKarutaQuestion(v){
 const count=Math.min(karuta.pool.length,Math.max(2,Math.min(6,+settings.pictureDifficulty||4)));
 const choices=shuffle([v,...shuffle(karuta.pool.filter(x=>x.id!==v.id)).slice(0,count-1)]),c=$('#card');
 karuta.roundStarted=0;karuta.replayed=false;
 c.innerHTML=`<div class="eyebrow">Karuta · かるた</div><h2 class="karuta-title">Listen, then tap the matching card</h2>${karutaHud()}<button id="karutaReplay" class="audio primary">🔊 Play Japanese word</button><div class="karuta-grid">${choices.map(x=>`<button class="choice karuta-card" data-answer="${encodeURIComponent(x.id)}" disabled>${sceneSprite(memoryScenes[sceneKey(x)],'karuta-image')}<span class="karuta-kanji" lang="ja">${esc(x.word)}</span></button>`).join('')}</div><section id="karutaFeedback" class="game-feedback" aria-live="polite" hidden></section>`;
 wireSceneImages(c);
 document.querySelectorAll('.karuta-card').forEach(button=>button.onclick=()=>resolveKarutaAnswer(button,v));
 $('#karutaReplay').onclick=()=>playKarutaPrompt(v,true);
 playKarutaPrompt(v,false);
}
function resolveKarutaAnswer(button,v){
 if(revealed||!karuta.roundStarted)return;revealed=true;
 const elapsed=Math.max(.01,(performance.now()-karuta.roundStarted)/1000),answer=decodeURIComponent(button.dataset.answer),ok=answer===v.id;
 button.classList.add(ok?'correct':'wrong');document.querySelectorAll('.karuta-card').forEach(card=>{if(decodeURIComponent(card.dataset.answer)===v.id)card.classList.add('correct');card.disabled=true});
 karuta.times.push(elapsed);let earned=0,speedLabel='Miss',multiplier=1;
 if(ok){
  karuta.correct++;const fast=elapsed<=3&&!karuta.replayed;
  if(fast)karuta.combo++;else karuta.combo=0;
  karuta.bestCombo=Math.max(karuta.bestCombo,karuta.combo);
  const base=elapsed<=1.5?300:elapsed<=3?200:100;multiplier=fast?Math.min(4,1+Math.floor(karuta.combo/3)):1;earned=base*multiplier;karuta.score+=earned;
  speedLabel=elapsed<=1.5?'Lightning':elapsed<=3?'Quick':'Steady';
 }else{karuta.wrong++;karuta.combo=0}
 updateKarutaHud();grade(v,'listening',ok?(elapsed<=3&&!karuta.replayed?4:3):1,ok,false);
 const feedback=$('#karutaFeedback');feedback.hidden=false;feedback.innerHTML=`<p class="game-result ${ok?'game-result-correct':'game-result-wrong'}">${ok?`${speedLabel}! +${earned.toLocaleString()} points${multiplier>1?` · ×${multiplier} combo`:''}`:'Not quite — the speed combo has reset.'}</p><p class="karuta-time">Reaction time: <b>${elapsed.toFixed(2)} seconds</b></p><div class="game-answer"><div class="jp">${esc(v.word)}</div><div class="reading">${esc(v.reading)}</div><div class="meaning">${esc(v.meaning)}</div></div><button id="karutaAnswerAudio" class="audio">🔊 Play Japanese audio</button><button id="karutaNext" class="primary reveal">${index===session.length-1?'Karuta summary':'Next card →'}</button>`;
 $('#karutaAnswerAudio').onclick=()=>play(v.wordAudio);$('#karutaNext').onclick=next;feedback.scrollIntoView({behavior:'smooth',block:'nearest'});$('#karutaNext').focus({preventScroll:true});
}
function showKarutaSummary(){
 const average=karuta.times.length?karuta.times.reduce((sum,time)=>sum+time,0)/karuta.times.length:0,fastest=karuta.times.length?Math.min(...karuta.times):0;
 meta.karutaBest=Math.max(Number(meta.karutaBest||0),karuta.score);save();$('#sessionCounter').textContent='Complete';$('#progressFill').style.width='100%';
 $('#card').innerHTML=`<div class="eyebrow">Karuta summary · かるた</div><h2 class="battle-summary-title">Reflex round complete</h2><div class="battle-summary-grid karuta-summary-grid"><article><strong>${karuta.score.toLocaleString()}</strong><span>Points</span></article><article><strong>${karuta.correct}/${karuta.correct+karuta.wrong}</strong><span>Correct cards</span></article><article><strong>${average.toFixed(2)}s</strong><span>Average reaction</span></article><article><strong>${fastest.toFixed(2)}s</strong><span>Fastest tap</span></article><article><strong>${karuta.bestCombo}</strong><span>Best speed combo</span></article><article><strong>${Number(meta.karutaBest||0).toLocaleString()}</strong><span>Personal best</span></article></div><p class="battle-summary-note">Fast, correct taps within three seconds build the combo. Replaying the audio or taking longer gives you time to learn, but resets the speed chain.</p><button id="karutaAgain" class="primary reveal">Play Karuta again</button><button id="karutaDone" class="reveal">Return to games</button>`;
 $('#karutaAgain').onclick=startKarutaGame;$('#karutaDone').onclick=()=>abortSession('games');
}
function startKarutaGame(){
 abortSession('games');
 const pool=shuffle(illustratedWords().filter(v=>v.wordAudio&&progress[v.id]?.stage>=1));
 if(pool.length<2){toast('Learn at least two illustrated words with audio to unlock Karuta');return}
 session=pool.slice(0,Math.min(settings.sessionSize,pool.length)).map(v=>({v,skill:'listening',karuta:true}));
 karutaActive=true;karuta={pool,score:0,combo:0,bestCombo:0,correct:0,wrong:0,times:[],roundStarted:0,replayed:false};index=0;current=null;show('study');renderCurrent();
}

function decayCandidates(){
 const now=Date.now(),dayMs=86400000;
 const started=vocab.filter(v=>progress[v.id]?.stage>=1).map(v=>{
  const p=pFor(v.id),window=Math.max(6*3600000,Math.min(3*dayMs,(p.interval||1)*dayMs*.2));
  return {v,risk:(now-(p.due-window))/window,due:p.due};
 }).sort((a,b)=>b.risk-a.risk||a.due-b.due);
 const near=started.filter(x=>x.risk>=0);
 const chosen=[...near,...started.filter(x=>!near.includes(x))];
 return chosen.map(x=>x.v);
}
function startDecayBattle(){
 abortSession('games');
 const pool=decayCandidates();
 if(!pool.length){toast('Study some words first to unlock decay battles');return}
 session=pool.slice(0,Math.min(settings.sessionSize,pool.length)).map(v=>({v,skill:'meaning',battle:true}));
 battleActive=true;battle={castle:3,enemyHp:2,enemyMax:2,position:4,defeated:0,roster:shuffle(BATTLE_MONSTERS),monsterIndex:0,state:'approach',reviewed:0,correct:0,hinted:0,wrong:0,critical:0,missed:[],startedAt:Date.now()};index=0;current=null;show('study');renderCurrent();
}
function startStreakRescue(){
 if(!activeStreakRescue()){toast('No streak rescue is currently available');return}
 if(!confirm('This is your only attempt for this lost streak. Get all 10 answers right with no hints or mistakes. Start now?'))return;
 const pool=decayCandidates();
 if(pool.length<2){toast('Study at least two words before attempting the rescue');return}
 abortSession('games');
 const questions=[];while(questions.length<10)questions.push(...shuffle(pool));
 session=questions.slice(0,10).map(v=>({v,skill:'meaning',battle:true,rescue:true}));
 meta.streakRescue.attempted=true;meta.streakRescue.attemptedAt=Date.now();save();
 battleActive=true;battle={rescue:true,castle:1,enemyHp:10,enemyMax:10,position:4,defeated:0,roster:[{id:'kaidora',name:'Kaidōra'}],monsterIndex:0,state:'approach',reviewed:0,correct:0,hinted:0,wrong:0,critical:0,missed:[],startedAt:Date.now()};index=0;current=null;show('study');renderCurrent();
}
function legacyBattleLane(){
 const cells=[0,1,2,3,4].map(n=>`<span class="battle-cell">${n===0?'🏯':n===battle.position?'👾':''}</span>`).join('');
 return `<section class="battle-board" aria-label="Monster battle"><div class="battle-hud"><b>Castle ${'❤️'.repeat(battle.castle)}</b><b>Monster ${'⚡'.repeat(battle.enemyHp)}</b><b>Defeated ${battle.defeated}</b></div><div class="battle-lane">${cells}</div><p>Correct reviews damage and push back the monster. A mistake lets it advance.</p></section>`;
}
function legacyRenderBattleQuestion(v){
 const choices=shuffle([v.meaning,...distractors(v,'meaning')]),c=$('#card');
 c.innerHTML=`<div class="eyebrow">SRS Decay Battle</div>${battleLane()}<div class="jp battle-word">${esc(v.word)}</div><div class="reading">${esc(v.reading)}</div><h2>Defend the tower: choose the meaning</h2><div class="choices">${choices.map(x=>`<button class="choice" data-answer="${encodeURIComponent(x)}">${esc(x)}</button>`).join('')}</div><section id="battleFeedback" class="game-feedback" aria-live="polite" hidden></section>`;
 document.querySelectorAll('.choice').forEach(b=>b.onclick=()=>resolveBattleAnswer(b,v));
}
function legacyResolveBattleAnswer(button,v){
 if(revealed)return;revealed=true;const answer=decodeURIComponent(button.dataset.answer),ok=answer===v.meaning;
 button.classList.add(ok?'correct':'wrong');document.querySelectorAll('.choice').forEach(x=>{if(decodeURIComponent(x.dataset.answer)===v.meaning)x.classList.add('correct');x.disabled=true});
 grade(v,'meaning',ok?3:1,ok,false);
 let result='';
 if(ok){battle.enemyHp--;battle.position=Math.min(4,battle.position+1);result='Direct hit! The monster is pushed back.';if(battle.enemyHp<=0){battle.defeated++;battle.enemyHp=battle.enemyMax;battle.position=4;result='Monster defeated! Another wave approaches.'}}
 else{battle.position--;result='The monster advances!';if(battle.position<=0){battle.castle--;battle.position=4;result=battle.castle?'The castle was hit! The monster returns to the edge.':'The castle has fallen—but the reviewed word is now reinforced.'}}
 const feedback=$('#battleFeedback');feedback.hidden=false;feedback.innerHTML=`<p class="game-result ${ok?'game-result-correct':'game-result-wrong'}">${result}</p><div class="game-answer"><div class="jp">${esc(v.word)}</div><div class="reading">${esc(v.reading)}</div><div class="meaning">${esc(v.meaning)}</div></div>${v.wordAudio?'<button id="battleAudio" class="audio">🔊 Play Japanese audio</button>':''}<button id="battleNext" class="primary reveal">${battle.castle<=0||index===session.length-1?'Battle results':'Next wave →'}</button>`;
 $('#battleAudio')?.addEventListener('click',()=>play(v.wordAudio));$('#battleNext').onclick=()=>{if(battle.castle<=0){index=session.length;finishSession()}else next()};
}
function currentMonster(){return battle.rescue?{id:'kaidora',name:'Kaidōra'}:battle.roster[battle.monsterIndex%battle.roster.length]}
function monsterImage(state=battle.state){const m=currentMonster();return `media/battle/${m.id}${state==='approach'?'':`-${state}`}.webp?v=${APP_VERSION}`}
function battleLane(){const m=currentMonster(),left=29+(Math.max(1,battle.position)-1)*14;return `<section class="battle-board ${battle.rescue?'rescue-board':''}" aria-label="${esc(m.name)} approaching the Memory Dojo"><div class="battle-hud"><b>${battle.rescue?'Rescue chance':'Dojo '+ '❤️'.repeat(battle.castle)}</b><b>${esc(m.name)} ${'⚡'.repeat(Math.max(0,battle.enemyHp))}</b><b>${battle.rescue?`${battle.correct}/10 perfect answers`:`Defeated ${battle.defeated}`}</b></div><div class="battle-stage"><img class="battle-defenders" src="media/battle/defenders.webp?v=${APP_VERSION}" alt="The two learners defending the Memory Dojo"><img class="battle-monster battle-${battle.state}" src="${monsterImage()}" alt="Friendly ${esc(m.name)}" style="left:${left}%"></div><p>${battle.rescue?'Ten correct answers. One mistake ends this one-chance rescue.':'Correct without a hint lands a critical hit. A mistake lets the yōkai advance.'}</p></section>`}
function renderBattleQuestion(v){battle.state='approach';hintUsed=false;const choices=shuffle([v.meaning,...distractors(v,'meaning')]),c=$('#card'),rescue=battle.rescue;c.innerHTML=`<div class="eyebrow">${rescue?'Streak Rescue Battle':'SRS Decay Battle'}</div>${battleLane()}<div class="jp battle-word">${esc(v.word)}</div><div class="reading">${esc(v.reading)}</div>${!rescue&&v.wordAudio?'<button id="battleHint" class="audio">🔊 Hear the word — uses hint</button>':''}<h2>${rescue?'Defeat Kaidōra: choose the meaning':'Defend the Memory Dojo: choose the meaning'}</h2><div class="choices">${choices.map(x=>`<button class="choice" data-answer="${encodeURIComponent(x)}">${esc(x)}</button>`).join('')}</div><section id="battleFeedback" class="game-feedback" aria-live="polite" hidden></section>`;const hint=$('#battleHint');if(hint)hint.onclick=()=>{if(!revealed){hintUsed=true;play(v.wordAudio);hint.textContent='🔊 Hint used — play again'}};document.querySelectorAll('.choice').forEach(b=>b.onclick=()=>resolveBattleAnswer(b,v))}
function recordMonsterVictory(){meta.monsterVictories=Array.isArray(meta.monsterVictories)?meta.monsterVictories:[];meta.monsterVictories.push(Date.now());meta.totalMonsterVictories=Number(meta.totalMonsterVictories||0)+1;recentMonsterVictories();save()}
function prepareNextMonster(){battle.monsterIndex++;battle.enemyHp=battle.enemyMax;battle.position=4;battle.state='approach'}
function refreshBattleBoard(){const m=currentMonster(),monster=$('.battle-monster'),hud=$('.battle-hud');if(hud)hud.innerHTML=battle.rescue?`<b>Rescue chance</b><b>${esc(m.name)} ${'⚡'.repeat(Math.max(0,battle.enemyHp))}</b><b>${battle.correct}/10 perfect answers</b>`:`<b>Dojo ${'❤️'.repeat(battle.castle)}</b><b>${esc(m.name)} ${'⚡'.repeat(Math.max(0,battle.enemyHp))}</b><b>Defeated ${battle.defeated}</b>`;if(monster){monster.src=monsterImage();monster.alt=`Friendly ${m.name}`;monster.className=`battle-monster battle-${battle.state}`;monster.style.left=`${29+(Math.max(1,battle.position)-1)*14}%`}}
function resolveStreakRescueAnswer(button,v){
 if(revealed)return;revealed=true;const answer=decodeURIComponent(button.dataset.answer),ok=answer===v.meaning;
 button.classList.add(ok?'correct':'wrong');document.querySelectorAll('.choice').forEach(x=>{if(decodeURIComponent(x.dataset.answer)===v.meaning)x.classList.add('correct');x.disabled=true});
 grade(v,'meaning',ok?4:1,ok,false);battle.reviewed++;
 if(ok){battle.correct++;battle.critical++;battle.enemyHp--;battle.state=battle.correct===10?'defeated':'hurt'}else{battle.wrong++;battle.missed.push(v.id);battle.state='approach'}
 refreshBattleBoard();const done=!ok||battle.correct===10,feedback=$('#battleFeedback');feedback.hidden=false;
 const result=ok?(done?'Perfect tenth hit — Kaidōra is defeated!':`${battle.correct}/10 correct — keep the perfect run going!`):'Kaidōra broke through. This rescue attempt has ended.';
 feedback.innerHTML=`<p class="game-result ${ok?'game-result-correct':'game-result-wrong'}">${result}</p><div class="game-answer"><div class="jp">${esc(v.word)}</div><div class="reading">${esc(v.reading)}</div><div class="meaning">${esc(v.meaning)}</div></div>${v.wordAudio?'<button id="battleAudio" class="audio">🔊 Play Japanese audio</button>':''}<button id="battleNext" class="primary reveal">${done?'Rescue result':'Next answer →'}</button>`;
 $('#battleAudio')?.addEventListener('click',()=>play(v.wordAudio));$('#battleNext').onclick=()=>done?showStreakRescueSummary(ok):next();
}
function resolveBattleAnswer(button,v){if(battle.rescue){resolveStreakRescueAnswer(button,v);return}if(revealed)return;revealed=true;const answer=decodeURIComponent(button.dataset.answer),ok=answer===v.meaning,assisted=hintUsed;button.classList.add(ok?'correct':'wrong');document.querySelectorAll('.choice').forEach(x=>{if(decodeURIComponent(x.dataset.answer)===v.meaning)x.classList.add('correct');x.disabled=true});grade(v,'meaning',ok?(assisted?3:4):1,ok,false);battle.reviewed++;let result='',defeated=false;if(ok){battle.correct++;if(assisted)battle.hinted++;else battle.critical++;battle.enemyHp-=assisted?1:2;battle.position=Math.min(4,battle.position+1);battle.state=battle.enemyHp<=0?'defeated':'hurt';result=assisted?'Good hit! The audio hint helped your recall.':'Critical memory hit — no hint needed!';if(battle.enemyHp<=0){defeated=true;battle.defeated++;recordMonsterVictory();result=`${currentMonster().name} is defeated and waves goodbye!`}}else{battle.wrong++;battle.missed.push(v.id);battle.position--;battle.state='approach';result=`${currentMonster().name} advances!`;if(battle.position<=1){battle.castle--;battle.position=4;result=battle.castle?'The Memory Dojo loses a heart, but the word is reinforced.':'The friendly yōkai reached the dojo. Time to review the results.'}}refreshBattleBoard();const done=battle.castle<=0||index===session.length-1,feedback=$('#battleFeedback');feedback.hidden=false;feedback.innerHTML=`<p class="game-result ${ok?'game-result-correct':'game-result-wrong'}">${result}</p><div class="game-answer"><div class="jp">${esc(v.word)}</div><div class="reading">${esc(v.reading)}</div><div class="meaning">${esc(v.meaning)}</div></div>${v.wordAudio?'<button id="battleAudio" class="audio">🔊 Play Japanese audio</button>':''}<button id="battleNext" class="primary reveal">${done?'Battle summary':'Next review →'}</button>`;$('#battleAudio')?.addEventListener('click',()=>play(v.wordAudio));$('#battleNext').onclick=()=>{if(done)showBattleSummary();else{if(defeated)prepareNextMonster();next()}}}
function showStreakRescueSummary(success){
 const rescue=meta.streakRescue||{};
 if(success){rescue.success=true;rescue.restoredAt=Date.now();meta.streak=Math.max(Number(meta.streak||0),Number(rescue.lostStreak||0)+1);meta.lastStudy=day();battle.defeated=1;recordMonsterVictory()}else{rescue.success=false;rescue.failedAt=Date.now();save()}
 updateHome();$('#sessionCounter').textContent='Complete';$('#progressFill').style.width='100%';
 $('#card').innerHTML=`<div class="eyebrow">Streak rescue result</div><h2 class="battle-summary-title">${success?'Streak restored!':'Rescue attempt complete'}</h2><img class="rescue-result-monster" src="${monsterImage(success?'defeated':'approach')}" alt="Kaidōra"><p class="battle-summary-note">${success?`A flawless 10/10 victory restored your streak at ${meta.streak} days.`:'The one-chance battle requires 10 correct answers with no mistakes. Your new streak can begin with the next completed study session.'}</p><button id="battleDone" class="primary reveal">Return to games</button>`;
 $('#battleDone').onclick=()=>abortSession('games');
}
function showBattleSummary(){const accuracy=battle.reviewed?Math.round(battle.correct/battle.reviewed*100):0,weak=[...new Set(battle.missed)].map(id=>vocab.find(v=>v.id===id)).filter(Boolean),elapsed=Math.max(1,Math.round((Date.now()-battle.startedAt)/60000));$('#sessionCounter').textContent='Complete';$('#progressFill').style.width='100%';$('#card').innerHTML=`<div class="eyebrow">Battle summary</div><h2 class="battle-summary-title">Memory Dojo defended</h2><div class="battle-summary-grid"><article><strong>${battle.defeated}</strong><span>Monsters defeated</span></article><article><strong>${battle.reviewed}</strong><span>Reviews completed</span></article><article><strong>${accuracy}%</strong><span>Accuracy</span></article><article><strong>${battle.critical}</strong><span>No-hint critical hits</span></article><article><strong>${battle.hinted}</strong><span>Audio-assisted answers</span></article><article><strong>${battle.castle}/3</strong><span>Dojo hearts left</span></article></div><p class="battle-summary-note">${battle.defeated?`Great work — ${battle.defeated} friendly yōkai challenge${battle.defeated===1?'':'s'} cleared in about ${elapsed} minute${elapsed===1?'':'s'}.`:'Every review strengthened your memory, even without a defeat this time.'}</p>${weak.length?`<section class="battle-weak"><b>Words to reinforce</b><p>${weak.map(v=>`${esc(v.word)} — ${esc(v.meaning)}`).join('<br>')}</p></section>`:'<p class="ok">No missed words in this battle.</p>'}<button id="battleWeak" class="primary reveal" ${weak.length?'':'hidden'}>Review weak words</button><button id="battleDone" class="reveal">Return to games</button>`;$('#battleDone').onclick=()=>abortSession('games');const weakButton=$('#battleWeak');if(weakButton)weakButton.onclick=()=>{battleActive=false;battle=null;session=weak.map(v=>({v,skill:'meaning'}));index=0;current=null;show('study');renderCurrent()}}
function exportProgress(){const blob=new Blob([JSON.stringify({version:1,progress,meta,settings},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='kaishi-quest-progress.json';a.click();URL.revokeObjectURL(a.href)}
function versionParts(v){return String(v||'0').split('.').map(n=>parseInt(n,10)||0)}
function newerVersion(a,b){const x=versionParts(a),y=versionParts(b);for(let i=0;i<3;i++){if(x[i]>y[i])return true;if(x[i]<y[i])return false}return false}
function showUpdateBanner(info){latestVersionInfo=info;$('#updateTitle').textContent=`Kaishi Quest ${info.version} is available`;$('#updateSummary').textContent=(info.changes||[]).slice(0,2).join(' • ')||'A new version is ready.';$('#updateBanner').hidden=false;$('#updateStatus').textContent=`Update available: v${info.version}`}
async function checkForUpdates(manual=false){
 $('#updateBanner').hidden=true;
 $('#updateStatus').textContent=`You’re running Kaishi Quest v${APP_VERSION}.`;
 if(manual)toast(`Current version: v${APP_VERSION}`);
}
async function applyUpdate(){
 $('#updateBanner').hidden=true;
 try{
  const regs=await navigator.serviceWorker?.getRegistrations()||[];
  await Promise.all(regs.map(r=>r.unregister()));
  const keys=await caches.keys();
  await Promise.all(keys.map(k=>caches.delete(k)));
 }catch(e){}
 location.replace(`${location.pathname}?reset=${Date.now()}`);
}
function showWhatsNew(){const previous=localStorage.getItem('kq-last-version');if(previous!==APP_VERSION){fetch('version.json',{cache:'no-store'}).then(r=>r.json()).then(info=>{$('#whatsNewTitle').textContent=`What’s new in ${info.version}`;$('#whatsNewContent').innerHTML=`<p>${info.title||''}</p><ul>${(info.changes||[]).map(x=>`<li>${x}</li>`).join('')}</ul>`;$('#whatsNewDialog').showModal();localStorage.setItem('kq-last-version',APP_VERSION)}).catch(()=>localStorage.setItem('kq-last-version',APP_VERSION))}}
async function setupServiceWorker(){
 try{
  const regs=await navigator.serviceWorker?.getRegistrations()||[];
  await Promise.all(regs.map(r=>r.unregister()));
  const keys=await caches.keys();
  await Promise.all(keys.map(k=>caches.delete(k)));
 }catch(e){}
}
async function init(){
 $('#updateBanner').hidden=true;
 $('#card').innerHTML='<div class="eyebrow">Loading</div><h2>Preparing Kaishi Quest…</h2>';
 try{
  [vocab,memoryScenes]=await Promise.all([
   fetch(`data/vocabulary.json?v=${APP_VERSION}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('data');return r.json()}),
   fetch(`memory-scenes.json?v=${APP_VERSION}`,{cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({}))
  ]);
  updateHome();
 }catch(e){
  console.error('Initialisation failed',e);
  $('#summary').textContent='Could not load app data.';
  $('#card').innerHTML=`<div class="eyebrow">Loading error</div><h2>Kaishi Quest could not start.</h2><p class="muted">${esc(e?.message||'Unknown error')}</p>`;
 }
 $('#newLimit').value=settings.newLimit;
 $('#sessionSize').value=settings.sessionSize;
 $('#activeWords').value=settings.activeWords;
 $('#pictureDifficulty').value=settings.pictureDifficulty;
 $('#mnemonicStyle').value=settings.mnemonicStyle;
 $('#autoAudio').checked=settings.autoAudio;
 await setupServiceWorker();
 $('#updateBanner').hidden=true;
}
$('#studyBtn').onclick=()=>{abortSession('home');makeSession()};$('#gamesBtn').onclick=()=>abortSession('games');$('#communityBtn').onclick=()=>{show('community');window.KaishiCloud?.loadLeaderboard?.()};$('#communityBack').onclick=()=>show('home');$('#gamesBack').onclick=()=>abortSession('home');document.querySelectorAll('.gameMode').forEach(b=>b.onclick=()=>{settings.pictureDifficulty=+$('#pictureDifficulty').value||4;save();startPictureGame(b.dataset.mode)});$('#exitBtn').onclick=()=>abortSession(pictureGameActive?'games':'home');$('#settingsBtn').onclick=()=>show('settings');$('#settingsBack').onclick=()=>{settings.newLimit=Math.max(1,Math.min(20,+$('#newLimit').value||5));settings.sessionSize=Math.max(5,Math.min(50,+$('#sessionSize').value||15));settings.activeWords=Math.max(2,Math.min(4,+$('#activeWords').value||4));settings.pictureDifficulty=Math.max(2,Math.min(6,+$('#pictureDifficulty').value||4));settings.mnemonicStyle=$('#mnemonicStyle').value;settings.autoAudio=$('#autoAudio').checked;save();updateHome();show('home')};$('#checkUpdateBtn').onclick=()=>checkForUpdates(true);$('#applyUpdate').onclick=applyUpdate;$('#laterUpdate').onclick=()=>{$('#updateBanner').hidden=true};$('#exportBtn').onclick=exportProgress;$('#importInput').onchange=async e=>{try{const d=JSON.parse(await e.target.files[0].text());progress=d.progress||{};meta={...META_DEFAULTS,...(d.meta||{})};delete meta.dailyReviewPlan;settings={...settings,...d.settings};save();updateHome();toast('Progress imported')}catch{toast('Invalid backup file')}};$('#resetBtn').onclick=()=>{if(confirm('Delete all learning progress?')){progress={};meta={...META_DEFAULTS};save();updateHome();toast('Progress reset')}};
$('#dashboardAvatarButton').onclick=openCharacterSettings;
$('#karutaMode').onclick=()=>{settings.pictureDifficulty=+$('#pictureDifficulty').value||4;save();startKarutaGame()};
$('#decayBattleMode').onclick=startDecayBattle;
$('#streakRescueMode').onclick=startStreakRescue;
$('#exitBtn').onclick=()=>abortSession(pictureGameActive||karutaActive||battleActive?'games':'home');
init();
