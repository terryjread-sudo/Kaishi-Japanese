'use strict';
const $=s=>document.querySelector(s), screens=[...document.querySelectorAll('.screen')];
const APP_VERSION='6.8.0';
const SKILLS=['meaning','production','listening','reading','kanji','components','sentence','picture'];
const BATTLE_MONSTERS=[{id:'kappa',name:'Kappa'},{id:'tanuki',name:'Tanuki'},{id:'kitsune',name:'Kitsune'},{id:'karakasa',name:'Karakasa-obake'}];
const LABELS={meaning:'Meaning',production:'English → Japanese',listening:'Listening',reading:'Reading',kanji:'Kanji recognition',components:'Kanji components',sentence:'Sentence',picture:'Picture match'};
const SKILL_HELP={
 meaning:'How often you correctly recognise the English meaning of a Japanese word.',
 production:'How often you correctly recall the Japanese word from its English meaning.',
 listening:'How often you identify the correct meaning after hearing the Japanese word.',
 reading:'How often you recall or select the correct Japanese reading.',
 kanji:'How often you recognise the correct written Japanese form.',
 components:'How accurately you rebuild Kanji from their visual components.',
 sentence:'How often you choose the correct word from the context of a sentence.',
 picture:'How often you connect a mnemonic picture with the correct word and meaning.'
};
let vocab=[], kanaData=[], mangaStories=[], conversations=[], theatreScenes=[], grammarLessons=[], componentData={components:{},kanji:[]}, session=[], index=0, current=null, revealed=false, startedAt=0, hintUsed=false, memoryScenes={};
let kanaSession=[], kanaIndex=0, kanaScript='', kanaAnswered=false;
let mangaStory=null, mangaPanelIndex=0, mangaAnswered=false, mangaQuestionAnswered=false, mangaRun=null;
let conversation=null, conversationTurn=0, conversationAnswered=false, conversationRun=null, japaneseSpeech=null;
let theatreScene=null, theatreRun=null, theatreTimers=[], theatrePlaybackStarted=0;
let kanjiBuilder=null,kanjiBuilderReturn='games',kanjiBuilderTargetIds=[];
let grammarLesson=null,grammarQuestionIndex=0,grammarRun=null;
let waitingWorker=null, latestVersionInfo=null, pictureGameActive=false, karutaActive=false, karuta=null, battleActive=false, battle=null;
let activityReturnScreen='home';
let activeVocabularyChapter=null;
let activeJourneyMission=null;
const defaults={newLimit:5,sessionSize:15,activeWords:4,pictureDifficulty:4,mnemonicStyle:'clear',autoAudio:true};
let settings={...defaults,...loadJSON('kq-settings',{})};
settings.playMode='journey';
let progress=loadJSON('kq-progress',{});
const META_DEFAULTS={lastStudy:'',streak:0,totalAnswers:0,totalCorrect:0,kanaAnswers:0,kanaCorrect:0,grammarAnswers:0,grammarCorrect:0,kanaProgress:{},grammarProgress:{},mangaProgress:{},conversationProgress:{},theatreProgress:{},pathUnlocks:[],pathVisits:{},pathOverrides:[],chapterOverrides:[],dailyJourneyRoute:null,dailyActivity:null,karutaSessions:[],monsterVictories:[],totalMonsterVictories:0,streakRescue:null,updatedAt:0};
let meta={...META_DEFAULTS,...loadJSON('kq-meta',{})};
meta.kanaProgress=meta.kanaProgress||{};
meta.grammarProgress=meta.grammarProgress||{};
meta.mangaProgress=meta.mangaProgress||{};
meta.conversationProgress=meta.conversationProgress||{};
meta.theatreProgress=meta.theatreProgress||{};
meta.pathUnlocks=Array.isArray(meta.pathUnlocks)?[...meta.pathUnlocks]:[];
meta.pathVisits={...(meta.pathVisits||{})};
meta.pathOverrides=Array.isArray(meta.pathOverrides)?[...meta.pathOverrides]:[];
meta.chapterOverrides=Array.isArray(meta.chapterOverrides)?[...meta.chapterOverrides]:[];
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
  meta.dailyReviewPlan={date:today,ids,limit,initialTotal:ids.length};
  save(false);
 }
 if(!Number.isFinite(meta.dailyReviewPlan.initialTotal))meta.dailyReviewPlan.initialTotal=meta.dailyReviewPlan.ids.length;
 const byId=new Map(vocab.map(v=>[v.id,v])),now=Date.now();
 return meta.dailyReviewPlan.ids.map(id=>byId.get(id)).filter(v=>v&&progress[v.id]?.due<=now);
}
function started(){return Object.keys(progress).length}
function accuracy(){return meta.totalAnswers?Math.round(meta.totalCorrect/meta.totalAnswers*100):0}
function mastery(p){return p&&p.interval>=21&&['meaning','listening','reading'].every(skill=>(p.skills?.[skill]?.strength||0)>=.65)}
function todayActivity(){const today=day();if(!meta.dailyActivity||meta.dailyActivity.date!==today)meta.dailyActivity={date:today,tested:0,qualified:false,sources:{}};return meta.dailyActivity}
function recordMeaningfulActivity(source,amount=1){const activity=todayActivity();activity.tested+=Math.max(0,Number(amount)||0);activity.sources[source]=Number(activity.sources[source]||0)+Math.max(0,Number(amount)||0);if(!activity.qualified&&activity.tested>=5){activity.qualified=true;const today=day();if(meta.lastStudy!==today){const yesterday=day(new Date(Date.now()-86400000));meta.streak=meta.lastStudy===yesterday?Number(meta.streak||0)+1:1;meta.lastStudy=today}toast('Daily streak protected! 🔥')}return activity}
function recentMonsterVictories(){const cutoff=Date.now()-72*3600000;meta.monsterVictories=(Array.isArray(meta.monsterVictories)?meta.monsterVictories:[]).filter(t=>Number(t)>cutoff);return meta.monsterVictories.length}
function recentKarutaBestAverage(){const cutoff=Date.now()-72*3600000;meta.karutaSessions=(Array.isArray(meta.karutaSessions)?meta.karutaSessions:[]).filter(item=>Number(item.at)>cutoff);return meta.karutaSessions.length?Math.max(...meta.karutaSessions.map(item=>Number(item.averageScore)||0)):null}
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
 restore:data=>{progress=data?.progress||{};meta={...META_DEFAULTS,...(data?.meta||{})};meta.kanaProgress=meta.kanaProgress||{};meta.grammarProgress=meta.grammarProgress||{};meta.mangaProgress=meta.mangaProgress||{};meta.conversationProgress=meta.conversationProgress||{};meta.theatreProgress=meta.theatreProgress||{};meta.pathUnlocks=Array.isArray(meta.pathUnlocks)?[...meta.pathUnlocks]:[];meta.pathVisits={...(meta.pathVisits||{})};meta.pathOverrides=Array.isArray(meta.pathOverrides)?[...meta.pathOverrides]:[];meta.chapterOverrides=Array.isArray(meta.chapterOverrides)?[...meta.chapterOverrides]:[];delete meta.dailyReviewPlan;settings={...defaults,...(data?.settings||{}),playMode:'journey'};save(false);if($('#newLimit')){$('#newLimit').value=settings.newLimit;$('#sessionSize').value=settings.sessionSize;$('#activeWords').value=settings.activeWords;$('#pictureDifficulty').value=settings.pictureDifficulty;$('#mnemonicStyle').value=settings.mnemonicStyle;$('#autoAudio').checked=settings.autoAudio}updateHome();toast('Cloud progress restored')},
 stats:()=>{const mastered=Object.values(progress).filter(mastery).length,reviews=Number(meta.totalAnswers||0),correct=Number(meta.totalCorrect||0),monsters=Number(meta.totalMonsterVictories||meta.monsterVictories?.length||0),streak=Number(meta.streak||0);return{xp:Math.max(0,correct*10+mastered*50+monsters*100+streak*20),mastered,accuracy:reviews?Math.round(correct/reviews*100):0,reviews,monsters_defeated:monsters,streak}}
};
function wordPracticeCount(p){return p?SKILLS.reduce((sum,skill)=>sum+Number(p.skills?.[skill]?.attempts||0),0):0}
function wordLearningStatus(v){const p=progress[v.id];if(!p)return'locked';if(Number(p.interval||0)>=21&&Number(p.skills?.kanji?.strength||0)>=.65)return'mastered';if(Number(p.skills?.kanji?.attempts||0)>=2||Number(p.reps||0)>=2||wordPracticeCount(p)>=2)return'practised';return'introduced'}
function kanjiCharacters(v){return [...new Set([...String(v.kanji||v.word||'')].filter(character=>/\p{Script=Han}/u.test(character)))]}
function kanjiCatalogue(){const map=new Map();vocab.forEach(v=>kanjiCharacters(v).forEach(character=>{if(!map.has(character))map.set(character,[]);map.get(character).push(v)}));return [...map].map(([character,words])=>{const statuses=words.map(wordLearningStatus);const status=statuses.includes('mastered')?'mastered':statuses.includes('practised')?'practised':statuses.includes('introduced')?'introduced':'locked';return{character,words,status}})}
function kanjiMasteredCount(){return kanjiCatalogue().filter(item=>item.status==='mastered').length}
function componentRecord(character){return (componentData.kanji||[]).find(item=>item.kanji===character)}
function componentInfo(part){return componentData.components?.[part]||{name:'visual component'}}
function componentBreakdownHTML(record,{compact=false}={}){
 if(!record)return`<p class="kanji-component-pending">A curated component lesson has not been added for this Kanji yet.</p>`;
 const parts=record.parts.map((part,itemIndex)=>{const info=componentInfo(part),source=info.source?` · form of ${esc(info.source)}`:'';return `<article class="kanji-component-piece" style="--piece-delay:${itemIndex*90}ms"><span lang="ja">${esc(part)}</span><div><b>${esc(info.name)}</b><small>${source}</small></div></article>`}).join('<i class="component-plus">+</i>');
 return `<section class="kanji-breakdown ${compact?'compact':''}"><div class="kanji-breakdown-equation"><strong lang="ja">${esc(record.kanji)}</strong><i>→</i><div class="kanji-component-pieces">${parts}</div></div><p class="kanji-component-story">${esc(record.story)}</p>${compact?'':'<small class="kanji-component-disclaimer">Visual memory breakdown · not a claim about historical etymology</small>'}</section>`;
}
function renderKanjiWords(item){const panel=$('#kanjiWords');if(!panel||item.status==='locked')return;const record=componentRecord(item.character);panel.hidden=false;panel.innerHTML=`<div class="kanji-detail-heading"><span lang="ja">${esc(item.character)}</span><div><h3>${record?'Interactive breakdown':'Words using this Kanji'}</h3><p>${item.words.filter(v=>wordLearningStatus(v)!=='locked').length} introduced</p></div></div>${componentBreakdownHTML(record)}<div class="kanji-word-list">${item.words.map(v=>{const status=wordLearningStatus(v);return `<article class="${status}"><div><strong lang="ja">${status==='locked'?'•••':esc(v.word)}</strong><span>${status==='locked'?'Not introduced':esc(v.reading)}</span></div><b>${status==='locked'?'Hidden':esc(v.meaning)}</b><small>${status==='practised'?'Practised':status[0].toUpperCase()+status.slice(1)}</small></article>`}).join('')}</div>`;panel.scrollIntoView({behavior:'smooth',block:'nearest'})}
function renderKanjiOverview(){const catalogue=kanjiCatalogue(),counts={locked:0,introduced:0,practised:0,mastered:0};catalogue.forEach(item=>counts[item.status]++);$('#kanjiOverviewStats').innerHTML=`<article><strong>${counts.introduced}</strong><span>Introduced</span></article><article><strong>${counts.practised}</strong><span>Practised</span></article><article><strong>${counts.mastered}</strong><span>Mastered</span></article><article><strong>${catalogue.length}</strong><span>Total Kanji</span></article>`;$('#kanjiGrid').innerHTML=catalogue.map((item,index)=>`<button class="kanji-tile ${item.status}" data-kanji-index="${index}" aria-label="${item.status==='locked'?'Kanji not introduced':`${item.character}, ${item.status}`}"><span lang="ja">${item.status==='locked'?'?':esc(item.character)}</span><small>${item.status}</small></button>`).join('');$('#kanjiWords').hidden=true;document.querySelectorAll('[data-kanji-index]').forEach(button=>button.onclick=()=>{const item=catalogue[+button.dataset.kanjiIndex];if(item.status==='locked'){toast('Study a word containing this Kanji to reveal it');return}renderKanjiWords(item)})}
function renderSkillScores(){
 const list=$('#skills');if(!list)return;
 list.innerHTML=SKILLS.map(skill=>{let attempts=0,correct=0,words=0,strength=0;Object.values(progress).forEach(p=>{const metric=p.skills?.[skill];if(!metric||!Number(metric.attempts))return;attempts+=Number(metric.attempts);correct+=Number(metric.correct||0);strength+=Number(metric.strength||0);words++});const score=words?Math.round(strength/words*100):0,accuracy=attempts?Math.round(correct/attempts*100):0,sample=words===0?'Not tested yet':words<5?'Early signal':words<20?'Developing signal':'Established signal';return `<div class="skill-score-row" tabindex="0" role="group" aria-label="${esc(LABELS[skill])}: ${score}% current strength, ${accuracy}% accuracy across ${attempts} attempts and ${words} words. ${esc(SKILL_HELP[skill])}"><div class="skill-score-heading"><b>${esc(LABELS[skill])}</b><strong>${score}%</strong></div><div class="bar" aria-hidden="true"><i style="width:${score}%"></i></div><p>${esc(SKILL_HELP[skill])}</p><div class="skill-score-details"><span><b>${accuracy}%</b> accuracy</span><span><b>${attempts}</b> attempts</span><span><b>${words}</b> words</span><small>${sample}</small></div></div>`}).join('');
}
const PATH_MILESTONES=[
 {id:'vocabulary',icon:'🌱',title:'Starting Village',activity:'Vocabulary Study',japanese:'単語学習',description:'Meet your first words and build the memory links that power every later activity.',requirement:'Available from the beginning.'},
 {id:'kana',icon:'あ',title:'Kana Bridge',activity:'Hiragana & Katakana',japanese:'かな学習',description:'Strengthen the sounds and scripts that make Japanese easier to read.',requirement:'Available from the beginning.'},
 {id:'picture',icon:'🌄',title:'Picture Meadow',activity:'Picture Matching',japanese:'絵合わせ',description:'Connect complete mnemonic scenes to the words they represent.',requirement:'Introduce 5 vocabulary words.'},
 {id:'listening',icon:'🎧',title:'Listening Station',activity:'Listen → Meaning',japanese:'聞き取り',description:'Recognise familiar Japanese by sound before seeing the answer.',requirement:'Practise listening with 8 words.'},
 {id:'karuta',icon:'🎴',title:'Karuta Arena',activity:'Audio Reflex Match',japanese:'かるた',description:'Race to match spoken Japanese with its mnemonic-and-Kanji card.',requirement:'Introduce 12 illustrated words with audio.'},
 {id:'conversation',icon:'💬',title:'Conversation Town',activity:'Conversation Quest',japanese:'会話クエスト',description:'Choose natural replies while Kai, Mia and Master speak with you.',requirement:'Start 12 words and answer 5 listening checks correctly.'},
 {id:'grammar',icon:'助',title:'Particle Shrine',activity:'Grammar & Particles',japanese:'文法と助詞',description:'Learn how particles connect complete Japanese sentences, then prove each distinction in context.',requirement:'Start 15 words and complete 15 tested answers.'},
 {id:'theatre',icon:'🎬',title:'Kaishi Theatre',activity:'Animated Listening Scenes',japanese:'会話劇場',description:'Watch Kai, Mia and Master act out short Japanese scenes, then prove what you understood.',requirement:'Complete one Conversation Quest.'},
 {id:'kanji',icon:'漢',title:'Kanji Gate',activity:'Kanji Recognition',japanese:'漢字学習',description:'See how the written characters connect the words you already know.',requirement:'Introduce 10 different Kanji.'},
 {id:'builder',icon:'🧩',title:'Kanji Workshop',activity:'Kanji Builder',japanese:'漢字組立',description:'Split familiar Kanji into visual components, then rebuild them from meaning and sound.',requirement:'Introduce 10 Kanji with component lessons.'},
 {id:'manga',icon:'📖',title:'Manga Library',activity:'Manga Stories',japanese:'漫画物語',description:'Read complete Japanese sentences in original illustrated stories.',requirement:'Start 25 words and complete 30 tested answers.'},
 {id:'battle',icon:'⚔️',title:'Memory Dojo',activity:'SRS Decay Battles',japanese:'復習バトル',description:'Defend the dojo by reviewing memories as they approach their forgetting threshold.',requirement:'Start 20 words and complete 40 tested answers.'}
];
function pathListeningWords(){return vocab.filter(item=>Number(progress[item.id]?.skills?.listening?.attempts||0)>0).length}
function pathListeningCorrect(){return vocab.reduce((sum,item)=>sum+Number(progress[item.id]?.skills?.listening?.correct||0),0)}
function pathIllustratedWords(){return illustratedWords().filter(item=>item.wordAudio&&progress[item.id]?.stage>=1).length}
function pathIntroducedKanji(){return kanjiCatalogue().filter(item=>item.status!=='locked').length}
function introducedComponentKanji(){return kanjiCatalogue().filter(item=>item.status!=='locked'&&componentRecord(item.character)).length}
function pathCondition(id){
 if(id==='vocabulary'||id==='kana')return true;
 if(id==='picture')return started()>=5;
 if(id==='listening')return pathListeningWords()>=8;
 if(id==='karuta')return pathIllustratedWords()>=12;
 if(id==='conversation')return started()>=12&&pathListeningCorrect()>=5;
 if(id==='grammar')return started()>=15&&Number(meta.totalAnswers||0)>=15;
 if(id==='theatre')return conversationCompletedCount()>=1;
 if(id==='kanji')return pathIntroducedKanji()>=10;
 if(id==='builder')return introducedComponentKanji()>=10;
 if(id==='manga')return started()>=25&&Number(meta.totalAnswers||0)>=30;
 if(id==='battle')return started()>=20&&Number(meta.totalAnswers||0)>=40;
 return false;
}
function pathProgress(id){
 if(id==='vocabulary'||id==='kana')return'Ready now';
 if(id==='picture')return`${Math.min(5,started())}/5 words introduced`;
 if(id==='listening')return`${Math.min(8,pathListeningWords())}/8 words heard`;
 if(id==='karuta')return`${Math.min(12,pathIllustratedWords())}/12 illustrated audio words`;
 if(id==='conversation')return`${Math.min(12,started())}/12 words · ${Math.min(5,pathListeningCorrect())}/5 listening answers`;
 if(id==='grammar')return`${Math.min(15,started())}/15 words · ${Math.min(15,Number(meta.totalAnswers||0))}/15 tested answers`;
 if(id==='theatre')return`${Math.min(1,conversationCompletedCount())}/1 conversation completed`;
 if(id==='kanji')return`${Math.min(10,pathIntroducedKanji())}/10 Kanji introduced`;
 if(id==='builder')return`${Math.min(10,introducedComponentKanji())}/10 component Kanji introduced`;
 if(id==='manga')return`${Math.min(25,started())}/25 words · ${Math.min(30,Number(meta.totalAnswers||0))}/30 answers`;
 if(id==='battle')return`${Math.min(20,started())}/20 words · ${Math.min(40,Number(meta.totalAnswers||0))}/40 answers`;
 return'';
}
function refreshPathUnlocks(){
 const before=meta.pathUnlocks.length;PATH_MILESTONES.forEach((item,itemIndex)=>{const previousEarned=itemIndex<2||meta.pathUnlocks.includes(PATH_MILESTONES[itemIndex-1].id);if(previousEarned&&pathCondition(item.id)&&!meta.pathUnlocks.includes(item.id))meta.pathUnlocks.push(item.id)});if(meta.pathUnlocks.length!==before)save();
}
function pathUnlocked(id){return meta.pathUnlocks.includes(id)||meta.pathOverrides.includes(id)}
function pathCurrentIndex(){const firstUnvisited=PATH_MILESTONES.findIndex(item=>pathUnlocked(item.id)&&!meta.pathVisits[item.id]);if(firstUnvisited>=0)return firstUnvisited;let current=0;PATH_MILESTONES.forEach((item,itemIndex)=>{if(pathUnlocked(item.id))current=itemIndex});return current}
const WORD_CHAPTER_SIZE=50,WORD_CHAPTER_NAMES=['First Steps','Riverside Path','Bamboo Trail','Lantern Market','Tea Garden','Green Hill','Cedar Crossing','Crane Lake','Festival Street','Moonlit Terrace','Torii Pass','Maple Valley','Coastal Road','Snowy Hamlet','Castle Approach','Artisan Quarter','Mountain Shrine','Firefly Marsh','Orchard Lane','Scholar’s Court','Cloud Pass','Silver Waterfall','Sunflower Plain','Old Post Town','Red Maple Ridge','Starry Plateau','Dragonfly Coast','Summit Trail','Dawn Sanctuary','Kaishi Summit'];
function wordChapterCount(){return Math.max(1,Math.ceil(vocab.length/WORD_CHAPTER_SIZE))}
function chapterWords(itemIndex){return vocab.slice(itemIndex*WORD_CHAPTER_SIZE,Math.min(vocab.length,(itemIndex+1)*WORD_CHAPTER_SIZE))}
function wordIntroduced(item){const p=progress[item.id];return Boolean(p&&(Number(p.stage||0)>=1||wordPracticeCount(p)>0))}
const MASTERY_SEQUENCE=[
 {id:'meaning',label:'Meaning recognition',minimum:2,strength:.42,reason:'recognise the meaning from written Japanese'},
 {id:'listening',label:'Listening',minimum:2,strength:.42,reason:'recognise the word by sound'},
 {id:'reading',label:'Reading',minimum:2,strength:.42,reason:'connect its meaning to the Japanese reading'},
 {id:'kanji',label:'Written form',minimum:1,strength:.32,reason:'recognise its written Japanese form'},
 {id:'components',label:'Kanji components',minimum:1,strength:.28,reason:'rebuild its Kanji from visual components'},
 {id:'production',label:'Production',minimum:1,strength:.32,reason:'recall the Japanese from English'},
 {id:'sentence',label:'Sentence context',minimum:1,strength:.32,reason:'understand it inside a complete sentence'}
];
function masteryStepFor(word){
 const p=progress[word.id];if(!p||!wordIntroduced(word))return{id:'learn',label:'Learn',reason:'meet this word and its memory link'};
 const hasKanji=kanjiCharacters(word).length>0&&word.word!==word.reading,hasComponents=hasKanji&&kanjiCharacters(word).some(componentRecord);
 for(const step of MASTERY_SEQUENCE){if(step.id==='kanji'&&!hasKanji)continue;if(step.id==='components'&&(!hasComponents||!pathUnlocked('builder')))continue;const metric=p.skills?.[step.id]||{};if(Number(metric.attempts||0)<step.minimum||Number(metric.strength||0)<step.strength)return step}
 if(Number(p.due||0)<=Date.now())return{id:'retain',label:'Retention review',reason:'refresh it before the memory fades'};
 const weakest=MASTERY_SEQUENCE.filter(step=>step.id!=='kanji'||hasKanji).filter(step=>step.id!=='components'||(hasComponents&&pathUnlocked('builder'))).map(step=>({step,strength:Number(p.skills?.[step.id]?.strength||0)})).sort((a,b)=>a.strength-b.strength)[0];
 return mastery(p)?{id:'mastered',label:'Mastered',reason:'keep it available through spaced review'}:{id:weakest?.step.id||'meaning',label:`Strengthen ${weakest?.step.label||'recall'}`,reason:weakest?.step.reason||'strengthen recall'};
}
function masterySnapshot(){const introduced=vocab.filter(wordIntroduced),counts={};introduced.forEach(word=>{const step=masteryStepFor(word);counts[step.id]=(counts[step.id]||0)+1});return{introduced,counts,mastered:introduced.filter(word=>masteryStepFor(word).id==='mastered').length}}
function masteryFocus(){
 const candidates=vocab.filter(wordIntroduced).map(word=>({word,step:masteryStepFor(word)})).filter(item=>!['mastered','retain','learn'].includes(item.step.id));
 if(!candidates.length)return{skill:'meaning',label:'Recall strengthening',reason:'Keep established words flexible with mixed recall.',words:vocab.filter(wordIntroduced).slice(0,8)};
 const groups={};candidates.forEach(item=>(groups[item.step.id]||(groups[item.step.id]=[])).push(item));const preferred=['listening','meaning','reading','components','production','sentence','kanji'];const skill=preferred.filter(id=>groups[id]?.length).sort((a,b)=>groups[b].length-groups[a].length||preferred.indexOf(a)-preferred.indexOf(b))[0],items=groups[skill]||candidates,step=items[0].step,words=items.sort((a,b)=>Number(progress[a.word.id]?.skills?.[skill]?.strength||0)-Number(progress[b.word.id]?.skills?.[skill]?.strength||0)).slice(0,8).map(item=>item.word);
 return{skill,label:step.label,reason:`${words.length} word${words.length===1?'':'s'} need to ${step.reason}.`,words};
}
function chapterStats(itemIndex){const words=chapterWords(itemIndex),introduced=words.filter(wordIntroduced).length,reviewed=words.filter(item=>wordPracticeCount(progress[item.id])>=2).length,introTarget=Math.min(40,words.length),reviewTarget=Math.min(25,Math.ceil(words.length/2)),complete=introduced>=introTarget&&reviewed>=reviewTarget;return{words,introduced,reviewed,introTarget,reviewTarget,complete,percent:Math.round((Math.min(1,introduced/Math.max(1,introTarget))*.6+Math.min(1,reviewed/Math.max(1,reviewTarget))*.4)*100)}}
function chapterNaturallyUnlocked(itemIndex){if(itemIndex===0)return true;for(let previous=0;previous<itemIndex;previous++)if(!chapterStats(previous).complete)return false;return true}
function chapterUnlocked(itemIndex){return chapterNaturallyUnlocked(itemIndex)||meta.chapterOverrides.includes(itemIndex)}
function currentWordChapterIndex(){let lastUnlocked=0;for(let itemIndex=0;itemIndex<wordChapterCount();itemIndex++){if(!chapterUnlocked(itemIndex))break;lastUnlocked=itemIndex;if(!chapterStats(itemIndex).complete)return itemIndex}return lastUnlocked}
function wordJourneyPosition(){const total=wordChapterCount(),explored=vocab.filter(wordIntroduced).length,chapter=currentWordChapterIndex()+1,completed=Array.from({length:total},(_,itemIndex)=>chapterStats(itemIndex).complete).filter(Boolean).length;return{explored,chapter,total,completed}}
function missionActivityId(){const available=['kana','picture','listening','karuta','conversation','grammar','theatre','builder','manga','battle'].filter(id=>pathUnlocked(id)),newActivity=available.find(id=>!meta.pathVisits[id]);if(newActivity)return newActivity;const seed=day().split('-').reduce((sum,value)=>sum+Number(value||0),0);return available[seed%Math.max(1,available.length)]||'kana'}
function ensureDailyJourneyRoute(){
 refreshPathUnlocks();if(meta.dailyJourneyRoute?.date===day()&&meta.dailyJourneyRoute.schemaVersion===2&&Array.isArray(meta.dailyJourneyRoute.steps))return meta.dailyJourneyRoute;
 const due=dailyDueWords().length,chapter=currentWordChapterIndex(),activityId=missionActivityId(),activity=PATH_MILESTONES.find(item=>item.id===activityId),discover=activity&&!meta.pathVisits[activityId],focus=masteryFocus(),third=discover?{id:'activity',kind:'activity',activityId,icon:activity.icon,title:`Discover ${activity.activity}`,detail:`Your progress has unlocked ${activity.title}. This guided mission teaches how it works.`}:{id:'mastery',kind:'mastery',skill:focus.skill,targetIds:focus.words.map(word=>word.id),activityId:focus.skill==='components'?'builder':'vocabulary',icon:focus.skill==='listening'?'🎧':focus.skill==='components'?'🧩':'🎯',title:`${focus.label} focus`,detail:focus.reason};
 meta.dailyJourneyRoute={schemaVersion:2,date:day(),completed:[],explanation:{due,chapter,focus:third.detail},steps:[{id:'warmup',kind:'review',icon:'🧠',title:due?`Review ${Math.min(due,settings.sessionSize)} due words`:'Memory warm-up',detail:due?'These words are due now or nearing their forgetting threshold.':'No reviews are overdue, so this mission keeps established memories flexible.'},{id:'chapter',kind:'chapter',chapter,icon:'🗺️',title:`Continue Chapter ${chapter+1}`,detail:`The next uncompleted vocabulary section is ${WORD_CHAPTER_NAMES[chapter]||`Chapter ${chapter+1}`}.`},third]};save();return meta.dailyJourneyRoute
}
function journeyRouteProgress(){const route=ensureDailyJourneyRoute(),completed=route.completed||[];return{route,completed,next:route.steps.find(step=>!completed.includes(step.id))}}
function renderDailyRoute(){const container=$('#dailyRoute');if(!container)return;const {route,completed,next}=journeyRouteProgress(),reason=$('#todayExplanation');if(reason){const explanation=route.explanation||{};reason.innerHTML=`<div><span>Why these missions?</span><strong>${explanation.due?`${explanation.due} review${explanation.due===1?' is':'s are'} due`:'No reviews are overdue'}</strong><p>Chapter ${Number(explanation.chapter||0)+1} is your next vocabulary section. ${esc(explanation.focus||'Your weakest current skill determines the final mission.')}</p></div>`}container.innerHTML=route.steps.map((step,itemIndex)=>{const done=completed.includes(step.id),current=next?.id===step.id;return `<article class="daily-mission ${done?'complete':''} ${current?'current':''}"><span class="mission-step">${done?'✓':itemIndex+1}</span><div><b>${esc(step.icon)} ${esc(step.title)}</b><p>${esc(step.detail)}</p></div><button data-journey-mission="${esc(step.id)}"${current?'':' disabled'}>${done?'Complete':current?'Start mission':'Up next'}</button></article>`}).join('');document.querySelectorAll('[data-journey-mission]').forEach(button=>button.onclick=()=>startJourneyMission(button.dataset.journeyMission));const start=$('#startNextMission');if(start){start.hidden=!next;start.textContent=next?`Start next: ${next.title}`:'Today’s route complete ✓';start.disabled=!next;start.onclick=()=>next&&startJourneyMission(next.id)}}
function startJourneyMission(missionId){const {route,completed}=journeyRouteProgress(),mission=route.steps.find(step=>step.id===missionId);if(!mission||completed.includes(mission.id))return;activeJourneyMission={id:mission.id,title:mission.title,activityId:mission.activityId||null,startAnswers:Number(meta.totalAnswers||0),startKana:Number(meta.kanaAnswers||0),startIntroduced:vocab.filter(wordIntroduced).length,targetIds:mission.targetIds||[]};activityReturnScreen='journey';if(mission.kind==='chapter'){startJourneyChapter(mission.chapter);return}if(mission.kind==='activity'){launchPathMilestone(mission.activityId);return}if(mission.kind==='mastery'){if(mission.skill==='components'){openKanjiBuilder(mission.targetIds);startKanjiBuilder();return}makeTargetedMasterySession(mission.targetIds,mission.skill);return}makeSession()}
function finishActiveJourneyMission(){if(!activeJourneyMission)return false;const mission=activeJourneyMission;activeJourneyMission=null;const answers=Math.max(0,Number(meta.totalAnswers||0)-mission.startAnswers)+Math.max(0,Number(meta.kanaAnswers||0)-mission.startKana);if(!answers){toast('Mission paused — complete a tested answer when you return');return false}const route=ensureDailyJourneyRoute();route.completed=Array.isArray(route.completed)?route.completed:[];if(!route.completed.includes(mission.id))route.completed.push(mission.id);if(mission.activityId)meta.pathVisits[mission.activityId]=Date.now();const introduced=Math.max(0,vocab.filter(wordIntroduced).length-mission.startIntroduced),remaining=route.steps.length-route.completed.length;save();const title=remaining?`${mission.title} complete`:'Today’s route complete!';const content=`<div class="mission-summary-stats"><article><strong>${answers}</strong><span>Tested answers</span></article><article><strong>${introduced}</strong><span>Words introduced</span></article><article><strong>${route.completed.length}/${route.steps.length}</strong><span>Route missions</span></article></div><p>${remaining?`${remaining} mission${remaining===1?'':'s'} remain on today’s recommended route.`:'Excellent work—your reviews, vocabulary and activity practice are complete for today.'}</p>`;requestAnimationFrame(()=>{const dialog=$('#missionSummaryDialog');if(!dialog)return;$('#missionSummaryTitle').textContent=title;$('#missionSummaryContent').innerHTML=content;if(!dialog.open)dialog.showModal()});return true}
const KAISHI_SHARE_URL='https://terryjread-sudo.github.io/Kakashi-Web/';
function inviteText(){return`I’m learning Japanese with Kaishi Quest! Join me on the 1,500-word journey: ${KAISHI_SHARE_URL}`}
function openInviteDialog(){const dialog=$('#shareDialog');if(!dialog)return;$('#shareWhatsApp').href=`https://wa.me/?text=${encodeURIComponent(inviteText())}`;if(!dialog.open)dialog.showModal()}
async function nativeShareInvite(){if(navigator.share){try{await navigator.share({title:'Kaishi Quest',text:'Join me on the 1,500-word Japanese journey!',url:KAISHI_SHARE_URL});return}catch(error){if(error?.name==='AbortError')return}}openInviteDialog()}
async function copyInviteLink(){try{await navigator.clipboard.writeText(KAISHI_SHARE_URL);toast('Invitation link copied')}catch{prompt('Copy this invitation link:',KAISHI_SHARE_URL)}}
async function achievementBlob(){const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1080;const ctx=canvas.getContext('2d'),gradient=ctx.createLinearGradient(0,0,1080,1080);gradient.addColorStop(0,'#172554');gradient.addColorStop(.58,'#2563eb');gradient.addColorStop(1,'#7c3aed');ctx.fillStyle=gradient;ctx.fillRect(0,0,1080,1080);ctx.fillStyle='#ffffff18';for(let index=0;index<8;index++){ctx.beginPath();ctx.arc(100+index*150,120+index%2*650,90,0,Math.PI*2);ctx.fill()}const position=wordJourneyPosition(),username=$('#dashboardAvatarTitle')?.textContent?.startsWith('@')?$('#dashboardAvatarTitle').textContent:'Kaishi learner';ctx.fillStyle='#fff';ctx.font='800 58px system-ui';ctx.fillText('KAISHI QUEST',80,110);ctx.font='900 88px system-ui';ctx.fillText('My Japanese Journey',80,235);ctx.font='700 48px system-ui';ctx.fillStyle='#dbeafe';ctx.fillText(username,80,315);try{const image=new Image();image.src=pathAvatarSource();await image.decode();ctx.save();ctx.beginPath();if(ctx.roundRect)ctx.roundRect(80,385,300,300,54);else ctx.rect(80,385,300,300);ctx.clip();ctx.drawImage(image,80,385,300,300);ctx.restore()}catch{}ctx.fillStyle='#fff';ctx.font='900 116px system-ui';ctx.fillText(String(position.explored),450,500);ctx.font='700 40px system-ui';ctx.fillStyle='#bfdbfe';ctx.fillText('WORDS INTRODUCED',455,555);ctx.fillStyle='#fff';ctx.font='900 90px system-ui';ctx.fillText(`${position.completed}/${position.total}`,450,660);ctx.font='700 40px system-ui';ctx.fillStyle='#ddd6fe';ctx.fillText('CHAPTERS COMPLETE',455,715);ctx.fillStyle='#fff';ctx.font='800 45px system-ui';ctx.fillText(`🔥 ${Number(meta.streak||0)} day streak`,80,835);ctx.font='650 34px system-ui';ctx.fillStyle='#dbeafe';ctx.fillText('Join me on the 1,500-word Japanese adventure',80,925);ctx.font='650 28px system-ui';ctx.fillText('terryjread-sudo.github.io/Kakashi-Web',80,990);return new Promise(resolve=>canvas.toBlob(resolve,'image/png'))}
async function shareAchievement(){const blob=await achievementBlob();if(!blob){toast('Could not create the achievement image');return}const file=typeof File==='function'?new File([blob],'kaishi-quest-progress.png',{type:'image/png'}):null,data=file?{files:[file],title:'My Kaishi Quest journey',text:'Join me learning Japanese with Kaishi Quest!'}:null;if(file&&navigator.canShare?.({files:[file]})){try{await navigator.share(data);return}catch(error){if(error?.name==='AbortError')return}}const link=document.createElement('a');link.download='kaishi-quest-progress.png';link.href=URL.createObjectURL(blob);link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);toast('Achievement image downloaded — it is ready for Instagram or another app')}
function pathAvatarSource(){return $('#dashboardAvatar')?.src||`media/profiles/boy-base.webp?v=${APP_VERSION}`}
function renderJourneyHome(){
 settings.playMode='journey';const classic=$('#classicActions'),journeyHome=$('#journeyHome'),kanjiButton=$('#kanjiOverviewBtn');if(classic)classic.hidden=true;if(journeyHome)journeyHome.hidden=false;if($('#conversationContinue'))$('#conversationContinue').hidden=true;if(!journeyHome)return;
 refreshPathUnlocks();const {route,completed,next}=journeyRouteProgress(),unlocked=PATH_MILESTONES.filter(item=>pathUnlocked(item.id)).length,wordPosition=wordJourneyPosition();if(kanjiButton){kanjiButton.disabled=!pathUnlocked('kanji');kanjiButton.querySelector('small').textContent=pathUnlocked('kanji')?'View progress →':'Unlock at Kanji Gate'}$('#journeyHomeAvatar').src=pathAvatarSource();$('#journeyHomeTitle').textContent=next?next.title:'Today’s route complete!';$('#journeyHomeActivity').textContent=next?next.detail:'Come back tomorrow for a newly adapted route.';$('#journeyHomeProgress').textContent=`${completed.length}/${route.steps.length} missions today · ${unlocked}/${PATH_MILESTONES.length} activities · ${wordPosition.explored}/${vocab.length} words`;$('#journeyHomeFill').style.width=`${Math.max(3,completed.length/Math.max(1,route.steps.length)*100)}%`;
}
function renderJourney(){
 refreshPathUnlocks();const currentIndex=pathCurrentIndex(),unlocked=PATH_MILESTONES.filter(item=>pathUnlocked(item.id)).length,wordPosition=wordJourneyPosition(),masteryState=masterySnapshot();$('#journeyStats').innerHTML=`<article><strong>${unlocked}/${PATH_MILESTONES.length}</strong><span>Activities unlocked</span></article><article><strong>${wordPosition.explored}/${vocab.length}</strong><span>Words introduced</span></article><article><strong>${masteryState.mastered}</strong><span>Full mastery journeys</span></article><article><strong>${wordPosition.completed}/${wordPosition.total}</strong><span>Chapters completed</span></article>`;
 renderDailyRoute();
 $('#pathRoad').innerHTML=PATH_MILESTONES.map((item,itemIndex)=>{const unlockedItem=pathUnlocked(item.id),visited=Boolean(meta.pathVisits[item.id]),current=itemIndex===currentIndex;return `<article class="path-stop ${unlockedItem?'unlocked':'locked'} ${visited?'visited':''} ${current?'current':''}"><div class="path-marker">${esc(item.icon)}</div>${current?`<img id="journeyAvatar" class="path-avatar" src="${pathAvatarSource()}" alt="Your Kaishi character at ${esc(item.title)}">`:''}<button data-path-launch="${esc(item.id)}"${unlockedItem?'':' disabled'}><span class="path-status">${unlockedItem?(visited?'✓ Unlocked':'✨ New activity'):'🔒 Locked'}</span><strong>${esc(item.title)}</strong><b>${esc(item.activity)}</b><small lang="ja">${esc(item.japanese)}</small><p>${esc(item.description)}</p><i>${unlockedItem?'Tap to practise':esc(pathProgress(item.id))}</i></button></article>`}).join('');
 $('#wordExpedition').innerHTML=Array.from({length:wordChapterCount()},(_,itemIndex)=>{const stats=chapterStats(itemIndex),unlockedChapter=chapterUnlocked(itemIndex),current=itemIndex===currentWordChapterIndex(),start=itemIndex*WORD_CHAPTER_SIZE+1,end=start+stats.words.length-1,name=WORD_CHAPTER_NAMES[itemIndex]||`Chapter ${itemIndex+1}`;return `<article class="word-chapter ${stats.complete?'complete':''} ${current?'current':''} ${unlockedChapter?'unlocked':'locked'}">${current?`<img class="chapter-avatar" src="${pathAvatarSource()}" alt="Your Kaishi character in ${esc(name)}">`:''}<button data-word-chapter="${itemIndex}"${unlockedChapter?'':' disabled'}><span class="chapter-number">Chapter ${itemIndex+1}</span><strong>${esc(name)}</strong><small>Words ${start}–${end}</small><div class="chapter-meter"><span><b style="width:${Math.min(100,stats.introduced/Math.max(1,stats.introTarget)*100)}%"></b></span><i>${stats.introduced}/${stats.introTarget} introduced</i></div><div class="chapter-meter review"><span><b style="width:${Math.min(100,stats.reviewed/Math.max(1,stats.reviewTarget)*100)}%"></b></span><i>${stats.reviewed}/${stats.reviewTarget} reviewed</i></div><em>${stats.complete?'✓ Chapter complete':unlockedChapter?(current?'Continue chapter':'Practise chapter'):'🔒 Complete the previous chapter'}</em></button></article>`}).join('');
 $('#practiceHub').innerHTML=PATH_MILESTONES.filter(item=>pathUnlocked(item.id)&&(item.id==='vocabulary'||Boolean(meta.pathVisits[item.id]))).map(item=>`<button data-path-launch="${esc(item.id)}"><span>${esc(item.icon)}</span><strong>${esc(item.activity)}</strong><small>${esc(item.title)}</small></button>`).join('');document.querySelectorAll('[data-path-launch]').forEach(button=>button.onclick=()=>launchPathMilestone(button.dataset.pathLaunch));document.querySelectorAll('[data-word-chapter]').forEach(button=>button.onclick=()=>startJourneyChapter(+button.dataset.wordChapter));
}
function openJourney(section='missions'){renderJourney();show('journey');if(section==='practice')requestAnimationFrame(()=>$('#practiceHubTitle')?.scrollIntoView({behavior:'smooth',block:'start'}));if(section==='missions')requestAnimationFrame(()=>$('#dailyRouteTitle')?.scrollIntoView({behavior:'smooth',block:'start'}));if(section==='current')requestAnimationFrame(()=>{const hasNew=PATH_MILESTONES.some(item=>pathUnlocked(item.id)&&!meta.pathVisits[item.id]);$(hasNew?'.path-stop.current':'.word-chapter.current')?.scrollIntoView({behavior:'smooth',block:'center'})})}
function startJourneyChapter(itemIndex){if(!chapterUnlocked(itemIndex)){toast('Complete the previous vocabulary chapter first');return}activityReturnScreen='journey';activeVocabularyChapter=itemIndex;makeSession(itemIndex)}
function launchPathMilestone(id){
 if(!pathUnlocked(id)){toast('Keep following the journey to unlock this activity');return}activityReturnScreen='journey';if(activeJourneyMission?.activityId!==id)meta.pathVisits[id]=Date.now();save();renderJourneyHome();
 if(id==='vocabulary'){startJourneyChapter(currentWordChapterIndex());return}if(id==='kana'){openKanaPath();return}if(id==='picture'){startPictureGame('picture-word');return}if(id==='listening'){startPictureGame('listen-meaning');return}if(id==='karuta'){startKarutaGame();return}if(id==='conversation'){openConversationLibrary();return}if(id==='grammar'){openGrammarPath();return}if(id==='theatre'){openTheatreLibrary();return}if(id==='kanji'){renderKanjiOverview();show('kanjiOverview');return}if(id==='builder'){openKanjiBuilder();return}if(id==='manga'){openMangaLibrary();return}if(id==='battle')startDecayBattle();
}
function continueJourney(){openJourney('missions')}
function returnToActivitySource(fallback='home'){const destination=activityReturnScreen==='journey'?'journey':fallback;activityReturnScreen='home';activeVocabularyChapter=null;if(destination==='journey'){finishActiveJourneyMission();openJourney()}else show(destination)}
function exitActivitySession(fallback='home'){const destination=activityReturnScreen==='journey'?'journey':fallback;activityReturnScreen='home';if(destination==='journey')finishActiveJourneyMission();abortSession(destination);if(destination==='journey')renderJourney()}
function renderOwnerPathControls(owner=window.KaishiCloud?.isOwner?.()){
 const controls=$('#ownerPathControls');if(!controls)return;controls.hidden=!owner;if(!owner)return;controls.querySelector('#ownerPathGrid').innerHTML=PATH_MILESTONES.map((item,itemIndex)=>`<button type="button" data-owner-path="${itemIndex}" class="${pathUnlocked(item.id)?'unlocked':''}"><span>${esc(item.icon)}</span><b>${esc(item.activity)}</b><small>${pathUnlocked(item.id)?'Available':'Unlock through here'}</small></button>`).join('');controls.querySelector('#ownerChapterGrid').innerHTML=Array.from({length:wordChapterCount()},(_,itemIndex)=>`<button type="button" data-owner-chapter="${itemIndex}" class="${chapterUnlocked(itemIndex)?'unlocked':''}"><b>${itemIndex+1}</b><span>${esc(WORD_CHAPTER_NAMES[itemIndex]||`Chapter ${itemIndex+1}`)}</span></button>`).join('');
}
function unlockOwnerPathThrough(itemIndex){if(!window.KaishiCloud?.isOwner?.())return;meta.pathOverrides=[...new Set([...meta.pathOverrides,...PATH_MILESTONES.slice(0,itemIndex+1).map(item=>item.id)])];save();renderOwnerPathControls(true);renderJourneyHome();toast(`Journey unlocked through ${PATH_MILESTONES[itemIndex].title}`)}
function unlockOwnerChapterThrough(itemIndex){if(!window.KaishiCloud?.isOwner?.())return;meta.chapterOverrides=[...new Set([...meta.chapterOverrides,...Array.from({length:itemIndex+1},(_,index)=>index)])];save();renderOwnerPathControls(true);renderJourneyHome();toast(`Vocabulary journey unlocked through chapter ${itemIndex+1}`)}
window.KaishiQuestPath={renderOwnerPathControls};
function updateHome(){
 detectLostStreak();const due=dailyDueWords().length,dailyLimit=meta.dailyReviewPlan?.limit||settings.sessionSize,initialDue=Math.max(0,Number(meta.dailyReviewPlan?.initialTotal||0)),dueRatio=initialDue?Math.min(1,due/initialDue):0,activity=todayActivity(),karutaAverage=recentKarutaBestAverage();
 const ring=$('#dueCount').parentElement;$('#dueCount').textContent=due;ring.style.setProperty('--due-progress',dueRatio);ring.setAttribute('aria-label',`${due} of ${initialDue} planned reviews remaining today`);ring.title=`${due} of ${initialDue} planned reviews remain. The ring drains as you complete them.`;$('#dueProgressLabel').textContent=initialDue?`of ${initialDue} due`:'due';
 $('#streakActivity').textContent=activity.qualified?'Streak protected today':`${Math.min(activity.tested,5)} / 5 tested answers`;$('#streakActivityFill').style.width=`${Math.min(100,activity.tested/5*100)}%`;
 $('#learnedCount').textContent=started();$('#accuracy').textContent=accuracy()+'%';$('#mastered').textContent=Object.values(progress).filter(mastery).length;$('#kanjiMastered').textContent=kanjiMasteredCount();$('#kanaMastered').textContent=kanaData.length?kanaMastered('hiragana')+kanaMastered('katakana'):0;$('#totalWords').textContent=vocab.length;$('#monsters72h').textContent=recentMonsterVictories();$('#karutaAverage72h').textContent=karutaAverage===null?'—':`${Math.round(karutaAverage).toLocaleString()} pts`;
 if($('#mangaBtn span'))$('#mangaBtn span').textContent=`📖 Manga Stories${mangaStories.length?` · ${mangaCompletedCount()}/${mangaStories.length}`:''}`;
 updateConversationPrompt();
 $('#streak').textContent=`🔥 ${meta.streak} day${meta.streak===1?'':'s'} streak`;$('#summary').textContent=due?`${due} of today's reviews are ready.`:activity.qualified?'Today’s streak is protected. Keep learning or enjoy a game.':'Reviews complete. Answer five tested questions to protect today’s streak.';
 renderSkillScores();updateKanaOverview();updateStreakRescue();window.KaishiCloud?.renderDashboardAvatar?.();renderJourneyHome();renderOwnerPathControls()
}
function similarity(a='',b=''){a=String(a);b=String(b);let score=0;if(a.length===b.length)score+=3;if(a.slice(-1)===b.slice(-1))score+=2;if(a.slice(-2)===b.slice(-2))score+=3;for(const ch of new Set(a))if(b.includes(ch))score+=1;return score}
function distractors(v,key,n=3){const pool=vocab.filter(x=>x.id!==v.id&&x[key]&&x[key]!==v[key]);const target=v[key]||'';return shuffle(pool.map(x=>({x,score:similarity(target,x[key])+(Math.abs((x.frequency||9999)-(v.frequency||9999))<250?2:0)})).sort((a,b)=>b.score-a.score).slice(0,35)).slice(0,n).map(o=>o.x[key])}
function shuffle(a){return [...a].sort(()=>Math.random()-.5)}
function chooseSkill(v){
 const p=pFor(v.id),allowed=skills=>skills.filter(skill=>skill!=='kanji'||v.word!==v.reading).filter(skill=>skill!=='picture'||memoryScenes[sceneKey(v)]);
 if(p.stage===0)return'intro';
 const early=allowed(['meaning','listening','reading','picture']);
 if(Number(p.reps||0)<4||Number(p.interval||0)<3)return early.sort((a,b)=>(p.skills[a]?.attempts||0)-(p.skills[b]?.attempts||0)||Math.random()-.5)[0];
 const developing=allowed(['meaning','listening','reading','sentence','kanji','production','picture']);
 if(Number(p.interval||0)<21)return developing.map(skill=>({skill,priority:(1-(p.skills[skill]?.strength||0))*(skill==='meaning'||skill==='listening'?1.2:1)*(.85+Math.random()*.3)})).sort((a,b)=>b.priority-a.priority)[0].skill;
 const independent=allowed(['meaning','listening','reading','sentence','kanji','production']);
 return independent.map(skill=>({skill,priority:(1-(p.skills[skill]?.strength||0))*(.85+Math.random()*.3)})).sort((a,b)=>b.priority-a.priority)[0].skill;
}
function abortSession(destination='home'){
 const returnToJourney=activityReturnScreen==='journey'&&(pictureGameActive||karutaActive||battleActive||session.length>0)&&['home','games'].includes(destination);if(returnToJourney)destination='journey';
 if(returnToJourney)finishActiveJourneyMission();
 pictureGameActive=false;karutaActive=false;karuta=null;battleActive=false;battle=null;
 activeVocabularyChapter=null;
 session=[];
 index=0;
 current=null;
 revealed=false;
 hintUsed=false;
 const card=$('#card');
 if(card)card.innerHTML='';
 updateHome();
 if(destination==='journey')renderJourney();show(destination);if(returnToJourney)activityReturnScreen='home';
}
function makeSession(chapterIndex=null){
 pictureGameActive=false;session=[];index=0;current=null;
 const chapterMode=Number.isInteger(chapterIndex),pool=chapterMode?chapterWords(chapterIndex):vocab;
 const due=(chapterMode?pool.filter(v=>progress[v.id]&&Number(progress[v.id].stage||0)>=1&&Number(progress[v.id].due||0)<=Date.now()):dailyDueWords()).sort((a,b)=>pFor(a.id).due-pFor(b.id).due);
 const unseen=pool.filter(v=>!progress[v.id]||Number(progress[v.id].stage||0)===0).slice(0,settings.newLimit);
 let selected=[...due.slice(0,settings.sessionSize),...unseen];
 if(!selected.length)selected=[...pool].sort((a,b)=>wordPracticeCount(progress[a.id])-wordPracticeCount(progress[b.id])).slice(0,Math.min(settings.sessionSize,pool.length));
 const activeCount=Math.max(2,Math.min(4,+settings.activeWords||4));
 const queue=selected.map(v=>{
   const p=pFor(v.id);
   let skills=p.stage===0?['intro','meaning','listening','reading','picture']:[chooseSkill(v)];
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
function makeTargetedMasterySession(ids,skill){
 pictureGameActive=false;const byId=new Map(vocab.map(word=>[word.id,word])),words=(ids||[]).map(id=>byId.get(id)).filter(Boolean);if(!words.length){makeSession();return}
 session=words.map(v=>({v,skill:skill==='retain'?chooseSkill(v):skill}));index=0;current=null;show('study');renderCurrent();
}
function media(name){return name?`media/${encodeURIComponent(name).replace(/%2F/g,'/')}`:''}
function play(name){if(!name)return;new Audio(media(name)).play().catch(()=>{})}
function kanaState(id){return meta.kanaProgress[id]||(meta.kanaProgress[id]={stage:0,attempts:0,correct:0,due:0})}
function kanaMastered(script){return kanaData.filter(x=>x.script===script&&Number(meta.kanaProgress?.[x.id]?.stage||0)>=4).length}
function updateKanaOverview(){
 if(!kanaData.length)return;
 const h=kanaData.filter(x=>x.script==='hiragana').length,k=kanaData.filter(x=>x.script==='katakana').length;
 if($('#hiraganaProgress'))$('#hiraganaProgress').textContent=`${kanaMastered('hiragana')} / ${h} mastered`;
 if($('#katakanaProgress'))$('#katakanaProgress').textContent=`${kanaMastered('katakana')} / ${k} mastered`;
}
function openKanaPath(){updateKanaOverview();$('#kanaOverview').hidden=false;$('#kanaLesson').hidden=true;show('kana')}
function playKana(entry){if(entry?.audio)play(entry.audio)}
function kanaChoices(entry,key){
 const pool=kanaData.filter(x=>x.script===entry.script&&x.id!==entry.id&&x[key]!==entry[key]);
 const choices=[entry[key]];
 for(const item of shuffle(pool)){if(!choices.includes(item[key]))choices.push(item[key]);if(choices.length===4)break}
 return shuffle(choices);
}
function startKanaStudy(script){
 kanaScript=script;const pool=kanaData.filter(x=>x.script===script),now=Date.now();
 const due=pool.filter(x=>kanaState(x.id).stage>0&&kanaState(x.id).due<=now).sort((a,b)=>kanaState(a.id).due-kanaState(b.id).due);
 const unseen=pool.filter(x=>kanaState(x.id).stage===0).slice(0,5);
 let chosen=[...due.slice(0,5),...unseen].slice(0,10);
 if(!chosen.length)chosen=[...pool].sort((a,b)=>kanaState(a.id).stage-kanaState(b.id).stage||kanaState(a.id).due-kanaState(b.id).due).slice(0,10);
 kanaSession=[];
 chosen.forEach(entry=>{const state=kanaState(entry.id);if(state.stage===0)kanaSession.push({entry,mode:'intro'});kanaSession.push({entry,mode:state.stage%2?'listen':'recognise'})});
 kanaIndex=0;$('#kanaOverview').hidden=true;$('#kanaLesson').hidden=false;renderKanaCard();
}
function renderKanaCard(){
 if(kanaIndex>=kanaSession.length){finishKanaStudy();return}
 const item=kanaSession[kanaIndex],entry=item.entry,c=$('#kanaCard');kanaAnswered=false;
 $('#kanaCounter').textContent=`${kanaIndex+1}/${kanaSession.length}`;$('#kanaProgressFill').style.width=`${kanaIndex/kanaSession.length*100}%`;
 if(item.mode==='intro'){
  c.innerHTML=`<span class="eyebrow">Meet a ${esc(entry.script)} sound</span><div class="kana-glyph" lang="ja">${esc(entry.kana)}</div><div class="kana-romaji">${esc(entry.romaji)}</div><button id="kanaAudio" class="audio primary">🔊 Play pronunciation</button><button id="kanaContinue" class="primary reveal">I’m ready →</button>`;
  $('#kanaAudio').onclick=()=>playKana(entry);$('#kanaContinue').onclick=()=>{const state=kanaState(entry.id);state.stage=Math.max(1,state.stage);state.due=Date.now();save();kanaIndex++;renderKanaCard()};if(settings.autoAudio)playKana(entry);return;
 }
 const listening=item.mode==='listen',answer=listening?entry.kana:entry.romaji,choices=kanaChoices(entry,listening?'kana':'romaji');
 c.innerHTML=`<span class="eyebrow">${listening?'Listen and recognise':'Read the character'}</span>${listening?'<h2>Which character matches the sound?</h2><button id="kanaPromptAudio" class="audio primary">🔊 Play sound</button>':`<div class="kana-glyph kana-question" lang="ja">${esc(entry.kana)}</div><h2>Which sound does it make?</h2>`}<div class="choices kana-choices">${choices.map(choice=>`<button class="choice" data-kana-answer="${encodeURIComponent(choice)}">${esc(choice)}</button>`).join('')}</div><section id="kanaFeedback" class="game-feedback" hidden aria-live="polite"></section>`;
 if(listening){$('#kanaPromptAudio').onclick=()=>playKana(entry);playKana(entry)}
 document.querySelectorAll('[data-kana-answer]').forEach(button=>button.onclick=()=>resolveKanaAnswer(button,entry,answer));
}
function resolveKanaAnswer(button,entry,answer){
 if(kanaAnswered)return;kanaAnswered=true;const selected=decodeURIComponent(button.dataset.kanaAnswer),ok=selected===answer,state=kanaState(entry.id);
 button.classList.add(ok?'correct':'wrong');document.querySelectorAll('[data-kana-answer]').forEach(choice=>{if(decodeURIComponent(choice.dataset.kanaAnswer)===answer)choice.classList.add('correct');choice.disabled=true});
 state.attempts++;meta.kanaAnswers=Number(meta.kanaAnswers||0)+1;if(ok){state.correct++;meta.kanaCorrect=Number(meta.kanaCorrect||0)+1;state.stage=Math.min(5,state.stage+1)}else state.stage=Math.max(1,state.stage-1);recordMeaningfulActivity('kana');
 const intervals=[0,10/1440,1,3,7,21];state.due=Date.now()+intervals[state.stage]*86400000;save();
 const feedback=$('#kanaFeedback');feedback.hidden=false;feedback.innerHTML=`<p class="game-result ${ok?'game-result-correct':'game-result-wrong'}">${ok?'Correct!':'Not quite — here is the right answer.'}</p><div class="kana-answer"><span lang="ja">${esc(entry.kana)}</span><strong>${esc(entry.romaji)}</strong></div><button id="kanaAnswerAudio" class="audio">🔊 Hear ${esc(entry.romaji)}</button><button id="kanaNext" class="primary reveal">${kanaIndex===kanaSession.length-1?'Path summary':'Next →'}</button>`;
 $('#kanaAnswerAudio').onclick=()=>playKana(entry);$('#kanaNext').onclick=()=>{kanaIndex++;renderKanaCard()};
}
function finishKanaStudy(){
 save();updateHome();
 const total=kanaData.filter(x=>x.script===kanaScript).length,mastered=kanaMastered(kanaScript),label=kanaScript[0].toUpperCase()+kanaScript.slice(1);$('#kanaProgressFill').style.width='100%';$('#kanaCounter').textContent='Complete';
 $('#kanaCard').innerHTML=`<span class="eyebrow">${esc(label)} session complete</span><h2>Foundation strengthened</h2><div class="kana-summary"><strong>${mastered}</strong><span>of ${total} ${esc(label)} sounds mastered</span></div><p>Characters reach mastery through repeated reading and listening checks over time.</p><button id="kanaAgain" class="primary reveal">Continue ${esc(label)}</button><button id="kanaPaths" class="reveal">Back to Kana paths</button>`;
 $('#kanaAgain').onclick=()=>startKanaStudy(kanaScript);$('#kanaPaths').onclick=openKanaPath;
}
function mangaProgressFor(id){return meta.mangaProgress[id]||(meta.mangaProgress[id]={completed:0,best:0,attempts:0,lastPanel:0,updatedAt:0})}
function mangaCompletedCount(){return mangaStories.filter(story=>Number(meta.mangaProgress?.[story.id]?.completed||0)>0).length}
function mangaStoryUnlocked(index){
 const story=mangaStories[index],done=Number(meta.mangaProgress?.[story?.id]?.completed||0)>0;
 return done||index===0||mangaStories.slice(0,index).every(previous=>Number(meta.mangaProgress?.[previous.id]?.completed||0)>0);
}
function mangaTarget(panel){return vocab.find(entry=>`${entry.word}|${entry.reading}`===panel.targetKey)}
function mangaDifficulty(level){return `${'●'.repeat(level)}${'○'.repeat(Math.max(0,4-level))}`}
function renderMangaLibrary(){
 const completed=mangaCompletedCount(),panels=mangaStories.reduce((sum,story)=>sum+story.panels.length,0);
 $('#mangaLibraryStats').innerHTML=`<article><strong>${completed}/${mangaStories.length}</strong><span>Stories completed</span></article><article><strong>${panels}</strong><span>Reading panels</span></article>`;
 $('#mangaStoryGrid').innerHTML=mangaStories.map((story,index)=>{const state=mangaProgressFor(story.id),done=state.completed>0,unlocked=mangaStoryUnlocked(index),previous=mangaStories[index-1],status=done?`✓ Complete · Best ${state.best}%`:unlocked?'Ready to read':`🔒 Complete ${esc(previous.englishTitle)} to unlock`;return `<button class="manga-story-card" data-manga-story="${esc(story.id)}"${unlocked?'':' disabled aria-disabled="true"'}><img src="${esc(story.image)}?v=${APP_VERSION}" alt="Manga page for ${esc(story.englishTitle)}"><span class="manga-story-level">Level ${story.difficulty} · ${mangaDifficulty(story.difficulty)}</span><strong lang="ja">${esc(story.title)}</strong><small>${esc(story.englishTitle)}</small><p>${esc(story.summary)}</p><b>${story.panels.length} panels · ${status}</b></button>`}).join('');
 document.querySelectorAll('[data-manga-story]:not([disabled])').forEach(button=>button.onclick=()=>startMangaStory(mangaStories.find(story=>story.id===button.dataset.mangaStory)));
}
function openMangaLibrary(){mangaStory=null;$('#mangaLibrary').hidden=false;$('#mangaReader').hidden=true;renderMangaLibrary();show('manga')}
function startMangaStory(story){
 const storyIndex=mangaStories.findIndex(candidate=>candidate.id===story?.id);
 if(!story||storyIndex<0||!mangaStoryUnlocked(storyIndex))return;
 mangaStory=story;mangaPanelIndex=0;mangaAnswered=false;mangaQuestionAnswered=false;
 const state=mangaProgressFor(story.id),previousTypes=Array.isArray(state.lastQuestionTypes)?state.lastQuestionTypes:[];
 const panelQuestions=story.panels.map((panel,panelIndex)=>chooseMangaQuestion(mangaPanelQuestionPool(panel,mangaTarget(panel)),previousTypes[panelIndex]));
 const finalQuestion=chooseMangaQuestion(mangaStoryQuestionPool(story),state.lastStoryQuestionType);
 mangaRun={correct:0,total:0,panelQuestions,finalQuestion};
 state.attempts++;state.updatedAt=Date.now();state.lastQuestionTypes=panelQuestions.map(question=>question.type);state.lastStoryQuestionType=finalQuestion.type;
 save();$('#mangaLibrary').hidden=true;$('#mangaReader').hidden=false;renderMangaPanel();
}
function highlightedMangaSentence(panel){const sentence=esc(panel.sentence),focus=esc(panel.focus);return sentence.replace(focus,`<mark>${focus}</mark>`)}
const SENTENCE_PARTICLES={は:'topic marker — “as for…”',が:'subject marker',を:'direct-object marker',に:'time, destination, resulting state, or adverb marker',へ:'direction — “towards”',で:'place or means of an action',と:'with, and, or a quotation',の:'links nouns — often “of” or possession',も:'also / too',から:'from / because',まで:'until / as far as',より:'than / from',か:'question marker',ね:'seeks agreement — “isn’t it?”',よ:'adds emphasis or new information',ながら:'while doing',ので:'because / since',ため:'for the purpose of',て:'connects actions — “and then”'};
const SENTENCE_GRAMMAR={です:'polite “is / are”',でした:'polite past — “was / were”',ます:'polite present or future',ました:'polite past tense',ません:'polite negative',ませんでした:'polite negative past',たい:'want to do',ましょう:'“let’s…” suggestion',ください:'polite request — “please…”',ない:'negative — “not / does not”',なかった:'negative past — “did not”',かった:'past form of an い-adjective',て:'て-form connecting this action to what follows',てい:'ongoing action or state (from ている)',でい:'ongoing action or state (from でいる)',ても:'“even if / even though”',そうに:'appearing or seeming',た:'plain past or completed action'};
const SENTENCE_GLOSSES={カイ:'Kai',ミア:'Mia',マスター:'Master',二人:'two people / the two',三人:'three people / the three',子犬:'puppy',広場:'square / plaza',時計:'clock',時計塔:'clocktower',歯車:'gear',本棚:'bookshelf',手掛かり:'clue',首輪:'collar',一口:'one bite',材料:'ingredients',門:'gate',塔:'tower',岸:'shore',角:'corner',卵:'egg',波:'waves',像:'statue',何時:'what time',覚まし:'wake up (from 目を覚ます)',よかった:'was good / glad',おはようございます:'good morning (polite)',ありがとうございます:'thank you (polite)',いらっしゃい:'welcome',お願いします:'please / I request',いただきます:'thank you; I will have it',ごちそうさま:'thank you for the meal',それなら:'in that case',では:'then / well then',まだ:'not yet / still',もう:'already',どうぞ:'please / go ahead',とても:'very',たくさん:'many / a lot',ゆっくり:'slowly',ほっと:'with relief',一斉:'all at once',心から:'wholeheartedly',初めて:'for the first time',小さな:'small',大きな:'large',冷たい:'cold',温かい:'warm',赤い:'red',古い:'old',弱い:'weak',重い:'heavy',細い:'thin',遠く:'far away',近く:'nearby',三番:'number three',五分:'five minutes',十分:'ten minutes',十時:'ten o’clock',十五分:'fifteen minutes',午後:'afternoon / p.m.',今から:'from now',その時:'at that moment',木の下:'beneath the tree'};
Object.assign(SENTENCE_GLOSSES,{かばん:'bag',傘:'umbrella',映画:'film / movie',昼:'daytime / lunch',曜日:'day of the week',電車:'train',切符:'ticket',ホーム:'platform',靴:'shoes',スリッパ:'slippers',客間:'guest room',おにぎり:'rice ball',米:'rice',海苔:'seaweed',神社:'Shinto shrine',お守り:'protective charm',放課後:'after school',サッカー:'football / soccer',校庭:'school grounds',誕生:'birth / birthday',プレゼント:'present / gift',カード:'card',注文:'order',天ぷら:'tempura',箸:'chopsticks',夏休み:'summer holiday',京都:'Kyoto',新幹線:'bullet train',お寺:'Buddhist temple',地図:'map',漢字:'Kanji',復習:'review',岩:'rock',字:'written character',明かり:'light',音楽:'music',飲み物:'drink',小豆:'red beans',鳥居:'torii gate',一歩:'one step',八時:'eight o’clock',二時:'two o’clock',時半:'half past the hour',千円:'one thousand yen',三日:'three days',あと:'remaining / more',所:'place',大切な:'important',きれい:'beautiful / clean',静かな:'quiet',新鮮な:'fresh',うれし:'happy',し:'do',撮り:'take (a photograph)',撮っ:'take (a photograph)',泊まり:'stay overnight',鳴い:'cry / meow',曲がる:'turn',曲がり:'turn',挑戦し:'attempt / take on a challenge',教わっ:'be taught by',でき:'can / be able to',連絡し:'contact / let someone know',切らし:'run out of breath',ほっとし:'feel relieved',気づき:'notice / realise',安心し:'feel relieved',差し込み:'shine / stream in',挟まっ:'be caught / wedged',練習し:'practise',復習し:'review',勉強し:'study',楽しみにし:'look forward to',天ぷらにし:'choose tempura',カレーにし:'choose curry',白にし:'choose white',よかった:'was good / was glad',おなかがすき:'be hungry',とてもすき:'very hungry',あります:'there is / have',使え:'can use',知ってい:'know',降ってい:'be raining',持ってい:'have / be carrying',止まったまま:'remain stopped',思ったより:'more than expected',迷ったこと:'having become lost',無事だ:'safe / unharmed',こちらこそ:'likewise / thank you too',まっすぐ:'straight ahead',少しずつ:'little by little',半分ずつ:'half each',日ぐらい:'about … days',いろいろな:'various'});
Object.assign(SENTENCE_GLOSSES,{お:'honorific prefix',ご:'honorific prefix',り:'verb stem continuing the action',き:'verb stem continuing the action',み:'verb stem continuing the action',だい:'part of a polite request',りますか:'polite question ending',りやすい:'easy to do the preceding action',ありますよ:'there is / have (よ adds emphasis)',ありますか:'is there? / do you have?',挑戦:'challenge / attempt',一斉につき:'switch on all at once',迷ったことに:'having become lost (こと turns the action into a “thing”)',なく:'negative linking form — “not / without”',玄関で:'at the entrance (で marks the place)',何にしますか:'what will you choose? (に marks the choice)',カレーが:'curry (が marks the subject)',みますか:'will you try it?',とてもおいしい:'very delicious',週末は:'as for the weekend (は marks the topic)',したいですか:'what do you want to do?',駅の:'of / at the station (の links nouns)',十五:'fifteen',十分ありますね:'there are ten minutes (ね seeks agreement)',中でどこに:'where inside? (で marks place; に marks destination)',招きありがとうござい:'thank you for the invitation',来てくれてありがとう:'thank you for coming',持ちしましょうか:'shall I carry it? (humble offer)',おき:'put / place',お昼に:'at lunchtime (に marks time)',二人でも:'even with two people (でも means “even with”)',大きさ:'size',古いですが:'it is old, but… (が links a contrast)',お願いしたいですか:'what would you like to request?',持ってきましたか:'did you bring it?',暑いので:'because it is hot (ので gives the reason)',来週は:'as for next week (は marks the topic)',花にしますか:'shall we choose flowers? (に marks the choice)',少しなら:'if it is only a little',使い方は:'as for how to use it (は marks the topic)',使えていますよ:'you are able to use it (よ adds emphasis)',終わったら:'when it is finished',行きたいですか:'do you want to go?',便利ですね:'convenient, isn’t it? (ね seeks agreement)',駅を:'the station (を marks the object/route)',かけてみますね:'I will try doing it (ね softens the statement)',駅までの:'to the station (まで means “as far as”)',駅が:'the station (が marks the subject)',見せたほうが:'it would be better to show',これなら:'if it is this / with this',続けることが:'continuing (こと turns the verb into a noun)',どうしますか:'what will you do?',できるように:'so as to become able to do it'});
Object.assign(SENTENCE_GLOSSES,{が:SENTENCE_PARTICLES.が,の:SENTENCE_PARTICLES.の,に:SENTENCE_PARTICLES.に,と:SENTENCE_PARTICLES.と,も:SENTENCE_PARTICLES.も,撮:'take a photograph',駅:'station',うれしそう:'looks happy',気づ:'notice / realise',聞:'hear / listen',おなか:'stomach',がすきましたか:'became empty? — the expression means “are you hungry?”',すき:'empty / hungry in おなかがすく',カレー:'curry',おいしい:'delicious',中でどこ:'where inside',招きありがとう:'thank you for the invitation',ござい:'polite copula stem',持ちし:'carry (humble verb stem)',お昼:'lunch',大:'large / size stem',きさ:'size-forming ending',飲:'drink',かけ:'make / place (such as a call)',駅まで:'as far as the station',続けること:'the act of continuing',できるよう:'so as to become able'});
Object.assign(SENTENCE_GLOSSES,{おはよう:'good morning',今日:'today',早い:'early',うん:'yes / yeah',一緒:'together',教室:'classroom',行こう:'let’s go (volitional form of 行く)',あっ:'oh!',雨:'rain',忘れ:'forget (verb stem)',私:'I / me',入って:'come in / enter (て-form)',ありがとう:'thank you',助かった:'was saved / that helped',お茶:'tea',飲む:'drink',はい:'yes',熱い:'hot to the touch',飲みなさい:'drink (gentle instruction)',お腹:'stomach',空いた:'became empty; became hungry',何:'what',食べたい:'want to eat',いい:'good / sounds good',二つ:'two items',買おう:'let’s buy (volitional form of 買う)',来る:'come / arrive',十時半:'10:30 / half past ten',ある:'there is / have',間に合う:'be in time / make it',どこか:'somewhere',猫:'cat',鳴いている:'is crying / meowing',あの:'that (over there)',箱:'box',後ろ:'behind',見て:'look (て-form)',いた:'there it is / found it',飼い主:'owner of a pet',探して:'look for (て-form)',あげよう:'let’s do it for someone',何度:'how many times / many times',失敗した:'failed',でも:'but / however',昨日:'yesterday',上手:'skilful / good at',なった:'became / got',そう:'that’s right / so',一回:'one time',やってみる:'try doing it',二人とも:'both of you',こちら:'this way / here',向いて:'turn toward / face',もう少し:'a little more',来て:'come (て-form)',分かった:'understood / okay',みんな:'everyone',笑おう:'let’s smile (volitional form of 笑う)'});
const SENTENCE_SUFFIXES=['ませんでした','なかった','ましょう','ください','ました','でした','ません','かった','そうに','ても','てい','でい','ます','です','たい','ない','て','た'];
function sentenceLexiconEntry(text){const exact=vocab.find(item=>item.word===text);if(exact)return{reading:exact.reading,meaning:exact.meaning};const godan={'う':['い','え','っ'],'く':['き','け','い'],'ぐ':['ぎ','げ','い'],'す':['し','せ'],'つ':['ち','て','っ'],'ぬ':['に','ね','ん'],'ぶ':['び','べ','ん'],'む':['み','め','ん'],'る':['り','れ','っ']};for(const item of vocab){const word=item.word||'',last=word.slice(-1),stem=word.slice(0,-1);if(last==='る'&&text===stem)return{reading:item.reading,meaning:item.meaning};if(godan[last]?.some(ending=>text===stem+ending))return{reading:item.reading,meaning:item.meaning};if(last==='い'&&(text===stem||text===stem+'く'||text===stem+'か'))return{reading:item.reading,meaning:item.meaning}}return null}
function sentenceContentParts(text){if(!text)return[];const singleKana=/^[ぁ-ゖ]$/.test(text);if(SENTENCE_GLOSSES[text]||(!singleKana&&sentenceLexiconEntry(text)))return[text];const segmenter=typeof Intl?.Segmenter==='function'?new Intl.Segmenter('ja',{granularity:'word'}):null;if(!segmenter)return[text];const parts=[];let current='';for(const item of segmenter.segment(text)){if(!item.isWordLike)continue;const token=item.segment,tokenSingleKana=/^[ぁ-ゖ]$/.test(token),known=Boolean(SENTENCE_GLOSSES[token]||(!tokenSingleKana&&sentenceLexiconEntry(token)));if(current&&known){parts.push(current);current=token}else if(current&&/\p{Script=Han}/u.test(token)){parts.push(current);current=token}else current+=token}if(current)parts.push(current);return parts}
function sentenceChunkMeaningful(text){if(/^[ぁ-ゖ]$/.test(text))return false;return sentenceContentParts(text).some(part=>{if(SENTENCE_GLOSSES[part]||sentenceLexiconEntry(part))return true;const suffix=SENTENCE_SUFFIXES.find(item=>part.length>item.length&&part.endsWith(item)),stem=suffix?part.slice(0,-suffix.length):part;return Boolean(SENTENCE_GLOSSES[stem]||sentenceLexiconEntry(stem))})}
function sentenceGuideParts(sentence){const segmenter=typeof Intl?.Segmenter==='function'?new Intl.Segmenter('ja',{granularity:'word'}):null;if(!segmenter)return[{text:sentence,meaning:'See the natural translation below',kind:'word'}];const parts=[];let content='';const addContent=part=>{if(!part)return;if(SENTENCE_GLOSSES[part]||sentenceLexiconEntry(part)){parts.push({text:part,kind:'word'});return}if(SENTENCE_GRAMMAR[part]){parts.push({text:part,kind:'grammar',meaning:SENTENCE_GRAMMAR[part]});return}const suffix=SENTENCE_SUFFIXES.find(item=>part.length>item.length&&part.endsWith(item));if(suffix){addContent(part.slice(0,-suffix.length));parts.push({text:suffix,kind:'grammar',meaning:SENTENCE_GRAMMAR[suffix]});return}parts.push({text:part,kind:'word'})};const flush=()=>{if(!content)return;sentenceContentParts(content).forEach(addContent);content=''};for(const item of segmenter.segment(sentence)){let token=item.segment;if(!item.isWordLike){flush();continue}const embeddedParticle=Object.keys(SENTENCE_PARTICLES).sort((a,b)=>b.length-a.length).find(particle=>token.length>particle.length&&token.endsWith(particle)&&sentenceChunkMeaningful(token.slice(0,-particle.length)));if(embeddedParticle){content+=token.slice(0,-embeddedParticle.length);flush();parts.push({text:embeddedParticle,kind:'particle',meaning:SENTENCE_PARTICLES[embeddedParticle]});continue}if(SENTENCE_PARTICLES[token]&&sentenceChunkMeaningful(content)){flush();parts.push({text:token,kind:'particle',meaning:SENTENCE_PARTICLES[token]})}else content+=token}flush();return parts.map(part=>{if(part.meaning)return part;const entry=sentenceLexiconEntry(part.text);return{...part,meaning:SENTENCE_GLOSSES[part.text]||entry?.meaning||'Meaning clarified by the natural translation'}})}
function sentenceGuideHtml(sentence,reading,translation,title='Understand the whole sentence'){return `<section class="sentence-guide"><div class="sentence-guide-heading"><span>${esc(title)}</span><strong lang="ja">${esc(sentence)}</strong><small>${esc(reading||'')}</small></div><div class="sentence-parts">${sentenceGuideParts(sentence).map(part=>`<article class="sentence-part ${part.kind}"><b lang="ja">${esc(part.text)}</b><span>${esc(part.meaning)}</span></article>`).join('')}</div><p class="sentence-natural"><b>Natural English:</b> ${esc(translation||'')}</p></section>`}
function mangaPanelDots(story,index){return story.panels.map((_,panelIndex)=>`<i class="${panelIndex===index?'active':panelIndex<index?'done':''}">${panelIndex+1}</i>`).join('')}
const MANGA_NEAR_MISS_JA=[['カイ',['ミア','マスター']],['ミア',['カイ','マスター']],['マスター',['カイ','ミア']],['朝',['夜','午後']],['夜',['朝','昼']],['学校',['家','駅']],['家',['学校','駅']],['元気に',['ゆっくり','静かに']],['小さな',['大きな']],['大きな',['小さな']],['赤い',['青い','白い']],['猫',['犬','鳥']],['子犬',['猫','鳥']],['写真',['手紙','鍵']],['海',['山','川']],['山',['海','町']],['五分',['十分','一時間']],['冷たい',['温かい']]];
const MANGA_NEAR_MISS_EN=[['Kai',['Mia','Master']],['Mia',['Kai','Master']],['Master',['Kai','Mia']],['morning',['evening','afternoon']],['night',['morning','afternoon']],['school',['home','the station']],['full of energy',['slowly','quietly']],['small',['large']],['large',['small']],['red',['blue','white']],['cat',['dog','bird']],['puppy',['cat','bird']],['photograph',['letter','key']],['five minutes',['ten minutes','an hour']],['cold',['warm']],['mountain',['coast','town']]];
function mangaNearMisses(panel,field,count=3){const source=panel[field],rules=field==='sentence'?MANGA_NEAR_MISS_JA:MANGA_NEAR_MISS_EN,choices=[];for(const [needle,replacements] of rules){if(!source.includes(needle))continue;for(const replacement of replacements){const choice=source.replace(needle,replacement);if(choice!==source&&!choices.includes(choice))choices.push(choice)}}return shuffle(choices).slice(0,count)}
function mangaQuestionAlternatives(panel,field,count=3){
 const near=mangaNearMisses(panel,field,count);
 const sameStory=mangaStory.panels.filter(candidate=>candidate!==panel).map(candidate=>candidate[field]);
 const sameLevel=mangaStories.filter(story=>story.id!==mangaStory.id&&story.difficulty===mangaStory.difficulty).flatMap(story=>story.panels.map(candidate=>candidate[field]));
 const all=mangaStories.flatMap(story=>story.panels.map(candidate=>candidate[field]));
 return [...near,...shuffle([...new Set([...sameStory,...sameLevel,...all].filter(value=>value&&value!==panel[field]&&!near.includes(value)))])].slice(0,count);
}
function mangaPanelQuestionPool(panel,target){
 const questions=[];
 if(target)questions.push({type:'vocabulary',label:'Vocabulary in context',prompt:'What does the highlighted word mean here?',choices:shuffle([target.meaning,...distractors(target,'meaning')]),answer:target.meaning});
 questions.push({type:'sentence-meaning',label:'Full sentence meaning',prompt:'What does the full sentence mean?',choices:shuffle([panel.translation,...mangaQuestionAlternatives(panel,'translation')]),answer:panel.translation});
 questions.push({type:'meaning-to-sentence',label:'Meaning to Japanese',prompt:'Which Japanese sentence matches this meaning?',support:panel.translation,choices:shuffle([panel.sentence,...mangaQuestionAlternatives(panel,'sentence')]),answer:panel.sentence,choiceLang:'ja'});
 return questions;
}
function mangaStoryQuestionPool(story){
 const eventPanel=shuffle(story.panels)[0];
 const eventChoices=shuffle([eventPanel.translation,...mangaQuestionAlternatives(eventPanel,'translation',2)]);
 const sentenceChoices=shuffle([eventPanel.sentence,...mangaQuestionAlternatives(eventPanel,'sentence',2)]);
 return [{...story.question,choices:shuffle(story.question.choices),type:'story-detail',label:'Story detail'},
  {type:'story-event',label:'Story event',prompt:'Which event happened in this story?',translation:'Choose the event you remember from the panels.',choices:eventChoices,answer:eventPanel.translation},
  {type:'story-sentence',label:'Story sentence',prompt:'この話に出てきた文はどれですか。',translation:'Which Japanese sentence appeared in this story?',choices:sentenceChoices,answer:eventPanel.sentence,choiceLang:'ja'}];
}
function chooseMangaQuestion(pool,previousType){const alternatives=pool.filter(question=>question.type!==previousType);return shuffle(alternatives.length?alternatives:pool)[0]}
function renderMangaPanel(){
 const panel=mangaStory.panels[mangaPanelIndex],target=mangaTarget(panel),question=mangaRun.panelQuestions[mangaPanelIndex],state=mangaProgressFor(mangaStory.id),hideSource=question.type==='meaning-to-sentence';mangaAnswered=false;startedAt=Date.now();state.lastPanel=Math.max(state.lastPanel,mangaPanelIndex);save(false);$('#mangaPanelCounter').textContent=`Panel ${mangaPanelIndex+1}/${mangaStory.panels.length}`;
 $('#mangaReaderContent').innerHTML=`<header class="manga-story-heading"><div><span class="eyebrow">Level ${mangaStory.difficulty} · ${mangaStory.panels.length} panels</span><h2 lang="ja">${esc(mangaStory.title)}</h2><p>${esc(mangaStory.englishTitle)}</p></div><span>${mangaDifficulty(mangaStory.difficulty)}</span></header><figure class="manga-page"><img src="${esc(mangaStory.image)}?v=${APP_VERSION}" alt="${esc(mangaStory.englishTitle)} manga page"><figcaption>Original Kaishi Quest manga · no answer text is baked into the artwork</figcaption></figure><div class="manga-panel-dots">${mangaPanelDots(mangaStory,mangaPanelIndex)}</div><section class="manga-reading-card" data-manga-question-type="${esc(question.type)}"><span class="eyebrow">Panel ${mangaPanelIndex+1} · ${esc(question.label)}</span>${hideSource?'<p class="manga-source-hidden">Japanese sentence hidden until you answer</p>':`<p class="manga-japanese" lang="ja">${highlightedMangaSentence(panel)}</p><p id="mangaReading" class="manga-reading" hidden>${esc(panel.reading)}</p><div class="manga-tools"><button id="mangaFurigana">Show reading</button>${target?.wordAudio?'<button id="mangaAudio" class="audio">🔊 Target word</button>':''}</div>`}<h3>${esc(question.prompt)}</h3>${question.support?`<p class="manga-question-support">${esc(question.support)}</p>`:''}<div class="choices manga-choices">${question.choices.map(choice=>`<button class="choice" ${question.choiceLang?`lang="${question.choiceLang}"`:''} data-manga-answer="${encodeURIComponent(choice)}">${esc(choice)}</button>`).join('')}</div><section id="mangaFeedback" class="game-feedback" hidden aria-live="polite"></section></section>`;
 if(!hideSource){$('#mangaFurigana').onclick=()=>{const reading=$('#mangaReading');reading.hidden=!reading.hidden;$('#mangaFurigana').textContent=reading.hidden?'Show reading':'Hide reading'};if(target?.wordAudio)$('#mangaAudio').onclick=()=>play(target.wordAudio)}document.querySelectorAll('[data-manga-answer]').forEach(button=>button.onclick=()=>resolveMangaPanel(button,panel,target,question));
}
function resolveMangaPanel(button,panel,target,question){
 if(mangaAnswered||!target)return;mangaAnswered=true;const answer=decodeURIComponent(button.dataset.mangaAnswer),ok=answer===question.answer;button.classList.add(ok?'correct':'wrong');document.querySelectorAll('[data-manga-answer]').forEach(choice=>{if(decodeURIComponent(choice.dataset.mangaAnswer)===question.answer)choice.classList.add('correct');choice.disabled=true});mangaRun.total++;if(ok)mangaRun.correct++;grade(target,'sentence',ok?3:1,ok,false);const state=mangaProgressFor(mangaStory.id);state.updatedAt=Date.now();save();const feedback=$('#mangaFeedback');feedback.hidden=false;feedback.innerHTML=`<p class="game-result ${ok?'game-result-correct':'game-result-wrong'}">${ok?'Correct — now see how the complete sentence works.':'Not quite — use the breakdown to understand the complete sentence.'}</p><div class="manga-reveal"><strong lang="ja">${esc(target.word)}</strong><span>${esc(target.reading)} · ${esc(target.meaning)}</span></div>${sentenceGuideHtml(panel.sentence,panel.reading,panel.translation)}${target.wordAudio?'<button id="mangaRevealAudio" class="audio">🔊 Hear the vocabulary</button>':''}<button id="mangaNext" class="primary reveal">${mangaPanelIndex===mangaStory.panels.length-1?'Story question':'Next panel →'}</button>`;if(target.wordAudio)$('#mangaRevealAudio').onclick=()=>play(target.wordAudio);$('#mangaNext').onclick=()=>{mangaPanelIndex++;if(mangaPanelIndex>=mangaStory.panels.length)renderMangaQuestion();else renderMangaPanel()};feedback.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function renderMangaQuestion(){
 const question=mangaRun.finalQuestion;mangaQuestionAnswered=false;$('#mangaPanelCounter').textContent='Story question';$('#mangaReaderContent').innerHTML=`<span class="eyebrow">Reading comprehension · ${esc(question.label)}</span><h2 lang="ja" class="manga-question">${esc(question.prompt)}</h2><p class="manga-reading">${esc(question.translation)}</p><div class="choices manga-comprehension">${question.choices.map(choice=>`<button class="choice" ${question.choiceLang?`lang="${question.choiceLang}"`:''} data-manga-question="${encodeURIComponent(choice)}">${esc(choice)}</button>`).join('')}</div><section id="mangaQuestionFeedback" class="game-feedback" hidden aria-live="polite"></section>`;document.querySelectorAll('[data-manga-question]').forEach(button=>button.onclick=()=>resolveMangaQuestion(button,question));
}
function resolveMangaQuestion(button,question){
 if(mangaQuestionAnswered)return;mangaQuestionAnswered=true;const answer=decodeURIComponent(button.dataset.mangaQuestion),ok=answer===question.answer;button.classList.add(ok?'correct':'wrong');document.querySelectorAll('[data-manga-question]').forEach(choice=>{if(decodeURIComponent(choice.dataset.mangaQuestion)===question.answer)choice.classList.add('correct');choice.disabled=true});mangaRun.total++;if(ok)mangaRun.correct++;recordMeaningfulActivity('manga');const state=mangaProgressFor(mangaStory.id),score=Math.round(mangaRun.correct/mangaRun.total*100);state.completed=Number(state.completed||0)+1;state.best=Math.max(Number(state.best||0),score);state.completedAt=Date.now();state.updatedAt=Date.now();save();const feedback=$('#mangaQuestionFeedback');feedback.hidden=false;feedback.innerHTML=`<p class="game-result ${ok?'game-result-correct':'game-result-wrong'}">${ok?'You understood the story!':'Review the highlighted answer, then finish the story.'}</p><p class="manga-comprehension-answer">${esc(question.answer)}</p><button id="mangaSummary" class="primary reveal">Story summary</button>`;$('#mangaSummary').onclick=finishMangaStory;
}
function finishMangaStory(){
 const state=mangaProgressFor(mangaStory.id),score=Math.round(mangaRun.correct/mangaRun.total*100),targets=[...new Map(mangaStory.panels.map(panel=>{const target=mangaTarget(panel);return[target?.id,target]}).filter(([id])=>id)).values()];updateHome();$('#mangaPanelCounter').textContent='Complete';$('#mangaReaderContent').innerHTML=`<span class="eyebrow">Manga story complete</span><h2 lang="ja" class="manga-summary-title">${esc(mangaStory.title)}</h2><div class="manga-summary-grid"><article><strong>${score}%</strong><span>This reading</span></article><article><strong>${state.best}%</strong><span>Personal best</span></article><article><strong>${mangaStory.panels.length}</strong><span>Panels read</span></article><article><strong>${targets.length}</strong><span>Words reinforced</span></article></div><section class="manga-glossary"><h3>Story vocabulary</h3>${targets.map(target=>`<button data-manga-audio="${encodeURIComponent(target.wordAudio||'')}"><strong lang="ja">${esc(target.word)}</strong><span>${esc(target.reading)}</span><small>${esc(target.meaning)}</small></button>`).join('')}</section><p class="battle-summary-note">${todayActivity().qualified?'Today’s streak is protected.':'Keep reading or answer more tested questions to protect today’s streak.'}</p><button id="mangaReplay" class="primary reveal">Read this story again</button><button id="mangaDone" class="reveal">Choose another story</button>`;document.querySelectorAll('[data-manga-audio]').forEach(button=>button.onclick=()=>{const audio=decodeURIComponent(button.dataset.mangaAudio);if(audio)play(audio)});$('#mangaReplay').onclick=()=>startMangaStory(mangaStory);$('#mangaDone').onclick=openMangaLibrary;
}
function conversationProgressFor(id){return meta.conversationProgress[id]||(meta.conversationProgress[id]={completed:0,best:0,attempts:0,lastTurn:0,updatedAt:0})}
function conversationCompletedCount(){return conversations.filter(item=>Number(meta.conversationProgress?.[item.id]?.completed||0)>0).length}
function conversationUnlocked(itemIndex){
 const item=conversations[itemIndex],done=Number(meta.conversationProgress?.[item?.id]?.completed||0)>0;
 return done||itemIndex===0||conversations.slice(0,itemIndex).every(previous=>Number(meta.conversationProgress?.[previous.id]?.completed||0)>0);
}
function conversationCharacterImage(item){return `media/profiles/${item?.character||'boy'}-base.webp?v=${APP_VERSION}`}
function conversationTargets(item){return [...new Set((item?.turns||[]).map(turn=>turn.targetWord).filter(Boolean))].map(word=>vocab.find(entry=>entry.word===word)).filter(Boolean)}
function updateConversationPrompt(){
 const button=$('#conversationContinue');if(!button||!conversations.length){if(button)button.hidden=true;return}
 const nextIndex=Math.max(0,conversations.findIndex(item=>!Number(meta.conversationProgress?.[item.id]?.completed||0))),item=conversations[nextIndex<0?0:nextIndex],state=conversationProgressFor(item.id),allDone=conversationCompletedCount()===conversations.length;
 button.hidden=false;button.dataset.conversationId=item.id;$('#conversationContinueImage').src=conversationCharacterImage(item);$('#conversationContinueTitle').textContent=allDone?'Replay Conversation Quest':`Continue with ${item.characterName}`;$('#conversationContinueMeta').textContent=allDone?`${conversations.length} conversations complete · replay any scene`:`${item.title} · ${state.completed?'Best '+state.best+'%':`Conversation ${conversations.indexOf(item)+1} of ${conversations.length}`}`;
}
function grammarState(id){return meta.grammarProgress[id]||(meta.grammarProgress[id]={attempts:0,completed:0,best:0})}
function grammarLessonUnlocked(itemIndex){return itemIndex===0||Number(grammarState(grammarLessons[itemIndex-1]?.id).completed||0)>0}
function grammarCompletedCount(){return grammarLessons.filter(lesson=>Number(meta.grammarProgress?.[lesson.id]?.completed||0)>0).length}
function openGrammarPath(){grammarLesson=null;grammarRun=null;$('#grammarLibrary').hidden=false;$('#grammarReader').hidden=true;const completed=grammarCompletedCount(),answers=Number(meta.grammarAnswers||0),accuracy=answers?Math.round(Number(meta.grammarCorrect||0)/answers*100):0;$('#grammarStats').innerHTML=`<article><strong>${completed}/${grammarLessons.length}</strong><span>Lessons complete</span></article><article><strong>${answers}</strong><span>Questions answered</span></article><article><strong>${accuracy}%</strong><span>Grammar accuracy</span></article>`;$('#grammarGrid').innerHTML=grammarLessons.map((lesson,itemIndex)=>{const state=grammarState(lesson.id),unlocked=grammarLessonUnlocked(itemIndex),status=state.completed?`✓ Complete · Best ${state.best}%`:unlocked?'Ready to learn':`🔒 Complete ${esc(grammarLessons[itemIndex-1]?.title||'the previous lesson')}`;return `<button class="grammar-lesson-card ${state.completed?'complete':''}" data-grammar-lesson="${itemIndex}"${unlocked?'':' disabled'}><span>${itemIndex+1}</span><div><strong>${esc(lesson.title)}</strong><small lang="ja">${esc(lesson.japanese)}</small><p>${esc(lesson.summary)}</p><b>${status}</b></div></button>`}).join('');document.querySelectorAll('[data-grammar-lesson]').forEach(button=>button.onclick=()=>startGrammarLesson(+button.dataset.grammarLesson));show('grammar')}
function startGrammarLesson(itemIndex){if(!grammarLessonUnlocked(itemIndex)){toast('Complete the previous particle lesson first');return}grammarLesson=grammarLessons[itemIndex];grammarQuestionIndex=-1;grammarRun={lessonIndex:itemIndex,questions:shuffle(grammarLesson.questions),correct:0,answered:false};$('#grammarLibrary').hidden=true;$('#grammarReader').hidden=false;renderGrammarTeaching()}
function grammarExampleHTML(example){return `<section class="grammar-example"><p lang="ja">${esc(example.japanese)}</p><span>${esc(example.reading)}</span><strong>${esc(example.english)}</strong><div>${(example.chunks||[]).map(chunk=>`<small>${esc(chunk)}</small>`).join('')}</div><button class="grammarSpeak" data-grammar-speech="${encodeURIComponent(example.japanese)}">🔊 Hear sentence</button></section>`}
function wireGrammarSpeech(){document.querySelectorAll('[data-grammar-speech]').forEach(button=>button.onclick=()=>speakJapanese(decodeURIComponent(button.dataset.grammarSpeech)))}
function renderGrammarTeaching(){const itemIndex=grammarRun.lessonIndex;$('#grammarCounter').textContent=`Lesson ${itemIndex+1} of ${grammarLessons.length}`;$('#grammarContent').innerHTML=`<section class="grammar-teaching"><span class="eyebrow">Particle lesson ${itemIndex+1}</span><h2>${esc(grammarLesson.title)}</h2><p class="grammar-symbol" lang="ja">${esc(grammarLesson.japanese)}</p><p>${esc(grammarLesson.summary)}</p>${grammarLesson.examples.map(grammarExampleHTML).join('')}<button id="startGrammarQuestions" class="primary reveal">Test this lesson →</button></section>`;wireGrammarSpeech();$('#startGrammarQuestions').onclick=()=>{grammarQuestionIndex=0;renderGrammarQuestion()}}
function renderGrammarQuestion(){if(grammarQuestionIndex>=grammarRun.questions.length){finishGrammarLesson();return}const question=grammarRun.questions[grammarQuestionIndex];$('#grammarCounter').textContent=`Question ${grammarQuestionIndex+1}/${grammarRun.questions.length}`;$('#grammarContent').innerHTML=`<section class="grammar-question"><span class="eyebrow">${esc(grammarLesson.title)}</span><p class="grammar-question-sentence" lang="ja">${esc(question.sentence)}</p><h2>${esc(question.prompt)}</h2><div class="choices grammar-choices">${shuffle(question.choices).map(choice=>`<button class="choice" data-grammar-answer="${encodeURIComponent(choice)}">${esc(choice)}</button>`).join('')}</div><section id="grammarFeedback" class="game-feedback" hidden aria-live="polite"></section></section>`;document.querySelectorAll('[data-grammar-answer]').forEach(button=>button.onclick=()=>resolveGrammarAnswer(button,question))}
function resolveGrammarAnswer(button,question){if(grammarRun.answered)return;grammarRun.answered=true;const answer=decodeURIComponent(button.dataset.grammarAnswer),ok=answer===question.answer;if(ok)grammarRun.correct++;meta.grammarAnswers=Number(meta.grammarAnswers||0)+1;meta.grammarCorrect=Number(meta.grammarCorrect||0)+(ok?1:0);meta.totalAnswers=Number(meta.totalAnswers||0)+1;meta.totalCorrect=Number(meta.totalCorrect||0)+(ok?1:0);recordMeaningfulActivity('grammar');document.querySelectorAll('[data-grammar-answer]').forEach(choice=>{const value=decodeURIComponent(choice.dataset.grammarAnswer);choice.disabled=true;if(value===question.answer)choice.classList.add('correct')});button.classList.add(ok?'correct':'wrong');save();const feedback=$('#grammarFeedback');feedback.innerHTML=`<p class="game-result ${ok?'game-result-correct':'game-result-wrong'}">${ok?'Correct!':'Not quite — here is the distinction.'}</p><p>${esc(question.explanation)}</p><button id="grammarNext" class="primary reveal">${grammarQuestionIndex===grammarRun.questions.length-1?'See lesson result':'Next question →'}</button>`;feedback.hidden=false;$('#grammarNext').onclick=()=>{grammarRun.answered=false;grammarQuestionIndex++;renderGrammarQuestion()}}
function finishGrammarLesson(){const state=grammarState(grammarLesson.id),total=grammarRun.questions.length,score=Math.round(grammarRun.correct/Math.max(1,total)*100),passed=grammarRun.correct>=Math.ceil(total*.67);state.attempts++;state.best=Math.max(Number(state.best||0),score);if(passed)state.completed=Number(state.completed||0)+1;save();refreshPathUnlocks();$('#grammarCounter').textContent='Lesson result';$('#grammarContent').innerHTML=`<section class="grammar-result"><div>${passed?'⛩️':'🌱'}</div><span class="eyebrow">${passed?'Lesson complete':'Almost there'}</span><h2>${grammarRun.correct} of ${total} correct</h2><p>${passed?'The next particle lesson is now available.':'Review the distinction and answer at least two questions correctly to unlock the next lesson.'}</p><div><button id="grammarRetry" class="primary">${passed?'Practise again':'Review and retry'}</button><button id="grammarFinish">Back to particle path</button></div></section>`;$('#grammarRetry').onclick=()=>startGrammarLesson(grammarRun.lessonIndex);$('#grammarFinish').onclick=()=>{if(activityReturnScreen==='journey')returnToActivitySource('home');else openGrammarPath()}}

const JAPANESE_VOICE_PROFILES={neutral:{rate:.86,pitch:1},kai:{rate:1.02,pitch:.9,names:/keita|ichiro|kaito|takumi|naoki|daichi|haruto|male/i},boy:{rate:1.02,pitch:.9,names:/keita|ichiro|kaito|takumi|naoki|daichi|haruto|male/i},mia:{rate:1.01,pitch:1.18,names:/nanami|ayumi|haruka|sayaka|kyoko|female/i},girl:{rate:1.01,pitch:1.18,names:/nanami|ayumi|haruka|sayaka|kyoko|female/i},master:{rate:.78,pitch:.68,names:/keita|ichiro|kaito|takumi|naoki|daichi|haruto|male/i}};
function speakJapanese(text,onEnd,profile='neutral'){
 if(!text||!('speechSynthesis'in window)){toast('Japanese speech is not available in this browser');return}
 if(profile==='neutral'&&theatreScene&&$('#theatre')?.classList.contains('active'))profile=theatreScene.timeline.find(line=>line.line===text)?.speaker||profile;
 speechSynthesis.cancel();japaneseSpeech=new SpeechSynthesisUtterance(text);japaneseSpeech.lang='ja-JP';const voiceProfile=JAPANESE_VOICE_PROFILES[profile]||JAPANESE_VOICE_PROFILES.neutral,voices=speechSynthesis.getVoices().filter(item=>item.lang?.toLowerCase().startsWith('ja')),voice=voices.find(item=>voiceProfile.names?.test(item.name))||voices[0];japaneseSpeech.rate=voiceProfile.rate;japaneseSpeech.pitch=voiceProfile.pitch;if(voice)japaneseSpeech.voice=voice;if(onEnd)japaneseSpeech.onend=onEnd;speechSynthesis.speak(japaneseSpeech);
}
function speakConversation(lines){
 const queue=lines.filter(Boolean);let position=0;const nextLine=()=>{if(position>=queue.length)return;const line=queue[position++];if(typeof line==='string')speakJapanese(line,nextLine);else speakJapanese(line.text,nextLine,line.profile)};nextLine();
}
function renderConversationLibrary(){
 const completed=conversationCompletedCount();$('#conversationLibraryStats').innerHTML=`<article><strong>${completed}/${conversations.length}</strong><span>Conversations completed</span></article><article><strong>${conversations.reduce((sum,item)=>sum+item.turns.length,0)}</strong><span>Response decisions</span></article>`;
 $('#conversationGrid').innerHTML=conversations.map((item,itemIndex)=>{const state=conversationProgressFor(item.id),done=state.completed>0,unlocked=conversationUnlocked(itemIndex),previous=conversations[itemIndex-1],targets=conversationTargets(item),startedTargets=targets.filter(target=>progress[target.id]?.stage>=1).length,status=done?`✓ Complete · Best ${state.best}%`:unlocked?'Ready to talk':`🔒 Complete ${esc(previous.title)} to unlock`;return `<button class="conversation-card" data-conversation-id="${esc(item.id)}"${unlocked?'':' disabled aria-disabled="true"'}><img src="${conversationCharacterImage(item)}" alt="${esc(item.characterName)}"><span class="conversation-level">Level ${item.level} · ${item.turns.length} replies</span><strong>${esc(item.title)}</strong><small lang="ja">${esc(item.japaneseTitle)}</small><p>${esc(item.summary)}</p><i>${startedTargets}/${targets.length||item.turns.length} linked words started</i><b>${status}</b></button>`}).join('');
 document.querySelectorAll('#conversationGrid [data-conversation-id]:not([disabled])').forEach(button=>button.onclick=()=>startConversation(conversations.find(item=>item.id===button.dataset.conversationId)));
}
function openConversationLibrary(){conversation=null;$('#conversationLibrary').hidden=false;$('#conversationReader').hidden=true;renderConversationLibrary();show('conversation')}
function conversationOptions(item,turnIndex){
 const correct=item.turns[turnIndex],pool=item.turns.filter((_,index)=>index!==turnIndex).map(turn=>({text:turn.response,reading:turn.responseReading,meaning:turn.responseMeaning,correct:false}));
 return shuffle([{text:correct.response,reading:correct.responseReading,meaning:correct.responseMeaning,correct:true},...shuffle(pool).slice(0,2)]);
}
function startConversation(item){
 const itemIndex=conversations.findIndex(candidate=>candidate.id===item?.id);if(!item||itemIndex<0||!conversationUnlocked(itemIndex))return;
 conversation=item;conversationTurn=0;conversationAnswered=false;hintUsed=false;const state=conversationProgressFor(item.id);state.attempts++;state.updatedAt=Date.now();conversationRun={correct:0,total:0,hints:0,readingShown:false,choices:item.turns.map((_,turnIndex)=>conversationOptions(item,turnIndex))};save();$('#conversationLibrary').hidden=true;$('#conversationReader').hidden=false;show('conversation');renderConversationTurn();
}
function conversationDots(){return conversation.turns.map((_,turnIndex)=>`<i class="${turnIndex===conversationTurn?'active':turnIndex<conversationTurn?'done':''}">${turnIndex+1}</i>`).join('')}
function renderConversationTurn(){
 const turn=conversation.turns[conversationTurn],choices=conversationRun.choices[conversationTurn],state=conversationProgressFor(conversation.id);conversationAnswered=false;hintUsed=false;conversationRun.readingShown=false;startedAt=Date.now();state.lastTurn=Math.max(state.lastTurn,conversationTurn);save(false);$('#conversationTurnCounter').textContent=`Reply ${conversationTurn+1}/${conversation.turns.length}`;
 $('#conversationReaderContent').innerHTML=`<header class="conversation-heading"><img src="${conversationCharacterImage(conversation)}" alt="${esc(conversation.characterName)}"><div><span class="eyebrow">${esc(conversation.setting)} · Level ${conversation.level}</span><h2>${esc(conversation.title)}</h2><p lang="ja">${esc(conversation.japaneseTitle)}</p></div></header><div class="conversation-dots">${conversationDots()}</div><section class="conversation-exchange"><div class="conversation-speaker"><strong>${esc(conversation.characterName)}</strong><button id="conversationPromptAudio" class="audio">🔊 Hear Japanese</button></div><p class="conversation-line" lang="ja">${esc(turn.line)}</p><p id="conversationPromptReading" class="conversation-reading" hidden>${esc(turn.reading)}</p><button id="conversationReadingToggle" class="conversation-hint">Show readings</button><h3>Choose the most natural reply</h3><div class="choices conversation-choices">${choices.map((choice,choiceIndex)=>`<button class="choice" data-conversation-answer="${choiceIndex}"><span lang="ja">${esc(choice.text)}</span><small class="conversation-choice-reading" hidden>${esc(choice.reading)}</small></button>`).join('')}</div><section id="conversationFeedback" class="game-feedback conversation-feedback" hidden aria-live="polite"></section></section>`;
 $('#conversationPromptAudio').onclick=()=>speakJapanese(turn.line);$('#conversationReadingToggle').onclick=()=>{conversationRun.readingShown=!conversationRun.readingShown;if(conversationRun.readingShown&&!hintUsed){hintUsed=true;conversationRun.hints++}$('#conversationPromptReading').hidden=!conversationRun.readingShown;document.querySelectorAll('.conversation-choice-reading').forEach(reading=>reading.hidden=!conversationRun.readingShown);$('#conversationReadingToggle').textContent=conversationRun.readingShown?'Hide readings':'Show readings'};document.querySelectorAll('[data-conversation-answer]').forEach(button=>button.onclick=()=>resolveConversationAnswer(button,turn,choices));if(settings.autoAudio)speakJapanese(turn.line);
}
function recordConversationAnswer(turn,ok){
 const target=vocab.find(entry=>entry.word===turn.targetWord),introduced=target&&progress[target.id]?.stage>=1;if(introduced)grade(target,'sentence',ok?(hintUsed?2:3):1,ok,false);else{meta.totalAnswers++;if(ok)meta.totalCorrect++;recordMeaningfulActivity('conversation');save()}
}
function resolveConversationAnswer(button,turn,choices){
 if(conversationAnswered)return;conversationAnswered=true;const choice=choices[+button.dataset.conversationAnswer],ok=Boolean(choice?.correct),correctIndex=choices.findIndex(item=>item.correct);button.classList.add(ok?'correct':'wrong');document.querySelectorAll('[data-conversation-answer]').forEach((option,optionIndex)=>{if(optionIndex===correctIndex)option.classList.add('correct');option.disabled=true});conversationRun.total++;if(ok)conversationRun.correct++;recordConversationAnswer(turn,ok);const finalTurn=conversationTurn===conversation.turns.length-1,state=conversationProgressFor(conversation.id),score=Math.round(conversationRun.correct/conversationRun.total*100);if(finalTurn){state.completed=Number(state.completed||0)+1;state.best=Math.max(Number(state.best||0),score);state.completedAt=Date.now();state.updatedAt=Date.now();save();updateHome()}const feedback=$('#conversationFeedback');feedback.hidden=false;feedback.innerHTML=`<p class="game-result ${ok?'game-result-correct':'game-result-wrong'}">${ok?'Natural response — now explore how each sentence is built.':'That reply does not fit as well — compare it with the best response below.'}</p>${ok?'':sentenceGuideHtml(choice.text,choice.reading,choice.meaning,'Your selected response')}<div class="conversation-correct"><span>Best response</span><strong lang="ja">${esc(turn.response)}</strong><small>${esc(turn.responseReading)}</small><p>${esc(turn.responseMeaning)}</p></div><p class="conversation-explanation">${esc(turn.explanation)}</p><div class="conversation-breakdowns"><h3>Understand the complete exchange</h3>${sentenceGuideHtml(turn.line,turn.reading,turn.meaning,`${conversation.characterName} asked`)}${sentenceGuideHtml(turn.response,turn.responseReading,turn.responseMeaning,'Best response')}${sentenceGuideHtml(turn.reaction,turn.reactionReading,turn.reactionMeaning,`${conversation.characterName} replied`)}</div><div class="conversation-reaction"><img src="${conversationCharacterImage(conversation)}" alt=""><div><b>${esc(conversation.characterName)} replies</b><strong lang="ja">${esc(turn.reaction)}</strong><small>${esc(turn.reactionReading)}</small><p>${esc(turn.reactionMeaning)}</p></div></div><div class="conversation-audio-row"><button id="conversationAnswerAudio" class="audio">🔊 Best response</button><button id="conversationReactionAudio" class="audio">🔊 Character reply</button></div><button id="conversationNext" class="primary reveal">${finalTurn?'Conversation summary':'Continue conversation →'}</button>`;$('#conversationAnswerAudio').onclick=()=>speakJapanese(turn.response);$('#conversationReactionAudio').onclick=()=>speakJapanese(turn.reaction);$('#conversationNext').onclick=()=>{if(finalTurn)finishConversation();else{conversationTurn++;renderConversationTurn()}};speakJapanese(turn.reaction);feedback.scrollIntoView({behavior:'smooth',block:'nearest'});$('#conversationNext').focus({preventScroll:true});
}
function finishConversation(){
 const state=conversationProgressFor(conversation.id),score=Math.round(conversationRun.correct/conversationRun.total*100),targets=conversationTargets(conversation);$('#conversationTurnCounter').textContent='Complete';$('#conversationReaderContent').innerHTML=`<span class="eyebrow">Conversation complete · 会話完了</span><h2 class="conversation-summary-title">${esc(conversation.title)}</h2><div class="manga-summary-grid"><article><strong>${score}%</strong><span>This conversation</span></article><article><strong>${state.best}%</strong><span>Personal best</span></article><article><strong>${conversation.turns.length}</strong><span>Replies practised</span></article><article><strong>${conversationRun.hints}</strong><span>Reading hints</span></article></div><button id="conversationFullAudio" class="audio primary">🔊 Play the complete conversation</button><section class="conversation-transcript"><h3>Conversation transcript</h3>${conversation.turns.map(turn=>`<article><b>${esc(conversation.characterName)}</b><p lang="ja">${esc(turn.line)}</p><small>${esc(turn.meaning)}</small><b>You</b><p lang="ja">${esc(turn.response)}</p><small>${esc(turn.responseMeaning)}</small></article>`).join('')}</section><section class="conversation-glossary"><h3>Linked vocabulary</h3>${targets.length?targets.map(target=>`<button data-conversation-vocab-audio="${encodeURIComponent(target.wordAudio||'')}"><strong lang="ja">${esc(target.word)}</strong><span>${esc(target.reading)}</span><small>${esc(target.meaning)}</small></button>`).join(''):'<p class="muted">This conversation practises useful phrases beyond the current vocabulary catalogue.</p>'}</section><p class="battle-summary-note">${todayActivity().qualified?'Today’s streak is protected.':'Each reply counts toward protecting today’s streak.'}</p><button id="conversationReplay" class="primary reveal">Talk with ${esc(conversation.characterName)} again</button><button id="conversationDone" class="reveal">Choose another conversation</button>`;$('#conversationFullAudio').onclick=()=>speakConversation(conversation.turns.flatMap(turn=>[turn.line,turn.response,turn.reaction]));document.querySelectorAll('[data-conversation-vocab-audio]').forEach(button=>button.onclick=()=>{const audio=decodeURIComponent(button.dataset.conversationVocabAudio);if(audio)play(audio)});$('#conversationReplay').onclick=()=>startConversation(conversation);$('#conversationDone').onclick=openConversationLibrary;updateHome();
}

function theatreProgressFor(id){return meta.theatreProgress[id]||(meta.theatreProgress[id]={completed:0,best:0,attempts:0,updatedAt:0})}
function theatreCompletedCount(){return theatreScenes.filter(item=>Number(meta.theatreProgress?.[item.id]?.completed||0)>0).length}
function theatreUnlocked(itemIndex){return itemIndex===0||theatreScenes.slice(0,itemIndex).every(item=>Number(meta.theatreProgress?.[item.id]?.completed||0)>0)}
function theatreCharacter(scene,id){return scene.characters.find(character=>character.id===id)}
function theatreAsset(path){return `${path}?v=${APP_VERSION}`}
function clearTheatrePlayback(){theatreTimers.forEach(clearTimeout);theatreTimers=[];if('speechSynthesis'in window)speechSynthesis.cancel();theatrePlaybackStarted=0}
function theatrePreview(scene){return `<div class="theatre-card-preview" style="background-image:url('${esc(theatreAsset(scene.background))}')">${scene.characters.slice(0,2).map(character=>`<img src="${esc(theatreAsset(character.image))}" alt="">`).join('')}</div>`}
function renderTheatreLibrary(){
 clearTheatrePlayback();const completed=theatreCompletedCount(),questions=theatreScenes.reduce((sum,scene)=>sum+scene.questions.length,0);$('#theatreLibraryStats').innerHTML=`<article><strong>${completed}/${theatreScenes.length}</strong><span>Scenes completed</span></article><article><strong>${questions}</strong><span>Questions in rotation</span></article>`;
 $('#theatreGrid').innerHTML=theatreScenes.map((scene,itemIndex)=>{const state=theatreProgressFor(scene.id),unlocked=theatreUnlocked(itemIndex),previous=theatreScenes[itemIndex-1],status=state.completed?`✓ Complete · Best ${state.best}%`:unlocked?'Ready to watch':`🔒 Complete ${esc(previous.title)} to unlock`;return `<button class="theatre-card" data-theatre-id="${esc(scene.id)}"${unlocked?'':' disabled aria-disabled="true"'}>${theatrePreview(scene)}<span class="theatre-card-level">Level ${scene.level} · ${scene.duration} seconds</span><strong>${esc(scene.title)}</strong><small lang="ja">${esc(scene.japaneseTitle)}</small><p>${esc(scene.summary)}</p><b>${status}</b></button>`}).join('');
 document.querySelectorAll('#theatreGrid [data-theatre-id]:not([disabled])').forEach(button=>button.onclick=()=>startTheatreScene(theatreScenes.find(scene=>scene.id===button.dataset.theatreId)));
}
function openTheatreLibrary(){theatreScene=null;theatreRun=null;clearTheatrePlayback();$('#theatreLibrary').hidden=false;$('#theatreReader').hidden=true;renderTheatreLibrary();show('theatre')}
function theatreStageHtml(scene,subtitles=false){return `<header class="theatre-heading"><div><span class="eyebrow">${esc(scene.setting)} · Level ${scene.level}</span><h2>${esc(scene.title)}</h2><p lang="ja">${esc(scene.japaneseTitle)}</p></div><span>${scene.duration}-second scene</span></header><div id="theatreStage" class="theatre-stage" style="background-image:url('${esc(theatreAsset(scene.background))}')"><div class="theatre-progress"><i id="theatrePlaybackFill"></i></div><div class="theatre-prop" aria-hidden="true">${esc(scene.prop||'')}</div>${scene.characters.map(character=>`<div class="theatre-character ${esc(character.side)}" data-theatre-character="${esc(character.id)}"><img class="theatre-sprite" src="${esc(theatreAsset(character.image))}" alt="${esc(character.name)}"><span class="theatre-voice-waves" aria-hidden="true"><i></i><i></i><i></i></span></div>`).join('')}<div id="theatreSubtitle" class="theatre-subtitle"${subtitles?'':' hidden'}></div><div id="theatreSpeaker" class="theatre-speaker">Listen carefully…</div></div><p class="theatre-listening-note">${subtitles?'Replay with the Japanese transcript visible.':'Listening challenge: subtitles stay hidden until after the questions.'}</p>`}
function startTheatreScene(scene){
 const itemIndex=theatreScenes.findIndex(item=>item.id===scene?.id);if(!scene||itemIndex<0||!theatreUnlocked(itemIndex))return;theatreScene=scene;const state=theatreProgressFor(scene.id);state.attempts++;state.updatedAt=Date.now();theatreRun={questions:shuffle(scene.questions).slice(0,2).map(question=>({...question,choices:shuffle(question.choices)})),questionIndex:0,correct:0,total:0,answered:false};save();$('#theatreLibrary').hidden=true;$('#theatreReader').hidden=false;$('#theatreCounter').textContent='Watch first';show('theatre');playTheatreScene(false,'questions');
}
function playTheatreScene(subtitles=false,returnView='questions'){
 if(!theatreScene)return;clearTheatrePlayback();const content=$('#theatreReaderContent');content.innerHTML=theatreStageHtml(theatreScene,subtitles);$('#theatreCounter').textContent=subtitles?'Transcript replay':'Listening first';theatrePlaybackStarted=Date.now();
 const fill=$('#theatrePlaybackFill'),speaker=$('#theatreSpeaker'),subtitle=$('#theatreSubtitle');const progressTimer=setInterval(()=>{const elapsed=(Date.now()-theatrePlaybackStarted)/1000;if(fill)fill.style.width=`${Math.min(100,elapsed/theatreScene.duration*100)}%`},120);theatreTimers.push(progressTimer);
 theatreScene.timeline.forEach(line=>{theatreTimers.push(setTimeout(()=>{document.querySelectorAll('[data-theatre-character]').forEach(sprite=>sprite.classList.remove('speaking','wave','point','offer','look','talk'));const sprite=document.querySelector(`[data-theatre-character="${line.speaker}"]`),character=theatreCharacter(theatreScene,line.speaker);sprite?.classList.add('speaking',line.action||'talk');if(speaker)speaker.textContent=`${character?.name||line.speaker} is speaking`;if(subtitle){subtitle.hidden=false;subtitle.innerHTML=`<span lang="ja">${esc(line.line)}</span><small>${esc(line.reading)}</small>`}speakJapanese(line.line,null,line.speaker)},line.at*1000))});
 theatreTimers.push(setTimeout(()=>{clearInterval(progressTimer);if(fill)fill.style.width='100%';document.querySelectorAll('[data-theatre-character]').forEach(sprite=>sprite.classList.remove('speaking','wave','point','offer','look','talk'));if(speaker)speaker.textContent='Scene complete';theatrePlaybackStarted=0;theatreTimers=[];setTimeout(()=>returnView==='summary'?renderTheatreSummary():renderTheatreQuestion(),500)},theatreScene.duration*1000));
}
function renderTheatreQuestion(){
 if(!theatreScene||!theatreRun)return;const question=theatreRun.questions[theatreRun.questionIndex];theatreRun.answered=false;$('#theatreCounter').textContent=`Question ${theatreRun.questionIndex+1}/${theatreRun.questions.length}`;$('#theatreReaderContent').innerHTML=`${theatreStageHtml(theatreScene,false)}<div class="theatre-controls"><button id="theatreReplayQuestion" class="audio">🔊 Replay the scene</button></div><section class="theatre-question"><span class="theatre-question-progress">Question ${theatreRun.questionIndex+1} of ${theatreRun.questions.length} · randomly selected</span><h3>${esc(question.prompt)}</h3><div class="choices">${question.choices.map(choice=>`<button class="choice" data-theatre-answer="${encodeURIComponent(choice)}">${esc(choice)}</button>`).join('')}</div><div id="theatreFeedback" class="theatre-feedback" hidden aria-live="polite"></div></section>`;$('#theatreReplayQuestion').onclick=()=>playTheatreScene(false,'questions');document.querySelectorAll('[data-theatre-answer]').forEach(button=>button.onclick=()=>resolveTheatreAnswer(button,question));
}
function resolveTheatreAnswer(button,question){
 if(theatreRun.answered)return;theatreRun.answered=true;const answer=decodeURIComponent(button.dataset.theatreAnswer),ok=answer===question.answer;button.classList.add(ok?'correct':'wrong');document.querySelectorAll('[data-theatre-answer]').forEach(choice=>{if(decodeURIComponent(choice.dataset.theatreAnswer)===question.answer)choice.classList.add('correct');choice.disabled=true});theatreRun.total++;if(ok)theatreRun.correct++;meta.totalAnswers++;if(ok)meta.totalCorrect++;recordMeaningfulActivity('theatre');save();const final=theatreRun.questionIndex===theatreRun.questions.length-1,feedback=$('#theatreFeedback');feedback.hidden=false;feedback.innerHTML=`<p class="game-result ${ok?'game-result-correct':'game-result-wrong'}">${ok?'Correct — you understood the scene.':'Not quite — the correct answer is highlighted.'}</p><p>${esc(question.explanation)}</p><button id="theatreNext" class="primary">${final?'Explore the conversation':'Next question →'}</button>`;$('#theatreNext').onclick=()=>{if(final){const state=theatreProgressFor(theatreScene.id),score=Math.round(theatreRun.correct/theatreRun.total*100);state.completed=Number(state.completed||0)+1;state.best=Math.max(Number(state.best||0),score);state.completedAt=Date.now();state.updatedAt=Date.now();save();updateHome();renderTheatreSummary()}else{theatreRun.questionIndex++;renderTheatreQuestion()}};feedback.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function renderTheatreSummary(){
 if(!theatreScene||!theatreRun)return;clearTheatrePlayback();const state=theatreProgressFor(theatreScene.id),score=Math.round(theatreRun.correct/Math.max(1,theatreRun.total)*100);$('#theatreCounter').textContent='Complete';$('#theatreReaderContent').innerHTML=`<section class="theatre-summary"><span class="eyebrow">Scene complete · 会話を理解しよう</span><h2>${esc(theatreScene.title)}</h2><div class="theatre-score"><article><strong>${score}%</strong><span>This performance</span></article><article><strong>${state.best}%</strong><span>Personal best</span></article><article><strong>${theatreScene.timeline.length}</strong><span>Lines explored</span></article></div><div class="theatre-replay-row"><button id="theatreReplayJapanese" class="audio primary">▶ Replay with Japanese subtitles</button><button id="theatreFullAudio" class="audio">🔊 Play dialogue only</button></div><section class="theatre-transcript"><h3>Understand the complete conversation</h3>${theatreScene.timeline.map((line,lineIndex)=>{const character=theatreCharacter(theatreScene,line.speaker);return `<article class="theatre-line"><div class="theatre-line-top"><strong>${esc(character?.name||line.speaker)}</strong><button class="audio" data-theatre-line="${lineIndex}">🔊 Hear line</button></div><p lang="ja">${esc(line.line)}</p><small>${esc(line.reading)}</small>${sentenceGuideHtml(line.line,line.reading,line.meaning,`${character?.name||line.speaker} says`)}</article>`}).join('')}</section><p class="battle-summary-note">${todayActivity().qualified?'Today’s streak is protected.':'Each comprehension answer helps protect today’s streak.'}</p><button id="theatreAgain" class="primary reveal">Watch this scene again</button><button id="theatreDone" class="reveal">Choose another scene</button></section>`;$('#theatreReplayJapanese').onclick=()=>playTheatreScene(true,'summary');$('#theatreFullAudio').onclick=()=>speakConversation(theatreScene.timeline.map(line=>line.line));document.querySelectorAll('[data-theatre-line]').forEach(button=>button.onclick=()=>speakJapanese(theatreScene.timeline[+button.dataset.theatreLine].line));$('#theatreAgain').onclick=()=>startTheatreScene(theatreScene);$('#theatreDone').onclick=openTheatreLibrary;
}
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
function memorySupport(v,force=false){const p=progress[v.id],faded=!force&&p&&Number(p.reps||0)>=4&&Number(p.interval||0)>=7;if(faded)return'<p class="memory-faded">Memory image faded — recall this word directly. Use “Show memory hint” if you need the scaffold again.</p>';const scene=memoryScene(v);return scene||`${mnemonicVisual(v)}<div class="mnemonic"><b>Memory link</b><p>${mnemonic(v)}</p><button id="editMnemonic">Edit mnemonic</button></div>`}
function wireMemoryEditor(v){const b=$('#editMnemonic');if(b)b.onclick=()=>editMnemonic(v)}
function renderCurrentUnsafe(){
 if(index>=session.length){finishSession();return}
 current=session[index];
 const game=(current.skill==='picture'&&pictureGameActive)||karutaActive||battleActive;
 $('#exitBtn').textContent=game?'← Game menu':'← Exit';
 $('#sessionCounter').setAttribute('aria-label',game?'Game progress':'Study progress');revealed=false;hintUsed=false;startedAt=Date.now();const {v,skill}=current;$('#sessionCounter').textContent=`${index+1}/${session.length}`;$('#progressFill').style.width=`${index/session.length*100}%`;const c=$('#card');
if(current.battle){renderBattleQuestion(v);return}
if(current.karuta){renderKarutaQuestion(v);return}
if(skill==='intro'){const hasKanji=kanjiCharacters(v).length>0&&v.word!==v.reading;c.innerHTML=`<div class="eyebrow">Meet the word</div><section class="meet-word-identity"><div class="meet-word-written"><span>${hasKanji?'Kanji / written word':'Japanese word'}</span><div class="jp">${v.word}</div><button id="introAudio" class="audio meet-word-speaker" aria-label="Play Japanese word" title="Play Japanese word">🔊</button></div><div class="meet-word-reading"><span>Reading</span><div class="reading">${v.reading}</div></div><div class="meet-word-meaning"><span>Meaning</span><div class="meaning">${v.meaning}</div></div></section>${visual(v)}${memorySupport(v,true)}<aside class="meet-word-guidance"><strong>How to learn this word</strong><ol><li>Tap the speaker and say the Japanese word aloud.</li><li>Connect the mnemonic picture and sound clue to the meaning.</li><li>Picture the story, then try to recall the word once before continuing.</li></ol></aside><button id="continueBtn" class="primary reveal">I have linked the word and meaning →</button>`;if(settings.autoAudio)play(v.wordAudio);$('#introAudio').onclick=()=>play(v.wordAudio);$('#continueBtn').onclick=next;wireMemoryEditor(v);return}
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
  if(current?.v&&!pictureGameActive&&!karutaActive&&!battleActive){const step=masteryStepFor(current.v),banner=document.createElement('aside');banner.className='word-mastery-next';banner.innerHTML=`<span>Per-word journey</span><b>Next: ${esc(step.label)}</b><small>${esc(step.reason)}</small>`;$('#card')?.prepend(banner)}
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
function grade(v,skill,rating,correct,advance=true){const p=pFor(v.id),sp=p.skills[skill];const response=(Date.now()-startedAt)/1000;sp.attempts++;if(correct)sp.correct++;const quality=rating/4*(hintUsed?.72:1)*(response>15?.9:1);sp.strength=Math.max(0,Math.min(1,sp.strength*.75+quality*.25));meta.totalAnswers++;if(correct)meta.totalCorrect++;p.reps++;if(rating===1){p.lapses++;p.interval=0;p.stage=1;p.due=Date.now()+10*60*1000;p.ease=Math.max(1.3,p.ease-.2)}else if(p.stage<2){p.stage=2;p.interval=rating===2?1:rating===3?2:4;p.due=Date.now()+p.interval*86400000}else{const mult=rating===2?1.2:rating===3?p.ease:p.ease*1.35;p.interval=Math.max(1,Math.round(Math.max(1,p.interval)*mult));p.ease=Math.max(1.3,p.ease+(rating===2?-.15:rating===4?.15:0));p.due=Date.now()+p.interval*86400000}recordMeaningfulActivity(battleActive?'battle':karutaActive?'karuta':pictureGameActive?'game':mangaStory&&$('#manga').classList.contains('active')?'manga':'vocabulary');save();if(advance)next()}
function next(){index++;renderCurrent()}
function finishSession(){if(battleActive){showBattleSummary();return}if(karutaActive){showKarutaSummary();return}if(pictureGameActive){abortSession('games');toast('Game complete 🎉');return}save();updateHome();returnToActivitySource('home');toast(todayActivity().qualified?'Session complete — streak protected 🎉':'Session complete — keep going to protect your streak')}
function editMnemonic(v){const p=pFor(v.id);const text=prompt('Edit your personal mnemonic:',p.mnemonic||mnemonic(v));if(text!==null){p.mnemonic=text.trim();save();renderCurrent()}}

function componentWords(record,introducedOnly=true){return vocab.filter(word=>kanjiCharacters(word).includes(record.kanji)&&(!introducedOnly||wordIntroduced(word)))}
function availableComponentRecords(introducedOnly=true){return (componentData.kanji||[]).map(record=>({...record,words:componentWords(record,introducedOnly)})).filter(record=>record.words.length)}
function renderKanjiBuilderHome(){
 const targetSet=new Set(kanjiBuilderTargetIds),available=availableComponentRecords(true).filter(record=>!targetSet.size||record.words.some(word=>targetSet.has(word.id))),all=availableComponentRecords(false),tested=all.filter(record=>record.words.some(word=>Number(progress[word.id]?.skills?.components?.attempts||0)>0)).length;
 $('#kanjiBuilderHome').hidden=false;$('#kanjiBuilderPlay').hidden=true;
 $('#kanjiBuilderStats').innerHTML=`<article><strong>${available.length}</strong><span>Introduced lessons</span></article><article><strong>${tested}</strong><span>Kanji tested</span></article><article><strong>${all.length}</strong><span>Curated lessons</span></article><article><strong>${kanjiCatalogue().length}</strong><span>Deck Kanji</span></article>`;
 const start=$('#startKanjiBuilder');start.disabled=available.length<2;start.textContent=available.length<2?'Introduce 2 supported Kanji first':'Start Kanji Builder';
 const library=$('#kanjiComponentLibrary');library.hidden=true;library.innerHTML=available.map((record,itemIndex)=>`<article class="kanji-library-item"><button data-component-lesson="${itemIndex}" aria-expanded="false"><span lang="ja">${esc(record.kanji)}</span><div><strong>${esc(record.words[0]?.meaning||'Kanji lesson')}</strong><small>${record.parts.length} visual components · ${record.words.length} introduced word${record.words.length===1?'':'s'}</small></div><i>Break apart ↓</i></button><div class="kanji-library-breakdown" hidden>${componentBreakdownHTML(record,{compact:true})}<div class="kanji-library-words">${record.words.slice(0,5).map(word=>`<span lang="ja">${esc(word.word)} <small>${esc(word.reading)} · ${esc(word.meaning)}</small></span>`).join('')}</div></div></article>`).join('');
 library.querySelectorAll('[data-component-lesson]').forEach(button=>button.onclick=()=>{const detail=button.nextElementSibling,open=detail.hidden;detail.hidden=!open;button.setAttribute('aria-expanded',String(open));button.querySelector('i').textContent=open?'Put together ↑':'Break apart ↓';if(open)detail.scrollIntoView({behavior:'smooth',block:'nearest'})});
}
function openKanjiBuilder(targetIds=[]){kanjiBuilderReturn=$('.screen.active')?.id==='kanjiOverview'?'kanjiOverview':'games';kanjiBuilderTargetIds=Array.isArray(targetIds)?targetIds:[];kanjiBuilder=null;renderKanjiBuilderHome();show('kanjiBuilder')}
function closeKanjiBuilder(){kanjiBuilder=null;kanjiBuilderTargetIds=[];if(kanjiBuilderReturn==='kanjiOverview'){renderKanjiOverview();show('kanjiOverview');return}returnToActivitySource('games')}
function builderTargetWord(record){return [...record.words].sort((a,b)=>(progress[a.id]?.skills?.components?.strength||0)-(progress[b.id]?.skills?.components?.strength||0)||wordPracticeCount(progress[a.id])-wordPracticeCount(progress[b.id]))[0]}
function startKanjiBuilder(){
 const targetSet=new Set(kanjiBuilderTargetIds),records=shuffle(availableComponentRecords(true).filter(record=>!targetSet.size||record.words.some(word=>targetSet.has(word.id))));if(records.length<2){toast('Introduce at least two Kanji with component lessons first');return}
 const rounds=records.slice(0,Math.min(10,records.length)).map(record=>({record,word:builderTargetWord(record)}));
 kanjiBuilder={rounds,index:0,correct:0,selected:[],answered:false};$('#kanjiBuilderHome').hidden=true;$('#kanjiBuilderPlay').hidden=false;renderKanjiBuilderRound();
}
function builderOptionParts(record){const required=[...new Set(record.parts)],pool=shuffle(Object.keys(componentData.components||{}).filter(part=>!required.includes(part)));return shuffle([...required,...pool.slice(0,Math.max(0,5-required.length))]).slice(0,Math.max(5,required.length))}
function builderStageHTML(record){const selected=kanjiBuilder.selected,slots=Array.from({length:record.parts.length},(_,itemIndex)=>selected[itemIndex]?`<button data-builder-remove="${itemIndex}" class="filled" lang="ja" aria-label="Remove ${esc(selected[itemIndex])}">${esc(selected[itemIndex])}</button>`:`<span aria-label="Empty component slot">?</span>`).join('<i>+</i>');return `<div class="kanji-assembly layout-${esc(record.layout)}">${slots}</div>`}
function updateBuilderSelection(){
 const target=kanjiBuilder.rounds[kanjiBuilder.index],record=target.record,stage=$('#kanjiAssemblyStage');if(!stage)return;stage.innerHTML=builderStageHTML(record);stage.querySelectorAll('[data-builder-remove]').forEach(button=>button.onclick=()=>{if(kanjiBuilder.answered)return;kanjiBuilder.selected.splice(+button.dataset.builderRemove,1);updateBuilderSelection()});
 const counts=kanjiBuilder.selected.reduce((map,part)=>(map[part]=(map[part]||0)+1,map),{});document.querySelectorAll('[data-builder-part]').forEach(button=>{const used=counts[decodeURIComponent(button.dataset.builderPart)]||0;button.querySelector('small').textContent=used?`selected ×${used}`:'tap to add'});$('#lockKanji').disabled=kanjiBuilder.selected.length!==record.parts.length;
}
function renderKanjiBuilderRound(){
 const target=kanjiBuilder.rounds[kanjiBuilder.index],record=target.record,word=target.word,options=builderOptionParts(record),wordKanji=kanjiCharacters(word),position=wordKanji.indexOf(record.kanji),positionNames=['first','second','third','fourth'],focus=wordKanji.length>1?`Build the ${positionNames[position]||`${position+1}th`} Kanji used in this word`:'Build the Kanji used in this word';kanjiBuilder.selected=[];kanjiBuilder.answered=false;startedAt=Date.now();hintUsed=false;
 $('#kanjiBuilderCounter').textContent=`${kanjiBuilder.index+1} / ${kanjiBuilder.rounds.length}`;$('#kanjiBuilderFill').style.width=`${kanjiBuilder.index/kanjiBuilder.rounds.length*100}%`;$('#kanjiBuilderScore').textContent=`${kanjiBuilder.correct} correct`;
 $('#kanjiBuilderCard').innerHTML=`<section class="kanji-builder-question"><span class="eyebrow">${esc(focus)}</span><h2>${esc(word.meaning)}</h2><p class="kanji-builder-reading">Reading: <strong>${esc(word.reading)}</strong></p>${word.wordAudio?'<button id="builderAudio" class="audio primary">🔊 Hear the Japanese word</button>':''}<p>Select ${record.parts.length} component${record.parts.length===1?'':'s'} in the lesson’s visual order.</p><div id="kanjiAssemblyStage">${builderStageHTML(record)}</div><div class="kanji-component-options">${options.map(part=>`<button data-builder-part="${encodeURIComponent(part)}"><span lang="ja">${esc(part)}</span><b>${esc(componentInfo(part).name)}</b><small>tap to add</small></button>`).join('')}</div><button id="lockKanji" class="primary kanji-lock" disabled>Lock in Kanji</button><section id="kanjiBuilderFeedback" class="game-feedback" hidden aria-live="polite"></section></section>`;
 if($('#builderAudio')){$('#builderAudio').onclick=()=>play(word.wordAudio);play(word.wordAudio)}
 document.querySelectorAll('[data-builder-part]').forEach(button=>button.onclick=()=>{if(kanjiBuilder.answered||kanjiBuilder.selected.length>=record.parts.length)return;kanjiBuilder.selected.push(decodeURIComponent(button.dataset.builderPart));updateBuilderSelection()});$('#lockKanji').onclick=resolveKanjiBuilder;updateBuilderSelection();
}
function resolveKanjiBuilder(){
 if(!kanjiBuilder||kanjiBuilder.answered)return;const target=kanjiBuilder.rounds[kanjiBuilder.index],record=target.record,word=target.word,ok=record.parts.every((part,itemIndex)=>kanjiBuilder.selected[itemIndex]===part);kanjiBuilder.answered=true;if(ok)kanjiBuilder.correct++;grade(word,'components',ok?3:1,ok,false);
 document.querySelectorAll('[data-builder-part], [data-builder-remove]').forEach(button=>button.disabled=true);$('#lockKanji').disabled=true;const feedback=$('#kanjiBuilderFeedback'),parts=record.parts.map(part=>{const info=componentInfo(part);return `<li><b lang="ja">${esc(part)}</b><span>${esc(info.name)}${info.source?` — component form of ${esc(info.source)}`:''}</span></li>`}).join('');
 feedback.innerHTML=`<p class="game-result ${ok?'game-result-correct':'game-result-wrong'}">${ok?'Correct — the components fit!':'Not quite — compare the correct writing order.'}</p><div class="kanji-builder-reveal"><div class="kanji-final" lang="ja">${esc(record.kanji)}</div><div><strong lang="ja">${esc(word.word)}</strong><span>${esc(word.reading)} · ${esc(word.meaning)}</span></div></div><ol class="kanji-explanation-list">${parts}</ol><p class="kanji-component-story">${esc(record.story)}</p>${word.wordAudio?'<button id="builderAnswerAudio" class="audio">🔊 Play Japanese audio</button>':''}<button id="builderNext" class="primary reveal">${kanjiBuilder.index===kanjiBuilder.rounds.length-1?'See workshop summary':'Next Kanji →'}</button>`;feedback.hidden=false;if($('#builderAnswerAudio'))$('#builderAnswerAudio').onclick=()=>play(word.wordAudio);$('#builderNext').onclick=nextKanjiBuilder;feedback.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function nextKanjiBuilder(){kanjiBuilder.index++;if(kanjiBuilder.index<kanjiBuilder.rounds.length){renderKanjiBuilderRound();return}showKanjiBuilderSummary()}
function showKanjiBuilderSummary(){const total=kanjiBuilder.rounds.length,correct=kanjiBuilder.correct,percent=Math.round(correct/Math.max(1,total)*100);$('#kanjiBuilderFill').style.width='100%';$('#kanjiBuilderCard').innerHTML=`<section class="kanji-builder-summary"><span class="eyebrow">Workshop complete</span><div class="kanji-summary-medal">${percent>=80?'🏆':percent>=50?'🧩':'🌱'}</div><h2>${correct} of ${total} Kanji built correctly</h2><p>${percent>=80?'Excellent component recognition.':percent>=50?'A strong start—another build will strengthen the shapes.':'Review the interactive breakdowns, then try again.'}</p><div class="kanji-builder-actions"><button id="builderAgain" class="primary">Build another set</button><button id="builderFinish">Finish</button></div></section>`;$('#builderAgain').onclick=startKanjiBuilder;$('#builderFinish').onclick=closeKanjiBuilder}

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
 else karuta.roundStarted=performance.now();
 document.querySelectorAll('.karuta-card').forEach(card=>card.disabled=false);
 play(v.wordAudio);
 const button=$('#karutaReplay');if(button)button.textContent=replay?'🔊 Playing again — timer continues':'🔊 Replay word';
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
 const total=karuta.correct+karuta.wrong,averageScore=total?karuta.score/total:0;meta.karutaBest=Math.max(Number(meta.karutaBest||0),karuta.score);meta.karutaSessions=Array.isArray(meta.karutaSessions)?meta.karutaSessions:[];meta.karutaSessions.push({at:Date.now(),averageScore,score:karuta.score,total,correct:karuta.correct});recentKarutaBestAverage();save();$('#sessionCounter').textContent='Complete';$('#progressFill').style.width='100%';
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
  [vocab,kanaData,mangaStories,conversations,theatreScenes,grammarLessons,componentData,memoryScenes]=await Promise.all([
   fetch(`data/vocabulary.json?v=${APP_VERSION}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('data');return r.json()}),
   fetch(`data/kana.json?v=${APP_VERSION}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('kana data');return r.json()}).then(data=>data.entries||[]),
   fetch(`data/manga-stories.json?v=${APP_VERSION}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('manga data');return r.json()}).then(data=>data.stories||[]),
   fetch(`data/conversations.json?v=${APP_VERSION}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('conversation data');return r.json()}).then(data=>data.conversations||[]),
   fetch(`data/theatre-scenes.json?v=${APP_VERSION}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('theatre data');return r.json()}).then(data=>data.scenes||[]),
   fetch(`data/grammar-path.json?v=${APP_VERSION}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('grammar data');return r.json()}).then(data=>data.lessons||[]),
   fetch(`data/kanji-components.json?v=${APP_VERSION}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Kanji component data');return r.json()}),
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
 const versionCard=$('.version-card');if(versionCard){versionCard.querySelector('strong').textContent='Kaishi Quest v6.6.0';versionCard.querySelector('span').textContent='Interactive Kanji Builder';versionCard.querySelector('small').textContent='Break familiar Kanji into checked visual components, rebuild them from meaning and sound, then review every piece before moving on.'}
 await setupServiceWorker();
 $('#updateBanner').hidden=true;
}
$('#studyBtn').onclick=()=>{abortSession('home');makeSession()};$('#kanaBtn').onclick=openKanaPath;$('#kanaBack').onclick=()=>show('home');$('#kanaLessonExit').onclick=openKanaPath;document.querySelectorAll('.kanaStart').forEach(button=>button.onclick=()=>startKanaStudy(button.dataset.script));$('#mangaBtn').onclick=openMangaLibrary;$('#mangaBack').onclick=()=>show('home');$('#mangaLibraryBack').onclick=openMangaLibrary;$('#gamesBtn').onclick=()=>abortSession('games');$('#communityBtn').onclick=()=>{show('community');window.KaishiCloud?.loadLeaderboard?.()};$('#communityBack').onclick=()=>show('home');$('#gamesBack').onclick=()=>abortSession('home');document.querySelectorAll('.gameMode').forEach(b=>b.onclick=()=>{settings.pictureDifficulty=+$('#pictureDifficulty').value||4;save();startPictureGame(b.dataset.mode)});$('#exitBtn').onclick=()=>abortSession(pictureGameActive?'games':'home');$('#settingsBtn').onclick=()=>show('settings');$('#settingsBack').onclick=()=>{settings.playMode=['journey','classic'].includes($('#playMode').value)?$('#playMode').value:'journey';settings.newLimit=Math.max(1,Math.min(20,+$('#newLimit').value||5));settings.sessionSize=Math.max(5,Math.min(50,+$('#sessionSize').value||15));settings.activeWords=Math.max(2,Math.min(4,+$('#activeWords').value||4));settings.pictureDifficulty=Math.max(2,Math.min(6,+$('#pictureDifficulty').value||4));settings.mnemonicStyle=$('#mnemonicStyle').value;settings.autoAudio=$('#autoAudio').checked;save();updateHome();show('home')};$('#checkUpdateBtn').onclick=()=>checkForUpdates(true);$('#applyUpdate').onclick=applyUpdate;$('#laterUpdate').onclick=()=>{$('#updateBanner').hidden=true};$('#exportBtn').onclick=exportProgress;$('#importInput').onchange=async e=>{try{const d=JSON.parse(await e.target.files[0].text());progress=d.progress||{};meta={...META_DEFAULTS,...(d.meta||{})};meta.kanaProgress=meta.kanaProgress||{};meta.grammarProgress=meta.grammarProgress||{};meta.mangaProgress=meta.mangaProgress||{};meta.conversationProgress=meta.conversationProgress||{};meta.theatreProgress=meta.theatreProgress||{};meta.pathUnlocks=Array.isArray(meta.pathUnlocks)?[...meta.pathUnlocks]:[];meta.pathVisits={...(meta.pathVisits||{})};meta.pathOverrides=Array.isArray(meta.pathOverrides)?[...meta.pathOverrides]:[];meta.chapterOverrides=Array.isArray(meta.chapterOverrides)?[...meta.chapterOverrides]:[];delete meta.dailyReviewPlan;settings={...defaults,...settings,...d.settings};save();updateHome();toast('Progress imported')}catch{toast('Invalid backup file')}};$('#resetBtn').onclick=()=>{if(confirm('Delete all learning progress?')){progress={};meta={...META_DEFAULTS,kanaProgress:{},grammarProgress:{},mangaProgress:{},conversationProgress:{},theatreProgress:{},pathUnlocks:[],pathVisits:{},pathOverrides:[],chapterOverrides:[]};save();updateHome();toast('Progress reset')}};
$('#dashboardAvatarButton').onclick=openCharacterSettings;
$('#kanjiOverviewBtn').onclick=()=>{if(settings.playMode!=='classic'&&!pathUnlocked('kanji')){toast('Reach the Kanji Gate to open this overview');return}renderKanjiOverview();show('kanjiOverview')};
$('#kanjiOverviewBack').onclick=()=>show('home');
$('#skillsBtn').onclick=()=>{renderSkillScores();show('skillsOverview')};
$('#skillsBack').onclick=()=>show('home');
$('#continueJourney').onclick=continueJourney;
$('#openPracticeHub').onclick=()=>openJourney('practice');
$('#journeyBack').onclick=()=>show('home');
$('#journeyCommunity').onclick=()=>{show('community');window.KaishiCloud?.loadLeaderboard?.()};
$('#journeySkills').onclick=()=>{renderSkillScores();show('skillsOverview')};
$('#conversationMode').onclick=openConversationLibrary;
$('#conversationBack').onclick=()=>show('games');
$('#conversationLibraryBack').onclick=openConversationLibrary;
$('#theatreMode').onclick=openTheatreLibrary;
$('#theatreBack').onclick=()=>{clearTheatrePlayback();show('games')};
$('#theatreLibraryBack').onclick=openTheatreLibrary;
$('#conversationContinue').onclick=()=>{const item=conversations.find(candidate=>candidate.id===$('#conversationContinue').dataset.conversationId);if(item)startConversation(item);else openConversationLibrary()};
$('#karutaMode').onclick=()=>{settings.pictureDifficulty=+$('#pictureDifficulty').value||4;save();startKarutaGame()};
$('#decayBattleMode').onclick=startDecayBattle;
$('#streakRescueMode').onclick=startStreakRescue;
$('#ownerPathGrid').onclick=event=>{const button=event.target.closest('[data-owner-path]');if(button)unlockOwnerPathThrough(+button.dataset.ownerPath)};
$('#ownerChapterGrid').onclick=event=>{const button=event.target.closest('[data-owner-chapter]');if(button)unlockOwnerChapterThrough(+button.dataset.ownerChapter)};
$('#ownerUnlockAll').onclick=()=>{unlockOwnerPathThrough(PATH_MILESTONES.length-1);unlockOwnerChapterThrough(wordChapterCount()-1)};
$('#ownerResetPath').onclick=()=>{if(!window.KaishiCloud?.isOwner?.())return;meta.pathOverrides=[];meta.chapterOverrides=[];save();renderOwnerPathControls(true);renderJourneyHome();toast('Journey test overrides reset')};
$('#studyBtn').onclick=()=>{activityReturnScreen='home';abortSession('home');makeSession()};
$('#kanaBtn').onclick=()=>{activityReturnScreen='home';openKanaPath()};
$('#mangaBtn').onclick=()=>{activityReturnScreen='home';openMangaLibrary()};
$('#communityBtn').onclick=()=>{activityReturnScreen='home';show('community');window.KaishiCloud?.loadLeaderboard?.()};
$('#kanjiOverviewBtn').onclick=()=>{activityReturnScreen='home';if(settings.playMode!=='classic'&&!pathUnlocked('kanji')){toast('Reach the Kanji Gate to open this overview');return}renderKanjiOverview();show('kanjiOverview')};
$('#skillsBtn').onclick=()=>{activityReturnScreen='home';renderSkillScores();show('skillsOverview')};
document.querySelectorAll('.gameMode').forEach(button=>button.onclick=()=>{activityReturnScreen='games';settings.pictureDifficulty=+$('#pictureDifficulty').value||4;save();startPictureGame(button.dataset.mode)});
$('#conversationMode').onclick=()=>{activityReturnScreen='games';openConversationLibrary()};
$('#grammarMode').onclick=()=>{activityReturnScreen='games';openGrammarPath()};
$('#theatreMode').onclick=()=>{activityReturnScreen='games';openTheatreLibrary()};
$('#karutaMode').onclick=()=>{activityReturnScreen='games';settings.pictureDifficulty=+$('#pictureDifficulty').value||4;save();startKarutaGame()};
$('#kanjiBuilderMode').onclick=()=>{activityReturnScreen='games';openKanjiBuilder()};
$('#decayBattleMode').onclick=()=>{activityReturnScreen='games';startDecayBattle()};
$('#streakRescueMode').onclick=()=>{activityReturnScreen='games';startStreakRescue()};
$('#conversationContinue').onclick=()=>{activityReturnScreen='home';const item=conversations.find(candidate=>candidate.id===$('#conversationContinue').dataset.conversationId);if(item)startConversation(item);else openConversationLibrary()};
$('#journeyCommunity').onclick=()=>{activityReturnScreen='journey';show('community');window.KaishiCloud?.loadLeaderboard?.()};
$('#journeySkills').onclick=()=>{activityReturnScreen='journey';renderSkillScores();show('skillsOverview')};
$('#journeyBack').onclick=()=>{activityReturnScreen='home';show('home')};
$('#kanaBack').onclick=()=>returnToActivitySource('home');
$('#mangaBack').onclick=()=>returnToActivitySource('home');
$('#theatreBack').onclick=()=>{clearTheatrePlayback();returnToActivitySource('games')};
$('#communityBack').onclick=()=>returnToActivitySource('home');
$('#kanjiOverviewBack').onclick=()=>returnToActivitySource('home');
$('#kanjiBuilderFromOverview').onclick=()=>openKanjiBuilder();
$('#kanjiBuilderBack').onclick=closeKanjiBuilder;
$('#startKanjiBuilder').onclick=startKanjiBuilder;
$('#browseKanjiComponents').onclick=()=>{const library=$('#kanjiComponentLibrary'),open=library.hidden;library.hidden=!open;$('#browseKanjiComponents').textContent=open?'Hide breakdowns':'Browse breakdowns';if(open)library.scrollIntoView({behavior:'smooth',block:'start'})};
$('#skillsBack').onclick=()=>returnToActivitySource('home');
$('#conversationBack').onclick=()=>returnToActivitySource('games');
$('#grammarBack').onclick=()=>returnToActivitySource('games');
$('#grammarLibraryBack').onclick=openGrammarPath;
$('#exitBtn').onclick=()=>exitActivitySession(pictureGameActive||karutaActive||battleActive?'games':'home');
$('#settingsBack').onclick=()=>{settings.playMode='journey';settings.newLimit=Math.max(1,Math.min(20,+$('#newLimit').value||5));settings.sessionSize=Math.max(5,Math.min(50,+$('#sessionSize').value||15));settings.activeWords=Math.max(2,Math.min(4,+$('#activeWords').value||4));settings.pictureDifficulty=Math.max(2,Math.min(6,+$('#pictureDifficulty').value||4));settings.mnemonicStyle=$('#mnemonicStyle').value;settings.autoAudio=$('#autoAudio').checked;save();updateHome();show('home')};
$('#journeyInvite').onclick=openInviteDialog;
$('#communityInvite').onclick=openInviteDialog;
$('#journeyShareProgress').onclick=openInviteDialog;
$('#shareNative').onclick=()=>{$('#shareDialog').close();nativeShareInvite()};
$('#shareCopy').onclick=()=>{copyInviteLink();$('#shareDialog').close()};
$('#shareAchievement').onclick=()=>{$('#shareDialog').close();shareAchievement()};
$('#shareClose').onclick=()=>$('#shareDialog').close();
$('#missionSummaryContinue').onclick=()=>{$('#missionSummaryDialog').close();openJourney()};
$('#missionSummaryShare').onclick=()=>{$('#missionSummaryDialog').close();openInviteDialog()};
init();
