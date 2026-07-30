'use strict';
const $=s=>document.querySelector(s), screens=[...document.querySelectorAll('.screen')];
const APP_VERSION='5.0.0';
const SKILLS=['meaning','production','listening','reading','kanji','sentence','picture'];
const LABELS={meaning:'Meaning',production:'English → Japanese',listening:'Listening',reading:'Reading',kanji:'Kanji recognition',sentence:'Sentence',picture:'Picture match'};
let vocab=[], session=[], index=0, current=null, revealed=false, startedAt=0, hintUsed=false, memoryScenes={};
let waitingWorker=null, latestVersionInfo=null, pictureGameActive=false;
const defaults={newLimit:5,sessionSize:15,activeWords:4,pictureDifficulty:4,mnemonicStyle:'clear',autoAudio:true};
let settings={...defaults,...loadJSON('kq-settings',{})};
let progress=loadJSON('kq-progress',{});
let meta=loadJSON('kq-meta',{lastStudy:'',streak:0,totalAnswers:0,totalCorrect:0});
function loadJSON(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}
function save(){localStorage.setItem('kq-progress',JSON.stringify(progress));localStorage.setItem('kq-settings',JSON.stringify(settings));localStorage.setItem('kq-meta',JSON.stringify(meta))}
function show(id){screens.forEach(s=>s.classList.toggle('active',s.id===id));scrollTo(0,0)}
function toast(t){const e=$('#toast');e.textContent=t;e.style.display='block';setTimeout(()=>e.style.display='none',1800)}
function day(){return new Date().toISOString().slice(0,10)}
function esc(value=''){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function pFor(id){const p=progress[id]||(progress[id]={stage:0,due:0,interval:0,ease:2.5,reps:0,lapses:0,mnemonic:'',skills:{}});p.skills=p.skills||{};SKILLS.forEach(s=>p.skills[s]||(p.skills[s]={attempts:0,correct:0,strength:0}));return p}
function dueWords(){const now=Date.now();return vocab.filter(v=>{const p=progress[v.id];return p&&p.due<=now})}
function started(){return Object.keys(progress).length}
function accuracy(){return meta.totalAnswers?Math.round(meta.totalCorrect/meta.totalAnswers*100):0}
function mastery(p){return p&&p.interval>=21&&SKILLS.every(s=>p.skills[s].strength>=.65)}
function updateHome(){const due=dueWords().length;$('#dueCount').textContent=due;$('#learnedCount').textContent=started();$('#accuracy').textContent=accuracy()+'%';$('#mastered').textContent=Object.values(progress).filter(mastery).length;$('#streak').textContent=`🔥 ${meta.streak} day${meta.streak===1?'':'s'} streak`;$('#summary').textContent=due?`${due} reviews are ready.`:`Add new words or practise weak skills.`;$('#skills').innerHTML=SKILLS.map(s=>{let a=0,c=0;Object.values(progress).forEach(p=>{a+=p.skills[s]?.attempts||0;c+=p.skills[s]?.correct||0});const pct=a?Math.round(c/a*100):0;return `<div class="skill-row"><b>${LABELS[s]}</b><div class="bar"><i style="width:${pct}%"></i></div><span>${pct}%</span></div>`}).join('')}
function similarity(a='',b=''){a=String(a);b=String(b);let score=0;if(a.length===b.length)score+=3;if(a.slice(-1)===b.slice(-1))score+=2;if(a.slice(-2)===b.slice(-2))score+=3;for(const ch of new Set(a))if(b.includes(ch))score+=1;return score}
function distractors(v,key,n=3){const pool=vocab.filter(x=>x.id!==v.id&&x[key]&&x[key]!==v[key]);const target=v[key]||'';return shuffle(pool.map(x=>({x,score:similarity(target,x[key])+(Math.abs((x.frequency||9999)-(v.frequency||9999))<250?2:0)})).sort((a,b)=>b.score-a.score).slice(0,35)).slice(0,n).map(o=>o.x[key])}
function shuffle(a){return [...a].sort(()=>Math.random()-.5)}
function chooseSkill(v){const p=pFor(v.id);const usable=v.word===v.reading?SKILLS.filter(s=>s!=='kanji'):SKILLS;const weak=usable.map(s=>({s,w:(1-(p.skills[s].strength||0))*(.7+Math.random()*.6)})).sort((a,b)=>b.w-a.w);if(p.stage===0)return'intro';if(p.interval>=21&&Math.random()<.7)return Math.random()<.5?'meaning':'production';return weak[0].s}
function abortSession(destination='home'){
 pictureGameActive=false;
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
 const due=dueWords().sort((a,b)=>pFor(a.id).due-pFor(b.id).due);
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
 const game=current.skill==='picture'&&pictureGameActive;
 $('#exitBtn').textContent=game?'← Game menu':'← Exit';
 $('#sessionCounter').setAttribute('aria-label',game?'Picture Match progress':'Study progress');revealed=false;hintUsed=false;startedAt=Date.now();const {v,skill}=current;$('#sessionCounter').textContent=`${index+1}/${session.length}`;$('#progressFill').style.width=`${index/session.length*100}%`;const c=$('#card');
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
function grade(v,skill,rating,correct){const p=pFor(v.id),sp=p.skills[skill];const response=(Date.now()-startedAt)/1000;sp.attempts++;if(correct)sp.correct++;const quality=rating/4*(hintUsed?.72:1)*(response>15?.9:1);sp.strength=Math.max(0,Math.min(1,sp.strength*.75+quality*.25));meta.totalAnswers++;if(correct)meta.totalCorrect++;p.reps++;if(rating===1){p.lapses++;p.interval=0;p.stage=1;p.due=Date.now()+10*60*1000;p.ease=Math.max(1.3,p.ease-.2)}else if(p.stage<2){p.stage=2;p.interval=rating===2?1:rating===3?2:4;p.due=Date.now()+p.interval*86400000}else{const mult=rating===2?1.2:rating===3?p.ease:p.ease*1.35;p.interval=Math.max(1,Math.round(Math.max(1,p.interval)*mult));p.ease=Math.max(1.3,p.ease+(rating===2?-.15:rating===4?.15:0));p.due=Date.now()+p.interval*86400000}save();next()}
function next(){index++;renderCurrent()}
function finishSession(){if(pictureGameActive){abortSession('games');toast('Picture Match complete 🎉');return}const today=day();if(meta.lastStudy!==today){const y=new Date(Date.now()-86400000).toISOString().slice(0,10);meta.streak=meta.lastStudy===y?meta.streak+1:1;meta.lastStudy=today}save();updateHome();show('home');toast('Session complete 🎉')}
function editMnemonic(v){const p=pFor(v.id);const text=prompt('Edit your personal mnemonic:',p.mnemonic||mnemonic(v));if(text!==null){p.mnemonic=text.trim();save();renderCurrent()}}

function illustratedWords(){return vocab.filter(v=>memoryScenes[sceneKey(v)])}
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
  answer=v.word;buttons=choices.map(x=>`<button class="choice" data-answer="${encodeURIComponent(x.word)}">${x.word}</button>`).join('');
 }else if(mode==='picture-reading'){
  prompt=`${sceneSprite(scene,'quiz-picture')}<h2>Which reading matches this picture?</h2>`;
  answer=v.reading;buttons=choices.map(x=>`<button class="choice" data-answer="${encodeURIComponent(x.reading)}">${x.reading}</button>`).join('');
 }else if(mode==='picture-meaning'){
  prompt=`${sceneSprite(scene,'quiz-picture')}<h2>Which meaning matches this picture?</h2>`;
  answer=v.meaning;buttons=choices.map(x=>`<button class="choice" data-answer="${encodeURIComponent(x.meaning)}">${x.meaning}</button>`).join('');
 }else{
  prompt=`<div class="jp">${v.word}</div><div class="reading">${v.reading}</div><h2>Choose the matching picture</h2>`;
  answer=`${scene.pack}:${scene.row}:${scene.col}`;buttons=choices.map(x=>{const s=memoryScenes[sceneKey(x)];return `<button class=\"choice picture-choice\" data-answer=\"${encodeURIComponent(`${s.pack}:${s.row}:${s.col}`)}\">${sceneSprite(s,'choice-sprite')}<span>${x.meaning}</span></button>`}).join('');
 }
 c.innerHTML=`<div class="eyebrow">Picture Match</div>${prompt}<div class="choices picture-choices">${buttons}</div>`;
 wireSceneImages(c);
 bindChoices(answer,'picture');
}
async function startPictureGame(mode){
 abortSession('games');
 const all=illustratedWords().filter(v=>memoryScenes[sceneKey(v)]?.file);
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
$('#studyBtn').onclick=()=>{abortSession('home');makeSession()};$('#gamesBtn').onclick=()=>abortSession('games');$('#gamesBack').onclick=()=>abortSession('home');document.querySelectorAll('.gameMode').forEach(b=>b.onclick=()=>{settings.pictureDifficulty=+$('#pictureDifficulty').value||4;save();startPictureGame(b.dataset.mode)});$('#exitBtn').onclick=()=>abortSession(pictureGameActive?'games':'home');$('#settingsBtn').onclick=()=>show('settings');$('#settingsBack').onclick=()=>{settings.newLimit=Math.max(1,Math.min(20,+$('#newLimit').value||5));settings.sessionSize=Math.max(5,Math.min(50,+$('#sessionSize').value||15));settings.activeWords=Math.max(2,Math.min(4,+$('#activeWords').value||4));settings.pictureDifficulty=Math.max(2,Math.min(6,+$('#pictureDifficulty').value||4));settings.mnemonicStyle=$('#mnemonicStyle').value;settings.autoAudio=$('#autoAudio').checked;save();show('home')};$('#checkUpdateBtn').onclick=()=>checkForUpdates(true);$('#applyUpdate').onclick=applyUpdate;$('#laterUpdate').onclick=()=>{$('#updateBanner').hidden=true};$('#exportBtn').onclick=exportProgress;$('#importInput').onchange=async e=>{try{const d=JSON.parse(await e.target.files[0].text());progress=d.progress||{};meta=d.meta||meta;settings={...settings,...d.settings};save();updateHome();toast('Progress imported')}catch{toast('Invalid backup file')}};$('#resetBtn').onclick=()=>{if(confirm('Delete all learning progress?')){progress={};meta={lastStudy:'',streak:0,totalAnswers:0,totalCorrect:0};save();updateHome();toast('Progress reset')}};
init();
