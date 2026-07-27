'use strict';
(() => {
 const KEY='kq-vms-settings';
 const defaults={enabled:true,autoOverlay:true,autoStory:false,hideRomaji:false};
 let cfg={...defaults,...read(KEY,{})}, cards={};
 function read(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}
 function save(){localStorage.setItem(KEY,JSON.stringify(cfg))}
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function load(){
  try{cards=await fetch('visual-mnemonics.json?v=4.2.0',{cache:'no-store'}).then(r=>r.ok?r.json():{});}
  catch(e){console.warn('VMS data unavailable',e)}
  bindSettings(); observe(); enhance(document);
 }
 function bindSettings(){
  const map={vmsEnabled:'enabled',vmsAutoOverlay:'autoOverlay',vmsAutoStory:'autoStory',vmsHideRomaji:'hideRomaji'};
  Object.entries(map).forEach(([id,key])=>{
   const el=document.getElementById(id); if(!el)return;
   el.checked=!!cfg[key];
   el.addEventListener('change',()=>{cfg[key]=el.checked;save();enhance(document,true)});
  });
 }
 function approved(v){return v?.imageStatus==='approved' && !!v.scene}
 function keyFromCard(root){
  const word=root.querySelector('.jp')?.textContent?.trim();
  const reading=root.querySelector('.reading')?.textContent?.trim();
  if(word&&reading&&cards[`${word}|${reading}`]) return `${word}|${reading}`;
  const scene=root.querySelector('.memory-scene img');
  if(scene){
   const entry=Object.entries(cards).find(([,v])=>scene.src.includes(v.scene));
   if(entry)return entry[0];
  }
  return '';
 }
 function markup(v){
  const romaji=cfg.hideRomaji?'':`<div><span>Romaji</span><strong>${esc(v.romaji)}</strong></div>`;
  return `<section class="vms-card" data-vms-key="${esc(v.word+'|'+v.reading)}">
   <div class="vms-scene">
    <img src="${esc(v.scene)}?v=${Number(v.imageVersion)||1}" alt="Visual mnemonic for ${esc(v.word)}">
    <div class="vms-overlay" style="--overlay-opacity:${Number(v.overlayOpacity)||.32}">${esc(v.overlay)}</div>
   </div>
   <div class="vms-reveal-controls">
    <button type="button" data-step="overlay">Show kanji</button>
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
  const overlay=box.querySelector('.vms-overlay'), panel=box.querySelector('.vms-reading-panel'), memory=box.querySelector('.vms-memory');
  if(cfg.autoOverlay)overlay.classList.add('show');
  if(cfg.autoStory){panel.classList.add('show');memory.classList.add('show')}
  box.querySelector('[data-step="overlay"]').onclick=()=>overlay.classList.toggle('show');
  box.querySelector('[data-step="reading"]').onclick=()=>panel.classList.toggle('show');
  box.querySelector('[data-step="story"]').onclick=()=>memory.classList.toggle('show');
 }
 function enhance(scope,refresh=false){
  if(!cfg.enabled)return;
  scope.querySelectorAll?.('#card').forEach(card=>{
   if(card.querySelector('.vms-card')&&!refresh)return;
   const key=keyFromCard(card), v=cards[key];
   // The learner-facing app never uses unapproved or regeneration-flagged artwork.
   if(!approved(v))return;
   const old=card.querySelector('.memory-scene'); if(!old)return;
   old.outerHTML=markup(v); wire(card.querySelector('.vms-card'));
  });
 }
 function observe(){
  const card=document.getElementById('card'); if(!card)return;
  new MutationObserver(()=>enhance(document)).observe(card,{childList:true,subtree:true});
 }
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',load):load();
})();