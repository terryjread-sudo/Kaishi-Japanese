'use strict';
(() => {
 const KEY='kq-vms-settings-v43';
 const defaults={enabled:true,autoOverlay:true,autoStory:true,hideRomaji:false};
 let cfg={...defaults,...read(KEY,{})}, cards={};

 function read(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}
 function save(){localStorage.setItem(KEY,JSON.stringify(cfg))}
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

 async function load(){
  try{
   cards=await fetch('visual-mnemonics.json?v=6.8.0',{cache:'no-store'}).then(r=>r.ok?r.json():{});
  }catch(e){
   console.warn('VMS data unavailable',e);
  }
  bindSettings();
  observe();
  enhance(document);
 }

 function bindSettings(){
  const map={
   vmsEnabled:'enabled',
   vmsAutoOverlay:'autoOverlay',
   vmsAutoStory:'autoStory',
   vmsHideRomaji:'hideRomaji'
  };
  Object.entries(map).forEach(([id,key])=>{
   const el=document.getElementById(id);
   if(!el)return;
   el.checked=!!cfg[key];
   el.addEventListener('change',()=>{
    cfg[key]=el.checked;
    save();
    enhance(document,true);
   });
  });
 }

 function usable(v){return v?.imageStatus==='approved'&&!!v.scene}

 function keyFromCard(root){
  const word=root.querySelector('.jp')?.textContent?.trim();
  const reading=root.querySelector('.reading')?.textContent?.trim();
  if(word&&reading&&cards[`${word}|${reading}`])return`${word}|${reading}`;
  return'';
 }

 function render(v,preview=false){
  const romaji=cfg.hideRomaji?'':`<div><span>Romaji</span><strong>${esc(v.romaji)}</strong></div>`;
  return `<section class="vms-card${preview?' vms-study-preview':''}" data-vms-key="${esc(v.word+'|'+v.reading)}">
   <div class="vms-stage-label">Mnemonic picture</div>
   <div class="vms-scene">
    <img src="${esc(v.scene)}?v=${encodeURIComponent(String(v.imageVersion||1))}" alt="Visual mnemonic for ${esc(v.word)}">
    <div class="vms-overlay" style="--overlay-opacity:${Number(v.overlayOpacity)||.34};--overlay-size:${Number(v.overlaySize)||.62};--overlay-colour:${esc(v.overlayColour||'#ffffff')}">${esc(v.overlay)}</div>
   </div>
   <div class="vms-reveal-controls">
    <button type="button" data-step="overlay">Show written word</button>
    <button type="button" data-step="reading">Show reading</button>
    <button type="button" data-step="story">Show story</button>
   </div>
   <div class="vms-reading-panel">
    <div><span>Hiragana</span><strong>${esc(v.reading)}</strong></div>
    <div><span>Katakana</span><strong>${esc(v.katakana)}</strong></div>${romaji}
   </div>
   <div class="vms-memory">
    <p class="vms-sound"><span>Sounds like</span><strong>${esc(v.soundMnemonic)}</strong></p>
    <p class="vms-story"><span>Story</span>${esc(v.story)}</p>
   </div>
  </section>`;
 }

 function wire(box){
  if(!box)return;
  const overlay=box.querySelector('.vms-overlay');
  const panel=box.querySelector('.vms-reading-panel');
  const memory=box.querySelector('.vms-memory');

  if(cfg.autoOverlay)overlay?.classList.add('show');
  if(cfg.autoStory){
   panel?.classList.add('show');
   memory?.classList.add('show');
  }

  const overlayButton=box.querySelector('[data-step="overlay"]');
  const readingButton=box.querySelector('[data-step="reading"]');
  const storyButton=box.querySelector('[data-step="story"]');

  if(overlayButton)overlayButton.onclick=()=>overlay?.classList.toggle('show');
  if(readingButton)readingButton.onclick=()=>panel?.classList.toggle('show');
  if(storyButton)storyButton.onclick=()=>memory?.classList.toggle('show');
 }

 function isMeetWord(card){
  return card.querySelector('.eyebrow')?.textContent?.trim()==='Meet the word';
 }

 function enhanceMeetWord(card,v){
  if(!isMeetWord(card)||card.dataset.meetWordEnhanced==='true')return;

  const vmsCard=card.querySelector('.vms-card');
  const jp=card.querySelector(':scope > .jp');
  const reading=card.querySelector(':scope > .reading');
  const meaning=card.querySelector(':scope > .meaning');
  const oldAudio=card.querySelector('#introAudio');

  // A dedicated mnemonic picture supersedes the ordinary built-in vocabulary picture.
  if(vmsCard){
   card.querySelectorAll(':scope > img.picture, :scope > .picture').forEach(element=>{
    if(!element.closest('.vms-card'))element.remove();
   });
  }

  if(jp){
   const hasKanji=/\p{Script=Han}/u.test(jp.textContent||'');
   const identity=document.createElement('section');
   identity.className='meet-word-identity';

   const wordBlock=document.createElement('div');
   wordBlock.className='meet-word-written';
   wordBlock.innerHTML=`<span>${hasKanji?'Kanji / written word':'Japanese word'}</span>`;
   wordBlock.appendChild(jp);

   const speaker=document.createElement('button');
   speaker.type='button';
   speaker.className='audio meet-word-speaker';
   speaker.setAttribute('aria-label','Play Japanese word');
   speaker.title='Play Japanese word';
   speaker.textContent='🔊';
   speaker.onclick=()=>typeof play==='function'&&current?.v?.wordAudio&&play(current.v.wordAudio);
   wordBlock.appendChild(speaker);

   identity.appendChild(wordBlock);

   if(reading){
    const readingBlock=document.createElement('div');
    readingBlock.className='meet-word-reading';
    readingBlock.innerHTML='<span>Reading</span>';
    readingBlock.appendChild(reading);
    identity.appendChild(readingBlock);
   }

   if(meaning){
    const meaningBlock=document.createElement('div');
    meaningBlock.className='meet-word-meaning';
    meaningBlock.innerHTML='<span>Meaning</span>';
    meaningBlock.appendChild(meaning);
    identity.appendChild(meaningBlock);
   }

   const eyebrow=card.querySelector('.eyebrow');
   eyebrow?.insertAdjacentElement('afterend',identity);
  }

  oldAudio?.remove();

  const guidance=document.createElement('aside');
  guidance.className='meet-word-guidance';
  guidance.innerHTML=vmsCard
   ? `<strong>How to learn this word</strong>
      <ol>
       <li>Say the Japanese word aloud using the speaker.</li>
       <li>Connect the mnemonic picture and sound clue to the meaning.</li>
       <li>Picture the short story, then try to recall the word before continuing.</li>
      </ol>`
   : `<strong>How to learn this word</strong>
      <p>Say the Japanese word aloud, look at its meaning and picture, then pause and try to recall it once before continuing.</p>`;

  if(vmsCard)vmsCard.insertAdjacentElement('beforebegin',guidance);
  else{
   const continueButton=card.querySelector('#continueBtn');
   continueButton?.insertAdjacentElement('beforebegin',guidance);
  }

  const continueButton=card.querySelector('#continueBtn');
  if(continueButton)continueButton.textContent='I have linked the word and meaning →';

  card.dataset.meetWordEnhanced='true';
 }

 function enhance(scope,refresh=false){
  if(!cfg.enabled)return;
  scope.querySelectorAll?.('#card').forEach(card=>{
   if(refresh){
    card.dataset.meetWordEnhanced='';
   }

   let key=keyFromCard(card);
   let v=cards[key];

   if(!card.querySelector('.vms-card')&&usable(v)){
    const old=card.querySelector('.memory-scene');
    if(old){
     old.outerHTML=render(v);
     wire(card.querySelector('.vms-card'));
    }
   }else if(card.querySelector('.vms-card')&&!refresh){
    // Existing card is already rendered.
   }

   key=keyFromCard(card);
   v=cards[key]||v;
   enhanceMeetWord(card,v);
  });
 }

 function observe(){
  const card=document.getElementById('card');
  if(!card)return;
  new MutationObserver(()=>enhance(document)).observe(card,{childList:true,subtree:true});
 }

 window.KaishiVMS={render,wire};
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',load):load();
})();
