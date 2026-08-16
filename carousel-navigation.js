'use strict';

/*
 * Kaishi Quest v11.8.1 — Journey / Japan Ready native carousel
 *
 * Uses a labelled mobile selector with one full-width campaign at a time.
 * Native scrolling remains available for touch users while the explicit
 * controls make the two destinations discoverable and accessible.
 */
(() => {
  const RELEASE='11.8.26';
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
        align-items:stretch!important;
        overflow-x:auto!important;overflow-y:visible!important;
        scroll-snap-type:x mandatory!important;
        scroll-padding-inline:0!important;
        scroll-behavior:smooth!important;
        -webkit-overflow-scrolling:touch;
        padding:10px 0 8px!important;
        scrollbar-width:none;
        touch-action:pan-x pan-y;
        overscroll-behavior-x:contain;
      }
      #campaignChooser .campaign-preview::-webkit-scrollbar{display:none}
      #campaignChooser .campaign-preview-panel{
        display:flex!important;
        flex-direction:column!important;
        flex:0 0 100%!important;
        min-width:0!important;
        max-width:100%!important;
        min-height:0!important;
        scroll-snap-align:start!important;
        scroll-snap-stop:always!important;
        box-sizing:border-box!important;
        overflow:hidden!important;
        padding-top:10px!important;
      }
      #campaignChooser .campaign-preview-panel *{min-width:0}
      #campaignChooser .campaign-preview-panel h1,
      #campaignChooser .campaign-preview-panel h2,
      #campaignChooser .campaign-preview-panel h3,
      #campaignChooser .campaign-preview-panel strong,
      #campaignChooser .campaign-preview-panel p,
      #campaignChooser .campaign-preview-panel small{
        overflow-wrap:anywhere;
      }
      #campaignChooser .campaign-preview-panel[hidden]{display:block!important}
      #journeyCampaignPreview,#japanReadyCampaignPreview{
        border-radius:24px!important;padding:12px!important;border:1px solid!important
      }
      #journeyCampaignPreview{
        background:linear-gradient(135deg,#ecfdf5,#eff6ff 58%,#f5f3ff)!important;
        border-color:#86efac!important
      }
      #japanReadyCampaignPreview{
        background:linear-gradient(135deg,#fff7ed,#fff1f2)!important;
        border-color:#fed7aa!important
      }
      #japanReadyCampaignPreview .japan-ready-dashboard-card{
        display:grid!important;grid-template-columns:1fr!important;gap:13px!important;
        padding:18px!important;border-radius:22px!important;
        background:linear-gradient(145deg,#ffffff,#f8fafc)!important;
        border:1px solid #dbe4f0!important;box-shadow:0 8px 25px #17255410!important
      }
      #japanReadyCampaignPreview .japan-ready-home-main{
        order:1!important;display:block!important;padding:0!important;border:0!important;
        grid-column:1!important;border-radius:0!important;background:transparent!important
      }
      #japanReadyCampaignPreview .japan-ready-home-main img{display:none!important}
      #japanReadyCampaignPreview .home-aiko-guide{
        order:2!important;grid-template-columns:48px minmax(0,1fr)!important;
        grid-column:1!important;
        gap:10px!important;padding:11px 12px!important;border:0!important;
        border-radius:14px!important;background:#fff7ed!important
      }
      #japanReadyCampaignPreview .home-aiko-guide img{
        width:48px!important;height:48px!important;border-radius:14px!important
      }
      #japanReadyCampaignPreview .journey-home-progress{order:3!important;grid-column:1!important}
      #japanReadyCampaignPreview .journey-home-actions{order:4!important;grid-column:1!important;margin-top:auto!important}
      .campaign-carousel-tabs{
        display:grid;grid-template-columns:1fr 1fr;gap:6px;
        margin:4px 0 0;padding:4px;border-radius:16px;
        background:#e2e8f0
      }
      .campaign-carousel-tab{
        width:100%;min-height:44px!important;border-radius:12px;border:0;
        padding:8px 10px!important;background:transparent;color:#475569;
        font-size:.78rem;font-weight:850
      }
      .campaign-carousel-tab.active{
        background:#fff;color:#1d4ed8;box-shadow:0 3px 10px #17255418
      }
      .campaign-carousel-tab:focus-visible,.campaign-pagination-dot:focus-visible{
        outline:3px solid #f59e0b;outline-offset:2px
      }
      .campaign-pagination-dots{
        display:flex;align-items:center;justify-content:center;gap:2px;
        min-height:34px;margin:0;padding:0
      }
      .campaign-pagination-dot{
        width:32px!important;height:32px!important;min-height:32px!important;padding:0!important;
        border:0!important;border-radius:50%!important;background:transparent!important
      }
      .campaign-pagination-dot::before{
        content:'';display:block;width:9px;height:9px;margin:auto;box-sizing:border-box;
        border:2px solid #64748b;border-radius:50%;background:transparent
      }
      .campaign-pagination-dot.active::before{
        background:#2563eb;border-color:#2563eb;box-shadow:0 0 0 4px #dbeafe
      }
      @media(max-width:520px){
        #japanReadyCampaignPreview .japan-ready-dashboard-card{
          gap:11px!important;padding:15px!important;border-radius:18px!important;
          box-shadow:0 4px 14px #1725540a!important
        }
        #japanReadyCampaignPreview .home-aiko-guide{
          grid-template-columns:42px minmax(0,1fr)!important;
          padding:10px!important;border-radius:12px!important;background:#fff7ed!important
        }
        #japanReadyCampaignPreview .home-aiko-guide img{
          width:42px!important;height:42px!important;border-radius:12px!important
        }
      }
      @media(min-width:720px){
        #campaignChooser .campaign-preview{
          padding-right:0!important;gap:14px!important;overflow-x:visible!important
        }
        #campaignChooser .campaign-preview-panel{
          flex-basis:calc(50% - 7px)!important;
          max-width:none!important;
          scroll-snap-align:start!important;
          cursor:pointer
        }
        .campaign-carousel-tabs,.campaign-pagination-dots{display:none}
        #campaignChooser .campaign-preview-panel .campaign-card-heading{
          visibility:visible!important
        }
      }
      .campaign-card-heading{
        display:flex;align-items:center;justify-content:space-between;gap:8px;
        margin:0 0 10px;padding:0 2px
      }
      .campaign-card-heading{
        flex:0 0 auto;
        min-height:30px;
        overflow:hidden;
      }
      .campaign-card-heading strong{font-size:.9rem;white-space:nowrap}
      .campaign-card-heading small{color:#64748b;white-space:nowrap}
      #campaignChooser .campaign-preview-panel:not(.carousel-current) .campaign-card-heading{
        visibility:hidden
      }
      #campaignChooser .campaign-preview-panel.carousel-current .campaign-card-heading{
        visibility:visible
      }
      @media(hover:hover) and (pointer:fine){
        #campaignChooser .campaign-preview-panel:hover{
          transform:translateY(-1px);
          box-shadow:0 10px 24px #17255412
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureCardHeadings(){
    const journey=$('#journeyCampaignPreview');
    const japan=$('#japanReadyCampaignPreview');
    if(journey && !journey.querySelector('.campaign-card-heading')){
      const h=document.createElement('div');
      h.className='campaign-card-heading';
      h.innerHTML='<strong>📖 Japanese Journey</strong><small>Full learning path</small>';
      journey.prepend(h);
    }
    if(japan && !japan.querySelector('.campaign-card-heading')){
      const h=document.createElement('div');
      h.className='campaign-card-heading';
      h.innerHTML='<strong>✈️ Japan Ready</strong><small>Practical travel Japanese</small>';
      japan.prepend(h);
    }
  }

  function ensureDots(){
    if($('#campaignCarouselDots'))return;
    const chooser=$('#campaignChooser');
    if(!chooser)return;
    const tabs=document.createElement('div');
    tabs.id='campaignCarouselDots';
    tabs.className='campaign-carousel-tabs';
    tabs.setAttribute('aria-label','Study mode pages');
    tabs.innerHTML=`
      <button class="campaign-carousel-tab active" data-carousel-index="0" aria-label="Show Japanese Journey">Journey</button>
      <button class="campaign-carousel-tab" data-carousel-index="1" aria-label="Show Japan Ready">Japan Ready</button>
    `;
    const strip=chooser.querySelector('.campaign-preview');
    strip?.insertAdjacentElement('beforebegin',tabs);

    const dots=document.createElement('div');
    dots.id='campaignPaginationDots';
    dots.className='campaign-pagination-dots';
    dots.setAttribute('aria-label','Swipe pages');
    dots.innerHTML=`
      <button class="campaign-pagination-dot active" data-carousel-index="0" aria-label="Show Japanese Journey"></button>
      <button class="campaign-pagination-dot" data-carousel-index="1" aria-label="Show Japan Ready"></button>
    `;
    strip?.insertAdjacentElement('afterend',dots);

    [...tabs.querySelectorAll('[data-carousel-index]'),...dots.querySelectorAll('[data-carousel-index]')].forEach(button=>{
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
    const left = target.offsetLeft - strip.offsetLeft - Math.max(0,(strip.clientWidth-target.offsetWidth)/2);
    strip.scrollTo({left:Math.max(0,left),behavior:'smooth'});
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
    document.querySelectorAll('[data-carousel-index]').forEach(control=>{
      const active=Number(control.dataset.carouselIndex)===index;
      control.classList.toggle('active',active);
      control.setAttribute('aria-current',active?'page':'false');
    });
    panels().forEach((panel,i)=>{
      panel.classList.toggle('carousel-current',i===index);
      panel.setAttribute('aria-current',i===index?'true':'false');
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

  function installDesktopInteractions(){
    const ps=panels();
    ps.forEach((panel,index)=>{
      if(panel.dataset.desktopBound==='1')return;
      panel.dataset.desktopBound='1';
      panel.setAttribute('tabindex','0');
      panel.addEventListener('click',event=>{
        if(event.target.closest('button,a,input,select,textarea'))return;
        activateIndex(index);
        if(window.matchMedia('(max-width:719px)').matches)scrollToIndex(index,false);
      });
      panel.addEventListener('keydown',event=>{
        if(event.key==='Enter' || event.key===' '){
          event.preventDefault();
          activateIndex(index);
        }
      });
    });

    const strip=$('#campaignChooser .campaign-preview');
    if(strip && strip.dataset.keyboardBound!=='1'){
      strip.dataset.keyboardBound='1';
      strip.setAttribute('tabindex','0');
      strip.addEventListener('keydown',event=>{
        if(event.key!=='ArrowLeft' && event.key!=='ArrowRight')return;
        event.preventDefault();
        const journeyActive=$('#chooseJourneyCampaign')?.classList.contains('active');
        const current=journeyActive?0:1;
        const next=event.key==='ArrowRight'?Math.min(1,current+1):Math.max(0,current-1);
        activateIndex(next);
        if(window.matchMedia('(max-width:719px)').matches)scrollToIndex(next,false);
        updateDots(next);
      });
    }
  }

  function install(){
    ensureStyles();
    ensureCardHeadings();
    ensureDots();
    installScrollSync();
    installDesktopInteractions();
    const journeyActive=$('#chooseJourneyCampaign')?.classList.contains('active');
    updateDots(journeyActive?0:1);
    syncToExistingState();

    // Keep carousel aligned when existing app state changes programmatically.
    ['chooseJourneyCampaign','chooseJapanReadyCampaign'].forEach((id,index)=>{
      $('#'+id)?.addEventListener('click',()=>setTimeout(()=>scrollToIndex(index,false),0));
    });

    window.addEventListener('resize',()=>{
      syncToExistingState();
    },{passive:true});
    window.addEventListener('pageshow',()=>{
      syncToExistingState();
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',install,{once:true});
  }else install();
})();
