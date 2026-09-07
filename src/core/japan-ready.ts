import { travelContentSchema } from '../domains/japan-ready/content';
import type { Scenario, TravelContent } from '../domains/japan-ready/content';
import { readTripPlan, recommendTrip, tripPlanSchema } from '../domains/japan-ready/trip-plan';
import type { ScenarioProgress } from '../domains/japan-ready/trip-plan';
import { loadContent } from '../platform/content';
import { showAnswerFeedback } from './lesson-ui';

interface Word { id: string; word: string; reading?: string; meaning: string; topic?: string; wordAudio?: string }
interface Campaign { currentScenarioId: string; unlockedScenarioIds: string[]; scenarioProgress: Record<string, ScenarioProgress> }
interface TravelMeta { activeCampaign?: string; tripPlan?: unknown; campaignProgress?: Record<string, Campaign> }
interface TravelBridge {
  getMeta(): TravelMeta; getVocab(): Word[]; save(): void; show(screen: string): void;
  wordIntroduced(word: Word): boolean; startFocusedStudy(ids: string[]): void;
  stats(): { started: number }; isTestMode?(): boolean;
}
declare global { interface Window { KaishiJapanReadyBridge?: TravelBridge } }
const q = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector);
const esc = (value: string) => value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c));
const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const speak = (text: string) => { if (!('speechSynthesis' in window)) return; speechSynthesis.cancel(); const utterance=new SpeechSynthesisUtterance(text); utterance.lang='ja-JP'; utterance.rate=.88; speechSynthesis.speak(utterance); };

