'use strict';

/*
 * Kaishi Quest release manager — v11.8.37
 *
 * Release helpers:
 * - reliable update/cache refresh
 * - v11.8.34 Reading-from-Meaning correction review pause
 * - v11.8.37 Theatre synchronized playback-speed controls
 * - v11.8.37 service-worker version pin + unclipped compact bonsai
 */
(() => {
  const CURRENT_VERSION='11.8.37';
  const CACHE_PREFIXES=['kaishi-shell-','kaishi-images-'];
  const THEATRE_SPEED_KEY='kq-theatre-playback-speed';
  const THEATRE_SPEEDS=[
    {rate:1,label:'Normal'},
    {rate:.8,label:'Slow'},
    {rate:.65,label:'Extra slow'}
  ];
  let refreshing=false;

  window.KAISHI_RELEASE_VERSION=CURRENT_VERSION;

  function parseVersion(value='0.0.0'){
    return String(value).split('.').map(part=>Number.parseInt(part,10)||0).slice(0,3);
  }

  function compareVersions(a,b){
    const av=parseVersion(a),bv=parseVersion(b);
    for(let i=0;i<3;i++){
      if((av[i]||0)>(bv[i]||0)) return 1;
      if((av[i]||0)<(bv[i]||0)) return -1;
    }
    return 0;
  }

  function badge(){
    return document.getElementById('versionBadge') || document.querySelector('.version-badge');
  }

  function setBadge(text,busy=false){
    const el=badge();
    if(!el) return;
    el.textContent=text;
    el.setAttribute('aria-busy',String(busy));
  }

  function notify(message){
    try{
      if(typeof toast==='function'){ toast(message); return; }
    }catch{}
    const status=document.getElementById('updateStatus');
    if(status) status.textContent=message;
  }

  // ----- v11.8.34: Reading-from-Meaning review pause --------------------
  function installReadingReviewPause(){
    try{
      if(typeof bindChoices!=='function' || typeof grade!=='function') return;

      bindChoices=function(answer,skill,onReveal){
        document.querySelectorAll('.choice').forEach(button=>{
          button.onclick=()=>{
            if(revealed) return;
            revealed=true;

            const value=decodeURIComponent(button.dataset.answer);
            const ok=value===answer;

            button.classList.add(ok?'correct':'wrong');
            document.querySelectorAll('.choice').forEach(choice=>{
              if(decodeURIComponent(choice.dataset.answer)===answer){
                choice.classList.add('correct');
              }
              choice.disabled=true;
            });

            if(onReveal) onReveal(ok);

            const pauseForReadingReview=
              skill==='reading' &&
              !ok &&
              Boolean(document.getElementById('readingFeedback'));

            if(!pauseForReadingReview){
              setTimeout(
                ()=>grade(current.v,skill,ok?(hintUsed?2:3):1,ok),
                900
              );
              return;
            }

            grade(current.v,skill,1,false,false);

            const feedback=document.getElementById('readingFeedback');
            if(!feedback) return;

            let continueButton=document.getElementById('readingReviewContinue');
            if(!continueButton){
              continueButton=document.createElement('button');
              continueButton.id='readingReviewContinue';
              continueButton.type='button';
              continueButton.className='primary reveal';
              continueButton.textContent='Continue →';
              feedback.appendChild(continueButton);
            }

            continueButton.onclick=()=>next();
            feedback.scrollIntoView({behavior:'smooth',block:'nearest'});
            continueButton.focus({preventScroll:true});
          };
        });
      };
    }catch(error){
      console.warn('[Kaishi v11.8.37] Reading review pause could not be installed',error);
    }
  }

  // ----- v11.8.37: Theatre speed ---------------------------------------
  function theatreSpeed(){
    try{
      const stored=Number(localStorage.getItem(THEATRE_SPEED_KEY));
      return THEATRE_SPEEDS.some(item=>item.rate===stored)?stored:1;
    }catch{
      return 1;
    }
  }

  function setTheatreSpeed(rate){
    const safe=THEATRE_SPEEDS.some(item=>item.rate===Number(rate))?Number(rate):1;
    try{ localStorage.setItem(THEATRE_SPEED_KEY,String(safe)); }catch{}
    return safe;
  }

  function theatreSpeedControlsHtml(){
    const current=theatreSpeed();
    return `<section class="theatre-speed-control" aria-label="Theatre speech speed">
      <span>Speech speed</span>
      <div>
        ${THEATRE_SPEEDS.map(item=>`<button type="button" data-theatre-speed="${item.rate}" class="${item.rate===current?'active':''}" aria-pressed="${item.rate===current}">${item.label}</button>`).join('')}
      </div>
    </section>`;
  }

  function wireTheatreSpeedControls(subtitles,returnView){
    document.querySelectorAll('[data-theatre-speed]').forEach(button=>{
      button.onclick=()=>{
        const chosen=setTheatreSpeed(button.dataset.theatreSpeed);
        document.querySelectorAll('[data-theatre-speed]').forEach(item=>{
          const active=Number(item.dataset.theatreSpeed)===chosen;
          item.classList.toggle('active',active);
          item.setAttribute('aria-pressed',String(active));
        });
        // Restart the current performance so speech, camera cuts and progress
        // all begin together at the new rate.
        if(typeof playTheatreScene==='function') playTheatreScene(subtitles,returnView);
      };
    });
  }

  function installTheatreSpeed(){
    try{
      if(typeof speakJapanese!=='function' ||
         typeof playTheatreScene!=='function' ||
         typeof theatreStageHtml!=='function') return;

      const baseSpeakJapanese=speakJapanese;
      const baseStageHtml=theatreStageHtml;

      // Only Theatre speech is changed. Conversation/Manga/Grammar keep their
      // existing voice profiles and rates.
      speakJapanese=function(text,onEnd,profile='neutral'){
        const inTheatre=Boolean(
          theatreScene &&
          document.querySelector('#theatre')?.classList.contains('active')
        );
        if(!inTheatre){
          return baseSpeakJapanese(text,onEnd,profile);
        }

        if(!text||!('speechSynthesis' in window)){
          toast('Japanese speech is not available in this browser');
          return;
        }

        if(profile==='neutral'){
          profile=theatreScene.timeline.find(line=>line.line===text)?.speaker||profile;
        }

        speechSynthesis.cancel();
        japaneseSpeech=new SpeechSynthesisUtterance(text);
        japaneseSpeech.lang='ja-JP';

        const voiceProfile=JAPANESE_VOICE_PROFILES[profile]||JAPANESE_VOICE_PROFILES.neutral;
        const voices=speechSynthesis.getVoices().filter(item=>item.lang?.toLowerCase().startsWith('ja'));
        const voice=voices.find(item=>voiceProfile.names?.test(item.name))||voices[0];

        japaneseSpeech.rate=Math.max(.45,Math.min(2,voiceProfile.rate*theatreSpeed()));
        japaneseSpeech.pitch=voiceProfile.pitch;
        if(voice) japaneseSpeech.voice=voice;
        if(onEnd) japaneseSpeech.onend=onEnd;
        speechSynthesis.speak(japaneseSpeech);
      };

      theatreStageHtml=function(scene,subtitles=false){
        return baseStageHtml(scene,subtitles)+theatreSpeedControlsHtml();
      };

      playTheatreScene=function(subtitles=false,returnView='questions'){
        if(!theatreScene) return;
        clearTheatrePlayback();

        const speed=theatreSpeed();
        const timingScale=1/speed;
        const effectiveDuration=theatreScene.duration*timingScale;
        const content=$('#theatreReaderContent');

        content.innerHTML=theatreStageHtml(theatreScene,subtitles);
        $('#theatreCounter').textContent=subtitles?'Transcript replay':'Listening first';
        theatrePlaybackStarted=Date.now();

        wireTheatreSpeedControls(subtitles,returnView);

        const fill=$('#theatrePlaybackFill');
        const speaker=$('#theatreSpeaker');
        const subtitle=$('#theatreSubtitle');

        const progressTimer=setInterval(()=>{
          const elapsed=(Date.now()-theatrePlaybackStarted)/1000;
          if(fill) fill.style.width=`${Math.min(100,elapsed/effectiveDuration*100)}%`;
        },120);
        theatreTimers.push(progressTimer);

        theatreScene.timeline.forEach((line,lineIndex)=>{
          theatreTimers.push(setTimeout(()=>{
            const stage=$('#theatreStage');
            const shotName=line.shot||'wide';
            const shot=theatreShot(theatreScene,shotName);
            const nextAt=theatreScene.timeline[lineIndex+1]?.at||theatreScene.duration;
            const baseSpeakingMs=Math.max(
              1200,
              Math.min((nextAt-line.at)*1000-450,line.line.length*155)
            );
            const speakingMs=baseSpeakingMs*timingScale;

            document.querySelectorAll('[data-theatre-character]').forEach(sprite=>
              sprite.classList.remove('speaking','wave','point','offer','look','talk')
            );

            if(stage&&stage.dataset.shot!==shotName){
              stage.dataset.shot=shotName;
              stage.style.backgroundImage=`url('${theatreAsset(shot)}')`;
              stage.classList.remove('theatre-cut');
              void stage.offsetWidth;
              stage.classList.add('theatre-cut');
            }

            stage?.classList.remove('focus-aiko','focus-kai','focus-master');
            stage?.classList.add(`focus-${line.speaker}`);

            const sprite=document.querySelector(`[data-theatre-character="${line.speaker}"]`);
            const character=theatreCharacter(theatreScene,line.speaker);
            sprite?.classList.add('speaking',line.action||'talk');
            theatreTimers.push(setTimeout(()=>sprite?.classList.remove('speaking'),speakingMs));

            if(speaker) speaker.textContent=`${character?.name||line.speaker} is speaking`;
            if(subtitles&&subtitle){
              subtitle.hidden=false;
              subtitle.innerHTML=`<span lang="ja">${esc(line.line)}</span><small>${esc(line.reading)}</small>`;
            }

            speakJapanese(line.line,null,line.speaker);
          },line.at*1000*timingScale));
        });

        theatreTimers.push(setTimeout(()=>{
          clearInterval(progressTimer);
          if(fill) fill.style.width='100%';
          document.querySelectorAll('[data-theatre-character]').forEach(sprite=>
            sprite.classList.remove('speaking','wave','point','offer','look','talk')
          );
          if(speaker) speaker.textContent='Scene complete';
          theatrePlaybackStarted=0;
          theatreTimers=[];
          setTimeout(
            ()=>returnView==='summary'
              ?renderTheatreSummary()
              :returnView==='explore'
                ?renderTheatreExplore()
                :renderTheatreQuestion(),
            500
          );
        },effectiveDuration*1000));
      };

      window.KaishiTheatrePlayback={
        getSpeed:theatreSpeed,
        setSpeed:setTheatreSpeed,
        speeds:THEATRE_SPEEDS.map(item=>({...item}))
      };
    }catch(error){
      console.warn('[Kaishi v11.8.37] Theatre speed controls could not be installed',error);
    }
  }

  function installEnhancementStyles(){
    if(document.getElementById('kaishiReleaseEnhancements11835')) return;
    const style=document.createElement('style');
    style.id='kaishiReleaseEnhancements11835';
    style.textContent=`
      .theatre-speed-control{
        display:flex;align-items:center;justify-content:space-between;gap:10px;
        margin:10px 0 2px;padding:9px 11px;border:1px solid #dbeafe;
        border-radius:14px;background:#f8fafc
      }
      .theatre-speed-control>span{
        color:#475569;font-size:.74rem;font-weight:800
      }
      .theatre-speed-control>div{display:flex;gap:6px;flex-wrap:wrap}
      .theatre-speed-control button{
        min-height:36px;padding:6px 10px;border-radius:999px;font-size:.72rem
      }
      .theatre-speed-control button.active{
        background:#172554;color:#fff;border-color:#172554
      }

      /* v11.8.37: preserve the sprite's original viewport ratio. */
      #bonsaiProgressCard{position:relative;grid-template-columns:118px minmax(0,1fr);gap:7px;margin:8px 0;padding:9px 10px;border-radius:18px;cursor:pointer;overflow:hidden}
      #bonsaiProgressCard:focus-visible{outline:3px solid #60a5fa;outline-offset:3px}
      #bonsaiProgressCard .bonsai-visual{min-height:166px;overflow:hidden}
      #bonsaiProgressCard .bonsai-tree{width:112px;height:210px;max-width:none;transform:scale(.76);transform-origin:center bottom}
      #bonsaiProgressCard.stage-grown .bonsai-tree{transform:scale(.76)}
      #bonsaiProgressCard .bonsai-condition-aura{width:131px;height:210px;transform:scale(.76);transform-origin:center bottom}
      #bonsaiProgressCard .bonsai-copy{gap:5px}
      #bonsaiProgressCard .bonsai-copy h2{font-size:clamp(1.08rem,2.6vw,1.35rem)}
      #bonsaiProgressCard .bonsai-copy>p{display:none}
      #bonsaiProgressCard .bonsai-stats{gap:4px}
      #bonsaiProgressCard .bonsai-stats span{font-size:.55rem;padding:5px}
      #bonsaiProgressCard .bonsai-stats strong{font-size:.78rem}
      #bonsaiProgressCard #bonsaiConditionTrigger{display:none!important}
      #bonsaiProgressCard::after{content:none!important}
      .dashboard-priority-actions{margin-top:9px;margin-bottom:6px}
      @media(max-width:390px){
        #bonsaiProgressCard{grid-template-columns:108px minmax(0,1fr);gap:6px}
        #bonsaiProgressCard .bonsai-visual{min-height:158px}
        #bonsaiProgressCard .bonsai-tree,#bonsaiProgressCard.stage-grown .bonsai-tree{transform:scale(.72)}
        #bonsaiProgressCard .bonsai-condition-aura{transform:scale(.72)}
      }

      .jr-quantity-learning{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0;padding:12px;border:1px solid #bfdbfe;border-radius:16px;background:linear-gradient(135deg,#eff6ff,#f0fdf4)}
      .jr-quantity-learning h3,.jr-quantity-learning p{margin:2px 0}.jr-quantity-learning p{font-size:.76rem;color:#475569}
      .jr-quantity-dialog{width:min(520px,calc(100% - 24px));padding:0;border:0;border-radius:22px;background:transparent}.jr-quantity-dialog::backdrop{background:#0f172a99}
      .jr-quantity-popup{position:relative;padding:20px;border-radius:22px;background:#fff}.jr-quantity-close{position:absolute;right:10px;top:10px;width:38px;height:38px;border-radius:50%}
      .jr-quantity-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.jr-quantity-row{display:grid;grid-template-columns:1fr auto;gap:1px 6px;text-align:left;padding:8px 9px;min-height:0}
      .jr-quantity-row span{font-size:.9rem}.jr-quantity-row small,.jr-quantity-row em{font-size:.62rem;color:#64748b;font-style:normal}.jr-quantity-row i{grid-row:1/3;grid-column:2;font-style:normal}
      .jr-quantity-popup aside{display:grid;gap:2px;margin:10px 0;padding:10px;border-radius:12px;background:#f8fafc}.jr-quantity-popup aside small,.jr-quantity-popup aside span{font-size:.7rem;color:#64748b}
      .jr-quantity-cheat{margin-bottom:12px;padding:12px;border:1px solid #bfdbfe;border-radius:16px;background:#f8fbff}.jr-quantity-heading h3,.jr-quantity-heading p{margin:3px 0 8px}.jr-quantity-heading p{font-size:.74rem;color:#475569}
      .jr-quantity-examples{display:grid;gap:6px;margin-top:8px}.jr-quantity-examples button{display:grid;gap:2px;text-align:left}.jr-quantity-examples small,.jr-quantity-examples em{font-size:.65rem;font-style:normal}
      @media(max-width:520px){.jr-quantity-learning{align-items:stretch;flex-direction:column}}
    `;
    document.head.appendChild(style);
  }



  const JAPAN_READY_QUANTITIES=[
    ['一つ','ひとつ','hitotsu','one thing'],['二つ','ふたつ','futatsu','two things'],
    ['三つ','みっつ','mittsu','three things'],['四つ','よっつ','yottsu','four things'],
    ['五つ','いつつ','itsutsu','five things'],['六つ','むっつ','muttsu','six things'],
    ['七つ','ななつ','nanatsu','seven things'],['八つ','やっつ','yattsu','eight things'],
    ['九つ','ここのつ','kokonotsu','nine things'],['十','とお','too','ten things']
  ];
  function jrQuantitySpeak(text){if(!('speechSynthesis'in window))return;const u=new SpeechSynthesisUtterance(text);u.lang='ja-JP';u.rate=.82;speechSynthesis.cancel();speechSynthesis.speak(u)}
  function jrQuantityRows(){return JAPAN_READY_QUANTITIES.map(([k,h,r,e])=>`<button type="button" class="jr-quantity-row" data-jr-quantity="${h}"><span lang="ja"><b>${k}</b> ${h}</span><small>${r}</small><em>${e}</em><i>🔊</i></button>`).join('')}
  function installQuantityCheatSheet(){
    const host=document.getElementById('cheatSheetSections');if(!host||host.querySelector('#jrQuantityCheat'))return;
    const s=document.createElement('section');s.id='jrQuantityCheat';s.className='cheat-sheet-section jr-quantity-cheat';
    s.innerHTML=`<div class="jr-quantity-heading"><span class="eyebrow">Ordering & shopping</span><h3>🔢 How many things? · いくつ</h3><p>General counters for asking for a number of items when you do not know a more specific counter.</p></div><div class="jr-quantity-grid">${jrQuantityRows()}</div><div class="jr-quantity-examples"><button type="button" data-jr-quantity="これを二つお願いします"><b lang="ja">これを二つお願いします</b><small>kore o futatsu onegaishimasu</small><em>Two of these, please.</em> 🔊</button><button type="button" data-jr-quantity="いくつですか"><b lang="ja">いくつですか</b><small>ikutsu desu ka</small><em>How many are there?</em> 🔊</button></div>`;
    host.prepend(s);s.querySelectorAll('[data-jr-quantity]').forEach(x=>x.onclick=()=>jrQuantitySpeak(x.dataset.jrQuantity));
  }
  function openQuantityLesson(){
    let d=document.getElementById('jrQuantityLesson');
    if(!d){d=document.createElement('dialog');d.id='jrQuantityLesson';d.className='jr-quantity-dialog';d.innerHTML=`<div class="jr-quantity-popup"><button type="button" class="jr-quantity-close">×</button><span class="eyebrow">Japan Ready mini-lesson</span><h2>Ask for a number of things</h2><p>Tap each counter to hear it.</p><div class="jr-quantity-grid">${jrQuantityRows()}</div><aside><b lang="ja">これを三つお願いします。</b><small>kore o mittsu onegaishimasu</small><span>Three of these, please.</span></aside><button type="button" class="primary jr-quantity-done">Got it</button></div>`;document.body.appendChild(d);d.querySelector('.jr-quantity-close').onclick=()=>d.close();d.querySelector('.jr-quantity-done').onclick=()=>d.close();d.querySelectorAll('[data-jr-quantity]').forEach(x=>x.onclick=()=>jrQuantitySpeak(x.dataset.jrQuantity))}
    d.showModal();
  }
  function installQuantityLearningPlan(){
    const detail=document.querySelector('#japanReadyScenarioList .scenario-detail');if(!detail||detail.querySelector('#jrQuantityLearning'))return;
    const title=detail.querySelector('h2')?.textContent||'';if(!/Caf|Restaurant|Convenience|Shop|Order|Meal/i.test(title))return;
    const s=document.createElement('section');s.id='jrQuantityLearning';s.className='jr-quantity-learning';s.innerHTML=`<div><span class="eyebrow">Essential quantity skill</span><h3>🔢 Ask for 1–10 things</h3><p>Learn ひとつ, ふたつ, みっつ … とお for ordering several items.</p></div><button type="button" class="primary">Learn quantities</button>`;
    (detail.querySelector('.scenario-actions')||detail).before(s);s.querySelector('button').onclick=openQuantityLesson;
  }
  function installJapanReadyQuantitySupport(){const o=new MutationObserver(()=>{installQuantityCheatSheet();installQuantityLearningPlan()});o.observe(document.body,{childList:true,subtree:true});installQuantityCheatSheet();installQuantityLearningPlan()}
  function enforceCurrentServiceWorker(){
    if(!('serviceWorker' in navigator) || location.protocol==='file:') return;
    const registerCurrent=()=>navigator.serviceWorker
      .register(`service-worker.js?v=${CURRENT_VERSION}`,{scope:'./'})
      .then(registration=>registration.update().catch(()=>{}))
      .catch(error=>console.warn('[Kaishi release] Could not pin current service worker',error));

    if(document.readyState==='complete') registerCurrent();
    else window.addEventListener('load',()=>setTimeout(registerCurrent,0),{once:true});
  }


  function lockVisibleReleaseVersion(){
    const apply=()=>{const el=badge();if(el&&el.textContent!==`v${CURRENT_VERSION}`){el.textContent=`v${CURRENT_VERSION}`;el.setAttribute('aria-label',`Kaishi Quest version ${CURRENT_VERSION}. Check for updates and refresh the app.`)}const t=`Kaishi Quest • v${CURRENT_VERSION}`;if(document.title!==t)document.title=t};
    apply();new MutationObserver(apply).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  }
  function refreshVisibleReleaseVersion(){
    document.title=`Kaishi Quest • v${CURRENT_VERSION}`;
    document.querySelectorAll('.version-badge').forEach(node=>{
      node.textContent=`v${CURRENT_VERSION}`;
      node.setAttribute('aria-label',`Kaishi Quest version ${CURRENT_VERSION}. Check for updates and refresh the app.`);
    });
  }

  async function fetchLatestVersion(){
    const response=await fetch(`version.json?check=${Date.now()}`,{
      cache:'no-store',
      headers:{'Cache-Control':'no-cache'}
    });
    if(!response.ok) throw new Error(`Version check failed (${response.status})`);
    return response.json();
  }

  async function clearKaishiCaches(){
    if(!('caches' in window)) return;
    const keys=await caches.keys();
    await Promise.all(
      keys.filter(key=>CACHE_PREFIXES.some(prefix=>key.startsWith(prefix)))
          .map(key=>caches.delete(key))
    );
  }

  async function updateServiceWorker(){
    if(!('serviceWorker' in navigator)) return null;
    const registration=await navigator.serviceWorker.getRegistration();
    if(!registration) return null;
    try{ await registration.update(); }catch{}
    return registration;
  }

  async function activateWaitingWorker(registration){
    const waiting=registration?.waiting;
    if(!waiting) return false;
    waiting.postMessage({type:'SKIP_WAITING'});
    await new Promise(resolve=>{
      const timeout=setTimeout(resolve,1200);
      navigator.serviceWorker.addEventListener('controllerchange',()=>{
        clearTimeout(timeout);
        resolve();
      },{once:true});
    });
    return true;
  }

  function reloadFresh(){
    const url=new URL(window.location.href);
    url.searchParams.set('kq-refresh',Date.now().toString());
    window.location.replace(url.toString());
  }

  async function checkAndRefresh(){
    if(refreshing) return;
    refreshing=true;
    const original=`v${CURRENT_VERSION}`;
    setBadge('Checking…',true);
    notify('Checking for a newer Kaishi Quest release…');

    try{
      const latest=await fetchLatestVersion();
      const latestVersion=String(latest?.version||CURRENT_VERSION);
      const newer=compareVersions(latestVersion,CURRENT_VERSION)>0;

      notify(newer
        ? `Kaishi Quest v${latestVersion} found. Refreshing app files…`
        : `v${CURRENT_VERSION} is current. Refreshing app files…`);

      const registration=await updateServiceWorker();
      await clearKaishiCaches();
      await activateWaitingWorker(registration);

      setBadge(newer?`v${latestVersion} ↻`:`v${CURRENT_VERSION} ↻`,true);
      setTimeout(reloadFresh,250);
    }catch(error){
      console.error('[Kaishi release check]',error);
      setBadge(original,false);
      notify('Could not check for updates. Please try again when online.');
      refreshing=false;
    }
  }

  function install(){
    installReadingReviewPause();
    installTheatreSpeed();
    installEnhancementStyles();
    refreshVisibleReleaseVersion();
    lockVisibleReleaseVersion();
    installJapanReadyQuantitySupport();
    enforceCurrentServiceWorker();

    const el=badge();
    if(el){
      el.textContent=`v${CURRENT_VERSION}`;
      el.setAttribute('role','button');
      el.setAttribute('tabindex','0');
      el.setAttribute('title','Check for updates and refresh');
      el.setAttribute('aria-label',`Kaishi Quest version ${CURRENT_VERSION}. Check for updates and refresh the app.`);
      el.style.cursor='pointer';
      el.addEventListener('click',checkAndRefresh);
      el.addEventListener('keydown',event=>{
        if(event.key==='Enter'||event.key===' '){
          event.preventDefault();
          checkAndRefresh();
        }
      });
    }

    const settingsButton=document.getElementById('checkUpdateBtn');
    if(settingsButton){
      settingsButton.addEventListener('click',event=>{
        event.preventDefault();
        event.stopImmediatePropagation();
        checkAndRefresh();
      },true);
    }

    document.querySelectorAll('.version-badge').forEach(node=>node.textContent=`v${CURRENT_VERSION}`);
    const versionCard=document.querySelector('.version-card');
    if(versionCard){
      const strong=versionCard.querySelector('strong');
      if(strong) strong.textContent=`Kaishi Quest v${CURRENT_VERSION}`;
      const title=versionCard.querySelector('span');
      if(title) title.textContent='Stable Update & Bonsai Fit';
      const detail=versionCard.querySelector('small');
      if(detail) detail.textContent='Theatre keeps synchronized speed controls, the release now pins the current service worker, and the compact dashboard bonsai fits fully without clipping.';
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',install,{once:true});
  }else install();
})();
