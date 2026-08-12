'use strict';

/*
 * Kaishi Quest v11.7.1 — Journey / Japan Ready native carousel
 *
 * Uses the mobile pattern of partially revealing the neighbouring card.
 * No instructional text is required: the visible edge + page dots indicate
 * horizontal content. Native scrolling keeps interaction smooth.
 */
(() => {
  const RELEASE='11.7.1';
  const $=(s,r=document)=>r.querySelector(s);

  function ensureStyles(){
    if($('#campaignCarouselStyles'))return;
    const style=document.createElement('style');
    style.id='campaignCarouselStyles';
    style.textContent=`
      /* Hide the old segmented switch visually, but leave it in the DOM for
         existing app.js state management and accessibility scripting. */
      #campaignChooser>.campaign-chooser-heading{display:none!important}
      #campaignChooser{
        overflow:visible!important;background:transparent!important;
        box-shadow:none!important;border:0!important;padding:0!important;
        min-height:0!important
      }
      #campaignChooser .campaign-preview{
        display:flex!important;gap:12px!important;
        overflow-x:auto!important;overflow-y:visible!important;
        scroll-snap-type:x mandatory!important;
        scroll-behavior:smooth!important;
        -webkit-overflow-scrolling:touch;
        padding:2px max(7vw,22px) 8px 0!important;
        scrollbar-width:none;
        touch-action:pan-x pan-y;
      }
      #campaignChooser .campaign-preview::-webkit-scrollbar{display:none}
      #campaignChooser .campaign-preview-panel{
        display:block!important;
        flex:0 0 90%!important;
        min-width:0!important;
        scroll-snap-align:start!important;
        scroll-snap-stop:always!important;
      }
      #campaignChooser .campaign-preview-panel[hidden]{display:block!important}
      #journeyCampaignPreview,#japanReadyCampaignPreview{
        border-radius:24px!important;
      }
      .campaign-carousel-dots{
        display:flex;justify-content:center;gap:6px;margin:3px 0 2px
      }
      .campaign-carousel-dot{
        width:7px;height:7px;border-radius:50%;border:0;padding:0!important;
        min-height:7px!important;background:#cbd5e1
      }
      .campaign-carousel-dot.active{width:18px;border-radius:999px;background:#2563eb}
      .campaign-carousel-caption{
        text-align:center;color:#94a3b8;font-size:.68rem;margin-top:1px
      }
      @media(min-width:720px){
        #campaignChooser .campaign-preview{
          padding-right:0!important;gap:14px!important
        }
        #campaignChooser .campaign-preview-panel{flex-basis:calc(50% - 7px)!important}
        .campaign-carousel-dots{display:none}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureDots(){
    if($('#campaignCarouselDots'))return;
    const chooser=$('#campaignChooser');
    if(!chooser)return;
    const dots=document.createElement('div');
    dots.id='campaignCarouselDots';
    dots.className='campaign-carousel-dots';
    dots.setAttribute('aria-label','Study mode pages');
    dots.innerHTML=`
      <button class="campaign-carousel-dot active" data-carousel-index="0" aria-label="Journey"></button>
      <button class="campaign-carousel-dot" data-carousel-index="1" aria-label="Japan Ready"></button>
    `;
    chooser.insertAdjacentElement('afterend',dots);

    dots.querySelectorAll('[data-carousel-index]').forEach(button=>{
      button.addEventListener('click',()=>{
        const index=Number(button.dataset.carouselIndex||0);
        scrollToIndex(index,true);
      });
    });
  }

  function panels(){
    return [$('#journeyCampaignPreview'),$('#japanReadyCampaignPreview')].filter(Boolean);
  }

  function scrollToIndex(index,activate=false){
    const strip=$('#campaignChooser .campaign-preview');
    const ps=panels();
    const target=ps[index];
    if(!strip||!target)return;
    strip.scrollTo({left:target.offsetLeft-strip.offsetLeft,behavior:'smooth'});
    if(activate)activateIndex(index);
    updateDots(index);
  }

  function activateIndex(index){
    const journeyButton=$('#chooseJourneyCampaign');
    const japanButton=$('#chooseJapanReadyCampaign');
    const journeyActive=journeyButton?.classList.contains('active');
    if(index===0 && !journeyActive)journeyButton?.click();
    if(index===1 && journeyActive)japanButton?.click();
  }

  function updateDots(index){
    document.querySelectorAll('.campaign-carousel-dot').forEach((dot,i)=>{
      dot.classList.toggle('active',i===index);
      dot.setAttribute('aria-current',i===index?'true':'false');
    });
  }

  function installScrollSync(){
    const strip=$('#campaignChooser .campaign-preview');
    if(!strip||strip.dataset.carouselBound==='1')return;
    strip.dataset.carouselBound='1';

    let settleTimer=null;
    strip.addEventListener('scroll',()=>{
      clearTimeout(settleTimer);
      settleTimer=setTimeout(()=>{
        const ps=panels();
        if(ps.length<2)return;
        const center=strip.scrollLeft + strip.clientWidth/2;
        let best=0,bestDist=Infinity;
        ps.forEach((panel,i)=>{
          const pc=panel.offsetLeft + panel.offsetWidth/2 - strip.offsetLeft;
          const dist=Math.abs(pc-center);
          if(dist<bestDist){best=i;bestDist=dist}
        });
        updateDots(best);
        activateIndex(best);
      },90);
    },{passive:true});
  }

  function syncToExistingState(){
    const journeyActive=$('#chooseJourneyCampaign')?.classList.contains('active');
    requestAnimationFrame(()=>scrollToIndex(journeyActive?0:1,false));
  }

  function install(){
    ensureStyles();
    ensureDots();
    installScrollSync();
    syncToExistingState();

    // Keep carousel aligned when existing app state changes programmatically.
    ['chooseJourneyCampaign','chooseJapanReadyCampaign'].forEach((id,index)=>{
      $('#'+id)?.addEventListener('click',()=>setTimeout(()=>scrollToIndex(index,false),0));
    });

    window.addEventListener('resize',syncToExistingState,{passive:true});
    window.addEventListener('pageshow',syncToExistingState);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',install,{once:true});
  }else install();
})();