export function installJapanReady() {
  const bridge = window.KaishiJapanReadyBridge;
  if (!bridge) return;
  const b = bridge;
  let data: TravelContent | undefined, active: Scenario | undefined, turn=0, mistakes=0, parts: string[]=[], position=0, busy=false;
  function campaign(): Campaign {
    const m=b.getMeta(); m.campaignProgress ||= {};
    return m.campaignProgress['japan-ready'] ||= { currentScenarioId:'polite-basics',unlockedScenarioIds:['polite-basics'],scenarioProgress:{} };
  }
  function state(id: string) { const c=campaign(); c.scenarioProgress ||= {}; return c.scenarioProgress[id] ||= { completedActivities:[],conversationAttempts:0,confidence:0,completedAt:null }; }
  function planRoute() { const plan=readTripPlan(b.getMeta().tripPlan); return plan?.enabled && data ? recommendTrip(plan,data.scenarios,campaign().scenarioProgress,today()) : null; }
  function words(s: Scenario) { return b.getVocab().filter(w=>s.wordHints.some(h=>`${w.meaning} ${w.topic||''}`.toLowerCase().includes(h.toLowerCase()))).slice(0,24); }
  function current() { const id=planRoute()?.scenarioId || campaign().currentScenarioId; return data?.scenarios.find(s=>s.id===id) || data?.scenarios[0]; }
  function unlocked(id: string) { return b.isTestMode?.() || campaign().unlockedScenarioIds.includes(id) || planRoute()?.unlockedIds.includes(id); }
  function bind(id: string, callback: () => void) { const el=q<HTMLButtonElement>(`#${id}`); if(el) el.onclick=callback; }
  function setText(id: string, value: string) { const el=q(`#${id}`); if(el)el.textContent=value; }
  function renderPlan(edit=false) {
    const page=q('.japan-ready-page'); if(!page||!data)return;
    let host=q('#tripPlan'); if(!host){host=document.createElement('section');host.id='tripPlan';host.className='trip-plan';page.querySelector('.japan-ready-hero')?.after(host);}
    const saved=readTripPlan(b.getMeta().tripPlan),route=planRoute();
    if (!edit) {
      host.innerHTML=`<h3>${route?.duringTrip?'During your trip':'Your trip plan'}</h3>${route?`<p>${route.duringTrip?'Keep useful phrases and reviews close at hand.':`${route.remainingDays} days until departure · ${route.dailyMinutes} minutes a day.`}</p><p>Recommended: ${esc(current()?.title||'Review')} · about ${route.dailyMinutes} minutes today.</p><p>${route.estimatedMinutes>route.availableMinutes&&!route.duringTrip?'Your selected pace may not cover every scenario before departure. We will prioritise your choices.':'Times are estimates; confidence grows with practice.'}</p><button id="tripPractice" class="primary">Start today’s travel practice</button>`:'<p>Choose a departure date and the situations you want to practise.</p>'}<button id="tripEdit">${route?'Edit trip plan':'Plan my trip'}</button>${route?'<button id="tripRemove">Remove plan</button>':''}`;
      bind('tripEdit',()=>renderPlan(true));bind('tripPractice',()=>{const next=current();if(next)detail(next.id)});
      bind('tripRemove',()=>{if(saved){b.getMeta().tripPlan={...saved,enabled:false,updatedAt:Date.now()};b.save();render();}}); return;
    }
    host.innerHTML=`<form id="tripForm"><h3>Plan my trip</h3><label>Departure date <input name="departure" type="date" required value="${saved?.departureDate||''}"></label><label>Daily study time <select name="minutes">${[5,10,15].map(n=>`<option value="${n}"${n===(saved?.dailyMinutes||10)?' selected':''}>${n} minutes</option>`).join('')}</select></label><fieldset><legend>Priority situations</legend><div class="trip-priorities">${data.scenarios.map(s=>`<label><input type="checkbox" name="priority" value="${esc(s.id)}"${!saved||saved.priorities.includes(s.id)?' checked':''}>${esc(s.title)}</label>`).join('')}</div></fieldset><p id="tripError" role="status"></p><button type="submit" class="primary">Save trip plan</button><button type="button" id="tripCancel">Cancel</button></form>`;
    const form=q<HTMLFormElement>('#tripForm');if(form)form.onsubmit=e=>{e.preventDefault();const fields=new FormData(form),value=tripPlanSchema.safeParse({schemaVersion:1,enabled:true,updatedAt:Date.now(),departureDate:fields.get('departure'),dailyMinutes:Number(fields.get('minutes')),priorities:fields.getAll('priority')});if(!value.success){setText('tripError','Choose a valid date and at least one priority situation.');return;}b.getMeta().tripPlan=value.data;b.save();render();};bind('tripCancel',()=>renderPlan());
  }
  function render() {
    if(!data)return;
    const n=current(); if(!n)return;
    const done=data.scenarios.filter(s=>state(s.id).completedAt).length;
    setText('japanReadyHomeTitle',`Next: ${n.title}`);setText('japanReadyHomeActivity',n.description);setText('japanReadyHomeScenario',`${n.icon} ${n.title}`);
    setText('japanReadyHomeStatus',`${state(n.id).confidence||0}/5 confidence · ${state(n.id).completedAt?'Completed':'In progress'}`);
    setText('japanReadyHomeProgress',`${done}/${data.scenarios.length} scenarios complete`);
    const stats=q('#japanReadyStats');if(stats)stats.innerHTML=`<span><strong>${done}/${data.scenarios.length}</strong> scenarios</span><span><strong>${b.stats().started}</strong> shared words</span>`;
    const list=q('#japanReadyScenarioList');if(list){list.innerHTML=data.scenarios.map(s=>`<article class="japan-scenario ${unlocked(s.id)?'':'locked'} ${s.id===n.id?'recommended':''}"><div class="japan-scenario-number">${unlocked(s.id)?s.icon:'🔒'}</div><div><span class="eyebrow">${esc(s.region)}</span><h3>${esc(s.title)}</h3><p>${esc(s.description)}</p><small>${state(s.id).confidence||0}/5 confidence</small></div><button data-s="${esc(s.id)}"${unlocked(s.id)?'':' disabled'}>${s.id===n.id?'Continue':state(s.id).completedAt?'Revisit':'Open'}</button></article>`).join('');list.querySelectorAll<HTMLButtonElement>('[data-s]').forEach(el=>el.onclick=()=>detail(el.dataset.s||''));}
    renderPlan();
  }
  function detail(id: string) {
    const s=data?.scenarios.find(s=>s.id===id),list=q('#japanReadyScenarioList');if(!s||!list||!unlocked(id))return;
    const ws=words(s),unknown=ws.filter(w=>!b.wordIntroduced(w));
    list.innerHTML=`<section class="scenario-detail"><button id="scenarioListBack">← All scenarios</button><h2>${s.icon} ${esc(s.title)}</h2><p>${esc(s.confidenceGoal)}</p><aside class="aiko-cultural-tip"><p>${esc(s.cultureTip)}</p></aside><div class="scenario-word-preview">${ws.slice(0,12).map(w=>`<span lang="ja">${esc(w.word)}<small>${esc(w.meaning)}</small></span>`).join('')}</div><p>${unknown.length?`${unknown.length} useful words are new. Focused study introduces them before testing.`:'Revisit these words or practise the conversation.'}</p><div class="scenario-actions"><button id="travelFocused" class="primary">Focused study</button><button id="travelLive">Live conversation</button></div></section>`;
    bind('scenarioListBack',render);bind('travelFocused',()=>b.startFocusedStudy([...unknown,...ws.filter(w=>b.wordIntroduced(w))].slice(0,3).map(w=>w.id)));bind('travelLive',()=>start(s));
  }
  async function open() { b.getMeta().activeCampaign='japan-ready';b.save();b.show('japanReady');if(!data)await load();render(); }
  function bubble(role: string, japanese: string, english: string) { const row=document.createElement('article');row.className=`wa-message-row ${role==='You'?'wa-user':'wa-npc'}`;row.innerHTML=`<div class="wa-bubble"><strong>${role}</strong><span lang="ja">${esc(japanese)}</span><em>${esc(english)}</em></div>`;q('#liveConversationTranscript')?.append(row); }
  function start(s: Scenario) { active=s;turn=0;mistakes=0;state(s.id).conversationAttempts=Number(state(s.id).conversationAttempts||0)+1;b.save();setText('liveConversationTitle',s.title);setText('liveConversationGoal',s.confidenceGoal);const transcript=q('#liveConversationTranscript');if(transcript)transcript.innerHTML='';q('#liveConversationComplete')?.setAttribute('hidden','');q('#liveConversationInputArea')?.removeAttribute('hidden');b.show('liveConversation');nextTurn(); }
  function nextTurn() { const phrase=active?.phrases[turn];if(!phrase){complete();return;}parts=[];position=0;bubble('Aiko',phrase.npc,phrase.npcEnglish||'');setText('liveConversationPrompt',phrase.prompt);renderBuilder();speak(phrase.npc); }
  function renderBuilder() {
    const phrase=active?.phrases[turn];if(!phrase)return;
    const target=Array.from((phrase.accepted[0]||'').replace(/[\s。、！？!?]/g,'')),expected=target[position];
    setText('kanaBuilderAnswer',parts.join('')||'Build your response');setText('kanaBuilderTarget',expected?'Choose the next character':'Response complete');
    const submit=q<HTMLButtonElement>('#liveConversationSubmit');if(submit)submit.disabled=position<target.length;
    const choices=q('#kanaBuilderChoices');if(!choices)return;choices.innerHTML='';
    if(!expected)return;
    const pool=Array.from(new Set([expected,...'あいうえおかきくけこさしすせそ'])).filter(c=>c!==expected).sort(()=>Math.random()-.5).slice(0,3);pool.push(expected);pool.sort(()=>Math.random()-.5);
    for(const char of pool){const button=document.createElement('button');button.type='button';button.textContent=char;button.lang='ja';button.onclick=()=>{
      choices.querySelectorAll<HTMLButtonElement>('button').forEach(el=>el.disabled=true);
      if(char===expected){parts.push(char);position++;renderBuilder();return;}
      mistakes++;showAnswerFeedback(choices,{selected:char,answer:expected,correct:false,explanation:phrase.explanation||`The next character in “${phrase.accepted[0]}” is “${expected}”. ${phrase.acceptedEnglish?.[0]||phrase.prompt}`},renderBuilder,()=>speak(phrase.accepted[0]||''));
    };choices.append(button);}
  }
  function submit() { const phrase=active?.phrases[turn];if(!phrase)return;const expected=Array.from((phrase.accepted[0]||'').replace(/[\s。、！？!?]/g,''));if(position<expected.length)return;bubble('You',phrase.accepted[0]||'',phrase.acceptedEnglish?.[0]||'');turn++;nextTurn(); }
  function complete() { if(!active||!data)return;const p=state(active.id),earned=mistakes===0?5:mistakes<=2?4:mistakes<=5?3:2;p.confidence=Math.max(p.confidence||0,earned);p.completedAt=new Date().toISOString();p.updatedAt=Date.now();p.completedActivities=Array.from(new Set([...(p.completedActivities||[]),'live-conversation']));p.lastWrongKana=mistakes;const next=data.scenarios[data.scenarios.findIndex(s=>s.id===active?.id)+1];if(next){campaign().unlockedScenarioIds=Array.from(new Set([...campaign().unlockedScenarioIds,next.id]));campaign().currentScenarioId=next.id;}b.save();q('#liveConversationInputArea')?.setAttribute('hidden','');const host=q('#liveConversationComplete');if(host){host.hidden=false;host.innerHTML=`<h2>Scenario complete</h2><p>${esc(active.title)} · ${earned}/5 confidence</p><p>${mistakes} character corrections</p><button id="travelReturn" class="primary">Return to scenarios</button><button id="travelRepeat">Practise again</button>`;bind('travelReturn',()=>{void open()});bind('travelRepeat',()=>{if(active)start(active)});} }
  function cheatSheet() { if(!data)return;const host=q('#cheatSheetSections');if(host){host.innerHTML=data.cheatSheet.map(group=>`<section class="cheat-sheet-group"><h3>${group.icon} ${esc(group.title)}</h3>${group.phrases.map(p=>`<article class="cheat-phrase"><button class="audio" data-phrase="${esc(p.jp)}" aria-label="Play ${esc(p.en)}">🔊</button><div><strong lang="ja">${esc(p.jp)}</strong><small>${esc(p.romaji)}</small><span>${esc(p.en)}</span></div></article>`).join('')}</section>`).join('');host.querySelectorAll<HTMLButtonElement>('[data-phrase]').forEach(button=>button.onclick=()=>speak(button.dataset.phrase||''));}b.show('japanReadyCheatSheet'); }
  async function load() { if(busy)return;busy=true;try{data=await loadContent('data/japan-ready-v90.json',travelContentSchema);render();}catch{const host=q('#japanReadyScenarioList');if(host){host.innerHTML='<p role="status">Travel content is unavailable. Connect and retry, or download it before travelling.</p><button id="travelRetry">Retry</button>';bind('travelRetry',()=>{void load()});}}finally{busy=false;} }
  bind('continueJapanReadyCampaign',()=>{void open()});bind('japanReadyBack',()=>{b.getMeta().activeCampaign='journey';b.save();b.show('home')});bind('liveConversationBack',()=>{void open()});bind('cheatSheetBack',()=>{void open()});bind('openJapanReadyCheatSheet',cheatSheet);bind('liveConversationSubmit',submit);bind('kanaBuilderUndo',()=>{if(position){position--;parts.pop();renderBuilder();}});
  window.addEventListener('kaishi-cloud-sync-ready',()=>{if(data)render();});
  void load();
}
