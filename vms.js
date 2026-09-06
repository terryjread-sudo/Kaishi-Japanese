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
   cards=await fetch('visual-mnemonics.json?v=8.2.1',{cache:'no-store'}).then(r=>r.ok?r.json():{});
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
   <div class="vms-reveal-controls" role="group" aria-label="Mnemonic details">
    <button type="button" data-step="overlay" aria-pressed="false">Written</button>
    <button type="button" data-step="reading" aria-pressed="false">Reading</button>
    <button type="button" data-step="story" aria-pressed="false">Story</button>
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

  const toggle=(button,target)=>{if(!button||!target)return;const sync=()=>button.setAttribute('aria-pressed',String(target.classList.contains('show')));sync();button.onclick=()=>{target.classList.toggle('show');sync()}};
  toggle(overlayButton,overlay);
  toggle(readingButton,panel);
  toggle(storyButton,memory);
 }

 function isMeetWord(card){
  return card.querySelector('.eyebrow')?.textContent?.trim()==='Meet the word';
 }

 function removeDuplicateBuiltInPictures(card){
  const vmsCard=card.querySelector('.vms-card');
  if(!vmsCard)return;
  card.querySelectorAll('img.picture, .picture').forEach(element=>{
   if(!element.closest('.vms-card'))element.remove();
  });
 }

 function enhanceMeetWord(card,v){
  removeDuplicateBuiltInPictures(card);
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
   removeDuplicateBuiltInPictures(card);
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
