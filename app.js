'use strict';
const $=s=>document.querySelector(s), screens=[...document.querySelectorAll('.screen')];
// APP_VERSION is defined once, in version.js, which loads before this file (see index.html).
const ADMIN_TEST_MODE_KEY='kq-admin-test-mode';
const ADMIN_TEST_ENTRY_KEY='kq-admin-test-entry';
const RESTORE_POINTS_LIMIT=3;
let appReady=false;
const isAdminTestMode=()=>{try{return sessionStorage.getItem(ADMIN_TEST_MODE_KEY)==='1'}catch{return false}};
const profileStorageKey=key=>isAdminTestMode()?key.replace(/^kq-/,'kq-admin-test-'):key;
const ADMIN_TEST_CHAPTER_KEY='kq-admin-test-chapter';
function adminTestChapterOverride(){
 if(!isAdminTestMode())return null;
 let raw;try{raw=sessionStorage.getItem(ADMIN_TEST_CHAPTER_KEY)}catch{return null}
 if(raw===null)return null;
 const n=Number(raw);
 if(!Number.isFinite(n)||n<0)return null;
 return Math.min(n,Math.max(0,wordChapterCount()-1));
}
function setAdminTestChapter(lessonNumber){
 if(!isAdminTestMode())return false;
 const index=Math.max(0,Math.min(wordChapterCount()-1,Math.round(Number(lessonNumber))-1));
 if(!Number.isFinite(index))return false;
 try{sessionStorage.setItem(ADMIN_TEST_CHAPTER_KEY,String(index))}catch{return false}
 clearMissionResume();
 return true;
}
function clearAdminTestChapter(){
 try{sessionStorage.removeItem(ADMIN_TEST_CHAPTER_KEY)}catch{}
 clearMissionResume();
}
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
let vocab=[], kanaData=[], mangaStories=[], conversations=[], theatreScenes=[], grammarLessons=[], componentData={components:{},kanji:[]}, ankiContent={records:[]}, topicData={topics:[]}, learningGraph={regions:[],topics:[],foundations:[],assignmentsByWord:{}}, session=[], index=0, current=null, revealed=false, startedAt=0, hintUsed=false, memoryScenes={};
let kanaSession=[], kanaIndex=0, kanaScript='', kanaAnswered=false;
let mangaStory=null, mangaPanelIndex=0, mangaAnswered=false, mangaQuestionAnswered=false, mangaRun=null, mangaComicEnglish=false;
let conversation=null, conversationTurn=0, conversationAnswered=false, conversationRun=null, japaneseSpeech=null;
let theatreScene=null, theatreRun=null, theatreTimers=[], theatrePlaybackStarted=0, theatreMediaRecorder=null, theatreRecordingChunks=[], theatreRecordingUrl='';
let kanjiBuilder=null,kanjiBuilderReturn='games',kanjiBuilderTargetIds=[];
let grammarLesson=null,grammarQuestionIndex=0,grammarRun=null;
let waitingWorker=null, latestVersionInfo=null, pictureGameActive=false, karutaActive=false, karuta=null, battleActive=false, battle=null;
let activityReturnScreen='home';
let activeLessonImmersive=null;
let pendingSessionRecord=null;
let redoingHistoryId=null;
let activeVocabularyChapter=null;
let activeJourneyMission=null,activeQuickStep=false,activeFirstLesson=false;
let introGuidanceCount=0;
const MISSION_CARD_LIMIT=15,NEW_WORDS_PER_MISSION=3,DAILY_REVIEW_TARGET=6,ACTIVE_WORD_MIX=3,CHECKPOINT_INTERVAL=5;
const defaults={sessionSize:10,pictureDifficulty:4,mnemonicStyle:'clear',autoAudio:true,learningBalance:0,learningBalanceAdaptive:true};
let settings={...defaults,...loadJSON(profileStorageKey('kq-settings'),{})};
settings.playMode='journey';
settings.learningBalance=Math.max(-2,Math.min(2,Math.round(Number(settings.learningBalance)||0)));
settings.learningBalanceAdaptive=settings.learningBalanceAdaptive!==false;
let progress=loadJSON(profileStorageKey('kq-progress'),{});
const META_DEFAULTS={lastStudy:'',streak:0,totalAnswers:0,totalCorrect:0,kanaAnswers:0,kanaCorrect:0,grammarAnswers:0,grammarCorrect:0,kanaProgress:{},grammarProgress:{},sentenceLabProgress:{lessons:{},saved:[],mistakes:[],totalAnswers:0,totalCorrect:0},mangaProgress:{},conversationProgress:{},theatreProgress:{},canDoAwards:[],pathUnlocks:[],pathVisits:{},pathOverrides:[],chapterOverrides:[],dailyJourneyRoute:null,dailyActivity:null,unlockNoticesSeen:[],unlockNoticesDismissed:[],activityPurchases:['vocabulary','kana','sentenceLab'],adventurePointsSpent:0,rhythm:{behind:0,lastChecked:'',quickWeek:'',quickUsed:0,cycles:0},activityModeLevels:{},karutaSessions:[],monsterVictories:[],totalMonsterVictories:0,streakRescue:null,activeCampaign:'journey',campaignProgress:{},sessionHistory:[],updatedAt:0};
const SESSION_HISTORY_LIMIT=200;
let meta={...META_DEFAULTS,...loadJSON(profileStorageKey('kq-meta'),{})};
meta.kanaProgress=meta.kanaProgress||{};
meta.grammarProgress=meta.grammarProgress||{};
meta.sentenceLabProgress={lessons:{},saved:[],mistakes:[],totalAnswers:0,totalCorrect:0,...(meta.sentenceLabProgress||{})};
meta.sentenceLabProgress.lessons=meta.sentenceLabProgress.lessons||{};meta.sentenceLabProgress.saved=Array.isArray(meta.sentenceLabProgress.saved)?meta.sentenceLabProgress.saved:[];meta.sentenceLabProgress.mistakes=Array.isArray(meta.sentenceLabProgress.mistakes)?meta.sentenceLabProgress.mistakes:[];
meta.mangaProgress=meta.mangaProgress||{};
meta.conversationProgress=meta.conversationProgress||{};
meta.theatreProgress=meta.theatreProgress||{};
meta.pathUnlocks=Array.isArray(meta.pathUnlocks)?[...meta.pathUnlocks]:[];
meta.pathVisits={...(meta.pathVisits||{})};
meta.pathOverrides=Array.isArray(meta.pathOverrides)?[...meta.pathOverrides]:[];
meta.chapterOverrides=Array.isArray(meta.chapterOverrides)?[...meta.chapterOverrides]:[];meta.unlockNoticesSeen=Array.isArray(meta.unlockNoticesSeen)?[...meta.unlockNoticesSeen]:[];meta.unlockNoticesDismissed=Array.isArray(meta.unlockNoticesDismissed)?[...meta.unlockNoticesDismissed]:[];meta.topicProgress=meta.topicProgress||{};
meta.activeCampaign=meta.activeCampaign||'journey';meta.campaignProgress=meta.campaignProgress||{};meta.activityPurchases=Array.isArray(meta.activityPurchases)?[...new Set(['vocabulary','kana','sentenceLab',...meta.activityPurchases])]:['vocabulary','kana','sentenceLab'];meta.activityModeLevels=meta.activityModeLevels||{};meta.adventurePointsSpent=Number(meta.adventurePointsSpent||0);const legacyRhythm=meta.rhythm||meta.garden||{};meta.rhythm={...META_DEFAULTS.rhythm,behind:Number(legacyRhythm.behind||0),lastChecked:String(legacyRhythm.lastChecked||''),quickWeek:String(legacyRhythm.quickWeek||''),quickUsed:Number(legacyRhythm.quickUsed||0),cycles:Number(legacyRhythm.cycles||0)};delete meta.garden;delete meta.gardenApSpent;
function loadJSON(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}
function serialiseMissionItem(item){return{wordId:item?.v?.id||'',skill:item?.skill||'',pictureMode:item?.pictureMode||'',bossTopicId:item?.bossTopicId||''}}
function saveMissionResume(){
 if(!session.length||index>=session.length||pictureGameActive||karutaActive||battleActive)return;
 const remaining=session.slice(index).map(serialiseMissionItem).filter(item=>item.wordId&&item.skill);
 localStorage.setItem(profileStorageKey('kq-resumable-mission'),JSON.stringify({version:2,date:day(),remaining,activityReturnScreen,activeJourneyMission,activeQuickStep,activeFirstLesson}));
}
function clearMissionResume(){localStorage.removeItem(profileStorageKey('kq-resumable-mission'))}
function resumableMission(){
 const saved=loadJSON(profileStorageKey('kq-resumable-mission'),null);
 if(!saved||saved.date!==day()||!Array.isArray(saved.remaining)||!saved.remaining.length)return null;
 const byId=new Map(vocab.map(word=>[word.id,word]));
 const restored=saved.remaining.map(item=>({v:byId.get(item.wordId),skill:item.skill,pictureMode:item.pictureMode||undefined,bossTopicId:item.bossTopicId||undefined})).filter(item=>item.v&&item.skill);
 return restored.length?{...saved,session:restored}:null;
}
function resumeSavedMission(){
 const saved=resumableMission();if(!saved)return false;
 session=saved.session;index=0;current=null;activityReturnScreen=saved.activityReturnScreen||'journey';activeJourneyMission=saved.activeJourneyMission||null;activeQuickStep=Boolean(saved.activeQuickStep);activeFirstLesson=Boolean(saved.activeFirstLesson);
 show('study');renderCurrent();toast('Mission resumed from your last save point');return true;
}
function kanaCharacters(text=''){return [...new Set([...String(text)].filter(ch=>/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(ch)))]}
function kanaKnown(character){const entry=kanaData.find(item=>item.kana===character);return !entry||Number(meta.kanaProgress?.[entry.id]?.stage||0)>0}
function unknownKanaFor(word){return kanaCharacters(word.reading||word.word).filter(ch=>!kanaKnown(ch))}
function ankiRecordFor(word){return word._anki||null}
function graphAssignmentFor(word){return learningGraph.assignmentsByWord?.[word.word]||null}
function topicForWord(word){const assignment=graphAssignmentFor(word);const id=assignment?.primaryTopicId||word.topicId;return learningGraph.topics?.find(topic=>topic.id===id)||topicData.topics?.find(topic=>topic.id===id)||{id:'abstract-society',title:'Ideas & Society',icon:'🗾',regionId:'communication'}}
function foundationFor(id){return learningGraph.foundations?.find(item=>item.id===id)}
function wordFoundationTags(word){return graphAssignmentFor(word)?.foundationTags||word.foundationTags||[]}
function journeyTopics(){const source=learningGraph.topics?.length?learningGraph.topics:topicData.topics||[];return source.map(topic=>({...topic,words:vocab.filter(word=>topicForWord(word).id===topic.id)})).filter(topic=>topic.words.length)}
function topicStats(topic){const words=topic.words||vocab.filter(word=>topicForWord(word).id===topic.id),introduced=words.filter(wordIntroduced).length,tested=words.filter(word=>wordPracticeCount(progress[word.id])>=2).length,mastered=words.filter(word=>mastery(progress[word.id])).length,target=Math.min(20,Math.max(5,words.length)),bossReady=isAdminTestMode()||introduced>=Math.min(target,words.length)&&tested>=Math.min(10,Math.ceil(words.length*.35)),complete=Boolean(meta.topicProgress?.[topic.id]?.bossPassed);return{words,introduced,tested,mastered,target,bossReady,complete,percent:words.length?Math.round((introduced/words.length*.55+tested/words.length*.3+mastered/words.length*.15)*100):0}}
function topicUnlocked(index){if(isAdminTestMode()||index===0)return true;const topics=journeyTopics();return Boolean(topicStats(topics[index-1]).complete||meta.topicProgress?.[topics[index]?.id]?.unlocked)}
function currentTopicIndex(){const topics=journeyTopics();for(let i=0;i<topics.length;i++){if(!topicUnlocked(i))return Math.max(0,i-1);if(!topicStats(topics[i]).complete)return i}return Math.max(0,topics.length-1)}
function currentTopic(){const lesson=chapterWords(currentWordChapterIndex()),first=lesson[0];return first?topicForWord(first):(journeyTopics()[currentTopicIndex()]||{id:'greetings-politeness',title:'Greetings & Politeness',icon:'👋',words:vocab})}
function topicWeakestSkill(topic){const skills=['meaning','listening','reading','picture','sentence','production','kanji'];let best={skill:'meaning',score:1};for(const skill of skills){let attempts=0,strength=0;topic.words.forEach(word=>{const metric=progress[word.id]?.skills?.[skill];if(metric?.attempts){attempts++;strength+=Number(metric.strength||0)}});const score=attempts?strength/attempts:0;if(score<best.score)best={skill,score}}return best.skill}
function topicSupportWords(topic,limit=4){const tags=[...new Set(topic.words.flatMap(wordFoundationTags))];return shuffle(vocab.filter(word=>wordIntroduced(word)&&wordFoundationTags(word).some(tag=>tags.includes(tag))&&!topic.words.includes(word))).slice(0,limit)}
function directActivitiesForWord(word){const activities=[];const p=pFor(word.id);if(word.wordAudio)activities.push('listening');if(word.exampleSentence||word._anki?.sentence)activities.push('reading');if(word.sentence||word.exampleSentence||word._anki?.sentence)activities.push('sentence');if(word.word!==word.reading)activities.push('production');if(memoryScenes[sceneKey(word)]?.file)activities.push('picture');return [...new Set(activities)];}
window.KaishiLessonActivities={directActivitiesForWord};
function startTopicSession(topicId=currentTopic().id){
 if(resumeSavedMission())return;
 const topic=journeyTopics().find(item=>item.id===topicId)||currentTopic();activityReturnScreen='journey';
 const due=topic.words.filter(word=>progress[word.id]&&Number(progress[word.id].due||0)<=Date.now()).sort((a,b)=>pFor(a.id).due-pFor(b.id).due).slice(0,DAILY_REVIEW_TARGET);
 const unseen=pickLinkedNewWords(topic.words,NEW_WORDS_PER_MISSION);
 const support=topicSupportWords(topic,2);
 const selected=[...new Map([...due,...unseen,...support].map(word=>[word.id,word])).values()];
 if(!selected.length){makeTargetedMasterySession(topic.words.slice(0,Math.min(MISSION_CARD_LIMIT,topic.words.length)).map(word=>word.id),topicWeakestSkill(topic));return}
 const queue=selected.map(v=>{const p=pFor(v.id),unknownKana=unknownKanaFor(v).slice(0,1);let skills=p.stage===0?[...(unknownKana.length?['kanaUnlock']:[]),'firstEncounter','intro',...(ankiRecordFor(v)?.sentence?['example']:[]),'meaning']:[chooseSkill(v)];skills=skills.filter(skill=>skill!=='picture'||memoryScenes[sceneKey(v)]);return{v,skills}});
 session=[];
 while(queue.some(item=>item.skills.length)&&session.length<MISSION_CARD_LIMIT){const active=queue.filter(item=>item.skills.length).slice(0,ACTIVE_WORD_MIX);active.forEach(item=>{if(item.skills.length&&session.length<MISSION_CARD_LIMIT)session.push({v:item.v,skill:item.skills.shift()})});queue.push(...queue.splice(0,Math.min(ACTIVE_WORD_MIX,queue.length)))}
 const bridge=sessionSentencePlan(selected);if(bridge){if(session.length>=MISSION_CARD_LIMIT)session.pop();session.push({v:bridge.target,skill:'sessionSentence',sentencePlan:bridge})}
 clearMissionResume();index=0;current=null;showJourneySessionPreview(`${topic.icon||'🗾'} ${topic.title}`)
}
function senseiRecommendation(topic){const stats=topicStats(topic),weak=topicWeakestSkill(topic),labels={meaning:'meaning recall',listening:'listening',reading:'reading',picture:'picture memory',sentence:'sentence understanding',production:'active recall',kanji:'written Japanese'};if(stats.bossReady&&!stats.complete)return`You are ready to challenge the ${topic.title} boss.`;if(stats.introduced<stats.target)return`Continue ${topic.title}. Foundational skills will return naturally when this topic needs them.`;return`Your weakest skill in ${topic.title} is ${labels[weak]||weak}. Let’s train it through a relevant game.`}
function achievementList(){const achievements=[];const learned=started(),masteredCount=Object.values(progress).filter(mastery).length;if(learned>=1)achievements.push(['🌱','First Word']);if(learned>=100)achievements.push(['🧠','100 Words']);if(masteredCount>=25)achievements.push(['⭐','25 Mastered']);if(Number(meta.streak||0)>=7)achievements.push(['🌿','7-Day Rhythm']);if(journeyTopics().some(topic=>topicStats(topic).complete))achievements.push(['🏆','First Topic Boss']);return achievements}
function enrichVocabularyFromAnki(){
 const byWord=new Map();(ankiContent.records||[]).forEach(record=>{if(record.word&&!byWord.has(record.word))byWord.set(record.word,record)});
 vocab.forEach((word,originalIndex)=>{const record=byWord.get(word.word),assignment=learningGraph.assignmentsByWord?.[word.word];word._originalOrder=originalIndex;if(record){word._anki=record;word.exampleSentence=record.sentence||'';word.exampleSentenceRomaji=record.sentenceRomaji||'';word.exampleSentenceMeaning=record.sentenceMeaning||''}if(assignment){word.topicId=assignment.primaryTopicId;word.secondaryTopicIds=assignment.secondaryTopicIds||[];word.foundationTags=assignment.foundationTags||[];word.topicOrder=assignment.topicOrder;word.contentOrder=assignment.contentOrder;const topic=learningGraph.topics?.find(item=>item.id===assignment.primaryTopicId);word.topic=topic?.title||word.topic}});
 vocab.sort((a,b)=>Number(topicForWord(a).regionOrder??999)-Number(topicForWord(b).regionOrder??999)||Number(a.topicOrder??999)-Number(b.topicOrder??999)||Number(a.contentOrder??999999)-Number(b.contentOrder??999999)||Number(a._originalOrder)-Number(b._originalOrder));
}
function senseiBlock(message,compact=true,pose='auto'){const lower=String(message).toLowerCase(),inferred=/not quite|mistake|try again|almost/.test(lower)?'encouraging':/complete|great work|excellent|mastered/.test(lower)?'celebrating':/first|welcome|meet this/.test(lower)?'welcoming':/notice|look|select|tap|use the/.test(lower)?'pointing':/review|compare|why|understand/.test(lower)?'analysing':'explaining',safePose=['welcoming','explaining','celebrating','encouraging','pointing','analysing'].includes(pose)?pose:inferred;return `<aside class="sensei-guide teacher-guide sensei-${safePose} ${compact?'compact':''}"><div class="sensei-avatar teacher-guide-avatar"><img src="media/guides/sensei/sensei-${safePose}.webp?v=${APP_VERSION}" alt="Sensei ${safePose}"></div><div><strong>Sensei’s guidance</strong><p>${esc(message)}</p></div></aside>`}
function markKanaIntroduced(character){const entry=kanaData.find(item=>item.kana===character);if(!entry)return;const state=kanaState(entry.id);state.stage=Math.max(1,Number(state.stage||0));state.due=Date.now();save(false)}
function save(sync=true){if(sync)meta.updatedAt=Date.now();localStorage.setItem(profileStorageKey('kq-progress'),JSON.stringify(progress));localStorage.setItem(profileStorageKey('kq-settings'),JSON.stringify(settings));localStorage.setItem(profileStorageKey('kq-meta'),JSON.stringify(meta));if(sync&&!isAdminTestMode())window.KaishiCloud?.scheduleSync?.()}
function cloneLocalState(value){return JSON.parse(JSON.stringify(value))}
function restorePointOwnerId(){const ownerId=window.KaishiCloud?.currentUserId?.();return typeof ownerId==='string'&&ownerId?ownerId:null}
function restorePointStorageKey(ownerId){return `kq-restore-points:${isAdminTestMode()?'test':'main'}:${encodeURIComponent(ownerId)}`}
function restorePoints(){const ownerId=restorePointOwnerId();if(!ownerId)return[];const points=loadJSON(restorePointStorageKey(ownerId),[]);return Array.isArray(points)?points.filter(point=>point&&point.ownerId===ownerId&&point.progress&&point.meta&&point.settings):[]}
function saveRestorePoints(points){const ownerId=restorePointOwnerId();if(!ownerId)return false;const ownedPoints=points.filter(point=>point?.ownerId===ownerId).slice(-RESTORE_POINTS_LIMIT);localStorage.setItem(restorePointStorageKey(ownerId),JSON.stringify(ownedPoints));return true}
function restorePointSummary(snapshot){const records=Object.values(snapshot.progress||{}),startedCount=records.filter(item=>Number(item?.stage||0)>=1||Object.values(item?.skills||{}).some(skill=>Number(skill?.attempts||0)>0)).length,masteredCount=records.filter(item=>Number(item?.interval||0)>=21).length;return{started:startedCount,mastered:masteredCount,answers:Number(snapshot.meta?.totalAnswers||0),streak:Number(snapshot.meta?.streak||0),lesson:Math.max(1,Math.ceil(startedCount/WORD_CHAPTER_SIZE))}}
function createRestorePoint(reason){const ownerId=restorePointOwnerId();if(!ownerId)return null;const point={id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,ownerId,takenAt:Date.now(),reason,progress:cloneLocalState(progress),meta:cloneLocalState(meta),settings:cloneLocalState(settings)};saveRestorePoints([...restorePoints(),point]);return point}
function resetLocalProgressState(){
 progress={};
 meta={...META_DEFAULTS,rhythm:{...META_DEFAULTS.rhythm},kanaProgress:{},grammarProgress:{},sentenceLabProgress:{lessons:{},saved:[],mistakes:[],totalAnswers:0,totalCorrect:0},mangaProgress:{},conversationProgress:{},theatreProgress:{},pathUnlocks:[],pathVisits:{},pathOverrides:[],chapterOverrides:[],sessionHistory:[]};
 // History is progress data, not a separate archive. Clear both its model and
 // any already-rendered view so a reset is immediately truthful everywhere.
 pendingSessionRecord=null;redoingHistoryId=null;clearMissionResume();
 $('#historyList')&&( $('#historyList').innerHTML='<p class="muted">Completed lessons will appear here after your next session.</p>' );
 $('#journeyHistoryTrack')&&( $('#journeyHistoryTrack').innerHTML='' );
 closeHistoryEntryDialog();
}
function applyRestorePoint(point){const ownerId=restorePointOwnerId();if(!ownerId||point?.ownerId!==ownerId){toast('This restore point is not available for the signed-in account');return false}createRestorePoint('Before restoring a restore point');progress=cloneLocalState(point.progress);meta={...META_DEFAULTS,...cloneLocalState(point.meta)};meta.kanaProgress=meta.kanaProgress||{};meta.grammarProgress=meta.grammarProgress||{};meta.sentenceLabProgress={lessons:{},saved:[],mistakes:[],totalAnswers:0,totalCorrect:0,...(meta.sentenceLabProgress||{})};meta.mangaProgress=meta.mangaProgress||{};meta.conversationProgress=meta.conversationProgress||{};meta.theatreProgress=meta.theatreProgress||{};meta.pathUnlocks=Array.isArray(meta.pathUnlocks)?meta.pathUnlocks:[];meta.pathVisits={...(meta.pathVisits||{})};meta.pathOverrides=Array.isArray(meta.pathOverrides)?meta.pathOverrides:[];meta.chapterOverrides=Array.isArray(meta.chapterOverrides)?meta.chapterOverrides:[];settings={...defaults,...cloneLocalState(point.settings),playMode:'journey'};save();renderLearningBalanceSettings();updateHome();$('#restorePointsDialog')?.close();toast('Restore point applied');return true}
function renderRestorePoints(){const list=$('#restorePointsList');if(!list)return;const points=[...restorePoints()].reverse();list.innerHTML=points.length?points.map(point=>{const summary=restorePointSummary(point);return `<article class="restore-point"><div><strong>${esc(new Date(point.takenAt).toLocaleString())}</strong><small>${esc(point.reason||'Saved progress')}</small><p>Lesson ${summary.lesson} · ${summary.started} words started · ${summary.mastered} mastered · ${summary.answers} answers · ${summary.streak}-day rhythm</p></div><button type="button" data-restore-point="${esc(point.id)}" class="primary">Restore</button></article>`}).join(''):'<p class="muted">No restore points yet. One is created before you reset progress or restore a point.</p>';list.querySelectorAll('[data-restore-point]').forEach(button=>button.onclick=()=>{const point=restorePoints().find(item=>item.id===button.dataset.restorePoint);if(point&&confirm('Restore this point? Your current progress will first be saved as a new restore point.'))applyRestorePoint(point)})}
function updateRestorePointAvailability(){const available=Boolean(restorePointOwnerId()),button=$('#restorePointsBtn'),dialog=$('#restorePointsDialog');if(button)button.hidden=!available;if(!available&&dialog?.open)dialog.close()}
function openRestorePoints(){if(!restorePointOwnerId()){toast('Sign in to use restore points');return}renderRestorePoints();const dialog=$('#restorePointsDialog');if(dialog&&!dialog.open)dialog.showModal()}
function show(id){screens.forEach(s=>s.classList.toggle('active',s.id===id));scrollTo(0,0)}
function openCharacterSettings(){show('settings');requestAnimationFrame(()=>{const picker=$('#avatarPicker');if(!picker)return;picker.scrollIntoView({behavior:'smooth',block:'center'});picker.classList.add('profile-target');setTimeout(()=>picker.classList.remove('profile-target'),1600)})}
function toast(t){const e=$('#toast');e.textContent=t;e.style.display='block';setTimeout(()=>e.style.display='none',1800)}
function day(date=new Date()){const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');return `${y}-${m}-${d}`}
function esc(value=''){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function pFor(id){const p=progress[id]||(progress[id]={stage:0,due:0,interval:0,ease:2.5,reps:0,lapses:0,mnemonic:'',skills:{}});p.skills=p.skills||{};SKILLS.forEach(s=>p.skills[s]||(p.skills[s]={attempts:0,correct:0,strength:0}));return p}
function dueWords(){const now=Date.now();return vocab.filter(v=>{const p=progress[v.id];return p&&p.due<=now})}
function dailyDueWords(){
 const today=day(),limit=DAILY_REVIEW_TARGET;
 if(!meta.dailyReviewPlan||meta.dailyReviewPlan.date!==today||!Array.isArray(meta.dailyReviewPlan.ids)){
  const ids=dueWords().sort((a,b)=>pFor(a.id).due-pFor(b.id).due).slice(0,limit).map(v=>v.id);
  meta.dailyReviewPlan={date:today,ids,completedIds:[],limit,initialTotal:ids.length};
  save(false);
 }
 if(!Number.isFinite(meta.dailyReviewPlan.initialTotal))meta.dailyReviewPlan.initialTotal=meta.dailyReviewPlan.ids.length;meta.dailyReviewPlan.completedIds=Array.isArray(meta.dailyReviewPlan.completedIds)?meta.dailyReviewPlan.completedIds:[];
 const byId=new Map(vocab.map(v=>[v.id,v])),now=Date.now();
 const completed=new Set(meta.dailyReviewPlan.completedIds);return meta.dailyReviewPlan.ids.map(id=>byId.get(id)).filter(v=>v&&!completed.has(v.id)&&progress[v.id]?.due<=now);
}
function markDailyReviewAttempted(wordId){
 const plan=meta.dailyReviewPlan;
 if(!plan||plan.date!==day()||!Array.isArray(plan.ids)||!plan.ids.includes(wordId))return;
 plan.completedIds=Array.isArray(plan.completedIds)?plan.completedIds:[];
 if(!plan.completedIds.includes(wordId))plan.completedIds.push(wordId);
}
function started(){return Object.keys(progress).length}
function accuracy(){return meta.totalAnswers?Math.round(meta.totalCorrect/meta.totalAnswers*100):0}
function mastery(p){return p&&p.interval>=21&&['meaning','listening','reading'].every(skill=>(p.skills?.[skill]?.strength||0)>=.65)}
function todayActivity(){const today=day();if(!meta.dailyActivity||meta.dailyActivity.date!==today)meta.dailyActivity={date:today,tested:0,qualified:false,sources:{}};return meta.dailyActivity}
function rhythmState(){const rhythm=meta.rhythm={...META_DEFAULTS.rhythm,...(meta.rhythm||{})};rhythm.behind=Math.max(0,Math.min(3,Number(rhythm.behind)||0));const now=new Date(),monday=new Date(now.getFullYear(),now.getMonth(),now.getDate()-((now.getDay()+6)%7)),week=day(monday);if(rhythm.quickWeek!==week){rhythm.quickWeek=week;rhythm.quickUsed=0}rhythm.quickUsed=Math.max(0,Math.min(2,Number(rhythm.quickUsed)||0));return rhythm}
function dateGap(from,to=day()){if(!from)return 0;const start=new Date(`${from}T12:00:00`),end=new Date(`${to}T12:00:00`);return Math.max(0,Math.round((end-start)/86400000))}
function breakLearningRhythm(rhythm){if(Number(meta.streak||0)<=0){rhythm.behind=0;return}const lostAt=Date.now();meta.streakRescue={lostStreak:Number(meta.streak),lastStudyBeforeLoss:meta.lastStudy,lostAt,expiresAt:lostAt+7*86400000,attempted:false};meta.streak=0;rhythm.behind=0;rhythm.cycles=Number(rhythm.cycles||0)+1;rhythm.lastBrokenAt=day()}
function reconcileRhythm(){const rhythm=rhythmState(),today=day();if(!rhythm.lastChecked){const missed=Math.max(0,dateGap(meta.lastStudy,today)-1);rhythm.behind=Math.min(3,missed);rhythm.lastChecked=today;if(rhythm.behind>=3)breakLearningRhythm(rhythm);return rhythm}if(rhythm.lastChecked===today)return rhythm;let cursor=new Date(`${rhythm.lastChecked}T12:00:00`),end=new Date(`${today}T12:00:00`);while(cursor<end){const date=day(cursor);if(date!==meta.lastStudy)rhythm.behind++;cursor.setDate(cursor.getDate()+1)}rhythm.lastChecked=today;if(rhythm.behind>=3)breakLearningRhythm(rhythm);return rhythm}
function awardRhythmDay(quick=false){const rhythm=reconcileRhythm(),today=day(),gap=dateGap(meta.lastStudy,today);if(meta.lastStudy!==today){meta.streak=Number(meta.streak||0)>0&&gap<=3?Number(meta.streak)+1:1;meta.lastStudy=today}if(quick)rhythm.quickUsed=Math.min(2,rhythm.quickUsed+1);else if(rhythm.behind>0)rhythm.behind--;rhythm.lastChecked=today;return rhythm}
function recordMeaningfulActivity(source,amount=1){
 const activity=todayActivity(),increment=Math.max(0,Number(amount)||0);
 activity.tested+=increment;
 activity.sources[source]=Number(activity.sources[source]||0)+increment;
 const testedForGoal=activity.quickStep?Math.max(0,activity.tested-Number(activity.quickStartTested||0)):activity.tested;
 const target=activity.quickStep?3:5;if(testedForGoal>=target&&!activity.qualified)activity.qualified=true;
 if(activity.qualified&&!activity.streakAwarded){
  const rhythm=awardRhythmDay(Boolean(activity.quickStep));
  activity.streakAwarded=true;
  toast(activity.quickStep?'Quick Step complete — today’s rhythm is protected!':rhythm.behind?'Learning rhythm restored — keep going!':'Today’s learning rhythm is complete!');
 }
 return activity;
}
function recentMonsterVictories(){const cutoff=Date.now()-72*3600000;meta.monsterVictories=(Array.isArray(meta.monsterVictories)?meta.monsterVictories:[]).filter(t=>Number(t)>cutoff);return meta.monsterVictories.length}
function recentKarutaBestAverage(){const cutoff=Date.now()-72*3600000;meta.karutaSessions=(Array.isArray(meta.karutaSessions)?meta.karutaSessions:[]).filter(item=>Number(item.at)>cutoff);return meta.karutaSessions.length?Math.max(...meta.karutaSessions.map(item=>Number(item.averageScore)||0)):null}
function detectLostStreak(){
 const before=Number(meta.streak||0);reconcileRhythm();if(before!==Number(meta.streak||0))save(false);
}
function activeStreakRescue(){const r=meta.streakRescue;return Boolean(r&&!r.attempted&&!r.success&&Date.now()<=Number(r.expiresAt||0))}
function updateStreakRescue(){
 const button=$('#streakRescueMode'),message=$('#streakRescueMessage');if(!button||!message)return;
 const active=activeStreakRescue();button.hidden=!active;message.hidden=!active;
 if(active){const days=Math.max(1,Math.ceil((meta.streakRescue.expiresAt-Date.now())/86400000));message.textContent=`One attempt available for ${days} more day${days===1?'':'s'}: defeat Kaidōra with 10 correct answers and no mistakes to restore your ${meta.streakRescue.lostStreak}-day streak.`}
}
function enterAdminTestMode(){
 if(!window.KaishiReports?.isAdmin?.()){toast('Administrator access is required');return false}
 save(false);sessionStorage.setItem(ADMIN_TEST_MODE_KEY,'1');sessionStorage.setItem(ADMIN_TEST_ENTRY_KEY,'1');location.reload();return true
}
function exitAdminTestMode(){sessionStorage.removeItem(ADMIN_TEST_MODE_KEY);location.reload()}
function renderAdminTestMode(){
 const banner=$('#adminTestBanner');if(banner)banner.hidden=!isAdminTestMode();
 document.documentElement.classList.toggle('admin-test-mode',isAdminTestMode());
 $('#exitAdminTest')?.addEventListener('click',exitAdminTestMode);
 if(isAdminTestMode()){
  const expose=()=>document.querySelectorAll('#japanReadyScenarioList [data-s]').forEach(button=>{button.disabled=false;button.closest('.japan-scenario')?.classList.remove('locked')});
  expose();new MutationObserver(expose).observe(document.body,{childList:true,subtree:true});
  const input=$('#adminTestLessonInput'),goButton=$('#adminTestLessonGo'),clearButton=$('#adminTestLessonClear'),activity=$('#adminTestActivity'),activityButton=$('#adminTestActivityGo');
  if(input)input.max=String(wordChapterCount());
  const current=adminTestChapterOverride();
  if(input)input.value=current!==null?String(current+1):'';
  goButton?.addEventListener('click',()=>{
   const value=Number(input?.value);
   if(!input?.value||!Number.isFinite(value)||value<1){toast('Enter a lesson number to jump to');return}
   setAdminTestChapter(value);updateHome();openJourney('current');toast(`Test learner set to lesson ${Math.min(Math.round(value),wordChapterCount())}`)
  });
  clearButton?.addEventListener('click',()=>{clearAdminTestChapter();if(input)input.value='';updateHome();openJourney('current');toast('Test learner back to natural progress')});
  if(activityButton){
   activityButton.disabled=!appReady;
   activityButton.textContent=appReady?'Launch':'Loading activities...';
   activityButton.onclick=()=>launchAdminTestActivity(activity?.value||'');
  }
 }
}
function setAdminTestActivityReady(ready){
 const button=$('#adminTestActivityGo');if(!button)return;
 button.disabled=!ready;button.textContent=ready?'Launch':'Loading activities...';
}
async function launchAdminTestActivity(id){
 const button=$('#adminTestActivityGo');
 if(!appReady){toast('Activities are still loading. Please try again in a moment.');return false}
 if(id!=='colosseum'&&!PATH_MILESTONES.some(item=>item.id===id)){toast('Choose a valid immersive activity');return false}
 if(button){button.disabled=true;button.textContent='Launching...'}
 try{
  if(id==='colosseum'){
   const launch=$('#kotobaColosseumMode');
   if(typeof launch?.onclick!=='function')throw new Error('Kotoba Colosseum is still loading');
   launch.onclick();
   return true;
  }
  await launchPathMilestone(id,true);
  return true;
 }catch(error){
  console.error('Test learner activity failed to launch',error);
  toast('That activity could not be launched. Please try another activity.');
  return false;
 }finally{
  if(button){button.disabled=false;button.textContent='Launch'}
 }
}
window.KaishiAdminTest={enter:enterAdminTestMode,exit:exitAdminTestMode,active:isAdminTestMode,setLesson:setAdminTestChapter,clearLesson:clearAdminTestChapter,currentLessonOverride:adminTestChapterOverride,isReady:()=>appReady,launchActivity:launchAdminTestActivity};
window.KaishiJapanReadyBridge={version:3,getVocab:()=>vocab,getProgress:()=>progress,getMeta:()=>meta,save:()=>save(),show,updateHome,isTestMode:isAdminTestMode,playWord:word=>speak(word?.word||word?.reading||''),startFocusedStudy:wordIds=>{const ids=[...new Set(wordIds)].filter(Boolean);if(!ids.length){toast('No matching study words were found yet');return}activityReturnScreen='japanReady';makeTargetedMasterySession(ids,'meaning')},wordIntroduced,wordMastery:word=>mastery(progress[word.id]),stats:()=>({started:started(),accuracy:accuracy(),mastered:Object.values(progress).filter(mastery).length})};
function bonsaiGrowthState(){const words=started(),mastered=Object.values(progress).filter(mastery).length,topics=journeyTopics().filter(topic=>topicStats(topic).complete).length,score=words+mastered*7+topics*35,thresholds=[0,2,60,240,700],stages=[['First Sprout','Your first useful Japanese is taking root.'],['New Branches','Recognition is becoming a reliable learning habit.'],['Shaped Sapling','Recall and listening are giving your Japanese structure.'],['Strong Bonsai','A broad base of Japanese is becoming usable.'],['Mastery in Bloom','Long-term recall is flowering across your learning.']];let stage=0;thresholds.forEach((threshold,index)=>{if(score>=threshold)stage=index});const next=thresholds[stage+1]??score,base=thresholds[stage],percent=stage===thresholds.length-1?100:Math.round((score-base)/Math.max(1,next-base)*100);return{stage,stageName:stages[stage][0],nextStageName:stages[stage+1]?.[0]||'',description:stages[stage][1],score,nextScore:next,progress:Math.max(0,Math.min(100,percent)),words,mastered,topics,newLearner:Number(meta.totalAnswers||0)===0&&words===0}}
function bonsaiConditionState(streak,behind,newLearner){const baseLevel=streak>=30?3:streak>=7?2:streak>0?1:0,level=Math.max(0,baseLevel-Math.min(3,Number(behind||0))),states=[{key:'resting',name:newLearner?'Ready to grow':'Resting',note:newLearner?'Complete your first learning rhythm to wake your bonsai gently.':behind?'A missed day has quietened it. A full daily objective restores one condition step.':'Complete today’s learning rhythm to begin caring for it.'},{key:'steady',name:'Steady',note:behind?'Your established rhythm is helping the bonsai recover.':`${Math.max(0,7-streak)} more rhythm day${7-streak===1?'':'s'} until it flourishes.`},{key:'flourishing',name:'Flourishing',note:behind?'Your long rhythm keeps the bonsai healthy while it recovers.':`${Math.max(0,30-streak)} more rhythm day${30-streak===1?'':'s'} until it becomes radiant.`},{key:'radiant',name:'Radiant',note:'A 30-day learning rhythm surrounds your bonsai with lasting energy.'}];return{...states[level],level,baseLevel}}
window.KaishiBonsaiBridge={state:()=>{const rhythm=reconcileRhythm(),activity=todayActivity(),growth=bonsaiGrowthState(),streak=Number(meta.streak||0),target=activity.quickStep?3:5,tested=activity.quickStep?Math.max(0,Number(activity.tested||0)-Number(activity.quickStartTested||0)):Number(activity.tested||0);return{...growth,...bonsaiConditionState(streak,rhythm.behind,growth.newLearner),streak,behind:rhythm.behind,quickUsed:rhythm.quickUsed,quickRemaining:Math.max(0,2-rhythm.quickUsed),todayTested:tested,todayTarget:target,qualified:Boolean(activity.qualified)}},startQuick:startQuickStep,startFirst:startFirstLesson,update:updateHome};
window.KaishiQuestCloudAdapter={
 snapshot:()=>isAdminTestMode()?null:{version:3,progress,meta,settings},
 restore:data=>{const localDailyReviewPlan=meta.dailyReviewPlan&&meta.dailyReviewPlan.date===day()?structuredClone(meta.dailyReviewPlan):null;progress=data?.progress||{};meta={...META_DEFAULTS,...(data?.meta||{})};meta.kanaProgress=meta.kanaProgress||{};meta.grammarProgress=meta.grammarProgress||{};meta.sentenceLabProgress={lessons:{},saved:[],mistakes:[],totalAnswers:0,totalCorrect:0,...(meta.sentenceLabProgress||{})};meta.mangaProgress=meta.mangaProgress||{};meta.conversationProgress=meta.conversationProgress||{};meta.theatreProgress=meta.theatreProgress||{};meta.pathUnlocks=Array.isArray(meta.pathUnlocks)?[...meta.pathUnlocks]:[];meta.pathVisits={...(meta.pathVisits||{})};meta.pathOverrides=Array.isArray(meta.pathOverrides)?[...meta.pathOverrides]:[];meta.chapterOverrides=Array.isArray(meta.chapterOverrides)?[...meta.chapterOverrides]:[];const legacy=meta.rhythm||meta.garden||{};meta.rhythm={...META_DEFAULTS.rhythm,behind:Number(legacy.behind||0),lastChecked:String(legacy.lastChecked||''),quickWeek:String(legacy.quickWeek||''),quickUsed:Number(legacy.quickUsed||0),cycles:Number(legacy.cycles||0)};delete meta.garden;delete meta.gardenApSpent;rhythmState();if(localDailyReviewPlan&&(!meta.dailyReviewPlan||meta.dailyReviewPlan.date!==day()||Number(localDailyReviewPlan.initialTotal||0)>=Number(meta.dailyReviewPlan.initialTotal||0)))meta.dailyReviewPlan=localDailyReviewPlan;settings={...defaults,...(data?.settings||{}),playMode:'journey'};save(false);if($('#pictureDifficulty')){$('#pictureDifficulty').value=settings.pictureDifficulty;$('#mnemonicStyle').value=settings.mnemonicStyle;$('#autoAudio').checked=settings.autoAudio;if($('#activityVillageMode'))$('#activityVillageMode').checked=settings.activityVillageMode!==false;if($('#activityVillageMode'))$('#activityVillageMode').checked=settings.activityVillageMode!==false}renderLearningBalanceSettings();updateHome();toast('Cloud progress restored')},
 stats:()=>{const mastered=Object.values(progress).filter(mastery).length,reviews=Number(meta.totalAnswers||0),correct=Number(meta.totalCorrect||0),monsters=Number(meta.totalMonsterVictories||meta.monsterVictories?.length||0),streak=Number(meta.streak||0);return{xp:Math.max(0,correct*10+mastered*50+monsters*100+streak*20),mastered,accuracy:reviews?Math.round(correct/reviews*100):0,reviews,monsters_defeated:monsters,streak}},
 isTestMode:isAdminTestMode
};
function wordPracticeCount(p){return p?SKILLS.reduce((sum,skill)=>sum+Number(p.skills?.[skill]?.attempts||0),0):0}
function wordLearningStatus(v){if(isAdminTestMode())return'introduced';const p=progress[v.id];if(!p)return'locked';if(Number(p.interval||0)>=21&&Number(p.skills?.kanji?.strength||0)>=.65)return'mastered';if(Number(p.skills?.kanji?.attempts||0)>=2||Number(p.reps||0)>=2||wordPracticeCount(p)>=2)return'practised';return'introduced'}
function kanjiCharacters(v){return [...new Set([...String(v.kanji||v.word||'')].filter(character=>/\p{Script=Han}/u.test(character)))]}
function kanjiCatalogue(){const map=new Map();vocab.forEach(v=>kanjiCharacters(v).forEach(character=>{if(!map.has(character))map.set(character,[]);map.get(character).push(v)}));return [...map].map(([character,words])=>{const statuses=words.map(wordLearningStatus);const status=statuses.includes('mastered')?'mastered':statuses.includes('practised')?'practised':statuses.includes('introduced')?'introduced':'locked';return{character,words,status}})}
function kanjiMasteredCount(){return kanjiCatalogue().filter(item=>item.status==='mastered').length}
function componentRecord(character){return (componentData.kanji||[]).find(item=>item.kanji===character)}
function wordComponentRecords(v){return kanjiCharacters(v).map(componentRecord).filter(record=>record&&record.parts&&record.parts.length)}
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
function historyEntries(){return[...(Array.isArray(meta.sessionHistory)?meta.sessionHistory:[])].sort((a,b)=>b.completedAt-a.completedAt)}
function historyEntryWords(entry){return(entry?.wordIds||[]).map(id=>vocab.find(v=>v.id===id)).filter(Boolean)}
function historyEntryAccuracy(entry){const attempts=Number(entry?.attempts||0),correct=Number(entry?.correct||0);return attempts?Math.round(correct/attempts*100):null}
function renderHistory(){
 const list=$('#historyList');if(!list)return;
 const entries=historyEntries();
 if(!entries.length){list.innerHTML='<p class="muted">Completed lessons will appear here after your next session.</p>';return}
 list.innerHTML=entries.map(entry=>{
  const words=historyEntryWords(entry),accuracy=historyEntryAccuracy(entry);
  const dateLabel=new Date(entry.completedAt).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
  const timeLabel=new Date(entry.completedAt).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
  const preview=words.slice(0,5).map(word=>`<span lang="ja">${esc(word.word)}</span>`).join('');
  const missing=(entry.wordIds||[]).length-words.length;
  return `<article class="history-entry"><div class="history-entry-head"><strong>${esc(entry.title||'Learning session')}</strong><time datetime="${new Date(entry.completedAt).toISOString()}">${esc(dateLabel)} · ${esc(timeLabel)}</time></div><p class="muted">${(entry.wordIds||[]).length} word${(entry.wordIds||[]).length===1?'':'s'} covered${accuracy!==null?` · ${accuracy}% accuracy`:''}</p>${preview?`<div class="history-entry-words">${preview}</div>`:''}${missing>0?`<p class="muted history-entry-missing">${missing} word${missing===1?' is':'s are'} no longer available.</p>`:''}<button type="button" class="history-redo" data-redo-history="${esc(entry.id)}"${words.length?'':' disabled'}>Redo this lesson</button></article>`;
 }).join('');
 document.querySelectorAll('[data-redo-history]').forEach(button=>button.onclick=()=>redoHistoryEntry(button.dataset.redoHistory));
}
function redoHistoryEntry(id){
 const entry=historyEntries().find(item=>item.id===id);
 const ids=(entry?.wordIds||[]).filter(wordId=>vocab.some(v=>v.id===wordId));
 if(!ids.length){toast('None of these words are available to redo right now.');return}
 closeHistoryEntryDialog();
 redoingHistoryId=entry.id;
 activityReturnScreen='journey';
 makeTargetedMasterySession(ids,'retain',entry.title||'Your focused practice session');
}
function openHistory(){renderHistory();show('history')}

function renderHistoryTimeline(){
 const section=$('#journeyHistoryTimeline'),track=$('#journeyHistoryTrack');if(!section||!track)return;
 const entries=historyEntries().slice(0,20);
 section.hidden=!entries.length;
 if(!entries.length){track.innerHTML='';return}
 track.innerHTML=entries.map(entry=>{
  const words=historyEntryWords(entry),accuracy=historyEntryAccuracy(entry);
  const dateLabel=new Date(entry.completedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'});
  return `<button type="button" class="journey-history-tile" data-history-tile="${esc(entry.id)}"><time>${esc(dateLabel)}</time><strong>${esc(entry.title||'Lesson')}</strong><span>${words.length} word${words.length===1?'':'s'}${accuracy!==null?` · ${accuracy}%`:''}</span></button>`;
 }).join('');
 bindHistoryTimelineDrag(track);
 track.querySelectorAll('[data-history-tile]').forEach(tile=>tile.onclick=()=>{if(tile.dataset.dragSuppressed==='1'){tile.dataset.dragSuppressed='0';return}openHistoryEntryDialog(tile.dataset.historyTile)});
}
const historyTimelineDragBound=new WeakSet();
function bindHistoryTimelineDrag(track){
 if(historyTimelineDragBound.has(track))return;historyTimelineDragBound.add(track);
 let dragging=false,startX=0,startScroll=0,moved=false;
 track.addEventListener('pointerdown',event=>{if(event.pointerType==='touch')return;dragging=true;moved=false;startX=event.clientX;startScroll=track.scrollLeft;try{track.setPointerCapture(event.pointerId)}catch{}track.classList.add('dragging')});
 track.addEventListener('pointermove',event=>{if(!dragging)return;const dx=event.clientX-startX;if(Math.abs(dx)>4)moved=true;track.scrollLeft=startScroll-dx});
 const end=event=>{if(!dragging)return;dragging=false;track.classList.remove('dragging');if(moved){const tile=event.target.closest('[data-history-tile]');if(tile)tile.dataset.dragSuppressed='1'}};
 track.addEventListener('pointerup',end);track.addEventListener('pointercancel',end);track.addEventListener('pointerleave',end);
}
function ensureHistoryEntryDialog(){let dialog=$('#historyEntryDialog');if(dialog)return dialog;document.body.insertAdjacentHTML('beforeend','<dialog id="historyEntryDialog" class="history-entry-dialog"><div class="history-entry-dialog-inner"><span class="eyebrow" id="historyEntryDialogDate"></span><h2 id="historyEntryDialogTitle"></h2><div id="historyEntryDialogStats" class="history-entry-dialog-stats"></div><div id="historyEntryDialogWords" class="history-entry-words"></div><div class="history-entry-dialog-actions"><button id="historyEntryDialogClose" type="button">Close</button><button id="historyEntryDialogRedo" class="primary" type="button">Redo this lesson</button></div></div></dialog>');$('#historyEntryDialogClose').onclick=closeHistoryEntryDialog;return $('#historyEntryDialog')}
function openHistoryEntryDialog(id){
 const entry=historyEntries().find(item=>item.id===id);if(!entry)return;
 const dialog=ensureHistoryEntryDialog();
 const words=historyEntryWords(entry),accuracy=historyEntryAccuracy(entry),attempts=Number(entry.attempts||0);
 const dateLabel=new Date(entry.completedAt).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
 const timeLabel=new Date(entry.completedAt).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
 $('#historyEntryDialogDate').textContent=`${dateLabel} · ${timeLabel}`;
 $('#historyEntryDialogTitle').textContent=entry.title||'Learning session';
 $('#historyEntryDialogStats').innerHTML=`<span><b>${words.length}</b> word${words.length===1?'':'s'}</span>${attempts?`<span><b>${accuracy}%</b> accuracy</span><span><b>${attempts}</b> attempt${attempts===1?'':'s'}</span>`:'<span>No graded attempts recorded</span>'}`;
 $('#historyEntryDialogWords').innerHTML=words.length?words.map(word=>`<span lang="ja">${esc(word.word)}<small>${esc(word.meaning)}</small></span>`).join(''):'<p class="muted">These words are no longer available.</p>';
 const redoBtn=$('#historyEntryDialogRedo');redoBtn.disabled=!words.length;redoBtn.onclick=()=>redoHistoryEntry(entry.id);
 if(!dialog.open)dialog.showModal();
}
function closeHistoryEntryDialog(){const dialog=$('#historyEntryDialog');if(dialog?.open)dialog.close()}
function renderJourneyPathAhead(){
 const list=$('#journeyPathAhead');if(!list)return;
 const current=currentWordChapterIndex(),total=wordChapterCount();
 // v11.25.0: horizon widened from 8 to 10 future lessons (plus the current
 // one) to match the rolling roadmap computed by roadmap-engine.js. This
 // list stays read-only — it does not affect completion, retry, ordering
 // or the daily Journey route.
 const HORIZON=10;
 const upcoming=Array.from({length:Math.min(HORIZON+1,total-current)},(_,offset)=>current+offset);
 // Optional: mapped events (milestone/activity/topic) from the roadmap
 // engine, keyed by chapter index. Purely additive — if the engine hasn't
 // loaded yet, this list renders exactly as it did before.
 let eventByChapter={};
 try{
  const roadmap=window.KaishiRoadmap?.get?.();
  if(roadmap)roadmap.lessons.forEach(lesson=>{if(lesson.event)eventByChapter[lesson.chapterIndex]=lesson.event});
 }catch(_){}
 list.innerHTML=upcoming.map((lessonIndex,offset)=>{
  const words=chapterWords(lessonIndex),topic=topicForWord(words[0]),stats=chapterStats(lessonIndex),isCurrent=offset===0;
  const title=words.slice(0,2).map(word=>word.meaning).join(' + ')||topic.title;
  const event=eventByChapter[lessonIndex];
  const eventBadge=event?`<span class="path-ahead-event">${esc(event.icon||'✨')} ${esc(event.label)}</span>`:'';
  return `<li class="path-ahead-item ${isCurrent?'current':'ahead'}"><span class="path-ahead-icon">${esc(topic.icon||'🗺️')}</span><span class="path-ahead-title">Lesson ${lessonIndex+1}: ${esc(title)}</span><span class="path-ahead-status">${isCurrent?`${stats.percent}% underway`:'Up next'}</span>${eventBadge}</li>`;
 }).join('')+(total>current+HORIZON?'<li class="path-ahead-item more">More lessons ahead</li>':'');
}
const ACTIVITY_VILLAGE_CONFIG={
 vocabulary:{cost:0,words:0,action:'Enter Village',theme:'village'},
 kana:{cost:0,words:0,action:'Cross the Bridge',theme:'bridge'},
 picture:{cost:100,words:8,action:'Restore Meadow',theme:'meadow'},
 listening:{cost:150,words:12,action:'Open Listening Station',theme:'station'},
 karuta:{cost:220,words:16,action:'Open Karuta Arena',theme:'arena'},
 conversation:{cost:280,words:20,action:'Open Conversation Town',theme:'town'},
 grammar:{cost:320,words:24,action:'Restore Particle Shrine',theme:'shrine'},
 sentenceLab:{cost:0,words:0,action:'Open Sentence Lab',theme:'laboratory'},
 theatre:{cost:450,words:35,action:'Raise the Curtain',theme:'theatre'},
 kanji:{cost:350,words:20,action:'Open Kanji Gate',theme:'gate'},
 builder:{cost:420,words:25,action:'Light the Workshop',theme:'forge'},
 manga:{cost:550,words:45,action:'Open Manga Library',theme:'library'},
 battle:{cost:650,words:55,action:'Open Memory Dojo',theme:'dojo'}
};
const PATH_MILESTONES=[
 {id:'vocabulary',icon:'🌱',title:'Starting Village',activity:'Vocabulary Study',japanese:'単語学習',description:'Meet your first words and build the memory links that power every later activity.',requirement:'Available from the beginning.'},
 {id:'kana',icon:'あ',title:'Kana Bridge',activity:'Hiragana & Katakana',japanese:'かな学習',description:'Strengthen the sounds and scripts that make Japanese easier to read.',requirement:'Available from the beginning.'},
 {id:'picture',icon:'🌄',title:'Picture Meadow',activity:'Picture Matching',japanese:'絵合わせ',description:'Connect complete mnemonic scenes to the words they represent.',requirement:'Introduce 5 vocabulary words.'},
 {id:'listening',icon:'🎧',title:'Listening Station',activity:'Listen → Meaning',japanese:'聞き取り',description:'Recognise familiar Japanese by sound before seeing the answer.',requirement:'Practise listening with 8 words.'},
 {id:'karuta',icon:'🎴',title:'Karuta Arena',activity:'Audio Reflex Match',japanese:'かるた',description:'Race to match spoken Japanese with its mnemonic-and-Kanji card.',requirement:'Introduce 12 illustrated words with audio.'},
 {id:'conversation',icon:'💬',title:'Conversation Town',activity:'Conversation Quest',japanese:'会話クエスト',description:'Choose natural replies while Kai, Mia and Master speak with you.',requirement:'Start 12 words and answer 5 listening checks correctly.'},
 {id:'grammar',icon:'助',title:'Particle Shrine',activity:'Grammar & Particles',japanese:'文法と助詞',description:'Learn how particles connect complete Japanese sentences, then prove each distinction in context.',requirement:'Start 15 words and complete 15 tested answers.'},
 {id:'sentenceLab',icon:'文',title:'Sentence Lab',activity:'Sentence Understanding',japanese:'文の研究室',description:'Decode, hear, rebuild and transform complete Japanese sentences while learning what every phrase contributes.',requirement:'Available from the beginning as guided practice.'},
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
 if(id==='sentenceLab')return true;
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
 if(id==='sentenceLab')return'Ready now';
 if(id==='theatre')return`${Math.min(1,conversationCompletedCount())}/1 conversation completed`;
 if(id==='kanji')return`${Math.min(10,pathIntroducedKanji())}/10 Kanji introduced`;
 if(id==='builder')return`${Math.min(10,introducedComponentKanji())}/10 component Kanji introduced`;
 if(id==='manga')return`${Math.min(25,started())}/25 words · ${Math.min(30,Number(meta.totalAnswers||0))}/30 answers`;
 if(id==='battle')return`${Math.min(20,started())}/20 words · ${Math.min(40,Number(meta.totalAnswers||0))}/40 answers`;
 return'';
}
function refreshPathUnlocks(){
 const ready=PATH_MILESTONES.filter(item=>{const state=activityReadiness(item.id);return !state.purchased&&state.wordReady&&state.apReady}).map(item=>item.id);
 meta.pathUnlocks=ready;
 return ready;
}
function lifetimeXp(){return Math.max(0,Number(meta.totalCorrect||0)*10+Object.values(progress).filter(mastery).length*50+Number(meta.totalMonsterVictories||0)*100+Number(meta.streak||0)*20)}
function adventurePoints(){return Math.max(0,lifetimeXp()-Number(meta.adventurePointsSpent||0))}
function startFirstLesson(){const words=chapterWords(currentWordChapterIndex()).slice(0,3);if(words.length<2){toast('Learning content is still loading');return false}activeFirstLesson=true;activeQuickStep=false;activityReturnScreen='home';pictureGameActive=false;introGuidanceCount=0;session=[...words.flatMap(v=>[{v,skill:'firstEncounter'},{v,skill:'intro'}]),...words.map(v=>({v,skill:'meaning'}))];index=0;current=null;clearMissionResume();meta.firstLessonStartedAt=Date.now();save();show('study');renderCurrent();return true}
function startQuickStep(){const activity=todayActivity(),rhythm=reconcileRhythm();if(activity.qualified){toast('Today’s learning rhythm is already complete');return false}if(rhythm.quickUsed>=2){toast('Both Quick Steps have been used this week');return false}const pool=[...new Map([...dueWords(),...vocab.filter(wordIntroduced),...vocab].map(word=>[word.id,word])).values()].slice(0,3);if(!pool.length){toast('Learning content is still loading');return false}activity.quickStep=true;activity.quickTarget=3;activity.quickStartTested=Number(activity.tested||0);activeQuickStep=true;activeFirstLesson=false;activityReturnScreen='home';pictureGameActive=false;session=pool.map((v,itemIndex)=>({v,skill:itemIndex===1&&v.wordAudio?'listening':itemIndex===2&&v.word!==v.reading?'reading':'meaning'}));index=0;current=null;clearMissionResume();save();show('study');renderCurrent();return true}
function introducedWords(){return vocab.filter(wordIntroduced)}
function activitySupportedWords(id){
 const introduced=introducedWords();
 if(id==='picture')return introduced.filter(v=>Boolean(memoryScenes[sceneKey(v)]?.file));
 if(id==='listening')return introduced.filter(v=>Boolean(v.wordAudio));
 if(id==='karuta')return introduced.filter(v=>Boolean(v.wordAudio&&memoryScenes[sceneKey(v)]?.file));
 if(id==='sentenceLab')return introduced.filter(v=>Boolean(v._anki?.sentence||v.exampleSentence));
 if(id==='kanji'||id==='builder')return introduced.filter(v=>kanjiCharacters(v).length);
 return introduced;
}
function activityReadiness(id){
 const cfg=id==='battle'?(ACTIVITY_VILLAGE_CONFIG[id]||{cost:0,words:0}):{cost:0,words:0,action:'Practice',theme:'village'};
 const supported=activitySupportedWords(id).length;
 return{cfg,supported,wordReady:isAdminTestMode()||supported>=cfg.words,apReady:isAdminTestMode()||adventurePoints()>=cfg.cost,purchased:pathUnlocked(id)};
}
function pathUnlocked(id){return isAdminTestMode()||id!=='battle'||meta.activityPurchases.includes(id)||meta.pathOverrides.includes(id)}
function pathCurrentIndex(){const firstUnvisited=PATH_MILESTONES.findIndex(item=>pathUnlocked(item.id)&&!meta.pathVisits[item.id]);if(firstUnvisited>=0)return firstUnvisited;let current=0;PATH_MILESTONES.forEach((item,itemIndex)=>{if(pathUnlocked(item.id))current=itemIndex});return current}
const WORD_CHAPTER_SIZE=3,WORD_CHAPTER_NAMES=['First Steps','Riverside Path','Bamboo Trail','Lantern Market','Tea Garden','Green Hill','Cedar Crossing','Crane Lake','Festival Street','Moonlit Terrace','Torii Pass','Maple Valley','Coastal Road','Snowy Hamlet','Castle Approach','Artisan Quarter','Mountain Shrine','Firefly Marsh','Orchard Lane','Scholar’s Court','Cloud Pass','Silver Waterfall','Sunflower Plain','Old Post Town','Red Maple Ridge','Starry Plateau','Dragonfly Coast','Summit Trail','Dawn Sanctuary','Kaishi Summit'];
function wordChapterCount(){return Math.max(1,Math.ceil(vocab.length/WORD_CHAPTER_SIZE))}
function chapterWords(itemIndex){return vocab.slice(itemIndex*WORD_CHAPTER_SIZE,Math.min(vocab.length,(itemIndex+1)*WORD_CHAPTER_SIZE))}
// Called here (rather than right after its own declaration, above) because it depends on
// WORD_CHAPTER_SIZE/wordChapterCount, which aren't initialised yet earlier in the script —
// calling it too early throws (const is in the temporal dead zone until this point), which
// silently aborts every button binding later in this file. Keep this call below this line.
renderAdminTestMode();
function wordIntroduced(item){if(isAdminTestMode())return true;const p=progress[item.id];return Boolean(p&&(Number(p.stage||0)>=1||wordPracticeCount(p)>0))}
function activitySessionSize(total){const requested=Number(settings.sessionSize),fallback=defaults.sessionSize;return Math.min(total,Math.max(1,Number.isFinite(requested)?Math.round(requested):fallback))}
const LEARNING_BALANCE_LABELS={"-2":'Mostly listening',"-1":'Listening focus',"0":'Balanced',"1":'Reading focus',"2":'Mostly reading'};
const READING_SKILLS=new Set(['reading','sentence','kanji','components']);
const LISTENING_ACTIVITIES=new Set(['listening','karuta','conversation','theatre']);
const READING_ACTIVITIES=new Set(['kana','grammar','sentenceLab','builder','manga']);
function storedLearningBalance(){return Math.max(-2,Math.min(2,Math.round(Number(settings.learningBalance)||0)))}
function skillStrengthSummary(skill){let attempts=0,total=0;Object.values(progress).forEach(item=>{const metric=item.skills?.[skill];if(!Number(metric?.attempts||0))return;attempts+=Number(metric.attempts);total+=Number(metric.strength||0)*Number(metric.attempts)});return{attempts,strength:attempts?total/attempts:0}}
function effectiveLearningBalance(){
 if(!settings.learningBalanceAdaptive)return storedLearningBalance();
 const listening=skillStrengthSummary('listening'),readingParts=['reading','sentence','kanji'].map(skillStrengthSummary),readingAttempts=readingParts.reduce((sum,item)=>sum+item.attempts,0),readingStrength=readingAttempts?readingParts.reduce((sum,item)=>sum+item.strength*item.attempts,0)/readingAttempts:0;
 if(listening.attempts+readingAttempts<4)return 0;
 const difference=listening.strength-readingStrength;if(Math.abs(difference)<.08)return 0;return Math.max(-2,Math.min(2,difference>0?(difference>.22?2:1):(difference<-.22?-2:-1)))
}
function learningPreferenceWeight(type){const balance=effectiveLearningBalance(),strength=Math.abs(balance);if(!balance||!strength)return 1;const focus=balance>0?'reading':'listening',focused=strength===2?2:1.5,opposite=strength===2?.85:.95;return type===focus?focused:type==='reading'||type==='listening'?opposite:1}
function skillPreferenceWeight(skill){return learningPreferenceWeight(skill==='listening'?'listening':READING_SKILLS.has(skill)?'reading':'neutral')}
function activityPreferenceWeight(id){return learningPreferenceWeight(LISTENING_ACTIVITIES.has(id)?'listening':READING_ACTIVITIES.has(id)?'reading':'neutral')}
function learningBalanceDescription(){const effective=effectiveLearningBalance(),label=LEARNING_BALANCE_LABELS[String(effective)];if(settings.learningBalanceAdaptive)return effective===0?'Sensei is keeping reading and listening balanced from your current results.':`Sensei currently recommends ${label.toLowerCase()} because it needs more reinforcement.`;return`${LEARNING_BALANCE_LABELS[String(storedLearningBalance())]} will guide future questions and daily activities. Both skills will still appear.`}
function renderLearningBalanceSettings(){const slider=$('#learningBalance'),adaptive=$('#learningBalanceAdaptive'),value=$('#learningBalanceValue'),description=$('#learningBalanceDescription');if(!slider||!adaptive)return;slider.value=String(storedLearningBalance());adaptive.checked=settings.learningBalanceAdaptive!==false;slider.disabled=adaptive.checked;if(value)value.textContent=adaptive.checked?'Let Sensei decide':LEARNING_BALANCE_LABELS[slider.value];if(description)description.textContent=learningBalanceDescription()}
function updateLearningBalanceFromControls(){const slider=$('#learningBalance'),adaptive=$('#learningBalanceAdaptive');if(!slider||!adaptive)return;settings.learningBalance=Math.max(-2,Math.min(2,Math.round(Number(slider.value)||0)));settings.learningBalanceAdaptive=adaptive.checked;renderLearningBalanceSettings()}
function saveSettingsAndExit(){settings.playMode='journey';settings.pictureDifficulty=Math.max(2,Math.min(6,+$('#pictureDifficulty').value||4));settings.mnemonicStyle=$('#mnemonicStyle').value;settings.autoAudio=$('#autoAudio').checked;settings.activityVillageMode=$('#activityVillageMode')?.checked!==false;updateLearningBalanceFromControls();save();updateHome();show('home')}
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
 const groups={};candidates.forEach(item=>(groups[item.step.id]||(groups[item.step.id]=[])).push(item));const preferred=['listening','meaning','reading','components','production','sentence','kanji'];const skill=preferred.filter(id=>groups[id]?.length).sort((a,b)=>groups[b].length*skillPreferenceWeight(b)-groups[a].length*skillPreferenceWeight(a)||preferred.indexOf(a)-preferred.indexOf(b))[0],items=groups[skill]||candidates,step=items[0].step,words=items.sort((a,b)=>Number(progress[a.word.id]?.skills?.[skill]?.strength||0)-Number(progress[b.word.id]?.skills?.[skill]?.strength||0)).slice(0,8).map(item=>item.word);
 return{skill,label:step.label,reason:`${words.length} word${words.length===1?'':'s'} need to ${step.reason}.`,words};
}
function chapterStats(itemIndex){const words=chapterWords(itemIndex),introduced=words.filter(wordIntroduced).length,reviewed=words.filter(item=>wordPracticeCount(progress[item.id])>=2).length,introTarget=words.length,reviewTarget=words.length,complete=introduced>=introTarget&&reviewed>=reviewTarget;return{words,introduced,reviewed,introTarget,reviewTarget,complete,percent:Math.round((Math.min(1,introduced/Math.max(1,introTarget))*.6+Math.min(1,reviewed/Math.max(1,reviewTarget))*.4)*100)}}
function chapterNaturallyUnlocked(itemIndex){if(itemIndex===0)return true;for(let previous=0;previous<itemIndex;previous++)if(!chapterStats(previous).complete)return false;return true}
function chapterUnlocked(itemIndex){return isAdminTestMode()||chapterNaturallyUnlocked(itemIndex)||meta.chapterOverrides.includes(itemIndex)}
function currentWordChapterIndex(){const override=adminTestChapterOverride();if(override!==null)return override;let lastUnlocked=0;for(let itemIndex=0;itemIndex<wordChapterCount();itemIndex++){if(!chapterUnlocked(itemIndex))break;lastUnlocked=itemIndex;if(!chapterStats(itemIndex).complete)return itemIndex}return lastUnlocked}
function wordJourneyPosition(){const total=wordChapterCount(),explored=vocab.filter(wordIntroduced).length,chapter=currentWordChapterIndex()+1,completed=Array.from({length:total},(_,itemIndex)=>chapterStats(itemIndex).complete).filter(Boolean).length;return{explored,chapter,total,completed}}
function missionActivityId(){const available=['kana','picture','listening','karuta','conversation','grammar','sentenceLab','theatre','builder','manga','battle'].filter(id=>pathUnlocked(id)),newActivity=available.find(id=>!meta.pathVisits[id]);if(newActivity)return newActivity;const weighted=available.flatMap(id=>Array.from({length:Math.max(1,Math.round(activityPreferenceWeight(id)*4))},()=>id)),seed=day().split('-').reduce((sum,value)=>sum+Number(value||0),0);return weighted[seed%Math.max(1,weighted.length)]||available[0]||'kana'}
function ensureDailyJourneyRoute(){
 refreshPathUnlocks();
 const balanceKey=`${settings.learningBalanceAdaptive!==false?'adaptive':'manual'}:${storedLearningBalance()}:${effectiveLearningBalance()}`;
 const chapter=currentWordChapterIndex();
 // Outside Admin Test Mode, the route intentionally stays pinned to whichever
 // chapter it was generated for today, even if chapterIndex naturally moves
 // on (e.g. right after finishing today's lesson) — that's what keeps the
 // "one lesson at a time" daily pacing honest. Admin Test Mode is exempted
 // so the "Test as if at lesson N" control can actually switch the route.
 const chapterMatches=!isAdminTestMode()||meta.dailyJourneyRoute?.chapter===chapter;
 if(meta.dailyJourneyRoute?.date===day()&&meta.dailyJourneyRoute.schemaVersion===5&&meta.dailyJourneyRoute.balanceKey===balanceKey&&chapterMatches&&Array.isArray(meta.dailyJourneyRoute.steps))return meta.dailyJourneyRoute;
 const words=chapterWords(chapter),topic=currentTopic();
 const previousCompleted=meta.dailyJourneyRoute?.date===day()&&meta.dailyJourneyRoute.chapter===chapter?meta.dailyJourneyRoute.completed||[]:[];
 meta.dailyJourneyRoute={schemaVersion:5,date:day(),balanceKey,chapter,completed:previousCompleted,explanation:{chapter,sequence:'One lesson at a time'},steps:[
  {id:`lesson-${chapter}`,kind:'chapter',chapter,topicId:topic.id,icon:topic.icon||'🗺️',title:`Lesson ${chapter+1}: ${words.slice(0,2).map(word=>word.meaning).join(' + ')||topic.title}`,detail:`Learn ${words.length} connected word${words.length===1?'':'s'} from ${topic.title}, then strengthen them before the next lesson.`}
 ]};
 save();
 return meta.dailyJourneyRoute;
}
function journeyRouteProgress(){const route=ensureDailyJourneyRoute(),completed=route.completed||[];return{route,completed,next:route.steps.find(step=>!completed.includes(step.id))}}
function renderDailyRoute(){
 const container=$('#dailyRoute');if(!container)return;
 const {route,completed,next}=journeyRouteProgress(),reason=$('#todayExplanation');
 if(reason){
  const explanation=route.explanation||{};
  reason.innerHTML=`<details><summary><span>Why this lesson?</span><strong>${esc(explanation.sequence||'One lesson at a time')}</strong><i>Details</i></summary><p>Learn a small connected set of words from ${esc(currentTopic().title)}, then strengthen them before the next lesson appears.</p></details>`;
 }
 container.innerHTML=route.steps.map((step,itemIndex)=>{
  const done=completed.includes(step.id),available=next?.id===step.id;
  const state=done?'complete':available?'available':'locked';
  const label=done?'✓ Complete':available?(step.optional?'Optional practice':'Start'):'🔒 Locked';
  return `<article class="daily-mission ${state}">
   <span class="mission-step">${done?'✓':itemIndex+1}</span>
   <div><b>${esc(step.icon)} ${esc(step.title)}${step.optional?' <small class="optional-tag">Optional</small>':''}</b><p>${esc(step.detail)}</p></div>
   <button data-journey-mission="${esc(step.id)}"${available?'':' disabled'}>${label}</button>
  </article>`;
 }).join('');
 document.querySelectorAll('[data-journey-mission]').forEach(button=>button.onclick=()=>startJourneyMission(button.dataset.journeyMission));
 const start=$('#startNextMission');
 if(start){
  start.hidden=!next;
  start.textContent=next?(next.optional?`${next.title} (optional)`:`${next.title}`):'Today’s route complete ✓';
  start.disabled=!next;
  start.onclick=()=>next&&startJourneyMission(next.id);
 }
 renderJourneyUnlockNotice();
}
function pendingJourneyUnlock(){
 refreshPathUnlocks();
 return PATH_MILESTONES.find(item=>pathUnlocked(item.id)&&!meta.unlockNoticesSeen.includes(item.id)&&!meta.unlockNoticesDismissed.includes(item.id));
}
function renderJourneyUnlockNotice(){
 const notice=$('#journeyUnlockNotice');if(!notice)return;
 const activity=pendingJourneyUnlock();
 if(!activity){notice.hidden=true;return}
 notice.hidden=false;
 notice.classList.remove('celebrate');
 requestAnimationFrame(()=>notice.classList.add('celebrate'));
 $('#journeyUnlockTitle').textContent=`New activity unlocked: ${activity.activity}`;
 $('#journeyUnlockText').textContent=`${activity.title} is now available. ${activity.description}`;
 $('#journeyUnlockStart').onclick=()=>{
  if(!meta.unlockNoticesSeen.includes(activity.id))meta.unlockNoticesSeen.push(activity.id);
  save();notice.hidden=true;launchPathMilestone(activity.id);
 };
 $('#journeyUnlockDismiss').onclick=()=>{
  if(!meta.unlockNoticesDismissed.includes(activity.id))meta.unlockNoticesDismissed.push(activity.id);
  save();notice.hidden=true;
 };
}
function startJourneyMission(missionId){const {route,completed}=journeyRouteProgress(),mission=route.steps.find(step=>step.id===missionId);if(!mission||completed.includes(mission.id))return;activeJourneyMission={id:mission.id,kind:mission.kind,chapter:mission.chapter,title:mission.title,activityId:mission.activityId||null,startAnswers:Number(meta.totalAnswers||0),startCorrect:Number(meta.totalCorrect||0),startKana:Number(meta.kanaAnswers||0),startKanaCorrect:Number(meta.kanaCorrect||0),startIntroduced:vocab.filter(wordIntroduced).length,targetIds:mission.targetIds||[]};activityReturnScreen='journey';if(mission.kind==='topic'&&route.pendingRepeat?.stepId===mission.id&&route.pendingRepeat.wordIds?.length){const ids=route.pendingRepeat.wordIds.filter(id=>vocab.some(v=>v.id===id));route.pendingRepeat=null;if(ids.length){makeTargetedMasterySession(ids,'retain',mission.title);return}}if(mission.kind==='topic'){startTopicSession(mission.topicId);return}if(mission.kind==='chapter'){startJourneyChapter(mission.chapter);return}if(mission.kind==='activity'){launchPathMilestone(mission.activityId);return}if(mission.kind==='mastery'){if(mission.skill==='components'){openKanjiBuilder(mission.targetIds);startKanjiBuilder();return}makeTargetedMasterySession(mission.targetIds,mission.skill);return}makeSession()}
function finishActiveJourneyMission(){
 if(!activeJourneyMission)return false;
 const mission=activeJourneyMission;activeJourneyMission=null;
 const answers=Math.max(0,Number(meta.totalAnswers||0)-mission.startAnswers)+Math.max(0,Number(meta.kanaAnswers||0)-mission.startKana);
 if(!answers){toast('Mission paused — complete a tested answer when you return');return false}
 const correct=Math.max(0,Number(meta.totalCorrect||0)-Number(mission.startCorrect||0))+Math.max(0,Number(meta.kanaCorrect||0)-Number(mission.startKanaCorrect||0));
 const accuracy=Math.round(correct/answers*100);
 const route=ensureDailyJourneyRoute();
 route.completed=Array.isArray(route.completed)?route.completed:[];
 route.retries=route.retries&&typeof route.retries==='object'?route.retries:{};
 if(mission.activityId)meta.pathVisits[mission.activityId]=Date.now();
 // Mastery gate: a topic lesson or a side-quest activity that's answered
 // shakily (under 75% with a real sample size) gets repeated rather than
 // marked complete, up to two extra tries, so the journey only advances
 // once a lesson is actually learned rather than merely attempted.
 const gatable=(mission.kind==='topic'||mission.kind==='activity')&&answers>=4;
 const retries=Number(route.retries[mission.id]||0);
 const needsRepeat=gatable&&accuracy<75&&retries<2;
 if(needsRepeat){
  route.retries[mission.id]=retries+1;
  if(mission.kind==='topic'){const lastEntry=historyEntries()[0];if(lastEntry?.wordIds?.length)route.pendingRepeat={stepId:mission.id,wordIds:[...lastEntry.wordIds]}}
  renderDailyRoute();save();
  requestAnimationFrame(()=>{const dialog=$('#missionSummaryDialog');if(!dialog)return;$('#missionSummaryTitle').textContent='Let’s go over that again';$('#missionSummaryContent').innerHTML=`<div class="mission-summary-stats"><article><strong>${answers}</strong><span>Tested answers</span></article><article><strong>${accuracy}%</strong><span>Accuracy</span></article></div><p>${esc(mission.title)} needs a little more practice before moving on — accuracy was ${accuracy}%. The same lesson is queued up again whenever you're ready.</p>`;if(!dialog.open)dialog.showModal()});
  return true;
 }
 if(!route.completed.includes(mission.id))route.completed.push(mission.id);
 renderDailyRoute();
 const introduced=Math.max(0,vocab.filter(wordIntroduced).length-mission.startIntroduced),remaining=route.steps.length-route.completed.length;
 save();
 const title=remaining?`${mission.title} complete`:'Today’s route complete!';
 const immersiveStep=mission.kind==='chapter'?route.steps.find(step=>step?.kind==='activity'&&step?.sideQuestFor===mission.id&&!route.completed.includes(step.id)):null;
 const immersive=immersiveStep?.mission;
 const missionCard=immersive?`<section class="lesson-real-world-mission"><span>${esc(immersive.icon)}</span><div><strong>Optional real-world mission · ${esc(immersive.label)}</strong><p>${esc(immersive.objective)}${immersive.vocabulary?` Reinforces ${esc(immersive.vocabulary)}.`:''}</p></div><button id="startLessonRealWorldMission" class="primary">Start mission</button></section>`:'';
 const content=`<div class="mission-summary-stats"><article><strong>${answers}</strong><span>Tested answers</span></article>${answers>=4?`<article><strong>${accuracy}%</strong><span>Accuracy</span></article>`:''}<article><strong>${introduced}</strong><span>Words introduced</span></article><article><strong>${route.completed.length}/${route.steps.length}</strong><span>Route missions</span></article></div><p>${remaining?`${remaining} mission${remaining===1?'':'s'} remain on today’s recommended route.`:'Excellent work—your reviews, vocabulary and activity practice are complete for today.'}</p>${missionCard}`;
 requestAnimationFrame(()=>{const dialog=$('#missionSummaryDialog');if(!dialog)return;$('#missionSummaryTitle').textContent=title;$('#missionSummaryContent').innerHTML=content;const start=$('#startLessonRealWorldMission');if(start&&immersiveStep)start.onclick=()=>{dialog.close();beginLessonImmersive(immersiveStep.activityId)};if(!dialog.open)dialog.showModal()});
 return true;
}
const KAISHI_SHARE_URL='https://terryjread-sudo.github.io/Kakashi-Web/';
let activeFriendInviteUrl=KAISHI_SHARE_URL;
function inviteText(url=activeFriendInviteUrl){return`I’m learning Japanese with Kaishi Quest! Join me on the 1,500-word journey: ${url}`}
async function prepareFriendInvite(){
 const generated=await window.KaishiCloud?.createFriendInviteLink?.();
 if(!generated)return null;
 activeFriendInviteUrl=generated;
 const whatsapp=$('#shareWhatsApp');
 if(whatsapp)whatsapp.href=`https://wa.me/?text=${encodeURIComponent(inviteText(generated))}`;
 return generated;
}
async function openInviteDialog(){
 const dialog=$('#shareDialog');if(!dialog)return;
 const url=await prepareFriendInvite();
 if(!url)return;
 if(!dialog.open)dialog.showModal();requestAnimationFrame(()=>{dialog.scrollTop=0;dialog.querySelector('.activity-unlock-scene')?.scrollTo({top:0})});
}
async function nativeShareInvite(){
 const url=activeFriendInviteUrl!==KAISHI_SHARE_URL?activeFriendInviteUrl:await prepareFriendInvite();
 if(!url)return;
 if(navigator.share){
  try{
   await navigator.share({title:'Kaishi Quest',text:'Join me on the 1,500-word Japanese journey!',url});
   return;
  }catch(error){if(error?.name==='AbortError')return}
 }
 openInviteDialog();
}
async function copyInviteLink(){
 const url=activeFriendInviteUrl!==KAISHI_SHARE_URL?activeFriendInviteUrl:await prepareFriendInvite();
 if(!url)return;
 try{await navigator.clipboard.writeText(url);toast('Secure invitation link copied')}
 catch{prompt('Copy this invitation link:',url)}
}
async function achievementBlob(){const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1080;const ctx=canvas.getContext('2d'),gradient=ctx.createLinearGradient(0,0,1080,1080);gradient.addColorStop(0,'#172554');gradient.addColorStop(.58,'#2563eb');gradient.addColorStop(1,'#7c3aed');ctx.fillStyle=gradient;ctx.fillRect(0,0,1080,1080);ctx.fillStyle='#ffffff18';for(let index=0;index<8;index++){ctx.beginPath();ctx.arc(100+index*150,120+index%2*650,90,0,Math.PI*2);ctx.fill()}const position=wordJourneyPosition(),username=$('#dashboardAvatarTitle')?.textContent?.startsWith('@')?$('#dashboardAvatarTitle').textContent:'Kaishi learner';ctx.fillStyle='#fff';ctx.font='800 58px system-ui';ctx.fillText('KAISHI QUEST',80,110);ctx.font='900 88px system-ui';ctx.fillText('My Japanese Journey',80,235);ctx.font='700 48px system-ui';ctx.fillStyle='#dbeafe';ctx.fillText(username,80,315);try{const image=new Image();image.src=pathAvatarSource();await image.decode();ctx.save();ctx.beginPath();if(ctx.roundRect)ctx.roundRect(80,385,300,300,54);else ctx.rect(80,385,300,300);ctx.clip();ctx.drawImage(image,80,385,300,300);ctx.restore()}catch{}ctx.fillStyle='#fff';ctx.font='900 116px system-ui';ctx.fillText(String(position.explored),450,500);ctx.font='700 40px system-ui';ctx.fillStyle='#bfdbfe';ctx.fillText('WORDS INTRODUCED',455,555);ctx.fillStyle='#fff';ctx.font='900 90px system-ui';ctx.fillText(`${position.completed}/${position.total}`,450,660);ctx.font='700 40px system-ui';ctx.fillStyle='#ddd6fe';ctx.fillText('CHAPTERS COMPLETE',455,715);ctx.fillStyle='#fff';ctx.font='800 45px system-ui';ctx.fillText(`LEARNING RHYTHM · ${Number(meta.streak||0)} days`,80,835);ctx.font='650 34px system-ui';ctx.fillStyle='#dbeafe';ctx.fillText('Join me on the 1,500-word Japanese adventure',80,925);ctx.font='650 28px system-ui';ctx.fillText('terryjread-sudo.github.io/Kakashi-Web',80,990);return new Promise(resolve=>canvas.toBlob(resolve,'image/png'))}
async function shareAchievement(){const blob=await achievementBlob();if(!blob){toast('Could not create the achievement image');return}const file=typeof File==='function'?new File([blob],'kaishi-quest-progress.png',{type:'image/png'}):null,data=file?{files:[file],title:'My Kaishi Quest journey',text:'Join me learning Japanese with Kaishi Quest!'}:null;if(file&&navigator.canShare?.({files:[file]})){try{await navigator.share(data);return}catch(error){if(error?.name==='AbortError')return}}const link=document.createElement('a');link.download='kaishi-quest-progress.png';link.href=URL.createObjectURL(blob);link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);toast('Achievement image downloaded — it is ready for Instagram or another app')}
function pathAvatarSource(){return $('#dashboardAvatar')?.src||`media/profiles/boy-base.webp?v=${APP_VERSION}`}
function renderJourneyHome(){
 settings.playMode='journey';const classic=$('#classicActions'),journeyHome=$('#journeyHome'),kanjiButton=$('#kanjiOverviewBtn');if(classic)classic.hidden=true;if(journeyHome)journeyHome.hidden=false;if($('#conversationContinue'))$('#conversationContinue').hidden=true;if(!journeyHome)return;
 const lessonIndex=currentWordChapterIndex();const {route,completed,next}=journeyRouteProgress(),topic=currentTopic(),stats=chapterStats(lessonIndex);
 if(kanjiButton){kanjiButton.disabled=!pathUnlocked('kanji');kanjiButton.querySelector('small').textContent=pathUnlocked('kanji')?'View progress →':'Unlock at Kanji Gate'}
 $('#journeyHomeAvatar').src=pathAvatarSource();$('#journeyHomeTitle').textContent=next?next.title:'Your path is complete!';$('#journeyHomeActivity').textContent=`Lesson ${lessonIndex+1} is ready. Learn its ${stats.words.length} connected words, then continue to the next step.`;$('#currentTopicTitle').textContent=`${topic.icon||'🗺️'} Lesson ${lessonIndex+1}`;$('#currentTopicStatus').textContent=`${stats.introduced}/${stats.words.length} words · ${stats.percent}%`;$('#journeyHomeProgress').textContent=`${completed.length}/${route.steps.length} lesson step`;$('#journeyHomeFill').style.width=`${Math.max(3,stats.percent)}%`;if($('#homeReviewCount'))$('#homeReviewCount').textContent=dailyDueWords().length;
}
let selectedVillageActivity=null;
function activityPreview(id,count){
 if(id==='picture')return `${count} illustrated cards · beginner-first picture modes`;
 if(id==='listening')return `${count} audio-enabled words`;
 if(id==='karuta')return `${count} illustrated audio cards`;
 if(id==='conversation')return `Conversations scoped to your introduced vocabulary`;
 if(id==='sentenceLab')return `5 guided real-world labs · 7 understanding stages in each`;
 if(id==='theatre')return `Scenes filtered to familiar vocabulary where metadata is available`;
 if(id==='builder'||id==='kanji')return `${count} introduced Kanji words`;
 return `${count} introduced words available`;
}
function openActivityUnlock(id){
 const item=PATH_MILESTONES.find(x=>x.id===id);if(!item)return;
 selectedVillageActivity=id;
 const state=activityReadiness(id),cfg=state.cfg,dialog=$('#activityUnlockDialog'),guidedSentenceLab=id==='sentenceLab';
 $('#activityUnlockBuilding').textContent=item.icon;
 $('#activityUnlockName').textContent=item.title;
 $('#activityUnlockDescription').textContent=item.description;
 $('#activityWordProgress').textContent=guidedSentenceLab?'Guided':`${state.supported} / ${cfg.words}`;
 $('#activityWordBar').style.width=`${cfg.words?Math.min(100,state.supported/cfg.words*100):100}%`;
 $('#activityWordNeed').textContent=guidedSentenceLab?'Every phrase is taught before testing':state.wordReady?'Enough familiar vocabulary':`${cfg.words-state.supported} more supported words needed`;
 $('#activityApProgress').textContent=`${adventurePoints()} / ${cfg.cost} AP`;
 $('#activityApBar').style.width=`${cfg.cost?Math.min(100,adventurePoints()/cfg.cost*100):100}%`;
 $('#activityApNeed').textContent=state.apReady?'Enough Adventure Points':`${cfg.cost-adventurePoints()} more AP needed`;
 $('#activityLifetimeXp').textContent=lifetimeXp().toLocaleString();
 $('#activityAvailableAp').textContent=adventurePoints().toLocaleString();
 $('#activityContentPreview').innerHTML=`<strong>What opens here</strong><p>${esc(activityPreview(id,state.supported))}</p><small>${guidedSentenceLab?'Each lab teaches its complete sentence before asking you to understand or rebuild it.':'Activities only test introduced words supported by this location.'}</small>`;
 const action=$('#activityUnlockAction');
 if(state.purchased){action.textContent='Practice';action.disabled=false;action.dataset.mode='practice'}
 else if(state.wordReady&&state.apReady){action.textContent=`${cfg.action} · ${cfg.cost} AP`;action.disabled=false;action.dataset.mode='unlock'}
 else{
  const wordsNeeded=Math.max(0,cfg.words-state.supported),apNeeded=Math.max(0,cfg.cost-adventurePoints());
  action.textContent=wordsNeeded?`Learn ${wordsNeeded} more supported word${wordsNeeded===1?'':'s'}`:`Earn ${apNeeded} more AP`;
  action.disabled=false;
  action.dataset.mode='learn';
 }
 $('#activityTeacherMessage').textContent=state.purchased
  ?guidedSentenceLab?'This guided location is open from the beginning. I will explain every phrase before it is tested.':`This location is open. I will only use words you have already met.`
  :state.wordReady&&state.apReady
   ?`You know enough Japanese to enjoy this location, and you have enough Adventure Points to restore it.`
   :!state.wordReady
    ?`Keep learning. Once you know ${cfg.words} supported words, this activity will have enough substance to be enjoyable.`
    :`Your vocabulary is ready. Keep learning to earn the remaining Adventure Points.`;
 window.KaishiEngagement?.decorateActivityDialog?.(id);
 action.onclick=()=>{
  const current=activityReadiness(id);
  if(action.dataset.mode==='learn'){
   dialog.close();clearVillageFocus();
   openJourney('current');
   requestAnimationFrame(()=>document.querySelector('.word-chapter.current')?.scrollIntoView({behavior:'smooth',block:'center'}));
   toast(current.wordReady?'Complete learning activities to earn more Adventure Points':`Keep learning to introduce ${Math.max(0,current.cfg.words-current.supported)} more supported words`);
   return;
  }
  if(!current.purchased){
   if(!current.wordReady||!current.apReady)return;
   meta.activityPurchases.push(id);meta.adventurePointsSpent+=current.cfg.cost;save();
   dialog.classList.add('unlocking');dialog.close();renderJourney();playVillageRestoration(id);
   setTimeout(()=>{dialog.classList.remove('unlocking');clearVillageFocus();launchVillageActivity(id)},1650);
  }else{dialog.close();clearVillageFocus();launchVillageActivity(id)}
 };
 $('#activityContinueJourney').onclick=()=>{dialog.close();clearVillageFocus()};
 $('#activityUnlockClose').onclick=()=>{dialog.close();clearVillageFocus()};
 if(!dialog.open)dialog.showModal();
}
function launchVillageActivity(id){
 activityReturnScreen='journey';
 if(id==='picture'){
  const level=Number(meta.activityModeLevels.picture||1);
  startPictureGame(level<=1?'picture-english-word':level===2?'picture-word':'word-picture');return;
 }
 launchPathMilestone(id,true);
}
const VILLAGE_HOTSPOTS=[
 {id:'battle',label:'Castle Keep',x:64,y:2,w:28,h:17},
 {id:'theatre',label:'Kaishi Theatre',x:4,y:15,w:30,h:16},
 {id:'builder',label:'Builder Forge',x:67,y:24,w:28,h:16},
 {id:'kana',label:'Kana Bridge',x:37,y:26,w:25,h:11},
 {id:'grammar',label:'Particle Shrine',x:36,y:39,w:26,h:15},
 {id:'sentenceLab',label:'Sentence Lab',x:3,y:48,w:26,h:14},
 {id:'listening',label:'Audio Dojo',x:68,y:46,w:28,h:15},
 {id:'picture',label:'Picture Meadow',x:33,y:57,w:33,h:15},
 {id:'manga',label:'Manga Library',x:2,y:67,w:29,h:15},
 {id:'vocabulary',label:'Starting Village',x:67,y:71,w:29,h:17}
];
function clearVillageFocus(){const stage=$('.village-map-stage');if(stage){stage.classList.remove('location-focused');stage.style.removeProperty('--focus-x');stage.style.removeProperty('--focus-y')}}
function focusVillageLocation(id,button){
 const stage=$('.village-map-stage');
 if(!stage){openActivityUnlock(id);return}
 const point=VILLAGE_HOTSPOTS.find(item=>item.id===id);
 if(point){stage.style.setProperty('--focus-x',`${point.x+point.w/2}%`);stage.style.setProperty('--focus-y',`${point.y+point.h/2}%`)}
 stage.classList.add('location-focused');
 setTimeout(()=>openActivityUnlock(id),260);
}
function playVillageRestoration(id){
 const layer=$('#villageRestorationLayer'),point=VILLAGE_HOTSPOTS.find(item=>item.id===id);if(!layer||!point)return;
 layer.innerHTML=`<i class="restoration-fx" style="--fx-x:${point.x+point.w/2}%;--fx-y:${point.y+point.h/2}%"></i>`;
 setTimeout(()=>layer.innerHTML='',1700);
}

let villageCatTimer=null;
const VILLAGE_CAT_SPOTS=[
 {id:'theatre',x:37,y:37},{id:'battle',x:62,y:24},{id:'builder',x:64,y:43},
 {id:'kana',x:49,y:36},{id:'grammar',x:66,y:57},{id:'listening',x:64,y:64},
 {id:'picture',x:31,y:66},{id:'manga',x:35,y:82},{id:'vocabulary',x:65,y:84},
 {id:'vocabulary',x:52,y:88},{id:'picture',x:50,y:76}
];
function villageCatSpotIsClear(spot){
 const margin=5;
 return !VILLAGE_HOTSPOTS.some(point=>{
  const state=activityReadiness(point.id);
  const insideBuilding=spot.x>point.x-margin&&spot.x<point.x+point.w+margin&&spot.y>point.y-margin&&spot.y<point.y+point.h+margin;
  if(!insideBuilding)return false;
  if(!state.purchased)return true;
  const labelTop=point.y+point.h*.58;
  return spot.y>labelTop-margin;
 });
}
function placeVillageCat(force=false){
 const cat=$('#villageCat');
 if(!cat||settings.activityVillageMode===false)return;
 const available=VILLAGE_CAT_SPOTS.filter(spot=>activityReadiness(spot.id).purchased&&villageCatSpotIsClear(spot));
 if(!available.length){cat.hidden=true;return}
 const current=cat.dataset.location;
 let choices=available.filter(spot=>force||`${spot.id}:${spot.x}:${spot.y}`!==current);
 if(!choices.length)choices=available;
 const spot=choices[Math.floor(Math.random()*choices.length)];
 cat.hidden=false;cat.dataset.location=`${spot.id}:${spot.x}:${spot.y}`;
 cat.style.setProperty('--cat-x',`${spot.x}%`);
 cat.style.setProperty('--cat-y',`${spot.y}%`);
 cat.classList.remove('cat-arriving');
 requestAnimationFrame(()=>cat.classList.add('cat-arriving'));
 clearTimeout(villageCatTimer);
 villageCatTimer=setTimeout(()=>placeVillageCat(),22000+Math.random()*26000);
}
function setupVillageCat(){
 const cat=$('#villageCat');if(!cat)return;
 cat.onclick=()=>{
  cat.classList.remove('cat-reacting');
  requestAnimationFrame(()=>cat.classList.add('cat-reacting'));
  toast(['The village cat looks pleased to see you.','The cat gives a tiny approving meow.','The cat is keeping watch over your studies.'][Math.floor(Math.random()*3)]);
 };
 placeVillageCat(true);
}

let villageResidentTimer=null,villageResidentDialogueTimer=null;
const VILLAGE_RESIDENTS=[
 {id:'kai',name:'Kai',img:'resident_kai.png',home:'vocabulary',line:'The village feels a little bigger every time you learn something new.'},
 {id:'hana',name:'Hana',img:'resident_hana.png',home:'picture',line:'Pictures are easier to remember when you notice one strong detail.'},
 {id:'scholar',name:'The Scholar',img:'resident_scholar.png',home:'manga',line:'A word becomes useful when you recognise it in a story.'},
 {id:'blacksmith',name:'The Blacksmith',img:'resident_blacksmith.png',home:'builder',line:'Strong skills are forged by short practice, repeated often.'},
 {id:'woodcutter',name:'The Woodcutter',img:'resident_woodcutter.png',home:'builder',line:'One small cut at a time clears even a difficult path.'},
 {id:'farmer',name:'The Farmer',img:'resident_farmer.png',home:'vocabulary',line:'A few words every day grow into a surprisingly large harvest.'},
 {id:'monk',name:'The Monk',img:'resident_monk.png',home:'grammar',line:'Listen for the shape of the sentence before worrying about every word.'},
 {id:'merchant',name:'Travelling Merchant',img:'resident_travelling_merchant.png',home:'theatre',line:'Useful Japanese is the best thing to carry on a journey.'},
 {id:'gardener',name:'Village Gardener',img:'resident_gardener.png',home:'picture',line:'Notice what is familiar first. The rest becomes easier.'},
 {id:'shrine',name:'Shrine Keeper',img:'resident_shrine_keeper.png',home:'kana',line:'Small characters open the way to many more words.'},
 {id:'field',name:'Field Keeper',img:'resident_farmer_pitchfork.png',home:'vocabulary',line:'Practice what is ready today and leave tomorrow’s work for tomorrow.'},
 {id:'herbalist',name:'Village Herbalist',img:'resident_herbalist.png',home:'listening',line:'A quiet repeat can be more useful than rushing to the next answer.'}
];
const VILLAGE_RESIDENT_SPOTS={
 vocabulary:[{x:78,y:86},{x:67,y:92}],picture:[{x:28,y:61},{x:15,y:65}],listening:[{x:70,y:69},{x:86,y:70}],manga:[{x:50,y:83},{x:64,y:88}],kana:[{x:44,y:58}],theatre:[{x:33,y:44}],builder:[{x:71,y:50}],grammar:[{x:28,y:77}]
};
function residentSpotClear(spot){
 const pad=4;
 return !VILLAGE_HOTSPOTS.some(point=>{
  const state=activityReadiness(point.id);if(state.purchased)return false;
  return spot.x>point.x-pad&&spot.x<point.x+point.w+pad&&spot.y>point.y-pad&&spot.y<point.y+point.h+pad;
 });
}
function showVillageResidentDialogue(resident,button){
 const panel=$('#villageResidentDialogue');if(!panel)return;
 $('#villageResidentPortrait').src=`media/activity-village/storybook/${resident.img}?v=${APP_VERSION}`;
 $('#villageResidentPortrait').alt=resident.name;$('#villageResidentName').textContent=resident.name;$('#villageResidentLine').textContent=resident.line;
 panel.hidden=false;clearTimeout(villageResidentDialogueTimer);villageResidentDialogueTimer=setTimeout(()=>panel.hidden=true,5200);
}
function renderVillageResidents(){
 const layer=$('#villageResidentLayer');if(!layer||settings.activityVillageMode===false)return;
 const eligible=VILLAGE_RESIDENTS.flatMap(resident=>{
  if(!activityReadiness(resident.home).purchased)return[];
  return (VILLAGE_RESIDENT_SPOTS[resident.home]||[]).filter(residentSpotClear).map(spot=>({resident,spot}));
 });
 const chosen=shuffle(eligible).slice(0,Math.min(3,eligible.length));
 layer.innerHTML=chosen.map(({resident,spot},i)=>`<button class="village-resident resident-${i+1}" data-resident="${esc(resident.id)}" style="--resident-x:${spot.x}%;--resident-y:${spot.y}%" aria-label="Talk to ${esc(resident.name)}"><img src="media/activity-village/storybook/${resident.img}?v=${APP_VERSION}" alt=""></button>`).join('');
 layer.querySelectorAll('[data-resident]').forEach(button=>button.onclick=e=>{e.stopPropagation();const resident=VILLAGE_RESIDENTS.find(item=>item.id===button.dataset.resident);if(resident)showVillageResidentDialogue(resident,button)});
 clearTimeout(villageResidentTimer);villageResidentTimer=setTimeout(renderVillageResidents,45000);
}
function renderVillageMap(){
 const map=$('#activityVillageMap'),classic=$('#classicActivityView'),practice=$('.practice-hub');
 const enabled=settings.activityVillageMode!==false;
 if(map)map.hidden=!enabled;
 if(classic)classic.hidden=enabled;
 if(practice)practice.hidden=enabled;
 const toggle=$('#activityViewToggle'),description=$('#activityViewDescription');
 if(toggle){toggle.textContent=enabled?'Switch to Classic view':'Switch to Village view';toggle.setAttribute('aria-pressed',String(enabled))}
 if(description)description.textContent=enabled?'Explore the interactive village map.':'Use the familiar activity cards and practice list.';
 const host=$('#villageHotspots'),fogHost=$('#villageFogLayer');if(!host||!enabled)return;
 const points=VILLAGE_HOTSPOTS.map(point=>{
  const item=PATH_MILESTONES.find(entry=>entry.id===point.id),state=activityReadiness(point.id),ready=state.wordReady&&state.apReady;
  if(!item)return null;
  const remainingWords=Math.max(0,state.cfg.words-state.supported);
  const wordPercent=state.cfg.words?Math.max(0,Math.min(100,Math.round(state.supported/state.cfg.words*100))):100;
  const status=state.purchased?'Open':ready?'Ready to restore':'Locked';
  const fogClass=state.purchased?'fog-none':ready?'fog-light':state.supported>=Math.ceil(state.cfg.words*.55)?'fog-medium':'fog-heavy';
  return{point,item,state,ready,status,fogClass,remainingWords,wordPercent};
 }).filter(Boolean);
 if(fogHost)fogHost.innerHTML=points.map(({point,fogClass,state})=>`<i class="village-building-fog ${fogClass}" style="--x:${point.x}%;--y:${point.y}%;--w:${point.w}%;--h:${point.h}%" data-fog-for="${esc(point.id)}" aria-hidden="true"></i>`).join('');
 host.innerHTML=points.map(({point,item,state,ready,status,remainingWords,wordPercent})=>{
  const subline=state.purchased?`<small class="location-open">Open</small>`:ready?`<small class="location-ready">Ready to restore</small>`:`<small class="location-lock-progress" title="${remainingWords} supported word${remainingWords===1?'':'s'} still needed"><span aria-hidden="true">🔒</span><i class="location-progress-track" aria-hidden="true"><b style="width:${wordPercent}%"></b></i></small>`;
  const detail=state.purchased?'Open':ready?'Ready to restore':`${state.supported} of ${state.cfg.words} supported words`;
  return `<button class="village-hotspot ${state.purchased?'open':ready?'ready':'developing'}" data-village-activity="${esc(point.id)}" style="--x:${point.x}%;--y:${point.y}%;--w:${point.w}%;--h:${point.h}%" aria-label="${esc(point.label)}. ${esc(detail)}"><span class="location-panel"><i class="location-icon">${esc(item.icon)}</i><strong>${esc(point.label)}</strong>${subline}</span></button>`;
 }).join('');
 host.querySelectorAll('[data-village-activity]').forEach(button=>button.onclick=()=>focusVillageLocation(button.dataset.villageActivity,button));
 setupVillageCat();
 renderVillageResidents();
}
function setActivityVillageMode(enabled){
 settings.activityVillageMode=Boolean(enabled);save();renderVillageMap();toast(enabled?'Activity Village enabled':'Classic activity view enabled');
}
const ACTIVITY_SKILL_LAYOUT={
 vocabulary:{x:50,y:7},
 kana:{x:25,y:17},picture:{x:75,y:17},
 listening:{x:50,y:28},
 karuta:{x:15,y:39},conversation:{x:50,y:39},grammar:{x:85,y:39},
 kanji:{x:18,y:52},sentenceLab:{x:50,y:52},theatre:{x:82,y:52},
 builder:{x:26,y:65},manga:{x:74,y:65},
 battle:{x:50,y:78},
 colosseum:{x:50,y:90}
};
const ACTIVITY_SKILL_LINKS=[
 ['vocabulary','kana'],['vocabulary','picture'],['kana','listening'],['picture','listening'],
 ['listening','karuta'],['listening','conversation'],['listening','grammar'],['karuta','kanji'],
 ['grammar','sentenceLab'],['conversation','sentenceLab'],['sentenceLab','theatre'],['sentenceLab','manga'],['conversation','theatre'],['kanji','builder'],['kanji','manga'],
 ['theatre','manga'],['builder','battle'],['manga','battle'],['battle','colosseum']
];
function activitySkillWebHtml(){
 const states=Object.fromEntries(PATH_MILESTONES.map(item=>{const state=activityReadiness(item.id);return[item.id,{...state,ready:state.wordReady&&state.apReady}]}));
 const colosseumSupported=introducedWords().filter(word=>!window.KaishiLearning?.wordState||window.KaishiLearning.wordState(word)!=='New').length;
 const colosseumReady=isAdminTestMode()||colosseumSupported>=8;
 states.colosseum={purchased:colosseumReady,ready:colosseumReady,supported:colosseumSupported,cfg:{words:8,cost:0}};
 const links=ACTIVITY_SKILL_LINKS.map(([from,to])=>{const a=ACTIVITY_SKILL_LAYOUT[from],b=ACTIVITY_SKILL_LAYOUT[to],source=states[from],target=states[to];const status=source.purchased&&target.purchased?'unlocked':source.purchased&&(target.ready||target.purchased)?'available':'locked';return`<line class="activity-skill-link ${status}" data-skill-from="${esc(from)}" data-skill-to="${esc(to)}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" vector-effect="non-scaling-stroke"></line>`}).join('');
 const nodes=PATH_MILESTONES.map(item=>{const state=states[item.id],point=ACTIVITY_SKILL_LAYOUT[item.id]||{x:50,y:50},ready=state.ready,progress=state.cfg.words?Math.min(100,state.supported/state.cfg.words*100):100,status=state.purchased?'Unlocked':ready?'Ready':'Locked';return`<article class="activity-skill-node ${state.purchased?'unlocked':ready?'available':'locked'}" style="--skill-x:${point.x}%;--skill-y:${point.y}%;--skill-progress:${progress*3.6}deg"><button data-village-activity="${esc(item.id)}" aria-label="${esc(item.title)}. ${status}. ${state.supported} of ${state.cfg.words} supported words."><span class="activity-skill-orb"><i>${esc(item.icon)}</i></span><strong>${esc(item.title)}</strong><small>${state.purchased?'Open':ready?'Unlock now':`${Math.max(0,state.cfg.words-state.supported)} words`}</small></button></article>`}).join('');
 const colosseumPoint=ACTIVITY_SKILL_LAYOUT.colosseum,remaining=Math.max(0,8-colosseumSupported);
 const colosseumNode=`<article id="kotobaSkillNode" class="activity-skill-node activity-skill-boss ${colosseumReady?'unlocked':'locked'}" style="--skill-x:${colosseumPoint.x}%;--skill-y:${colosseumPoint.y}%;--skill-progress:${Math.min(100,colosseumSupported/8*100)*3.6}deg"><button class="kotoba-open" type="button" ${colosseumReady?'':'disabled'} aria-label="Kotoba Colosseum. ${colosseumReady?'Open':'Locked'}. ${colosseumSupported} of 8 battle-ready words."><span class="activity-skill-orb"><i>⚔️</i></span><strong>Kotoba Colosseum</strong><small>${colosseumReady?'Enter battle':`${remaining} words`}</small></button></article>`;
 return`<div class="activity-skill-web-head"><span><b>Activity Skill Web</b><small>Unlock connected ways to practise</small></span><span class="activity-skill-legend"><i></i> Open <i></i> Ready</span></div><svg class="activity-skill-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${links}</svg>${nodes}${colosseumNode}`;
}
function renderJourney(){
 const lessonIndex=currentWordChapterIndex(),wordPosition=wordJourneyPosition(),masteryState=masterySnapshot(),lesson=chapterStats(lessonIndex);$('#journeyStats').innerHTML=`<article><strong>Lesson ${lessonIndex+1}</strong><span>Current step</span></article><article><strong>${lesson.introduced}/${lesson.words.length}</strong><span>Words introduced</span></article><article><strong>${masteryState.mastered}</strong><span>Words mastered</span></article><article><strong>${wordPosition.completed}/${wordPosition.total}</strong><span>Lessons completed</span></article>`;
 renderDailyRoute();
 renderHistoryTimeline();
 renderJourneyPathAhead();
 document.querySelectorAll('[data-word-chapter]').forEach(button=>button.onclick=()=>startJourneyChapter(+button.dataset.wordChapter));
}
function startTopicBoss(topicId){const topic=journeyTopics().find(item=>item.id===topicId);if(!topic)return;const stats=topicStats(topic);if(!stats.bossReady){toast('Teacher will unlock the boss after more topic practice');return}const skills=['meaning','listening','reading','picture','sentence','production'],pool=shuffle([...topic.words.filter(wordIntroduced),...topicSupportWords(topic,4)]);session=[];pool.slice(0,Math.min(12,pool.length)).forEach((v,i)=>{let skill=skills[i%skills.length];if(skill==='picture'&&!memoryScenes[sceneKey(v)])skill='meaning';if(skill==='sentence'&&!v.sentence&&!v._anki?.sentence)skill='reading';session.push({v,skill,bossTopicId:topic.id})});meta.activeTopicBoss={topicId,correct:0,total:session.length};activityReturnScreen='journey';index=0;current=null;clearMissionResume();showJourneySessionPreview(`${topic.icon||'⚔️'} ${topic.title} — Boss Challenge`)}
function completeTopicBoss(topicId,passed=true){meta.topicProgress=meta.topicProgress||{};meta.topicProgress[topicId]={...(meta.topicProgress[topicId]||{}),bossPassed:passed,bossCompletedAt:Date.now()};const topics=journeyTopics(),index=topics.findIndex(topic=>topic.id===topicId);if(passed&&topics[index+1])meta.topicProgress[topics[index+1].id]={...(meta.topicProgress[topics[index+1].id]||{}),unlocked:true};delete meta.activeTopicBoss;save();toast(passed?'Topic complete — next region unlocked!':'Sensei created a recovery route')}
function renderCollection(tab='words'){const stats=$('#collectionStats'),content=$('#collectionContent');if(!stats||!content)return;const introduced=vocab.filter(wordIntroduced),mnemonics=introduced.filter(word=>memoryScenes[sceneKey(word)]),topics=journeyTopics();stats.innerHTML=`<article><strong>${introduced.length}</strong><span>Words</span></article><article><strong>${kanjiCatalogue().filter(item=>item.status!=='locked').length}</strong><span>Kanji</span></article><article><strong>${mnemonics.length}</strong><span>Mnemonics</span></article><article><strong>${topics.filter(topic=>topicStats(topic).complete).length}/${topics.length}</strong><span>Topics</span></article>`;document.querySelectorAll('[data-collection-tab]').forEach(button=>button.classList.toggle('active',button.dataset.collectionTab===tab));if(tab==='topics')content.innerHTML=topics.map(topic=>{const s=topicStats(topic);return `<article class="collection-item"><span>${esc(topic.icon||'🗾')}</span><div><strong>${esc(topic.title)}</strong><small>${s.introduced}/${s.words.length} words · ${s.complete?'Complete':s.percent+'%'}</small></div></article>`}).join('');else if(tab==='foundations')content.innerHTML=(learningGraph.foundations||[]).map(item=>{const words=introduced.filter(word=>wordFoundationTags(word).includes(item.id));return `<article class="collection-item foundation-item"><span>${esc(item.icon)}</span><div><strong>${esc(item.title)}</strong><small>${words.length} introduced · reused across topics</small><p>${esc(item.description)}</p></div></article>`}).join('');else if(tab==='mnemonics')content.innerHTML=mnemonics.slice(0,100).map(word=>`<article class="collection-word"><strong lang="ja">${esc(word.word)}</strong><span>${esc(word.meaning)}</span><small>${esc(topicForWord(word).title)}</small></article>`).join('')||'<p class="muted">Mnemonic images appear here as you discover words.</p>';else if(tab==='achievements')content.innerHTML=achievementList().map(([icon,title])=>`<article class="achievement"><span>${icon}</span><strong>${esc(title)}</strong></article>`).join('')||'<p class="muted">Continue your adventure to unlock achievements.</p>';else content.innerHTML=introduced.slice(0,200).map(word=>{const foundations=wordFoundationTags(word).map(id=>foundationFor(id)?.title).filter(Boolean);return `<article class="collection-word"><strong lang="ja">${esc(word.word)}</strong><span>${esc(word.reading)} · ${esc(word.meaning)}</span><small>${esc(topicForWord(word).title)}${foundations.length?` · ${esc(foundations.join(', '))}`:''}</small></article>`}).join('')||'<p class="muted">Your discovered words will appear here.</p>'}
function openCollection(tab='words'){renderCollection(tab);show('collection')}
function renderJourneyTimelineWhenReady(){requestAnimationFrame(()=>requestAnimationFrame(()=>window.KaishiJourneyRender?.()))}
function openJourney(section='missions'){show('journey');try{renderJourney()}catch(error){console.error('Journey legacy render failed',error)}renderJourneyTimelineWhenReady();if(section==='missions')requestAnimationFrame(()=>$('#dailyRouteTitle')?.scrollIntoView({behavior:'smooth',block:'start'}));if(section==='current')requestAnimationFrame(()=>document.querySelector('.word-chapter.current')?.scrollIntoView({behavior:'smooth',block:'center'}))}
window.addEventListener('kaishi-journey-ready',()=>{if($('#journey')?.classList.contains('active'))renderJourneyTimelineWhenReady()});
function startJourneyChapter(itemIndex){if(!chapterUnlocked(itemIndex)){toast('Complete the previous vocabulary chapter first');return}activityReturnScreen='journey';activeVocabularyChapter=itemIndex;makeSession(itemIndex)}
function launchPathMilestone(id,fromVillage=false){
 if((pathUnlocked(id)||fromVillage)&&!meta.unlockNoticesSeen.includes(id)){meta.unlockNoticesSeen.push(id);save(false)}
 if(!pathUnlocked(id)&&!fromVillage){openActivityUnlock(id);return}activityReturnScreen='journey';if(activeJourneyMission?.activityId!==id)meta.pathVisits[id]=Date.now();save();renderJourneyHome();
 if(id==='vocabulary'){startJourneyChapter(currentWordChapterIndex());return}if(id==='kana'){openKanaPath();return}if(id==='picture'){startPictureGame('picture-english-word');return}if(id==='listening'){startPictureGame('listen-meaning');return}if(id==='karuta'){startKarutaGame();return}if(id==='conversation'){openConversationLibrary();return}if(id==='grammar'){openGrammarPath();return}if(id==='sentenceLab'){openSentenceLab();return}if(id==='theatre'){openTheatreLibrary();return}if(id==='kanji'){renderKanjiOverview();show('kanjiOverview');return}if(id==='builder'){openKanjiBuilder();return}if(id==='manga'){openMangaLibrary();return}if(id==='battle'){startDecayBattle();return}if(id==='colosseum'){const launch=$('#kotobaColosseumMode');if(typeof launch?.onclick==='function'){launch.onclick();return}toast('Kotoba Colosseum is still loading. Please try again in a moment.')}
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
 const streakTarget=activity.quickStep?3:5,streakTested=activity.quickStep?Math.max(0,Number(activity.tested||0)-Number(activity.quickStartTested||0)):Number(activity.tested||0);$('#streakActivity').textContent=activity.qualified?'Today’s learning complete':`${Math.min(streakTested,streakTarget)} / ${streakTarget} tested answers`;$('#streakActivityFill').style.width=`${Math.min(100,streakTested/streakTarget*100)}%`;
 $('#learnedCount').textContent=started();$('#accuracy').textContent=accuracy()+'%';$('#mastered').textContent=Object.values(progress).filter(mastery).length;$('#kanjiMastered').textContent=kanjiMasteredCount();$('#kanaMastered').textContent=kanaData.length?kanaMastered('hiragana')+kanaMastered('katakana'):0;$('#totalWords').textContent=vocab.length;$('#monsters72h').textContent=recentMonsterVictories();$('#karutaAverage72h').textContent=karutaAverage===null?'—':`${Math.round(karutaAverage).toLocaleString()} pts`;
 if($('#mangaBtn span'))$('#mangaBtn span').textContent=`📖 Manga Stories${mangaStories.length?` · ${mangaCompletedCount()}/${mangaStories.length}`:''}`;
 updateConversationPrompt();
 $('#streak').textContent=`${meta.streak} day${meta.streak===1?'':'s'} · Learning rhythm`;$('#summary').textContent=!started()?'Start gently: Sensei will teach two useful words with no assumed knowledge.':due?`${due} of today's reviews are ready.`:activity.qualified?'Today’s learning is complete. Continue only if you want to.':`Reviews complete. Answer ${streakTarget} tested questions to complete today’s rhythm.`;
 renderSkillScores();updateKanaOverview();updateStreakRescue();window.KaishiCloud?.renderDashboardAvatar?.();renderJourneyHome();renderOwnerPathControls();window.KaishiBonsai?.render?.()
}
function similarity(a='',b=''){a=String(a);b=String(b);let score=0;if(a.length===b.length)score+=3;if(a.slice(-1)===b.slice(-1))score+=2;if(a.slice(-2)===b.slice(-2))score+=3;for(const ch of new Set(a))if(b.includes(ch))score+=1;return score}
function distractors(v,key,n=3){const pool=vocab.filter(x=>x.id!==v.id&&x[key]&&x[key]!==v[key]);const target=v[key]||'';return shuffle(pool.map(x=>({x,score:similarity(target,x[key])+(Math.abs((x.frequency||9999)-(v.frequency||9999))<250?2:0)})).sort((a,b)=>b.score-a.score).slice(0,35)).slice(0,n).map(o=>o.x[key])}
function shuffle(a){return [...a].sort(()=>Math.random()-.5)}
function chooseSkill(v){
 const p=pFor(v.id),allowed=skills=>skills.filter(skill=>skill!=='kanji'||v.word!==v.reading).filter(skill=>skill!=='picture'||memoryScenes[sceneKey(v)]).filter(skill=>skill!=='components'||wordComponentRecords(v).length);
 if(p.stage===0)return'intro';
 const early=allowed(['meaning','listening','reading','picture']);
 if(Number(p.reps||0)<4||Number(p.interval||0)<3)return early.map(skill=>({skill,priority:skillPreferenceWeight(skill)/(1+Number(p.skills[skill]?.attempts||0))*(.9+Math.random()*.2)})).sort((a,b)=>b.priority-a.priority)[0].skill;
 const developing=allowed(['meaning','listening','reading','sentence','kanji','components','production','picture']);
 if(Number(p.interval||0)<21)return developing.map(skill=>({skill,priority:(1-(p.skills[skill]?.strength||0))*(skill==='meaning'||skill==='listening'?1.2:1)*skillPreferenceWeight(skill)*(.85+Math.random()*.3)})).sort((a,b)=>b.priority-a.priority)[0].skill;
 const independent=allowed(['meaning','listening','reading','sentence','kanji','components','production']);
 return independent.map(skill=>({skill,priority:(1-(p.skills[skill]?.strength||0))*skillPreferenceWeight(skill)*(.85+Math.random()*.3)})).sort((a,b)=>b.priority-a.priority)[0].skill;
}
function abortSession(destination='home'){
 if(session.length&&index<session.length&&!pictureGameActive&&!karutaActive&&!battleActive)saveMissionResume();
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
function wordBoundaryMatch(sentence,candidate){if(!sentence||!candidate)return false;const word=typeof candidate==='string'?candidate:candidate.word;if(!word)return false;const isHan=ch=>/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch||'');let idx=sentence.indexOf(word);while(idx!==-1){const before=sentence[idx-1],after=sentence[idx+word.length];if(!isHan(before)&&!isHan(after))return true;idx=sentence.indexOf(word,idx+1)}if(typeof candidate==='string')return false;return sentenceGuideParts(sentence).some(part=>part.kind==='word'&&sentenceTokenMatchesWord(part.text,candidate))}
function sentenceTokenMatchesWord(token,wordObj){if(!token||!wordObj)return false;if(token===wordObj.word)return true;const entry=sentenceLexiconEntry(token);return Boolean(entry&&wordObj.meaning&&entry.meaning===wordObj.meaning&&entry.reading===wordObj.reading)}
function pickLinkedNewWords(pool,count){const unseenPool=pool.filter(v=>!progress[v.id]||Number(progress[v.id].stage||0)===0);if(count<=0||!unseenPool.length)return unseenPool.slice(0,count);for(const word of unseenPool){const sentence=word.sentence||word.exampleSentence||'';if(!sentence)continue;const companion=unseenPool.find(other=>other!==word&&wordBoundaryMatch(sentence,other));if(companion){const rest=unseenPool.filter(w=>w!==word&&w!==companion).slice(0,Math.max(0,count-2));return[word,companion,...rest].slice(0,count)}}return unseenPool.slice(0,count)}
function sessionSentencePlan(words){const fresh=words.filter(word=>Number(pFor(word.id).stage||0)===0);if(!fresh.length)return null;const build=(target,companion,sentence)=>{const chunks=sentenceGuideParts(sentence).filter(part=>part.text);if(chunks.length<2)return null;return{target,companion,sentence,meaning:target.sentenceMeaning||target.exampleSentenceMeaning||'',chunks}};for(const target of fresh){const sentence=target.sentence||target.exampleSentence||'';if(!sentence)continue;const companion=fresh.find(word=>word!==target&&wordBoundaryMatch(sentence,word));if(!companion)continue;const plan=build(target,companion,sentence);if(plan)return plan}for(const target of fresh){const sentence=target.sentence||target.exampleSentence||'';if(!sentence)continue;const companion=words.find(word=>word!==target&&Number(pFor(word.id).stage||0)>0&&wordBoundaryMatch(sentence,word));if(!companion)continue;const plan=build(target,companion,sentence);if(plan)return plan}return null}
function renderSessionSentenceBridge(item){const plan=item.sentencePlan,chosen=[];const freshCompanion=Number(pFor(plan.companion.id).stage||0)===0;const connectors=plan.chunks.filter(chunk=>chunk.kind==='particle'||chunk.kind==='grammar');const connectorList=connectors.length?`<details class="sentence-bridge-connectors" open><summary>Connecting words in this sentence</summary><ul>${connectors.map(chunk=>`<li><b lang="ja">${esc(chunk.text)}</b> — ${esc(chunk.meaning||'connects the sentence')}</li>`).join('')}</ul></details>`:'';const draw=()=>{const remaining=plan.chunks.map((chunk,index)=>({chunk,index})).filter(item=>!chosen.includes(item.index));$('#card').innerHTML=`${senseiBlock(freshCompanion?`You met ${plan.target.word} and ${plan.companion.word} together. Build their real sentence from its meaning, then notice how the connecting words hold it together.`:`${plan.target.word} is brand new — ${plan.companion.word} is a word you already know. Build their real sentence together so the new word sticks, and notice how the connecting words hold it together.`)}<div class="eyebrow">Meaning-first sentence bridge</div><h2>${esc(plan.meaning||'Build this complete thought')}</h2><p class="sentence-bridge-hint">Use every Japanese chunk once, in order.</p><div class="sentence-bridge-answer" lang="ja">${chosen.length?chosen.map(index=>`<span class="${plan.chunks[index].kind!=='word'?'connector':''}">${esc(plan.chunks[index].text)}</span>`).join(''):'<span class="muted">Build the Japanese sentence here</span>'}</div><div class="sentence-bridge-choices">${shuffle(remaining).map(({chunk,index})=>`<button type="button" data-sentence-chunk="${index}" lang="ja">${esc(chunk.text)}</button>`).join('')}</div>${connectorList}${chosen.length===plan.chunks.length?'<button id="checkSentenceBridge" class="primary reveal">Check my sentence</button>':''}`;document.querySelectorAll('[data-sentence-chunk]').forEach(button=>button.onclick=()=>{chosen.push(+button.dataset.sentenceChunk);draw()});const check=$('#checkSentenceBridge');if(check)check.onclick=()=>{const correct=chosen.every((value,index)=>value===index),answer=$('.sentence-bridge-answer');answer.classList.add(correct?'correct':'wrong');const feedback=document.createElement('p');feedback.className=correct?'ok':'guess-feedback';feedback.textContent=correct?'Excellent — the words work together in a complete Japanese thought.':`The natural order is: ${plan.sentence}`;answer.after(feedback);check.disabled=true;setTimeout(()=>grade(plan.target,'sentence',correct?3:1,correct),1200)}};draw()}
function makeSession(chapterIndex=null){
 if(resumeSavedMission())return;
 pictureGameActive=false;session=[];index=0;current=null;introGuidanceCount=0;
 const chapterMode=Number.isInteger(chapterIndex),pool=chapterMode?chapterWords(chapterIndex):vocab;
 if(!pool.length){toast('Learning content is unavailable. Download an offline pack in Settings.');return}
 const due=(chapterMode?pool.filter(v=>progress[v.id]&&Number(progress[v.id].stage||0)>=1&&Number(progress[v.id].due||0)<=Date.now()):dailyDueWords()).sort((a,b)=>pFor(a.id).due-pFor(b.id).due).slice(0,DAILY_REVIEW_TARGET);
 const unseen=pickLinkedNewWords(pool,NEW_WORDS_PER_MISSION);
 let selected=[...new Map([...due,...unseen].map(word=>[word.id,word])).values()];
 if(!selected.length)selected=[...pool].sort((a,b)=>wordPracticeCount(progress[a.id])-wordPracticeCount(progress[b.id])).slice(0,Math.min(DAILY_REVIEW_TARGET,pool.length));
 const queue=selected.map(v=>{const p=pFor(v.id),unknownKana=unknownKanaFor(v).slice(0,1);let skills=p.stage===0?[...(unknownKana.length?['kanaUnlock']:[]),'firstEncounter','intro',...(ankiRecordFor(v)?.sentence?['example']:[]),'meaning']:[chooseSkill(v)];skills=skills.filter(s=>s!=='kanji'||v.word!==v.reading).filter(s=>s!=='picture'||memoryScenes[sceneKey(v)]);return{v,skills}});
 while(queue.some(item=>item.skills.length)&&session.length<MISSION_CARD_LIMIT){const active=queue.filter(item=>item.skills.length).slice(0,ACTIVE_WORD_MIX);active.forEach(item=>{if(item.skills.length&&session.length<MISSION_CARD_LIMIT)session.push({v:item.v,skill:item.skills.shift()})});queue.push(...queue.splice(0,Math.min(ACTIVE_WORD_MIX,queue.length)))}
 for(let i=1;i<session.length;i++)if(session[i].v.id===session[i-1].v.id){const swap=session.findIndex((item,j)=>j>i&&item.v.id!==session[i-1].v.id);if(swap>i)[session[i],session[swap]]=[session[swap],session[i]]}
 const bridge=sessionSentencePlan(selected);if(bridge){if(session.length>=MISSION_CARD_LIMIT)session.pop();session.push({v:bridge.target,skill:'sessionSentence',sentencePlan:bridge})}
 if(!session.length){toast('No cards available for this session.');return}
 clearMissionResume();showJourneySessionPreview(chapterMode?'Your topic learning session':'Your Japanese learning session')
}
function ensureJourneySessionPreview(){let dialog=$('#journeySessionPreviewDialog');if(dialog)return dialog;document.body.insertAdjacentHTML('beforeend','<dialog id="journeySessionPreviewDialog" class="journey-session-preview-dialog"><div class="journey-session-preview"><span class="eyebrow">Session preview</span><h2 id="journeySessionPreviewTitle">Your Japanese learning session</h2><div id="journeySessionPreviewContent"></div><div class="journey-session-preview-actions"><button id="journeySessionPreviewCancel" type="button">Not now</button><button id="journeySessionPreviewStart" class="primary" type="button">Start session</button></div></div></dialog>');return $('#journeySessionPreviewDialog')}
function showJourneySessionPreview(title='Your Japanese learning session'){
 const dialog=ensureJourneySessionPreview();
 const words=[...new Map(session.map(item=>[item.v.id,item.v])).values()];
 pendingSessionRecord=words.length?{title,wordIds:words.map(word=>word.id),startAnswers:Number(meta.totalAnswers||0),startCorrect:Number(meta.totalCorrect||0),redoOf:redoingHistoryId}:null;
 redoingHistoryId=null;
 const newWords=words.filter(word=>Number(pFor(word.id).stage||0)===0),reviewWords=words.filter(word=>Number(pFor(word.id).stage||0)>0);
 const renderWords=list=>list.length?`<div class="journey-session-words">${list.map(word=>`<span><b lang="ja">${esc(word.word)}</b><small>${esc(word.meaning)}</small></span>`).join('')}</div>`:'<p class="muted">None in this session.</p>';
 $('#journeySessionPreviewTitle').textContent=title;
 const matchingConversation=conversations.find(item=>item.turns?.some(turn=>words.some(word=>word.word===turn.targetWord||word.reading===turn.targetWord)));
 const matchingManga=mangaStories.find(story=>story.panels?.some(panel=>words.some(word=>`${word.word}|${word.reading}`===panel.targetKey)));
 const contextHtml=(matchingConversation||matchingManga)?`<section class="journey-context-options"><h3>Use these words in context</h3><p>Immersive activities are optional and only appear when the current lesson has suitable content.</p><div class="journey-context-actions">${matchingConversation?`<button type="button" data-lesson-immersive="conversation">💬 Conversation · ${esc(matchingConversation.title)}</button>`:''}${matchingManga?`<button type="button" data-lesson-immersive="manga">📖 Manga · choose a story</button>`:''}</div></section>`:'';
 $('#journeySessionPreviewContent').innerHTML=`<p>Here is the small set Sensei selected for this session.</p><section><h3>New words <b>${newWords.length}</b></h3>${renderWords(newWords)}</section><section><h3>Reviews <b>${reviewWords.length}</b></h3>${renderWords(reviewWords)}</section>${contextHtml}`;
 document.querySelectorAll('[data-lesson-immersive]').forEach(button=>button.onclick=()=>{const id=button.dataset.lessonImmersive;activeLessonImmersive={id,returnScreen:'journey'};activityReturnScreen='journey';dialog.close();if(id==='conversation'&&matchingConversation)startConversation(matchingConversation);else if(id==='manga')openMangaLibrary();});
 if(!dialog.open)dialog.showModal();
}
function beginJourneySession(){const dialog=$('#journeySessionPreviewDialog');if(dialog?.open)dialog.close();show('study');renderCurrent()}
function cancelJourneySessionPreview(){const dialog=$('#journeySessionPreviewDialog');if(dialog?.open)dialog.close();pendingSessionRecord=null;redoingHistoryId=null;session=[];index=0;current=null;openJourney('missions')}
function makeTargetedMasterySession(ids,skill,title='Your focused practice session'){
 pictureGameActive=false;introGuidanceCount=0;const byId=new Map(vocab.map(word=>[word.id,word])),words=(ids||[]).map(id=>byId.get(id)).filter(Boolean);
 if(!words.length){if(vocab.length)makeSession();else toast('Learning content is loading or unavailable offline.');return}
 session=words.map(v=>({v,skill:skill==='retain'?chooseSkill(v):skill}));index=0;current=null;clearMissionResume();showJourneySessionPreview(title);
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
 if(isAdminTestMode())return true;
 const story=mangaStories[index],done=Number(meta.mangaProgress?.[story?.id]?.completed||0)>0;
 return Boolean(story?.featured)||done||index===0||mangaStories.slice(0,index).filter(previous=>!previous.featured).every(previous=>Number(meta.mangaProgress?.[previous.id]?.completed||0)>0);
}
function mangaTarget(panel){return vocab.find(entry=>`${entry.word}|${entry.reading}`===panel.targetKey)}
function mangaDifficulty(level){return `${'●'.repeat(level)}${'○'.repeat(Math.max(0,4-level))}`}
function mangaStoryUnits(story){return story.format==='comic'?story.pages.length:story.panels.length}
function renderMangaLibrary(){
 const completed=mangaCompletedCount(),panels=mangaStories.reduce((sum,story)=>sum+mangaStoryUnits(story),0);
 $('#mangaLibraryStats').innerHTML=`<article><strong>${completed}/${mangaStories.length}</strong><span>Stories completed</span></article><article><strong>${panels}</strong><span>Pages and reading panels</span></article>`;
 $('#mangaStoryGrid').innerHTML=[...mangaStories].sort((a,b)=>Number(Boolean(b.featured))-Number(Boolean(a.featured))).map(story=>{const index=mangaStories.indexOf(story),state=mangaProgressFor(story.id),done=state.completed>0,unlocked=mangaStoryUnlocked(index),previous=mangaStories.slice(0,index).filter(item=>!item.featured).at(-1),status=done?`✓ Complete · Best ${state.best}%`:unlocked?'Ready to read':`🔒 Complete ${esc(previous?.englishTitle||'the previous story')} to unlock`,unit=story.format==='comic'?`${story.pages.length} swipeable pages`:`${story.panels.length} panels`;return `<button class="manga-story-card ${story.format==='comic'?'manga-comic-card':''}" data-manga-story="${esc(story.id)}"${unlocked?'':' disabled aria-disabled="true"'}><img src="${esc(story.image)}?v=${APP_VERSION}" alt="Manga page for ${esc(story.englishTitle)}"><span class="manga-story-level">${story.format==='comic'?`NEW · Level ${story.difficulty} · ${mangaDifficulty(story.difficulty)} · RTL`:`Level ${story.difficulty} · ${mangaDifficulty(story.difficulty)}`}</span><strong lang="ja">${esc(story.title)}</strong><small>${esc(story.englishTitle)}</small><p>${esc(story.summary)}</p><b>${unit} · ${status}</b></button>`}).join('');
 document.querySelectorAll('[data-manga-story]:not([disabled])').forEach(button=>button.onclick=()=>startMangaStory(mangaStories.find(story=>story.id===button.dataset.mangaStory)));
}
function beginLessonImmersive(id){activeLessonImmersive={id,returnScreen:'journey'};activityReturnScreen='journey';launchPathMilestone(id,true);}
function finishLessonImmersive(){const destination=activeLessonImmersive?.returnScreen||'journey';activeLessonImmersive=null;activityReturnScreen=destination;return destination==='journey'?openJourney('missions'):show(destination)}
function openMangaLibrary(){mangaStory=null;$('#mangaLibrary').hidden=false;$('#mangaReader').hidden=true;renderMangaLibrary();show('manga')}
function startMangaStory(story){
 const storyIndex=mangaStories.findIndex(candidate=>candidate.id===story?.id);
 if(!story||storyIndex<0||!mangaStoryUnlocked(storyIndex))return;
 mangaStory=story;mangaPanelIndex=0;mangaAnswered=false;mangaQuestionAnswered=false;
 if(story.format==='comic'){const state=mangaProgressFor(story.id);mangaComicEnglish=false;mangaRun={completed:false};story.pages.forEach(page=>preloadImageUrl(`${page.image}?v=${APP_VERSION}`));state.attempts++;state.updatedAt=Date.now();save();$('#mangaLibrary').hidden=true;$('#mangaReader').hidden=false;renderMangaComicPage();return}
 const state=mangaProgressFor(story.id),previousTypes=Array.isArray(state.lastQuestionTypes)?state.lastQuestionTypes:[];
 const panelQuestions=story.panels.map((panel,panelIndex)=>chooseMangaQuestion(mangaPanelQuestionPool(panel,mangaTarget(panel)),previousTypes[panelIndex]));
 const finalQuestion=chooseMangaQuestion(mangaStoryQuestionPool(story),state.lastStoryQuestionType);
 mangaRun={correct:0,total:0,panelQuestions,finalQuestion};
 state.attempts++;state.updatedAt=Date.now();state.lastQuestionTypes=panelQuestions.map(question=>question.type);state.lastStoryQuestionType=finalQuestion.type;
 save();$('#mangaLibrary').hidden=true;$('#mangaReader').hidden=false;renderMangaPanel();
}
function mangaComicWords(words=[],balloonIndex=0){return words.map((word,wordIndex)=>word.reading||word.meaning?`<button class="manga-comic-word" lang="ja" data-comic-token="${balloonIndex}-${wordIndex}" data-comic-speech="${encodeURIComponent(word.speech||word.text)}" aria-label="Hear ${esc(word.reading||word.text)}" title="${esc(`${word.reading||word.text}${word.meaning?` · ${word.meaning}`:''}`)}">${esc(word.text)}</button>`:`<span lang="ja">${esc(word.text)}</span>`).join('')}
function mangaComicBalloon(balloon,index){return `<aside class="manga-comic-balloon ${esc(balloon.tone||'speech')}" data-comic-panel="${Number.isInteger(balloon.panel)?balloon.panel:Math.min(index,2)}" style="--balloon-x:${Number(balloon.x)||5}%;--balloon-y:${Number(balloon.y)||5}%;--balloon-w:${Number(balloon.width)||34}%" aria-label="Dialogue ${index+1}"><div class="manga-comic-japanese">${mangaComicWords(balloon.words,index)}</div><p class="manga-comic-english">${esc(balloon.english)}</p><small>${esc(balloon.speaker||'')}</small></aside>`}
function stopMangaComicReading(){if(japaneseSpeech)japaneseSpeech.onend=null;if('speechSynthesis'in window)speechSynthesis.cancel();document.querySelectorAll('.manga-comic-word.is-reading').forEach(word=>word.classList.remove('is-reading'));document.querySelectorAll('.manga-panel-speaker.is-reading').forEach(button=>{button.classList.remove('is-reading');button.setAttribute('aria-pressed','false')})}
function readMangaComicPanel(panelIndex){
 if(!('speechSynthesis'in window)){toast('Japanese speech is not available in this browser');return}if(mangaComicEnglish){mangaComicEnglish=false;renderMangaComicPage();setTimeout(()=>readMangaComicPanel(panelIndex),30);return}stopMangaComicReading();const page=mangaStory.pages[mangaPanelIndex],queue=[];page.balloons.forEach((balloon,balloonIndex)=>{const targetPanel=Number.isInteger(balloon.panel)?balloon.panel:Math.min(balloonIndex,2);if(targetPanel===panelIndex)balloon.words.forEach((word,wordIndex)=>{if(word.reading||word.meaning)queue.push({word,balloonIndex,wordIndex,speaker:(balloon.speaker||'neutral').toLowerCase()})})});const control=document.querySelector(`[data-comic-read-panel="${panelIndex}"]`);control?.classList.add('is-reading');control?.setAttribute('aria-pressed','true');let position=0;const nextWord=()=>{document.querySelector('.manga-comic-word.is-reading')?.classList.remove('is-reading');if(position>=queue.length){control?.classList.remove('is-reading');control?.setAttribute('aria-pressed','false');return}const item=queue[position++],button=document.querySelector(`[data-comic-token="${item.balloonIndex}-${item.wordIndex}"]`);button?.classList.add('is-reading');speakJapanese(item.word.speech||item.word.text,nextWord,item.speaker)};nextWord()
}
function renderMangaComicPage(){
 const page=mangaStory.pages[mangaPanelIndex],last=mangaPanelIndex===mangaStory.pages.length-1;stopMangaComicReading();$('#mangaPanelCounter').textContent=`Page ${mangaPanelIndex+1}/${mangaStory.pages.length} · panels right to left`;
 $('#mangaReaderContent').innerHTML=`<section class="manga-comic-reader ${mangaComicEnglish?'show-english':''}" tabindex="0" aria-label="Right-to-left manga page ${mangaPanelIndex+1} of ${mangaStory.pages.length}"><header class="manga-comic-header"><div><span class="eyebrow">Level ${mangaStory.difficulty} · ${mangaDifficulty(mangaStory.difficulty)} · panels right → left</span><h2 lang="ja">${esc(mangaStory.title)}</h2><p>${esc(mangaStory.englishTitle)}</p></div><button id="mangaComicLanguage" class="manga-language-toggle" aria-pressed="${mangaComicEnglish}">${mangaComicEnglish?'日本語を見る':'English text'}</button></header><div class="manga-comic-page"><img src="${esc(page.image)}?v=${APP_VERSION}" alt="${esc(page.alt)}">${page.balloons.map(mangaComicBalloon).join('')}${[0,1,2].map(panelIndex=>`<button class="manga-panel-speaker" data-comic-read-panel="${panelIndex}" style="--speaker-y:${(panelIndex+1)*33.333}%" aria-label="Read panel ${panelIndex+1} in Japanese" aria-pressed="false">🔊</button>`).join('')}<span class="manga-read-direction" aria-hidden="true">START →</span></div><p class="manga-comic-help">Tap a word or 🔊 to hear Japanese · swipe left → right for the next page</p><nav class="manga-comic-pagination" aria-label="Manga pages"><button id="mangaComicPrevious"${mangaPanelIndex?'':' disabled'}>← Previous</button><div class="manga-comic-dots" dir="rtl">${mangaStory.pages.map((_,index)=>`<button data-comic-page="${index}" class="${index===mangaPanelIndex?'active':''}" aria-label="Page ${index+1}"${index===mangaPanelIndex?' aria-current="page"':''}></button>`).join('')}</div><button id="mangaComicNext" class="primary">${last?'Finish story':'Next page →'}</button></nav></section>`;
 document.querySelectorAll('[data-comic-speech]').forEach(button=>button.onclick=event=>{event.stopPropagation();stopMangaComicReading();speakJapanese(decodeURIComponent(button.dataset.comicSpeech))});document.querySelectorAll('[data-comic-read-panel]').forEach(button=>button.onclick=event=>{event.stopPropagation();readMangaComicPanel(+button.dataset.comicReadPanel)});$('#mangaComicLanguage').onclick=()=>{stopMangaComicReading();mangaComicEnglish=!mangaComicEnglish;renderMangaComicPage()};$('#mangaComicPrevious').onclick=()=>changeMangaComicPage(-1);$('#mangaComicNext').onclick=()=>last?finishMangaComic():changeMangaComicPage(1);document.querySelectorAll('[data-comic-page]').forEach(button=>button.onclick=()=>{stopMangaComicReading();mangaPanelIndex=+button.dataset.comicPage;renderMangaComicPage()});const reader=document.querySelector('.manga-comic-reader');let swipeX=0;reader.onpointerdown=event=>swipeX=event.clientX;reader.onpointerup=event=>{const distance=event.clientX-swipeX;if(Math.abs(distance)>55){if(distance>0&&!last)changeMangaComicPage(1);if(distance<0&&mangaPanelIndex)changeMangaComicPage(-1)}};reader.onkeydown=event=>{if(event.key==='ArrowRight'&&!last)changeMangaComicPage(1);if(event.key==='ArrowLeft'&&mangaPanelIndex)changeMangaComicPage(-1)};
}
function changeMangaComicPage(direction){stopMangaComicReading();mangaPanelIndex=Math.max(0,Math.min(mangaStory.pages.length-1,mangaPanelIndex+direction));const state=mangaProgressFor(mangaStory.id);state.lastPanel=Math.max(state.lastPanel,mangaPanelIndex);state.updatedAt=Date.now();save(false);renderMangaComicPage()}
function finishMangaComic(){const state=mangaProgressFor(mangaStory.id);if(!mangaRun.completed){mangaRun.completed=true;state.completed=Number(state.completed||0)+1;state.best=100;state.completedAt=Date.now();state.updatedAt=Date.now();recordMeaningfulActivity('manga');save()}updateHome();$('#mangaPanelCounter').textContent='Complete';$('#mangaReaderContent').innerHTML=`<section class="manga-comic-complete"><span class="eyebrow">Right-to-left manga complete</span><h2 lang="ja">${esc(mangaStory.title)}</h2><p>You followed a complete real-world story across ${mangaStory.pages.length} manga pages.</p><div class="manga-summary-grid"><article><strong>${mangaStory.pages.length}</strong><span>Pages read</span></article><article><strong>${mangaStory.pages.reduce((sum,page)=>sum+page.balloons.length,0)}</strong><span>Dialogue balloons</span></article></div><button id="mangaReplay" class="primary">Read again</button><button id="mangaDone">Choose another story</button></section>`;$('#mangaReplay').onclick=()=>startMangaStory(mangaStory);$('#mangaDone').onclick=()=>activeLessonImmersive?finishLessonImmersive():openMangaLibrary}
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
 const panelStories=mangaStories.filter(story=>Array.isArray(story.panels));
 const sameLevel=panelStories.filter(story=>story.id!==mangaStory.id&&story.difficulty===mangaStory.difficulty).flatMap(story=>story.panels.map(candidate=>candidate[field]));
 const all=panelStories.flatMap(story=>story.panels.map(candidate=>candidate[field]));
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
 const state=mangaProgressFor(mangaStory.id),score=Math.round(mangaRun.correct/mangaRun.total*100),targets=[...new Map(mangaStory.panels.map(panel=>{const target=mangaTarget(panel);return[target?.id,target]}).filter(([id])=>id)).values()];updateHome();$('#mangaPanelCounter').textContent='Complete';$('#mangaReaderContent').innerHTML=`<span class="eyebrow">Manga story complete</span><h2 lang="ja" class="manga-summary-title">${esc(mangaStory.title)}</h2><div class="manga-summary-grid"><article><strong>${score}%</strong><span>This reading</span></article><article><strong>${state.best}%</strong><span>Personal best</span></article><article><strong>${mangaStory.panels.length}</strong><span>Panels read</span></article><article><strong>${targets.length}</strong><span>Words reinforced</span></article></div><section class="manga-glossary"><h3>Story vocabulary</h3>${targets.map(target=>`<button data-manga-audio="${encodeURIComponent(target.wordAudio||'')}"><strong lang="ja">${esc(target.word)}</strong><span>${esc(target.reading)}</span><small>${esc(target.meaning)}</small></button>`).join('')}</section><p class="battle-summary-note">${todayActivity().qualified?'Today’s streak is protected.':'Keep reading or answer more tested questions to protect today’s streak.'}</p><button id="mangaReplay" class="primary reveal">Read this story again</button><button id="mangaDone" class="reveal">Choose another story</button>`;document.querySelectorAll('[data-manga-audio]').forEach(button=>button.onclick=()=>{const audio=decodeURIComponent(button.dataset.mangaAudio);if(audio)play(audio)});$('#mangaReplay').onclick=()=>startMangaStory(mangaStory);$('#mangaDone').onclick=()=>activeLessonImmersive?finishLessonImmersive():openMangaLibrary;
}
function conversationProgressFor(id){return meta.conversationProgress[id]||(meta.conversationProgress[id]={completed:0,best:0,attempts:0,lastTurn:0,updatedAt:0})}
function conversationCompletedCount(){return conversations.filter(item=>Number(meta.conversationProgress?.[item.id]?.completed||0)>0).length}
function conversationUnlocked(itemIndex){
 if(isAdminTestMode())return true;
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
function grammarLessonUnlocked(itemIndex){return isAdminTestMode()||itemIndex===0||Number(grammarState(grammarLessons[itemIndex-1]?.id).completed||0)>0}
function grammarCompletedCount(){return grammarLessons.filter(lesson=>Number(meta.grammarProgress?.[lesson.id]?.completed||0)>0).length}
function openGrammarPath(){grammarLesson=null;grammarRun=null;$('#grammarLibrary').hidden=false;$('#grammarReader').hidden=true;const completed=grammarCompletedCount(),answers=Number(meta.grammarAnswers||0),accuracy=answers?Math.round(Number(meta.grammarCorrect||0)/answers*100):0;$('#grammarStats').innerHTML=`<article><strong>${completed}/${grammarLessons.length}</strong><span>Lessons complete</span></article><article><strong>${answers}</strong><span>Questions answered</span></article><article><strong>${accuracy}%</strong><span>Grammar accuracy</span></article>`;$('#grammarGrid').innerHTML=grammarLessons.map((lesson,itemIndex)=>{const state=grammarState(lesson.id),unlocked=grammarLessonUnlocked(itemIndex),status=state.completed?`✓ Complete · Best ${state.best}%`:unlocked?'Ready to learn':`🔒 Complete ${esc(grammarLessons[itemIndex-1]?.title||'the previous lesson')}`;return `<button class="grammar-lesson-card ${state.completed?'complete':''}" data-grammar-lesson="${itemIndex}"${unlocked?'':' disabled'}><span>${itemIndex+1}</span><div><strong>${esc(lesson.title)}</strong><small lang="ja">${esc(lesson.japanese)}</small><p>${esc(lesson.summary)}</p><b>${status}</b></div></button>`}).join('');document.querySelectorAll('[data-grammar-lesson]').forEach(button=>button.onclick=()=>startGrammarLesson(+button.dataset.grammarLesson));show('grammar')}
function startGrammarLesson(itemIndex){if(!grammarLessonUnlocked(itemIndex)){toast('Complete the previous particle lesson first');return}grammarLesson=grammarLessons[itemIndex];grammarQuestionIndex=-1;grammarRun={lessonIndex:itemIndex,questions:shuffle(grammarLesson.questions),correct:0,answered:false};$('#grammarLibrary').hidden=true;$('#grammarReader').hidden=false;renderGrammarTeaching()}
function grammarExampleHTML(example){return `<section class="grammar-example"><p lang="ja">${esc(example.japanese)}</p><span>${esc(example.reading)}</span><strong>${esc(example.english)}</strong><div>${(example.chunks||[]).map(chunk=>`<small>${esc(chunk)}</small>`).join('')}</div><button class="grammarSpeak" data-grammar-speech="${encodeURIComponent(example.japanese)}">🔊 Hear sentence</button></section>`}
function wireGrammarSpeech(){document.querySelectorAll('[data-grammar-speech]').forEach(button=>button.onclick=()=>speakJapanese(decodeURIComponent(button.dataset.grammarSpeech)))}
function renderGrammarTeaching(){const itemIndex=grammarRun.lessonIndex;$('#grammarCounter').textContent=`Lesson ${itemIndex+1} of ${grammarLessons.length}`;$('#grammarContent').innerHTML=`<section class="grammar-teaching"><span class="eyebrow">Particle lesson ${itemIndex+1}</span><h2>${esc(grammarLesson.title)}</h2><p class="grammar-symbol" lang="ja">${esc(grammarLesson.japanese)}</p><p>${esc(grammarLesson.summary)}</p>${grammarLesson.examples.map(grammarExampleHTML).join('')}<button id="startGrammarQuestions" class="primary reveal">Test this lesson →</button></section>`;wireGrammarSpeech();$('#startGrammarQuestions').onclick=()=>{grammarQuestionIndex=0;renderGrammarQuestion()}}
function renderGrammarQuestion(){if(grammarQuestionIndex>=grammarRun.questions.length){finishGrammarLesson();return}const question=grammarRun.questions[grammarQuestionIndex];$('#grammarCounter').textContent=`Question ${grammarQuestionIndex+1}/${grammarRun.questions.length}`;$('#grammarContent').innerHTML=`<section class="grammar-question"><span class="eyebrow">${esc(grammarLesson.title)}</span><p class="grammar-question-sentence" lang="ja">${esc(question.sentence)}</p><h2>${esc(question.prompt)}</h2><div class="choices grammar-choices">${shuffle(question.choices).map(choice=>`<button class="choice" data-grammar-answer="${encodeURIComponent(choice)}">${esc(choice)}</button>`).join('')}</div><section id="grammarFeedback" class="game-feedback" hidden aria-live="polite"></section></section>`;document.querySelectorAll('[data-grammar-answer]').forEach(button=>button.onclick=()=>resolveGrammarAnswer(button,question))}
function resolveGrammarAnswer(button,question){if(grammarRun.answered)return;grammarRun.answered=true;const answer=decodeURIComponent(button.dataset.grammarAnswer),ok=answer===question.answer;if(ok)grammarRun.correct++;meta.grammarAnswers=Number(meta.grammarAnswers||0)+1;meta.grammarCorrect=Number(meta.grammarCorrect||0)+(ok?1:0);meta.totalAnswers=Number(meta.totalAnswers||0)+1;meta.totalCorrect=Number(meta.totalCorrect||0)+(ok?1:0);recordMeaningfulActivity('grammar');document.querySelectorAll('[data-grammar-answer]').forEach(choice=>{const value=decodeURIComponent(choice.dataset.grammarAnswer);choice.disabled=true;if(value===question.answer)choice.classList.add('correct')});button.classList.add(ok?'correct':'wrong');save();const feedback=$('#grammarFeedback');feedback.innerHTML=`<p class="game-result ${ok?'game-result-correct':'game-result-wrong'}">${ok?'Correct!':'Not quite — here is the distinction.'}</p><p>${esc(question.explanation)}</p><button id="grammarNext" class="primary reveal">${grammarQuestionIndex===grammarRun.questions.length-1?'See lesson result':'Next question →'}</button>`;feedback.hidden=false;$('#grammarNext').onclick=()=>{grammarRun.answered=false;grammarQuestionIndex++;renderGrammarQuestion()}}
function finishGrammarLesson(){const state=grammarState(grammarLesson.id),total=grammarRun.questions.length,score=Math.round(grammarRun.correct/Math.max(1,total)*100),passed=grammarRun.correct>=Math.ceil(total*.67);state.attempts++;state.best=Math.max(Number(state.best||0),score);if(passed)state.completed=Number(state.completed||0)+1;save();refreshPathUnlocks();$('#grammarCounter').textContent='Lesson result';$('#grammarContent').innerHTML=`<section class="grammar-result"><div>${passed?'⛩️':'🌱'}</div><span class="eyebrow">${passed?'Lesson complete':'Almost there'}</span><h2>${grammarRun.correct} of ${total} correct</h2><p>${passed?'The next particle lesson is now available.':'Review the distinction and answer at least two questions correctly to unlock the next lesson.'}</p><div><button id="grammarRetry" class="primary">${passed?'Practise again':'Review and retry'}</button><button id="grammarFinish">Back to particle path</button></div></section>`;$('#grammarRetry').onclick=()=>startGrammarLesson(grammarRun.lessonIndex);$('#grammarFinish').onclick=()=>{if(activityReturnScreen==='journey')returnToActivitySource('home');else openGrammarPath()}}

const JAPANESE_VOICE_PROFILES={neutral:{rate:.86,pitch:1},kai:{rate:1.02,pitch:.9,names:/keita|ichiro|kaito|takumi|naoki|daichi|haruto|male/i},boy:{rate:1.02,pitch:.9,names:/keita|ichiro|kaito|takumi|naoki|daichi|haruto|male/i},mia:{rate:1.01,pitch:1.18,names:/nanami|ayumi|haruka|sayaka|kyoko|female/i},girl:{rate:1.01,pitch:1.18,names:/nanami|ayumi|haruka|sayaka|kyoko|female/i},aiko:{rate:.94,pitch:1.08,names:/nanami|ayumi|haruka|sayaka|kyoko|female/i},master:{rate:.78,pitch:.68,names:/keita|ichiro|kaito|takumi|naoki|daichi|haruto|male/i}};
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
 const state=conversationProgressFor(conversation.id),score=Math.round(conversationRun.correct/conversationRun.total*100),targets=conversationTargets(conversation);$('#conversationTurnCounter').textContent='Complete';$('#conversationReaderContent').innerHTML=`<span class="eyebrow">Conversation complete · 会話完了</span><h2 class="conversation-summary-title">${esc(conversation.title)}</h2><div class="manga-summary-grid"><article><strong>${score}%</strong><span>This conversation</span></article><article><strong>${state.best}%</strong><span>Personal best</span></article><article><strong>${conversation.turns.length}</strong><span>Replies practised</span></article><article><strong>${conversationRun.hints}</strong><span>Reading hints</span></article></div><button id="conversationFullAudio" class="audio primary">🔊 Play the complete conversation</button><section class="conversation-transcript"><h3>Conversation transcript</h3>${conversation.turns.map(turn=>`<article><b>${esc(conversation.characterName)}</b><p lang="ja">${esc(turn.line)}</p><small>${esc(turn.meaning)}</small><b>You</b><p lang="ja">${esc(turn.response)}</p><small>${esc(turn.responseMeaning)}</small></article>`).join('')}</section><section class="conversation-glossary"><h3>Linked vocabulary</h3>${targets.length?targets.map(target=>`<button data-conversation-vocab-audio="${encodeURIComponent(target.wordAudio||'')}"><strong lang="ja">${esc(target.word)}</strong><span>${esc(target.reading)}</span><small>${esc(target.meaning)}</small></button>`).join(''):'<p class="muted">This conversation practises useful phrases beyond the current vocabulary catalogue.</p>'}</section><p class="battle-summary-note">${todayActivity().qualified?'Today’s streak is protected.':'Each reply counts toward protecting today’s streak.'}</p><button id="conversationReplay" class="primary reveal">Talk with ${esc(conversation.characterName)} again</button><button id="conversationDone" class="reveal">Choose another conversation</button>`;$('#conversationFullAudio').onclick=()=>speakConversation(conversation.turns.flatMap(turn=>[turn.line,turn.response,turn.reaction]));document.querySelectorAll('[data-conversation-vocab-audio]').forEach(button=>button.onclick=()=>{const audio=decodeURIComponent(button.dataset.conversationVocabAudio);if(audio)play(audio)});$('#conversationReplay').onclick=()=>startConversation(conversation);$('#conversationDone').onclick=()=>activeLessonImmersive?finishLessonImmersive():openConversationLibrary;updateHome();
}

