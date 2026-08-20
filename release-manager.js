'use strict';

/*
 * Kaishi Quest release manager — v11.8.35
 *
 * Release helpers:
 * - reliable update/cache refresh
 * - v11.8.34 Reading-from-Meaning correction review pause
 * - v11.8.35 Theatre synchronized playback-speed controls
 */
(() => {
  const CURRENT_VERSION='11.8.35';
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
      console.warn('[Kaishi v11.8.35] Reading review pause could not be installed',error);
    }
  }

  // ----- v11.8.35: Theatre speed ---------------------------------------
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
      console.warn('[Kaishi v11.8.35] Theatre speed controls could not be installed',error);
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

      /* Compact the dashboard bonsai without losing the useful progress data. */
      #bonsaiProgressCard{
        grid-template-columns:125px minmax(0,1fr);
        gap:12px;margin:8px 0;padding:10px 14px;border-radius:18px;
        cursor:pointer
      }
      #bonsaiProgressCard:focus-visible{
        outline:3px solid #60a5fa;outline-offset:3px
      }
      #bonsaiProgressCard .bonsai-visual{min-height:178px}
      #bonsaiProgressCard .bonsai-tree{
        width:104px;height:174px
      }
      #bonsaiProgressCard .bonsai-condition-aura{
        width:112px;height:178px
      }
      #bonsaiProgressCard .bonsai-copy{gap:5px}
      #bonsaiProgressCard .bonsai-copy h2{
        font-size:clamp(1.08rem,2.6vw,1.35rem)
      }
      #bonsaiProgressCard .bonsai-copy p{
        font-size:.78rem;line-height:1.3
      }
      #bonsaiProgressCard .bonsai-stats span{
        padding:6px 7px
      }
      #bonsaiProgressCard #bonsaiConditionTrigger{display:none!important}
      #bonsaiProgressCard::after{
        content:'Tap bonsai for condition';
        position:absolute;right:12px;top:9px;
        color:#166534;font-size:.59rem;font-weight:850;opacity:.7
      }
      .dashboard-priority-actions{margin-top:9px;margin-bottom:6px}
      @media(max-width:620px){
        #bonsaiProgressCard{
          grid-template-columns:92px minmax(0,1fr);
          gap:9px;padding:9px 10px
        }
        #bonsaiProgressCard .bonsai-visual{min-height:142px}
        #bonsaiProgressCard .bonsai-tree{width:82px;height:140px}
        #bonsaiProgressCard .bonsai-condition-aura{width:88px;height:142px}
        #bonsaiProgressCard .bonsai-copy>p{display:none}
        #bonsaiProgressCard .bonsai-stats{gap:4px}
        #bonsaiProgressCard .bonsai-stats span{font-size:.55rem;padding:5px}
        #bonsaiProgressCard .bonsai-stats strong{font-size:.78rem}
        #bonsaiProgressCard::after{content:'Tap for status';font-size:.54rem;right:9px;top:7px}
        .theatre-speed-control{align-items:flex-start;flex-direction:column}
      }
    `;
    document.head.appendChild(style);
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
      if(title) title.textContent='Theatre Speed & Compact Bonsai';
      const detail=versionCard.querySelector('small');
      if(detail) detail.textContent='Theatre now offers synchronized speech-speed controls, and the dashboard bonsai is smaller and tappable for its condition explanation.';
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',install,{once:true});
  }else install();
})();