function theatreProgressFor(id){return meta.theatreProgress[id]||(meta.theatreProgress[id]={completed:0,best:0,attempts:0,updatedAt:0})}
function theatreCompletedCount(){return theatreScenes.filter(item=>Number(meta.theatreProgress?.[item.id]?.completed||0)>0).length}
function theatreUnlocked(itemIndex){return isAdminTestMode()||itemIndex===0||theatreScenes.slice(0,itemIndex).every(item=>Number(meta.theatreProgress?.[item.id]?.completed||0)>0)}
function theatreCharacter(scene,id){return scene.characters.find(character=>character.id===id)}
function theatreAsset(path){return `${path}?v=${APP_VERSION}`}
function clearTheatreRecording(){if(theatreMediaRecorder?.state==='recording')theatreMediaRecorder.stop();theatreMediaRecorder=null;theatreRecordingChunks=[];if(theatreRecordingUrl){URL.revokeObjectURL(theatreRecordingUrl);theatreRecordingUrl=''}}
function clearTheatrePlayback(){theatreTimers.forEach(clearTimeout);theatreTimers=[];if('speechSynthesis'in window)speechSynthesis.cancel();theatrePlaybackStarted=0}
function theatrePreview(scene){return `<div class="theatre-card-preview" data-scene="${esc(scene.id)}" style="background-image:url('${esc(theatreAsset(scene.background))}')">${scene.characters.slice(0,2).map(character=>`<img src="${esc(theatreAsset(character.image))}" alt="">`).join('')}</div>`}
function theatreActTracker(active=1){if(!theatreScene?.fiveAct)return'';const labels=['Watch','Understand','Explore','Join','Perform'];return `<nav class="theatre-act-tracker" aria-label="Episode acts">${labels.map((label,i)=>`<span class="${i+1<active?'complete':i+1===active?'active':''}"${i+1===active?' aria-current="step"':''}><b>${i+1}</b><small>${label}</small></span>`).join('')}</nav>`}
function theatreShot(scene,name='wide'){return scene.shots?.[name]||scene.background}
function theatreSpeechFrames(character){return character.speechFrames?.length?character.speechFrames:[character.image,character.talkImage].filter(Boolean)}
function preloadTheatreAssets(scene){[...Object.values(scene.shots||{}),...scene.characters.flatMap(theatreSpeechFrames).filter(Boolean)].forEach(path=>preloadImageUrl(theatreAsset(path)))}
function renderTheatreLibrary(){
 clearTheatrePlayback();const completed=theatreCompletedCount(),questions=theatreScenes.reduce((sum,scene)=>sum+scene.questions.length,0),displayScenes=[...theatreScenes].sort((a,b)=>Number(Boolean(b.featured))-Number(Boolean(a.featured)));$('#theatreLibraryStats').innerHTML=`<article><strong>${completed}/${theatreScenes.length}</strong><span>Scenes completed</span></article><article><strong>${questions}</strong><span>Questions in rotation</span></article>`;
 $('#theatreGrid').innerHTML=displayScenes.map(scene=>{const itemIndex=theatreScenes.indexOf(scene),state=theatreProgressFor(scene.id),unlocked=Boolean(scene.featured)||theatreUnlocked(itemIndex),previous=theatreScenes[itemIndex-1],status=state.completed?`✓ Complete · Best ${state.best}%`:scene.fiveAct?'New · Five-act episode':unlocked?'Ready to watch':`🔒 Complete ${esc(previous.title)} to unlock`;return `<button class="theatre-card ${scene.featured?'featured':''}" data-theatre-id="${esc(scene.id)}"${unlocked?'':' disabled aria-disabled="true"'}>${theatrePreview(scene)}<span class="theatre-card-level">${scene.fiveAct?'5 acts · ':''}Level ${scene.level} · ${scene.duration} seconds</span><strong>${esc(scene.title)}</strong><small lang="ja">${esc(scene.japaneseTitle)}</small><p>${esc(scene.summary)}</p><b>${status}</b></button>`}).join('');
 document.querySelectorAll('#theatreGrid [data-theatre-id]:not([disabled])').forEach(button=>button.onclick=()=>startTheatreScene(theatreScenes.find(scene=>scene.id===button.dataset.theatreId)));
}
function openTheatreLibrary(){clearTheatreRecording();theatreScene=null;theatreRun=null;clearTheatrePlayback();$('#theatreLibrary').hidden=false;$('#theatreReader').hidden=true;renderTheatreLibrary();show('theatre')}
function theatreStageHtml(scene,subtitles=false){return `${theatreActTracker(1)}<header class="theatre-heading"><div><span class="eyebrow">${esc(scene.setting)} · Level ${scene.level}</span><h2>${esc(scene.title)}</h2><p lang="ja">${esc(scene.japaneseTitle)}</p></div><span>${scene.duration}-second scene</span></header><div id="theatreStage" class="theatre-stage is-playing" data-scene="${esc(scene.id)}" data-shot="wide" style="background-image:url('${esc(theatreAsset(theatreShot(scene))) }')"><div class="theatre-progress"><i id="theatrePlaybackFill"></i></div><div class="theatre-cut-flash" aria-hidden="true"></div><div class="theatre-prop" aria-hidden="true">${esc(scene.prop||'')}</div>${scene.characters.map(character=>{const frames=theatreSpeechFrames(character),frameClass=frames.length>2?' multi-frame':frames.length<2?' single-frame':'';return `<div class="theatre-character ${esc(character.side)}${frameClass}" data-theatre-character="${esc(character.id)}">${frames.map((frame,index)=>`<img class="theatre-sprite theatre-speech-frame theatre-speech-frame-${index}" src="${esc(theatreAsset(frame))}" alt="${index?'':esc(character.name)}"${index?' aria-hidden="true"':''}>`).join('')}<span class="theatre-voice-waves" aria-hidden="true"><i></i><i></i><i></i></span></div>`}).join('')}<div id="theatreSubtitle" class="theatre-subtitle"${subtitles?'':' hidden'}></div><div id="theatreSpeaker" class="theatre-speaker">Listen carefully…</div></div><p class="theatre-listening-note">${subtitles?'Replay with the Japanese transcript visible.':'Act 1 · Watch naturally. Subtitles stay hidden so you can follow the situation first.'}</p>`}
function startTheatreScene(scene){
 const itemIndex=theatreScenes.findIndex(item=>item.id===scene?.id);if(!scene||itemIndex<0||(!scene.featured&&!theatreUnlocked(itemIndex)))return;clearTheatreRecording();theatreScene=scene;preloadTheatreAssets(scene);const state=theatreProgressFor(scene.id);state.attempts++;state.updatedAt=Date.now();theatreRun={questions:shuffle(scene.questions).slice(0,scene.fiveAct?3:2).map(question=>({...question,choices:shuffle(question.choices)})),questionIndex:0,correct:0,total:0,answered:false,roleIndex:0,roleCorrect:0,shadowIndex:0,shadowed:0};save();$('#theatreLibrary').hidden=true;$('#theatreReader').hidden=false;$('#theatreCounter').textContent='Act 1 of 5 · Watch';show('theatre');playTheatreScene(false,'questions');
}
function playTheatreScene(subtitles=false,returnView='questions'){
 if(!theatreScene)return;clearTheatrePlayback();const content=$('#theatreReaderContent');content.innerHTML=theatreStageHtml(theatreScene,subtitles);$('#theatreCounter').textContent=subtitles?'Transcript replay':'Listening first';theatrePlaybackStarted=Date.now();
 const fill=$('#theatrePlaybackFill'),speaker=$('#theatreSpeaker'),subtitle=$('#theatreSubtitle');const progressTimer=setInterval(()=>{const elapsed=(Date.now()-theatrePlaybackStarted)/1000;if(fill)fill.style.width=`${Math.min(100,elapsed/theatreScene.duration*100)}%`},120);theatreTimers.push(progressTimer);
 theatreScene.timeline.forEach((line,lineIndex)=>{theatreTimers.push(setTimeout(()=>{const stage=$('#theatreStage'),shotName=line.shot||'wide',shot=theatreShot(theatreScene,shotName),nextAt=theatreScene.timeline[lineIndex+1]?.at||theatreScene.duration,speakingMs=Math.max(1200,Math.min((nextAt-line.at)*1000-450,line.line.length*155));document.querySelectorAll('[data-theatre-character]').forEach(sprite=>sprite.classList.remove('speaking','wave','point','offer','look','talk'));if(stage&&stage.dataset.shot!==shotName){stage.dataset.shot=shotName;stage.style.backgroundImage=`url('${theatreAsset(shot)}')`;stage.classList.remove('theatre-cut');void stage.offsetWidth;stage.classList.add('theatre-cut')}stage?.classList.remove('focus-aiko','focus-kai','focus-master');stage?.classList.add(`focus-${line.speaker}`);const sprite=document.querySelector(`[data-theatre-character="${line.speaker}"]`),character=theatreCharacter(theatreScene,line.speaker);sprite?.classList.add('speaking',line.action||'talk');theatreTimers.push(setTimeout(()=>sprite?.classList.remove('speaking'),speakingMs));if(speaker)speaker.textContent=`${character?.name||line.speaker} is speaking`;if(subtitles&&subtitle){subtitle.hidden=false;subtitle.innerHTML=`<span lang="ja">${esc(line.line)}</span><small>${esc(line.reading)}</small>`}speakJapanese(line.line,null,line.speaker)},line.at*1000))});
 theatreTimers.push(setTimeout(()=>{clearInterval(progressTimer);if(fill)fill.style.width='100%';document.querySelectorAll('[data-theatre-character]').forEach(sprite=>sprite.classList.remove('speaking','wave','point','offer','look','talk'));if(speaker)speaker.textContent='Scene complete';theatrePlaybackStarted=0;theatreTimers=[];setTimeout(()=>returnView==='summary'?renderTheatreSummary():returnView==='explore'?renderTheatreExplore():renderTheatreQuestion(),500)},theatreScene.duration*1000));
}
function renderTheatreQuestion(){
 if(!theatreScene||!theatreRun)return;clearTheatrePlayback();const question=theatreRun.questions[theatreRun.questionIndex];theatreRun.answered=false;$('#theatreCounter').textContent=theatreScene.fiveAct?`Act 2 of 5 · Question ${theatreRun.questionIndex+1}/${theatreRun.questions.length}`:`Question ${theatreRun.questionIndex+1}/${theatreRun.questions.length}`;$('#theatreReaderContent').innerHTML=`${theatreActTracker(2)}<div class="theatre-controls"><button id="theatreReplayQuestion" class="audio">🔊 Replay the scene without subtitles</button></div><section class="theatre-question"><span class="theatre-question-progress">Act 2 · Understand · Question ${theatreRun.questionIndex+1} of ${theatreRun.questions.length}</span><h3>${esc(question.prompt)}</h3><div class="choices">${question.choices.map(choice=>`<button class="choice" data-theatre-answer="${encodeURIComponent(choice)}">${esc(choice)}</button>`).join('')}</div><div id="theatreFeedback" class="theatre-feedback" hidden aria-live="polite"></div></section>`;$('#theatreReplayQuestion').onclick=()=>playTheatreScene(false,'questions');document.querySelectorAll('[data-theatre-answer]').forEach(button=>button.onclick=()=>resolveTheatreAnswer(button,question));
}
function resolveTheatreAnswer(button,question){
 if(theatreRun.answered)return;theatreRun.answered=true;const answer=decodeURIComponent(button.dataset.theatreAnswer),ok=answer===question.answer;button.classList.add(ok?'correct':'wrong');document.querySelectorAll('[data-theatre-answer]').forEach(choice=>{if(decodeURIComponent(choice.dataset.theatreAnswer)===question.answer)choice.classList.add('correct');choice.disabled=true});theatreRun.total++;if(ok)theatreRun.correct++;meta.totalAnswers++;if(ok)meta.totalCorrect++;recordMeaningfulActivity('theatre');save();const final=theatreRun.questionIndex===theatreRun.questions.length-1,feedback=$('#theatreFeedback');feedback.hidden=false;feedback.innerHTML=`<p class="game-result ${ok?'game-result-correct':'game-result-wrong'}">${ok?'Correct — you understood the scene.':'Not quite — the correct answer is highlighted.'}</p><p>${esc(question.explanation)}</p><button id="theatreNext" class="primary">${final?'Act 3: Explore the dialogue →':'Next question →'}</button>`;$('#theatreNext').onclick=()=>{if(final){if(theatreScene.fiveAct)renderTheatreExplore();else completeTheatreEpisode()}else{theatreRun.questionIndex++;renderTheatreQuestion()}};feedback.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function completeTheatreEpisode(){const state=theatreProgressFor(theatreScene.id),score=Math.round(theatreRun.correct/Math.max(1,theatreRun.total)*100);state.completed=Number(state.completed||0)+1;state.best=Math.max(Number(state.best||0),score);state.completedAt=Date.now();state.updatedAt=Date.now();state.lastShadowed=Number(theatreRun.shadowed||0);state.lastConfident=Number(theatreRun.confident||0);save();updateHome();renderTheatreSummary()}
function renderTheatreSummary(){
 if(!theatreScene?.fiveAct){renderLegacyTheatreSummary();return}clearTheatrePlayback();clearTheatreRecording();const state=theatreProgressFor(theatreScene.id),score=Math.round(theatreRun.correct/Math.max(1,theatreRun.total)*100),questionScore=`${Math.min(theatreRun.correct,theatreRun.questions.length)}/${theatreRun.questions.length}`,roleScore=`${theatreRun.roleCorrect}/${theatreScene.roleplay.length}`;$('#theatreCounter').textContent='Five acts complete';$('#theatreReaderContent').innerHTML=`${theatreActTracker(6)}<section class="theatre-summary theatre-five-act-summary"><span class="eyebrow">Real-world mission complete · 実践成功</span><h2>You ordered at the café</h2><p>You followed natural speech, understood the situation, examined useful patterns, replied as the customer and performed the key lines aloud.</p><div class="theatre-score"><article><strong>${score}%</strong><span>Understanding</span></article><article><strong>${roleScore}</strong><span>Natural replies</span></article><article><strong>${theatreRun.shadowed}/${theatreScene.shadowing.length}</strong><span>Lines performed</span></article></div><section class="theatre-can-do"><h3>You can now…</h3><ul><li>Order one drink politely with 一つお願いします</li><li>Choose hot or iced with option + でお願いします</li><li>Answer whether an order is for here with 店内で</li></ul></section><div class="theatre-replay-row"><button id="theatreReplayJapanese" class="audio primary">▶ Watch again with subtitles</button><button id="theatrePerformAgain" class="audio">🎙️ Perform again</button></div><p class="battle-summary-note">${todayActivity().qualified?'Today’s streak is protected.':'This complete real-world mission counts toward today’s learning activity.'}</p><button id="theatreAgain" class="primary reveal">Restart all five acts</button><button id="theatreDone" class="reveal">Choose another scene</button></section>`;$('#theatreReplayJapanese').onclick=()=>playTheatreScene(true,'summary');$('#theatrePerformAgain').onclick=()=>{theatreRun.shadowIndex=0;theatreRun.shadowed=0;renderTheatreShadowing()};$('#theatreAgain').onclick=()=>startTheatreScene(theatreScene);$('#theatreDone').onclick=()=>activeLessonImmersive?finishLessonImmersive():openTheatreLibrary
}
function renderTheatreExplore(){
 clearTheatrePlayback();$('#theatreCounter').textContent='Act 3 of 5 · Explore';$('#theatreReaderContent').innerHTML=`${theatreActTracker(3)}<section class="theatre-act-intro"><span class="eyebrow">Act 3 · Investigate the dialogue</span><h2>Build meaning from the complete exchange</h2><p>Replay any line, inspect its reading and notice the practical phrase pattern.</p></section><div class="theatre-replay-row"><button id="theatreExploreReplay" class="audio primary">▶ Replay with Japanese subtitles</button><button id="theatreExploreAudio" class="audio">🔊 Play dialogue only</button></div><section class="theatre-transcript">${theatreScene.timeline.map((line,lineIndex)=>{const character=theatreCharacter(theatreScene,line.speaker);return `<article class="theatre-line"><div class="theatre-line-top"><strong>${esc(character?.name||line.speaker)}</strong><button class="audio" data-theatre-line="${lineIndex}">🔊 Hear line</button></div><p lang="ja">${esc(line.line)}</p><small>${esc(line.reading)}</small><p class="theatre-line-meaning">${esc(line.meaning)}</p>${line.focus?`<div class="theatre-phrase-focus"><b>Useful pattern</b><span>${esc(line.focus)}</span></div>`:''}</article>`}).join('')}</section><button id="theatreJoinAct" class="primary theatre-act-next">Act 4: Join the scene →</button>`;$('#theatreExploreReplay').onclick=()=>playTheatreScene(true,'explore');$('#theatreExploreAudio').onclick=()=>speakConversation(theatreScene.timeline.map(line=>line.line));document.querySelectorAll('[data-theatre-line]').forEach(button=>button.onclick=()=>{const line=theatreScene.timeline[+button.dataset.theatreLine];speakJapanese(line.line,null,line.speaker)});$('#theatreJoinAct').onclick=()=>{theatreRun.roleIndex=0;renderTheatreRoleplay()}
}
function renderTheatreRoleplay(){
 clearTheatrePlayback();const role=theatreScene.roleplay?.[theatreRun.roleIndex];if(!role){theatreRun.shadowIndex=0;renderTheatreShadowing();return}const character=theatreCharacter(theatreScene,role.speaker);$('#theatreCounter').textContent=`Act 4 of 5 · Reply ${theatreRun.roleIndex+1}/${theatreScene.roleplay.length}`;$('#theatreReaderContent').innerHTML=`${theatreActTracker(4)}<section class="theatre-act-intro"><span class="eyebrow">Act 4 · Join the scene</span><h2>You are the customer</h2><p>Listen to Aiko, then choose the natural Japanese response you would use.</p></section><section class="theatre-roleplay-stage"><img src="${esc(theatreAsset(character.image))}" alt="${esc(character.name)}"><div><strong>${esc(character.name)}</strong><p lang="ja">${esc(role.prompt)}</p><small>${esc(role.reading)}</small><span>${esc(role.meaning)}</span><button id="theatreRolePrompt" class="audio">🔊 Hear Aiko</button></div></section><div class="theatre-role-choices">${shuffle(role.choices).map((choice,index)=>`<button data-role-choice="${encodeURIComponent(choice.line)}" data-role-correct="${choice.correct?'true':'false'}"><strong lang="ja">${esc(choice.line)}</strong><small>${esc(choice.reading)}</small><span>${esc(choice.meaning)}</span></button>`).join('')}</div><div id="theatreRoleFeedback" class="theatre-feedback" hidden aria-live="polite"></div>`;$('#theatreRolePrompt').onclick=()=>speakJapanese(role.prompt,null,role.speaker);speakJapanese(role.prompt,null,role.speaker);document.querySelectorAll('[data-role-choice]').forEach(button=>button.onclick=()=>resolveTheatreRoleplay(button,role))
}
function resolveTheatreRoleplay(button,role){
 const feedback=$('#theatreRoleFeedback');if(!feedback.hidden)return;const ok=button.dataset.roleCorrect==='true',model=role.choices.find(choice=>choice.correct);button.classList.add(ok?'correct':'wrong');document.querySelectorAll('[data-role-choice]').forEach(choice=>{choice.disabled=true;if(choice.dataset.roleCorrect==='true')choice.classList.add('correct')});theatreRun.total++;meta.totalAnswers++;if(ok){theatreRun.correct++;theatreRun.roleCorrect++;meta.totalCorrect++}recordMeaningfulActivity('theatre');save();speakJapanese(model.line,null,'kai');const final=theatreRun.roleIndex===theatreScene.roleplay.length-1;feedback.hidden=false;feedback.innerHTML=`<p class="game-result ${ok?'game-result-correct':'game-result-wrong'}">${ok?'Natural response — Aiko understood you.':'That would sound unusual here. Try the highlighted model response aloud.'}</p><p>${esc(role.feedback)}</p><div class="theatre-model-response"><strong lang="ja">${esc(model.line)}</strong><small>${esc(model.reading)}</small><span>${esc(model.meaning)}</span></div><button id="theatreRoleNext" class="primary">${final?'Act 5: Perform the scene →':'Continue the conversation →'}</button>`;$('#theatreRoleNext').onclick=()=>{theatreRun.roleIndex++;renderTheatreRoleplay()};feedback.scrollIntoView({behavior:'smooth',block:'nearest'})
}
function renderTheatreShadowing(){
 clearTheatrePlayback();clearTheatreRecording();const line=theatreScene.shadowing?.[theatreRun.shadowIndex];if(!line){completeTheatreEpisode();return}$('#theatreCounter').textContent=`Act 5 of 5 · Line ${theatreRun.shadowIndex+1}/${theatreScene.shadowing.length}`;$('#theatreReaderContent').innerHTML=`${theatreActTracker(5)}<section class="theatre-act-intro"><span class="eyebrow">Act 5 · Perform the scene</span><h2>Listen, shadow, then hear yourself</h2><p>Your recording stays on this device and is discarded when you leave the line.</p></section><section class="theatre-shadow-card"><span class="theatre-shadow-count">Line ${theatreRun.shadowIndex+1} of ${theatreScene.shadowing.length}</span><p lang="ja">${esc(line.line)}</p><small>${esc(line.reading)}</small><strong>${esc(line.meaning)}</strong><div class="theatre-shadow-tip">🎙️ ${esc(line.tip)}</div><div class="theatre-shadow-actions"><button id="theatreShadowModel" class="audio primary">1 · Hear model</button><button id="theatreRecord" class="audio">2 · Record my line</button></div><div id="theatreRecordStatus" class="theatre-record-status" aria-live="polite">Listen once, then copy the rhythm and pauses.</div><audio id="theatreRecordingPlayback" controls hidden></audio><div class="theatre-self-rating"><span>3 · How did that feel?</span><button data-shadow-rating="practice">Needs another try</button><button data-shadow-rating="comfortable" class="primary">Comfortable</button></div></section>`;$('#theatreShadowModel').onclick=()=>speakJapanese(line.line,null,'kai');$('#theatreRecord').onclick=toggleTheatreRecording;document.querySelectorAll('[data-shadow-rating]').forEach(button=>button.onclick=()=>{theatreRun.shadowed++;if(button.dataset.shadowRating==='comfortable')theatreRun.confident=Number(theatreRun.confident||0)+1;theatreRun.shadowIndex++;renderTheatreShadowing()});speakJapanese(line.line,null,'kai')
}
async function toggleTheatreRecording(){
 const button=$('#theatreRecord'),status=$('#theatreRecordStatus'),playback=$('#theatreRecordingPlayback');if(theatreMediaRecorder?.state==='recording'){theatreMediaRecorder.stop();button.textContent='2 · Record again';status.textContent='Recording complete — play it back and compare with the model.';return}if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){status.textContent='Microphone recording is not supported here. Say the line aloud, then rate your attempt.';return}try{clearTheatreRecording();const stream=await navigator.mediaDevices.getUserMedia({audio:true});theatreRecordingChunks=[];theatreMediaRecorder=new MediaRecorder(stream);theatreMediaRecorder.ondataavailable=event=>{if(event.data.size)theatreRecordingChunks.push(event.data)};theatreMediaRecorder.onstop=()=>{stream.getTracks().forEach(track=>track.stop());if(!theatreRecordingChunks.length)return;theatreRecordingUrl=URL.createObjectURL(new Blob(theatreRecordingChunks,{type:theatreMediaRecorder.mimeType||'audio/webm'}));playback.src=theatreRecordingUrl;playback.hidden=false;button.textContent='2 · Record again';status.textContent='Recording complete — play it back and compare with the model.'};theatreMediaRecorder.start();button.textContent='■ Stop recording';status.textContent='Recording… say the complete Japanese line.';theatreTimers.push(setTimeout(()=>{if(theatreMediaRecorder?.state==='recording')theatreMediaRecorder.stop()},10000))}catch(error){status.textContent='Microphone permission was not available. Say the line aloud and continue when ready.'}
}
function renderLegacyTheatreSummary(){
 if(!theatreScene||!theatreRun)return;clearTheatrePlayback();const state=theatreProgressFor(theatreScene.id),score=Math.round(theatreRun.correct/Math.max(1,theatreRun.total)*100);$('#theatreCounter').textContent='Complete';$('#theatreReaderContent').innerHTML=`<section class="theatre-summary"><span class="eyebrow">Scene complete · 会話を理解しよう</span><h2>${esc(theatreScene.title)}</h2><div class="theatre-score"><article><strong>${score}%</strong><span>This performance</span></article><article><strong>${state.best}%</strong><span>Personal best</span></article><article><strong>${theatreScene.timeline.length}</strong><span>Lines explored</span></article></div><div class="theatre-replay-row"><button id="theatreReplayJapanese" class="audio primary">▶ Replay with Japanese subtitles</button><button id="theatreFullAudio" class="audio">🔊 Play dialogue only</button></div><section class="theatre-transcript"><h3>Understand the complete conversation</h3>${theatreScene.timeline.map((line,lineIndex)=>{const character=theatreCharacter(theatreScene,line.speaker);return `<article class="theatre-line"><div class="theatre-line-top"><strong>${esc(character?.name||line.speaker)}</strong><button class="audio" data-theatre-line="${lineIndex}">🔊 Hear line</button></div><p lang="ja">${esc(line.line)}</p><small>${esc(line.reading)}</small>${sentenceGuideHtml(line.line,line.reading,line.meaning,`${character?.name||line.speaker} says`)}</article>`}).join('')}</section><p class="battle-summary-note">${todayActivity().qualified?'Today’s streak is protected.':'Each comprehension answer helps protect today’s streak.'}</p><button id="theatreAgain" class="primary reveal">Watch this scene again</button><button id="theatreDone" class="reveal">Choose another scene</button></section>`;$('#theatreReplayJapanese').onclick=()=>playTheatreScene(true,'summary');$('#theatreFullAudio').onclick=()=>speakConversation(theatreScene.timeline.map(line=>line.line));document.querySelectorAll('[data-theatre-line]').forEach(button=>button.onclick=()=>speakJapanese(theatreScene.timeline[+button.dataset.theatreLine].line));$('#theatreAgain').onclick=()=>startTheatreScene(theatreScene);$('#theatreDone').onclick=()=>activeLessonImmersive?finishLessonImmersive():openTheatreLibrary;
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
function preloadImageUrl(url){
 if(!url)return;
 const image=new Image();
 image.decoding='async';
 image.src=url;
}
function preloadUpcomingCardImages(count=3){
 const urls=[];
 for(let offset=1;offset<=count;offset++){
  const item=session[index+offset];
  if(!item?.v)continue;
  const scene=memoryScenes[sceneKey(item.v)];
  const sceneUrl=sceneImageUrl(scene);
  if(sceneUrl)urls.push(sceneUrl);
  if(item.v.picture)urls.push(new URL(media(item.v.picture),document.baseURI).href);
 }
 [...new Set(urls)].slice(0,6).forEach(preloadImageUrl);
}
function registerKaishiServiceWorker(){
 if(!('serviceWorker' in navigator)||location.protocol==='file:')return;
 addEventListener('load',()=>{
  navigator.serviceWorker.register(`service-worker.js?v=${APP_VERSION}`,{scope:'./'})
   .then(reg=>{
    reg.addEventListener('updatefound',()=>{
     const installing=reg.installing;
     installing?.addEventListener('statechange',()=>{
      if(installing.state==='redundant'){
       console.warn('Service worker became redundant/failed.');
       localStorage.setItem('kaishi-sw-broken','1');
       window.dispatchEvent(new Event('kaishi-sw-status'));
      }
     });
    });
   })
   .catch(error=>{
    console.warn('Service worker registration failed',error);
    localStorage.setItem('kaishi-sw-broken','1');
    window.dispatchEvent(new Event('kaishi-sw-status'));
   });
 }, {once:true});
}
registerKaishiServiceWorker();
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
 if(index>=session.length){if(meta.activeTopicBoss){completeTopicBoss(meta.activeTopicBoss.topicId,true);}finishSession();return}
 current=session[index];
 const game=(current.skill==='picture'&&pictureGameActive)||karutaActive||battleActive;
 $('#exitBtn').textContent=game?'← Game menu':'← Exit';
 $('#sessionCounter').setAttribute('aria-label',game?'Game progress':'Study progress');revealed=false;hintUsed=false;startedAt=Date.now();const {v,skill}=current;$('#sessionCounter').textContent=`Card ${index+1}/${session.length}`;$('#progressFill').style.width=`${index/session.length*100}%`;const c=$('#card');
if(current.battle){renderBattleQuestion(v);return}
if(current.karuta){renderKarutaQuestion(v);return}
if(skill==='sessionSentence'){renderSessionSentenceBridge(current);return}
if(skill==='kanaUnlock'){const characters=unknownKanaFor(v).slice(0,2),character=characters[0],entry=kanaData.find(item=>item.kana===character),topic=topicForWord(v);if(!character){current.skill='firstEncounter';renderCurrent();return}const reading=esc(v.reading||v.word),highlightedReading=reading.replace(esc(character),`<mark>${esc(character)}</mark>`);c.innerHTML=`${senseiBlock(`You need ${character} for ${v.word}. Learn this sound now, then the very next card will teach you ${v.word}.`)}<div class="eyebrow">Character unlock</div><section class="kana-unlock-layout"><div class="kana-unlock-main"><div class="kana-unlock-glyph" lang="ja">${esc(character)}</div><div class="kana-unlock-sound">${esc(entry?.romaji||'New Japanese sound')}</div><button id="kanaUnlockAudio" class="audio primary">🔊 Hear the sound</button></div><aside class="kana-word-preview"><span>Used in the next word</span><strong lang="ja">${esc(v.word)}</strong><small>${highlightedReading} · ${esc(v.meaning)}</small><p>After learning ${esc(character)}, you will immediately meet this word.</p></aside></section><button id="kanaUnlockContinue" class="primary reveal">Learn ${esc(character)} now →</button><div class="kana-next-word">Next: Meet <strong lang="ja">${esc(v.word)}</strong></div>`;$('#kanaUnlockAudio').onclick=()=>entry&&playKana(entry);$('#kanaUnlockContinue').onclick=()=>{markKanaIntroduced(character);const remaining=unknownKanaFor(v);if(remaining.length){current.skill='kanaUnlock';renderCurrent();return}const duplicateIndex=session.findIndex((item,itemIndex)=>itemIndex>index&&item.v.id===v.id&&item.skill==='firstEncounter');if(duplicateIndex>index)session.splice(duplicateIndex,1);current.skill='firstEncounter';renderCurrent()};if(entry&&settings.autoAudio)playKana(entry);return}
if(skill==='firstEncounter'){const topic=topicForWord(v);c.innerHTML=`${senseiBlock('First, simply see and hear this word. We will build the memory next.')}<div class="eyebrow">${esc(topic.icon)} ${esc(topic.title)} · First encounter</div><div class="first-encounter-word" lang="ja">${esc(v.word)}</div><div class="first-encounter-summary">${esc(v.reading)} · <strong>${esc(v.meaning)}</strong></div><button id="firstEncounterAudio" class="audio primary">🔊</button><button id="firstEncounterContinue" class="primary reveal">Meet this word →</button>`;$('#firstEncounterAudio').onclick=()=>play(v.wordAudio);$('#firstEncounterContinue').onclick=next;if(settings.autoAudio)play(v.wordAudio);return}
if(skill==='example'){const record=ankiRecordFor(v),sentence=record?.sentence||v.exampleSentence||'',meaning=record?.sentenceMeaning||v.exampleSentenceMeaning||'',romaji=record?.sentenceRomaji||v.exampleSentenceRomaji||'';if(!sentence){next();return}const highlighted=esc(sentence).replace(esc(v.word),`<mark>${esc(v.word)}</mark>`);c.innerHTML=`${senseiBlock('Now see how this word works inside a complete sentence.')}<div class="eyebrow">Example sentence</div><div class="example-sentence" lang="ja">${highlighted}</div>${romaji?`<div class="example-romaji">${esc(romaji)}</div>`:''}<div class="example-meaning">${esc(meaning)}</div><button id="exampleAudio" class="audio primary">🔊 Play sentence</button><button id="exampleContinue" class="primary reveal">Continue the journey →</button>`;$('#exampleAudio').onclick=()=>play(v.wordAudio);$('#exampleContinue').onclick=next;return}
if(skill==='intro'){const topic=topicForWord(v);const hasKanji=kanjiCharacters(v).length>0&&v.word!==v.reading,showFullGuidance=introGuidanceCount<2;introGuidanceCount++;c.innerHTML=`${senseiBlock('Use the mnemonic image and story to make this word difficult to forget.')}<div class="eyebrow">${esc(topic.icon)} ${esc(topic.title)} · Meet the word</div><section class="meet-word-identity"><div class="meet-word-written"><span>${hasKanji?'Kanji / written word':'Japanese word'}</span><div class="jp">${v.word}</div><button id="introAudio" class="audio meet-word-speaker" aria-label="Play Japanese word" title="Play Japanese word">🔊</button></div><div class="meet-word-summary"><span class="reading">${v.reading}</span><i aria-hidden="true">·</i><strong class="meaning">${v.meaning}</strong></div></section>${visual(v)}${memorySupport(v,true)}<details class="meet-word-guidance"${showFullGuidance?' open':''}><summary>How to learn this word</summary><ol><li>Tap the speaker and say the Japanese word aloud.</li><li>Connect the mnemonic picture and sound clue to the meaning.</li><li>Picture the story, then recall the word once before continuing.</li></ol></details><div class="sticky-study-action"><button id="continueBtn" class="primary reveal">I have linked the word and meaning →</button></div>`;if(settings.autoAudio)play(v.wordAudio);$('#introAudio').onclick=()=>play(v.wordAudio);$('#continueBtn').onclick=next;wireMemoryEditor(v);return}
if(skill==='meaning')recallCard(v,'What does this mean?',v.word,`${v.meaning}<div class="reading">${v.reading}</div>`,skill);
if(skill==='production')recallCard(v,'Recall the Japanese word',v.meaning,`<div class="jp">${v.word}</div><div class="reading">${v.reading}</div>`,skill);
if(skill==='listening'){const choices=shuffle([v.meaning,...distractors(v,'meaning')]);c.innerHTML=`<div class="eyebrow">Listening</div><h2>Which meaning matches the audio?</h2><button id="playBtn" class="audio primary">🔊 Play audio</button><div class="choices">${choices.map(x=>`<button class="choice" data-answer="${encodeURIComponent(x)}">${x}</button>`).join('')}</div><button id="hintBtn" class="hint">Show memory hint</button>`;$('#playBtn').onclick=()=>play(v.wordAudio);if(settings.autoAudio)play(v.wordAudio);bindChoices(v.meaning,skill);$('#hintBtn').onclick=()=>showHint(v)}
if(skill==='reading'){const mature=pFor(v.id).interval>=21;if(mature){recallCard(v,'Recall the Japanese reading',v.meaning,`<div class="reading">${v.reading}</div><div class="jp small-jp">${v.word}</div>`,skill)}else{const choices=shuffle([v.reading,...distractors(v,'reading')]);c.innerHTML=`<div class="eyebrow">Reading from meaning</div><div class="meaning prompt-meaning">${v.meaning}</div><h2>Which Japanese reading matches?</h2><div class="choices">${choices.map(x=>`<button class="choice" data-answer="${encodeURIComponent(x)}">${x}</button>`).join('')}</div><button id="hintBtn" class="hint">Show memory hint</button><section id="readingFeedback" class="teacher-answer-feedback" hidden aria-live="polite"></section>`;bindChoices(v.reading,skill,(ok)=>{const hint=$('#hintBtn');if(hint)hint.remove();if(ok)return;const feedback=$('#readingFeedback');feedback.innerHTML=`${senseiBlock(`Not quite. The correct reading for ${v.meaning} is ${v.reading}.`,true)}<div class="teacher-correct-answer"><strong lang="ja">${esc(v.reading)}</strong><span>${esc(v.word)} · ${esc(v.meaning)}</span><button id="readingAnswerAudio" class="audio" aria-label="Replay correct pronunciation" title="Replay correct pronunciation">🔊</button></div>`;feedback.hidden=false;$('#readingAnswerAudio').onclick=()=>play(v.wordAudio);play(v.wordAudio);feedback.scrollIntoView({behavior:'smooth',block:'nearest'})});$('#hintBtn').onclick=()=>showHint(v)}}
if(skill==='kanji'){const mature=pFor(v.id).interval>=21;if(mature){recallCard(v,'Recall the written Japanese word',`${v.reading}<div class="meaning">${v.meaning}</div>`,`<div class="jp">${v.word}</div>`,skill)}else{const choices=shuffle([v.word,...distractors(v,'word')]);c.innerHTML=`<div class="eyebrow">Kanji recognition</div><div class="reading large-reading">${v.reading}</div><div class="meaning prompt-meaning">${v.meaning}</div><h2>Choose the correct written form</h2><div class="choices kanji-choices">${choices.map(x=>`<button class="choice" data-answer="${encodeURIComponent(x)}">${x}</button>`).join('')}</div><button id="hintBtn" class="hint">Show memory hint</button>`;bindChoices(v.word,skill);$('#hintBtn').onclick=()=>showHint(v)}}
if(skill==='picture'){renderPictureQuestion(v,current.pictureMode||'picture-word');}
if(skill==='sentence'){let sentence=v.sentence||`「${v.word}」 means ____.`;let prompt=sentence.includes(v.word)?sentence.replace(v.word,'＿＿＿'):sentence.replace(/<b>|<\/b>/g,'');const choices=shuffle([v.word,...distractors(v,'word')]);c.innerHTML=`<div class="eyebrow">Sentence context</div><div class="sentence">${prompt}</div><p class="meaning">${v.sentenceMeaning||v.meaning}</p><div class="choices">${choices.map(x=>`<button class="choice" data-answer="${encodeURIComponent(x)}">${x}</button>`).join('')}</div><button id="sentenceAudio" class="audio">🔊 Full sentence</button>`;bindChoices(v.word,skill);$('#sentenceAudio').onclick=()=>play(v.sentenceAudio)}
if(skill==='components'){renderComponentBuild(v)}}
function currentLearningReportContext(){
 const item=current||{},v=item.v||{};
 return {
  pageType:'learning-card',
  activityType:String(item.skill||item.pictureMode||(item.battle?'battle':item.karuta?'karuta':'unknown')),
  wordId:String(v.id||''),
  japanese:String(v.word||''),
  reading:String(v.reading||''),
  english:String(v.meaning||''),
  topicId:String(topicForWord(v)?.id||''),
  topicTitle:String(topicForWord(v)?.title||''),
  selectedAnswer:'',
  expectedAnswer:'',
  cardText:cleanText($('#card')?.innerText||'').slice(0,1200),
  appVersion:APP_VERSION
 };
}
function renderCurrent(){
 try{
  renderCurrentUnsafe();
  if(current?.v&&!pictureGameActive&&!karutaActive&&!battleActive){const step=masteryStepFor(current.v),banner=document.createElement('aside');banner.className='word-mastery-next';banner.innerHTML=`<span>Journey</span><b>Next: ${esc(step.label)}</b><small>${esc(step.reason)}</small>`;$('#card')?.prepend(banner)}
  wireSceneImages($('#card')||document);
  preloadUpcomingCardImages(3);
  window.KaishiReports?.attachToLearningCard?.(currentLearningReportContext());
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
function recallCard(v,title,front,answer,skill){$('#card').innerHTML=`<div class="eyebrow">Active recall</div><h2>${title}</h2><div class="jp recall-front">${front}</div><button id="hintBtn" class="hint">Show memory hint</button><div id="answer" hidden><hr><div class="recall-answer-content">${answer}${visual(v)}${memorySupport(v)}</div></div><button id="revealBtn" class="primary reveal">Reveal answer</button><div id="ratingsWrap" hidden><p class="rating-title">How easily did you remember this <em>before</em> revealing the answer?</p><div id="ratings" class="ratings"><button class="again" data-rating="1">Again</button><button class="hard" data-rating="2">Hard</button><button class="good" data-rating="3">Good</button><button class="easy" data-rating="4">Easy</button></div></div>`;$('#hintBtn').onclick=()=>showHint(v);$('#revealBtn').onclick=()=>{const answerBox=$('#answer'),hint=$('#hintBtn'),reveal=$('#revealBtn');answerBox.hidden=false;$('#ratingsWrap').hidden=false;reveal.hidden=true;if(hint)hint.remove();const audio=document.createElement('button');audio.id='answerAudio';audio.className='audio recall-inline-audio';audio.type='button';audio.textContent='🔊';audio.title='Play Japanese word';audio.setAttribute('aria-label','Play Japanese word');audio.onclick=()=>play(v.wordAudio);const answerKanji=answerBox.querySelector('.jp'),frontKanji=$('#card > .recall-front'),target=answerKanji||frontKanji;if(target){const row=document.createElement('div');row.className='recall-word-row';target.parentNode.insertBefore(row,target);row.appendChild(target);row.appendChild(audio)}else answerBox.prepend(audio);wireMemoryEditor(v);wireSceneImages(answerBox)};document.querySelectorAll('[data-rating]').forEach(b=>b.onclick=()=>grade(v,skill,+b.dataset.rating,+b.dataset.rating>=3))}
function showHint(v){hintUsed=true;const s=memoryScenes[sceneKey(v)];alert(s?s.caption:mnemonic(v))}
function addGuessFlag(){const choices=$('.choices');if(!choices)return()=>false;let guessing=false;choices.insertAdjacentHTML('beforebegin','<button id="guessFlag" class="guess-flag" type="button" aria-pressed="false">🤔 I’m guessing</button>');const flag=$('#guessFlag');flag.onclick=()=>{guessing=!guessing;flag.classList.toggle('active',guessing);flag.setAttribute('aria-pressed',String(guessing));flag.textContent=guessing?'🤔 Guessing — do not count as known':'🤔 I’m guessing'};return()=>guessing}
function bindChoices(answer,skill,onReveal){const isGuessing=addGuessFlag();document.querySelectorAll('.choice').forEach(b=>b.onclick=()=>{if(revealed)return;revealed=true;const val=decodeURIComponent(b.dataset.answer);const ok=val===answer,guessed=isGuessing(),countedCorrect=ok&&!guessed;b.classList.add(ok?'correct':'wrong');document.querySelectorAll('.choice').forEach(x=>{if(decodeURIComponent(x.dataset.answer)===answer)x.classList.add('correct');x.disabled=true});$('#guessFlag')?.remove();if(guessed&&ok){const note=document.createElement('p');note.className='guess-feedback';note.textContent='Correct answer — marked as a guess, so this word will return for practice.';$('.choices')?.after(note)}if(onReveal)onReveal(ok,guessed);setTimeout(()=>grade(current.v,skill,countedCorrect?(hintUsed?2:3):1,countedCorrect),900)})}
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
function grade(v,skill,rating,correct,advance=true){const p=pFor(v.id),sp=p.skills[skill];const response=(Date.now()-startedAt)/1000;sp.attempts++;if(correct)sp.correct++;const quality=rating/4*(hintUsed?.72:1)*(response>15?.9:1);sp.strength=Math.max(0,Math.min(1,sp.strength*.75+quality*.25));meta.totalAnswers++;if(correct)meta.totalCorrect++;markDailyReviewAttempted(v.id);p.reps++;if(rating===1){p.lapses++;p.interval=0;p.stage=1;p.due=Date.now()+10*60*1000;p.ease=Math.max(1.3,p.ease-.2)}else if(p.stage<2){p.stage=2;p.interval=rating===2?1:rating===3?2:4;p.due=Date.now()+p.interval*86400000}else{const mult=rating===2?1.2:rating===3?p.ease:p.ease*1.35;p.interval=Math.max(1,Math.round(Math.max(1,p.interval)*mult));p.ease=Math.max(1.3,p.ease+(rating===2?-.15:rating===4?.15:0));p.due=Date.now()+p.interval*86400000}recordMeaningfulActivity(battleActive?'battle':karutaActive?'karuta':pictureGameActive?'game':mangaStory&&$('#manga').classList.contains('active')?'manga':'vocabulary');save();window.KaishiCloud?.flush?.();if(advance)next()}
function showMissionCheckpoint(){saveMissionResume();const dialog=$('#missionCheckpointDialog');if(!dialog){index++;renderCurrent();return}$('#checkpointProgress').textContent=`${index+1} of ${session.length} cards complete. Your progress is saved.`;dialog.showModal()}
function continueAfterCheckpoint(){clearMissionResume();$('#missionCheckpointDialog')?.close();index++;renderCurrent()}
function finishAtCheckpoint(){saveMissionResume();$('#missionCheckpointDialog')?.close();session=[];index=0;current=null;revealed=false;hintUsed=false;updateHome();show('home');toast('Progress saved — Continue Adventure will resume here')}
function next(){if(activeQuickStep&&Math.max(0,todayActivity().tested-Number(todayActivity().quickStartTested||0))>=3){session=session.slice(0,3);index=session.length;finishSession();renderCurrent();return}saveMissionResume();const completed=index+1;if(completed<session.length&&completed%CHECKPOINT_INTERVAL===0&&!pictureGameActive&&!karutaActive&&!battleActive&&!activeFirstLesson){showMissionCheckpoint();return}index++;renderCurrent()}
function recordSessionHistory(){
 if(!pendingSessionRecord||!pendingSessionRecord.wordIds?.length){pendingSessionRecord=null;return}
 meta.sessionHistory=Array.isArray(meta.sessionHistory)?meta.sessionHistory:[];
 const attempts=Math.max(0,Number(meta.totalAnswers||0)-Number(pendingSessionRecord.startAnswers||0));
 const correct=Math.max(0,Number(meta.totalCorrect||0)-Number(pendingSessionRecord.startCorrect||0));
 const existing=pendingSessionRecord.redoOf?meta.sessionHistory.find(item=>item.id===pendingSessionRecord.redoOf):null;
 if(existing){existing.completedAt=Date.now();existing.wordIds=[...pendingSessionRecord.wordIds];existing.attempts=attempts;existing.correct=correct}
 else{
  meta.sessionHistory.push({id:`${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`,title:pendingSessionRecord.title,wordIds:[...pendingSessionRecord.wordIds],completedAt:Date.now(),attempts,correct});
  if(meta.sessionHistory.length>SESSION_HISTORY_LIMIT)meta.sessionHistory=meta.sessionHistory.slice(-SESSION_HISTORY_LIMIT);
 }
 pendingSessionRecord=null;
}
function finishSession(){clearMissionResume();recordSessionHistory();const quickCompleted=activeQuickStep,firstLessonCompleted=activeFirstLesson;activeQuickStep=false;activeFirstLesson=false;const completedJourneyMission=Boolean(activeJourneyMission)&&finishActiveJourneyMission();if(battleActive){showBattleSummary();return}if(karutaActive){showKarutaSummary();return}if(pictureGameActive){abortSession('games');toast('Game complete 🎉');return}save();updateHome();if(completedJourneyMission)renderJourney();const c=$('#card');$('#sessionCounter').textContent='Complete';$('#progressFill').style.width='100%';if(firstLessonCompleted){c.innerHTML=`${senseiBlock('You learned and recalled your first two Japanese words. That is a real beginning.',true,'celebrating')}<div class="eyebrow">First lesson complete</div><h2>Your bonsai has new branches.</h2><p>You can now recognise two useful words. Its size records lasting learning progress, while its condition will brighten as your learning rhythm grows.</p><div class="mission-complete-actions"><button id="finishMissionNow" class="primary">See my progress</button><button id="keepLearningMission">Learn a little more</button></div>`;$('#finishMissionNow').onclick=()=>{show('home');setTimeout(()=>$('#bonsaiProgressCard')?.scrollIntoView({behavior:'smooth',block:'center'}),60)};$('#keepLearningMission').onclick=()=>{session=[];index=0;current=null;startTopicSession(currentTopic().id)};return}if(quickCompleted){c.innerHTML=`${senseiBlock('Quick Step complete. Even a short, focused practice keeps your learning rhythm moving.',true,'celebrating')}<div class="eyebrow">Rhythm protected</div><h2>A small step still counts.</h2><p>Three genuine review attempts protected today without turning practice into a chore.</p><div class="mission-complete-actions"><button id="finishMissionNow" class="primary">Back to dashboard</button><button id="keepLearningMission">Keep learning</button></div>`;$('#finishMissionNow').onclick=()=>show('home');$('#keepLearningMission').onclick=()=>{session=[];index=0;current=null;startTopicSession(currentTopic().id)};return}c.innerHTML=`${senseiBlock('Mandatory mission complete. Your progress is safely saved.')}<div class="eyebrow">Mission complete</div><h2>Great work — you reached today’s save point.</h2><p>You can finish now, or continue with another short optional mission.</p><div class="mission-complete-actions"><button id="finishMissionNow" class="primary">Finish for now</button><button id="keepLearningMission">Keep learning</button></div>`;$('#finishMissionNow').onclick=()=>{activityReturnScreen=activityReturnScreen==='journey'?'home':activityReturnScreen;returnToActivitySource('home');toast(todayActivity().qualified?'Mission complete — today’s rhythm is protected 🎉':'Mission complete — progress saved')};$('#keepLearningMission').onclick=()=>{session=[];index=0;current=null;startTopicSession(currentTopic().id)}}
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

/*
 * v11.8.49 — Inline Kanji Component Build card.
 * A single, interactive "build the kanji from its parts" screen shown as an
 * ordinary card inside the normal mission flow (skill==='components'), for
 * words that already have a kanji component record. This reuses the same
 * tap-to-place interaction and CSS as the standalone Kanji Builder activity,
 * but runs as one word/one build/one grade — no separate screen, rounds, or
 * summary. Uses its own state object (inlineBuild) so it never collides with
 * the multi-round Kanji Builder's `kanjiBuilder` state.
 */
let inlineBuild=null;
function renderComponentBuild(v){
 const records=wordComponentRecords(v);
 if(!records.length){current.skill='meaning';renderCurrent();return}
 const record=records[Math.floor(Math.random()*records.length)];
 inlineBuild={v,record,selected:[],answered:false};
 const c=$('#card');
 c.innerHTML=`${senseiBlock('Build the Kanji from its parts to reinforce how it is written.')}<section class="kanji-builder-question"><span class="eyebrow">Component build</span><h2>${esc(v.meaning)}</h2><p class="kanji-builder-reading">Reading: <strong>${esc(v.reading)}</strong></p>${v.wordAudio?'<button id="inlineBuildAudio" class="audio primary">🔊 Hear the Japanese word</button>':''}<p>Select ${record.parts.length} component${record.parts.length===1?'':'s'} in the lesson’s visual order.</p><div id="inlineAssemblyStage">${inlineBuildStageHTML()}</div><div class="kanji-component-options">${builderOptionParts(record).map(part=>`<button data-inline-part="${encodeURIComponent(part)}"><span lang="ja">${esc(part)}</span><b>${esc(componentInfo(part).name)}</b><small>tap to add</small></button>`).join('')}</div><button id="lockInlineKanji" class="primary kanji-lock" disabled>Lock in Kanji</button><section id="inlineBuildFeedback" class="game-feedback" hidden aria-live="polite"></section></section>`;
 if($('#inlineBuildAudio')){$('#inlineBuildAudio').onclick=()=>play(v.wordAudio);if(settings.autoAudio)play(v.wordAudio)}
 document.querySelectorAll('[data-inline-part]').forEach(button=>button.onclick=()=>{if(inlineBuild.answered||inlineBuild.selected.length>=record.parts.length)return;inlineBuild.selected.push(decodeURIComponent(button.dataset.inlinePart));updateInlineBuildSelection()});
 $('#lockInlineKanji').onclick=resolveComponentBuild;
 updateInlineBuildSelection();
}
function inlineBuildStageHTML(){const record=inlineBuild.record,selected=inlineBuild.selected,slots=Array.from({length:record.parts.length},(_,itemIndex)=>selected[itemIndex]?`<button data-inline-remove="${itemIndex}" class="filled" lang="ja" aria-label="Remove ${esc(selected[itemIndex])}">${esc(selected[itemIndex])}</button>`:`<span aria-label="Empty component slot">?</span>`).join('<i>+</i>');return `<div class="kanji-assembly layout-${esc(record.layout)}">${slots}</div>`}
function updateInlineBuildSelection(){
 const stage=$('#inlineAssemblyStage');if(!stage)return;
 stage.innerHTML=inlineBuildStageHTML();
 stage.querySelectorAll('[data-inline-remove]').forEach(button=>button.onclick=()=>{if(inlineBuild.answered)return;inlineBuild.selected.splice(+button.dataset.inlineRemove,1);updateInlineBuildSelection()});
 const counts=inlineBuild.selected.reduce((map,part)=>(map[part]=(map[part]||0)+1,map),{});
 document.querySelectorAll('[data-inline-part]').forEach(button=>{const used=counts[decodeURIComponent(button.dataset.inlinePart)]||0;button.querySelector('small').textContent=used?`selected ×${used}`:'tap to add'});
 $('#lockInlineKanji').disabled=inlineBuild.selected.length!==inlineBuild.record.parts.length;
}
function resolveComponentBuild(){
 if(!inlineBuild||inlineBuild.answered)return;
 const {v,record,selected}=inlineBuild,ok=record.parts.every((part,itemIndex)=>selected[itemIndex]===part);
 inlineBuild.answered=true;
 document.querySelectorAll('[data-inline-part], [data-inline-remove]').forEach(button=>button.disabled=true);
 $('#lockInlineKanji').disabled=true;
 const parts=record.parts.map(part=>{const info=componentInfo(part);return `<li><b lang="ja">${esc(part)}</b><span>${esc(info.name)}${info.source?` — component form of ${esc(info.source)}`:''}</span></li>`}).join('');
 const feedback=$('#inlineBuildFeedback');
 feedback.innerHTML=`<p class="game-result ${ok?'game-result-correct':'game-result-wrong'}">${ok?'Correct — the components fit!':'Not quite — compare the correct writing order.'}</p><div class="kanji-builder-reveal"><div class="kanji-final" lang="ja">${esc(record.kanji)}</div><div><strong lang="ja">${esc(v.word)}</strong><span>${esc(v.reading)} · ${esc(v.meaning)}</span></div></div><ol class="kanji-explanation-list">${parts}</ol><p class="kanji-component-story">${esc(record.story)}</p>${v.wordAudio?'<button id="inlineBuildAnswerAudio" class="audio">🔊 Play Japanese audio</button>':''}<button id="inlineBuildNext" class="primary reveal">Continue →</button>`;
 feedback.hidden=false;
 if($('#inlineBuildAnswerAudio'))$('#inlineBuildAnswerAudio').onclick=()=>play(v.wordAudio);
 $('#inlineBuildNext').onclick=next;
 feedback.scrollIntoView({behavior:'smooth',block:'nearest'});
 grade(v,'components',ok?3:1,ok,false);
}

function illustratedWords(){return vocab.filter(v=>memoryScenes[sceneKey(v)]?.file)}
function pictureChoices(v,n){
 const pool=shuffle(illustratedWords().filter(x=>x.id!==v.id&&wordIntroduced(x)));
 return shuffle([v,...pool.slice(0,Math.max(1,n-1))]);
}
function renderPictureQuestion(v,mode='picture-word'){
 const count=Math.max(2,Math.min(6,+settings.pictureDifficulty||4));
 const choices=pictureChoices(v,count),scene=memoryScenes[sceneKey(v)],c=$('#card');
 let prompt='',answer='',buttons='';
 if(mode==='picture-english-word'){
  prompt=`${sceneSprite(scene,'quiz-picture')}<p class="picture-learning-meaning">${esc(v.meaning)}</p><h2>Which Japanese word matches?</h2>`;
  answer=v.id;buttons=choices.map(x=>`<button class="choice" data-answer="${encodeURIComponent(x.id)}"><span lang="ja">${esc(x.word)}</span><small>${esc(x.reading)}</small></button>`).join('');
 }else if(mode==='picture-word'){
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
 abortSession('journey');
 const all=illustratedWords().filter(v=>wordIntroduced(v)&&(mode!=='listen-meaning'||v.wordAudio));
 if(all.length<2){toast('More illustrated vocabulary is needed');return}

 const pool=shuffle(all);
 const available=pool;
 session=available
  .slice(0,activitySessionSize(available.length))
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
 $('#karutaAgain').onclick=startKarutaGame;$('#karutaDone').onclick=()=>{abortSession('journey');openJourney('practice')};
}
function startKarutaGame(){
 abortSession('games');
 const pool=shuffle(illustratedWords().filter(v=>v.wordAudio&&wordIntroduced(v)));
 if(pool.length<2){toast('Learn at least two illustrated words with audio to unlock Karuta');return}
 session=pool.slice(0,activitySessionSize(pool.length)).map(v=>({v,skill:'listening',karuta:true}));
 karutaActive=true;karuta={pool,score:0,combo:0,bestCombo:0,correct:0,wrong:0,times:[],roundStarted:0,replayed:false};index=0;current=null;show('study');renderCurrent();
}

function decayCandidates(){
 const now=Date.now(),dayMs=86400000;
 const started=vocab.filter(wordIntroduced).map(v=>{
  const p=progress[v.id]||{interval:1,due:now},window=Math.max(6*3600000,Math.min(3*dayMs,(p.interval||1)*dayMs*.2));
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
 session=pool.slice(0,activitySessionSize(pool.length)).map(v=>({v,skill:'meaning',battle:true}));
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
function showWhatsNew(){const previous=localStorage.getItem('kq-last-version');if(previous!==APP_VERSION){fetch('version.json',{cache:'no-store'}).then(r=>r.json()).then(info=>{$('#whatsNewTitle').textContent=`What’s new in v${APP_VERSION}`;$('#whatsNewContent').innerHTML=`<p>${info.title||''}</p><ul>${(info.changes||[]).map(x=>`<li>${x}</li>`).join('')}</ul>`;$('#whatsNewDialog').showModal();localStorage.setItem('kq-last-version',APP_VERSION)}).catch(()=>localStorage.setItem('kq-last-version',APP_VERSION))}}
async function setupServiceWorker(){
 try{
  const regs=await navigator.serviceWorker?.getRegistrations()||[];
  await Promise.all(regs.map(r=>r.unregister()));
  const keys=await caches.keys();
  await Promise.all(keys.map(k=>caches.delete(k)));
 }catch(e){}
}
async function safeFetchJson(url,fallback={}){
 try{
  const r=await fetch(url);
  if(r.ok) return await r.json();
 }catch(e){}
 if('caches' in window){
  try{
   const match=await caches.match(url,{ignoreSearch:true});
   if(match&&match.ok) return await match.json();
  }catch(e){}
 }
 return fallback;
}
async function init(){
 $('#updateBanner').hidden=true;
 $('#card').innerHTML='<div class="eyebrow">Loading</div><h2>Preparing Kaishi Quest…</h2>';
 try{
  [vocab,kanaData,mangaStories,conversations,theatreScenes,grammarLessons,componentData,memoryScenes,ankiContent,topicData,learningGraph]=await Promise.all([
   safeFetchJson(`data/vocabulary.json?v=${APP_VERSION}`,[]),
   safeFetchJson(`data/kana.json?v=${APP_VERSION}`,{entries:[]}).then(data=>data.entries||[]),
   safeFetchJson(`data/manga-stories.json?v=${APP_VERSION}`,{stories:[]}).then(data=>data.stories||[]),
   safeFetchJson(`data/conversations.json?v=${APP_VERSION}`,{conversations:[]}).then(data=>data.conversations||[]),
   safeFetchJson(`data/theatre-scenes.json?v=${APP_VERSION}`,{scenes:[]}).then(data=>data.scenes||[]),
   safeFetchJson(`data/grammar-path.json?v=${APP_VERSION}`,{lessons:[]}).then(data=>data.lessons||[]),
   safeFetchJson(`data/kanji-components.json?v=${APP_VERSION}`,{}),
   safeFetchJson(`memory-scenes.json?v=${APP_VERSION}`,{}),
   safeFetchJson(`data/anki-content-v72.json?v=${APP_VERSION}`,{records:[]}),
   safeFetchJson(`data/topics-v72.json?v=${APP_VERSION}`,{topics:[]}),
   safeFetchJson(`data/learning-graph-v82.json?v=${APP_VERSION}`,{})
  ]);
  enrichVocabularyFromAnki();
  updateHome();
  appReady=true;
  setAdminTestActivityReady(true);
  if(isAdminTestMode()&&sessionStorage.getItem(ADMIN_TEST_ENTRY_KEY)==='1'){
   sessionStorage.removeItem(ADMIN_TEST_ENTRY_KEY);
   openJourney('current');
  }
 }catch(e){
  console.error('Initialisation failed',e);
  $('#summary').textContent='Could not load app data.';
  $('#card').innerHTML=`<div class="eyebrow">Loading error</div><h2>Kaishi Quest could not start.</h2><p class="muted">${esc(e?.message||'Unknown error')}</p>`;
 }
 $('#pictureDifficulty').value=settings.pictureDifficulty;
 $('#mnemonicStyle').value=settings.mnemonicStyle;
 $('#autoAudio').checked=settings.autoAudio;
 renderLearningBalanceSettings();
 const versionCard=$('.version-card');if(versionCard){versionCard.querySelector('strong').textContent=`Kaishi Quest v${APP_VERSION}`;versionCard.querySelector('span').textContent='Progression Characters';versionCard.querySelector('small').textContent='Three new characters and complete pose sets now unlock through genuine vocabulary mastery.'}
}
$('#studyBtn').onclick=()=>{abortSession('home');makeSession()};$('#kanaBtn').onclick=openKanaPath;$('#kanaBack').onclick=()=>show('home');$('#kanaLessonExit').onclick=openKanaPath;document.querySelectorAll('.kanaStart').forEach(button=>button.onclick=()=>startKanaStudy(button.dataset.script));$('#mangaBtn').onclick=openMangaLibrary;$('#mangaBack').onclick=()=>show('home');$('#mangaLibraryBack').onclick=()=>activeLessonImmersive?finishLessonImmersive():openMangaLibrary();$('#gamesBtn').onclick=()=>abortSession('games');$('#communityBtn').onclick=()=>{show('community');window.KaishiCloud?.loadLeaderboard?.()};$('#communityBack').onclick=()=>show('home');$('#gamesBack').onclick=()=>{abortSession('journey');openJourney('practice')};document.querySelectorAll('.gameMode').forEach(b=>b.onclick=()=>{settings.pictureDifficulty=+$('#pictureDifficulty').value||4;save();startPictureGame(b.dataset.mode)});$('#exitBtn').onclick=()=>{if(pictureGameActive){abortSession('journey');openJourney('practice')}else abortSession('home')};$('#settingsBtn').onclick=()=>{if($('#study')?.classList.contains('active')&&session.length){$('#quickAutoAudio').checked=settings.autoAudio;$('#quickMnemonicStyle').value=settings.mnemonicStyle;$('#quickSettingsDialog').showModal()}else{renderLearningBalanceSettings();show('settings')}};$('#checkpointContinue').onclick=continueAfterCheckpoint;$('#checkpointFinish').onclick=finishAtCheckpoint;$('#quickSettingsSave').onclick=()=>{settings.autoAudio=$('#quickAutoAudio').checked;settings.mnemonicStyle=$('#quickMnemonicStyle').value;save();$('#quickSettingsDialog').close();toast('Quick settings applied')};$('#quickSettingsCancel').onclick=()=>$('#quickSettingsDialog').close();$('#quickFullSettings').onclick=()=>{saveMissionResume();$('#quickSettingsDialog').close();renderLearningBalanceSettings();show('settings')};$('#settingsBack').onclick=saveSettingsAndExit;$('#activityViewToggle').onclick=()=>setActivityVillageMode(settings.activityVillageMode===false);$('#activityVillageMode').onchange=event=>setActivityVillageMode(event.target.checked);$('#checkUpdateBtn').onclick=()=>checkForUpdates(true);$('#historyBtn').onclick=openHistory;$('#historyBack').onclick=()=>{renderLearningBalanceSettings();show('settings')};$('#applyUpdate').onclick=applyUpdate;$('#laterUpdate').onclick=()=>{$('#updateBanner').hidden=true};$('#exportBtn').onclick=exportProgress;$('#importInput').onchange=async e=>{try{const d=JSON.parse(await e.target.files[0].text());progress=d.progress||{};meta={...META_DEFAULTS,...(d.meta||{})};meta.kanaProgress=meta.kanaProgress||{};meta.grammarProgress=meta.grammarProgress||{};meta.sentenceLabProgress={lessons:{},saved:[],mistakes:[],totalAnswers:0,totalCorrect:0,...(meta.sentenceLabProgress||{})};meta.mangaProgress=meta.mangaProgress||{};meta.conversationProgress=meta.conversationProgress||{};meta.theatreProgress=meta.theatreProgress||{};meta.pathUnlocks=Array.isArray(meta.pathUnlocks)?[...meta.pathUnlocks]:[];meta.pathVisits={...(meta.pathVisits||{})};meta.pathOverrides=Array.isArray(meta.pathOverrides)?[...meta.pathOverrides]:[];meta.chapterOverrides=Array.isArray(meta.chapterOverrides)?[...meta.chapterOverrides]:[];const legacyRhythm=meta.rhythm||meta.garden||{};meta.rhythm={...META_DEFAULTS.rhythm,behind:Number(legacyRhythm.behind||0),lastChecked:String(legacyRhythm.lastChecked||''),quickWeek:String(legacyRhythm.quickWeek||''),quickUsed:Number(legacyRhythm.quickUsed||0),cycles:Number(legacyRhythm.cycles||0)};delete meta.garden;delete meta.gardenApSpent;rhythmState();if(meta.dailyReviewPlan?.date!==day())delete meta.dailyReviewPlan;settings={...defaults,...settings,...d.settings};renderLearningBalanceSettings();save();updateHome();toast('Progress imported')}catch{toast('Invalid backup file')}};$('#resetBtn').onclick=async()=>{const signedIn=Boolean(window.KaishiCloud?.isSignedIn?.());const message=signedIn?'Delete all learning progress? This also erases your synced cloud progress on every device.':'Delete all learning progress?';if(!confirm(message))return;const resetBtn=$('#resetBtn');progress={};meta={...META_DEFAULTS,rhythm:{...META_DEFAULTS.rhythm},kanaProgress:{},grammarProgress:{},sentenceLabProgress:{lessons:{},saved:[],mistakes:[],totalAnswers:0,totalCorrect:0},mangaProgress:{},conversationProgress:{},theatreProgress:{},pathUnlocks:[],pathVisits:{},pathOverrides:[],chapterOverrides:[]};save(false);updateHome();if(!signedIn){toast('Progress reset');return}resetBtn.disabled=true;resetBtn.textContent='Resetting cloud progress…';toast('Resetting local and cloud progress…');const result=await window.KaishiCloud?.resetProgress?.();resetBtn.disabled=false;resetBtn.textContent='Reset local progress';toast(result?.ok?'Local and cloud progress reset':'Local progress reset, but the cloud reset failed — try again while online')};
$('#dashboardAvatarButton').onclick=openCharacterSettings;
$('#restorePointsBtn').onclick=openRestorePoints;
$('#restorePointsClose').onclick=()=>$('#restorePointsDialog').close();
window.addEventListener('kaishi-auth-change',()=>{const dialog=$('#restorePointsDialog');if(dialog?.open)dialog.close();updateRestorePointAvailability()});
updateRestorePointAvailability();
$('#resetBtn').onclick=async()=>{const signedIn=Boolean(restorePointOwnerId());const message=signedIn?'Delete all learning progress? This also erases your synced cloud progress on every device.':'Delete all learning progress?';if(!confirm(message))return;if(signedIn)createRestorePoint('Before resetting local progress');const resetBtn=$('#resetBtn');resetLocalProgressState();save(false);updateHome();if(!signedIn){toast('Progress reset');return}resetBtn.disabled=true;resetBtn.textContent='Resetting cloud progress…';toast('Resetting local and cloud progress…');const result=await window.KaishiCloud?.resetProgress?.();resetBtn.disabled=false;resetBtn.textContent='Reset local progress';toast(result?.ok?'Local and cloud progress reset. A restore point was saved.':'Local progress reset, but the cloud reset failed — try again while online')};
$('#kanjiOverviewBtn').onclick=()=>{if(settings.playMode!=='classic'&&!pathUnlocked('kanji')){toast('Reach the Kanji Gate to open this overview');return}renderKanjiOverview();show('kanjiOverview')};
$('#kanjiOverviewBack').onclick=()=>show('home');
$('#skillsBtn').onclick=()=>{renderSkillScores();show('skillsOverview')};
$('#skillsBack').onclick=()=>show('home');
$('#continueJourney').onclick=continueJourney;$('#openReviews').onclick=()=>makeSession();$('#openCollection').onclick=()=>openCollection();$('#collectionBack').onclick=()=>show('home');document.querySelectorAll('[data-collection-tab]').forEach(button=>button.onclick=()=>renderCollection(button.dataset.collectionTab));
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
$('#ownerPathGrid')?.addEventListener('click',event=>{const button=event.target.closest('[data-owner-path]');if(button)unlockOwnerPathThrough(+button.dataset.ownerPath)});
$('#ownerChapterGrid')?.addEventListener('click',event=>{const button=event.target.closest('[data-owner-chapter]');if(button)unlockOwnerChapterThrough(+button.dataset.ownerChapter)});
$('#ownerUnlockAll')?.addEventListener('click',()=>{unlockOwnerPathThrough(PATH_MILESTONES.length-1);unlockOwnerChapterThrough(wordChapterCount()-1)});
$('#ownerResetPath')?.addEventListener('click',()=>{if(!window.KaishiCloud?.isOwner?.())return;meta.pathOverrides=[];meta.chapterOverrides=[];save();renderOwnerPathControls(true);renderJourneyHome();toast('Journey test overrides reset')});
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
$('#mangaBack').onclick=()=>activeLessonImmersive?finishLessonImmersive():returnToActivitySource('home');
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
$('#learningBalance').oninput=updateLearningBalanceFromControls;
$('#learningBalanceAdaptive').onchange=updateLearningBalanceFromControls;
$('#settingsBack').onclick=saveSettingsAndExit;
$('#journeyInvite').onclick=openInviteDialog;
$('#communityInvite').onclick=openInviteDialog;
$('#journeyShareProgress').onclick=openInviteDialog;
$('#shareNative').onclick=()=>{$('#shareDialog').close();nativeShareInvite()};
$('#shareCopy').onclick=async()=>{await copyInviteLink();$('#shareDialog').close()};
$('#shareAchievement').onclick=()=>{$('#shareDialog').close();shareAchievement()};
$('#shareClose').onclick=()=>$('#shareDialog').close();
$('#missionSummaryContinue').onclick=()=>{$('#missionSummaryDialog').close();openJourney()};
$('#missionSummaryShare').onclick=()=>{$('#missionSummaryDialog').close();openInviteDialog()};
const japanReadyContinue=$('#continueJapanReadyCampaign');
if(japanReadyContinue)japanReadyContinue.addEventListener('click',event=>{
 if(japanReadyContinue.onclick)return;
 event.preventDefault();event.stopImmediatePropagation();
 japanReadyContinue.disabled=true;const original=japanReadyContinue.innerHTML; japanReadyContinue.textContent='Loading Japan Ready…';
 const retry=attempt=>{if(japanReadyContinue.onclick){japanReadyContinue.disabled=false;japanReadyContinue.innerHTML=original;japanReadyContinue.click();return}if(attempt<100){setTimeout(()=>retry(attempt+1),100);return}japanReadyContinue.disabled=false;japanReadyContinue.innerHTML=original;toast('Japan Ready is still loading — please try again shortly.')};retry(0);
},true);
const journeySessionPreview=ensureJourneySessionPreview();
$('#journeySessionPreviewStart').onclick=beginJourneySession;
$('#journeySessionPreviewCancel').onclick=cancelJourneySessionPreview;
journeySessionPreview.addEventListener('cancel',event=>{event.preventDefault();cancelJourneySessionPreview()});
function playChapterCelebration(){const AudioContextClass=window.AudioContext||window.webkitAudioContext;if(!AudioContextClass)return;try{const context=new AudioContextClass(),start=context.currentTime;[523.25,659.25,783.99,1046.5].forEach((frequency,index)=>{const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type='triangle';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.0001,start+index*.12);gain.gain.exponentialRampToValueAtTime(.16,start+index*.12+.02);gain.gain.exponentialRampToValueAtTime(.0001,start+index*.12+.25);oscillator.connect(gain).connect(context.destination);oscillator.start(start+index*.12);oscillator.stop(start+index*.12+.28)});setTimeout(()=>context.close(),900)}catch{}}
function celebrateCompletedChapter(){const chapter=activeVocabularyChapter;if(!Number.isInteger(chapter)||index<session.length||!chapterStats(chapter).complete)return;meta.chapterCelebrations=Array.isArray(meta.chapterCelebrations)?meta.chapterCelebrations:[];if(meta.chapterCelebrations.includes(chapter))return;meta.chapterCelebrations.push(chapter);save();playChapterCelebration();toast(`🎉 ${WORD_CHAPTER_NAMES[chapter]||`Chapter ${chapter+1}`} complete!`)}
const chapterCelebrationObserver=new MutationObserver(()=>requestAnimationFrame(celebrateCompletedChapter));chapterCelebrationObserver.observe($('#card'),{childList:true,subtree:true});
function strokeAsset(character){return componentRecord(character)?`media/kanji-strokes/${character.codePointAt(0).toString(16).padStart(5,'0')}.svg?v=${APP_VERSION}`:''}
function attachKanjiStrokePlayer(){const panel=$('#kanjiWords'),character=panel?.querySelector('.kanji-detail-heading>span')?.textContent,asset=character&&strokeAsset(character);if(!panel||!asset||panel.querySelector('[data-kanji-strokes]'))return;const tools=document.createElement('div');tools.className='kanji-stroke-tools';tools.innerHTML=`<button type="button" data-kanji-strokes="${esc(character)}">✍️ Watch stroke order</button><small>Animated strokes from KanjiVG</small>`;panel.querySelector('.kanji-detail-heading')?.after(tools)}
const kanjiStrokeObserver=new MutationObserver(()=>attachKanjiStrokePlayer());kanjiStrokeObserver.observe($('#kanjiWords'),{childList:true,subtree:true});
document.addEventListener('click',event=>{const button=event.target.closest('[data-kanji-strokes]');if(!button)return;const character=button.dataset.kanjiStrokes,asset=strokeAsset(character),tools=button.closest('.kanji-stroke-tools');if(!asset||!tools)return;tools.innerHTML=`<button type="button" data-kanji-strokes="${esc(character)}">↻ Replay stroke order</button><small>Animated strokes from KanjiVG</small><object class="kanji-stroke-animation" type="image/svg+xml" data="${asset}" aria-label="Animated stroke order for ${esc(character)}"></object>`});
init();


function hasAnyKaishiLocalData(){
  try{
    if(localStorage.length===0)return false;
    for(let index=0;index<localStorage.length;index++){
      const key=localStorage.key(index);
      if(key&&(
        key.toLowerCase().includes('kaishi')||
        key.toLowerCase().includes('kakashi')||
        key.toLowerCase().includes('progress')||
        key.toLowerCase().includes('journey')
      ))return true;
    }
    return false;
  }catch(error){
    console.warn('Unable to inspect local storage',error);
    return true;
  }
}
function dismissFirstLaunch(){
  const overlay=document.getElementById('firstLaunchOverlay');
  if(overlay)overlay.hidden=true;
  try{localStorage.setItem('kaishi_first_launch_seen','1')}catch(error){}
}
function initialiseFirstLaunchWelcome(){
  const overlay=document.getElementById('firstLaunchOverlay');
  if(!overlay)return;
  if(isAdminTestMode()){
    overlay.hidden=true;
    document.body.classList.remove('welcome-open');
    return;
  }
  let seen=false;
  try{seen=localStorage.getItem('kaishi_first_launch_seen')==='1'}catch(error){}
  if(!seen&&!hasAnyKaishiLocalData()){
    overlay.hidden=false;
    document.body.classList.add('welcome-open');
  }
  const close=()=>{
    dismissFirstLaunch();
    document.body.classList.remove('welcome-open');
  };
  document.getElementById('firstLaunchClose')?.addEventListener('click',close);
  document.getElementById('firstLaunchStart')?.addEventListener('click',close);
  document.getElementById('firstLaunchFirstLesson')?.addEventListener('click',async()=>{
    close();
    for(let attempt=0;attempt<20;attempt++){
      if(vocab.length>=2){startFirstLesson();return}
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    toast('Your first lesson could not load. Check your connection and try again.');
  });
  document.getElementById('firstLaunchSignIn')?.addEventListener('click',async()=>{
    close();
    const signIn=document.getElementById('dashboardSignIn')||document.getElementById('cloudSignIn');
    if(signIn)signIn.click();
  });
}

initialiseFirstLaunchWelcome();

document.addEventListener('visibilitychange',()=>document.documentElement.classList.toggle('village-paused',document.hidden));
