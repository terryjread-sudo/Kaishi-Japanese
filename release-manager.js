'use strict';

/*
 * Kaishi Quest release manager — v11.8.42
 *
 * Release helpers:
 * - reliable update/cache refresh
 * - v11.8.34 Reading-from-Meaning correction review pause
 * - v11.8.40 Theatre synchronized playback-speed controls
 * - v11.8.40 service-worker version pin + unclipped compact bonsai
 * - v11.8.41 Settings screen reorganized into tabs (Learning / Character / Account / Data & Offline / About)
 * - v11.8.41 Offline detection now verified with a real network probe instead of trusting navigator.onLine alone
 * - v11.8.41 Fixed offline packs missing core vocabulary/kana/manga/theatre/grammar/mnemonic data, which
 *   could prevent the app from starting at all while offline even with a pack downloaded
 * - v11.8.42 Added admin-area real-time logs for offline detection and system diagnostics
 */
(() => {
  const CURRENT_VERSION='11.8.42';
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
      console.warn('[Kaishi v11.8.40] Reading review pause could not be installed',error);
    }
  }

  // ----- v11.8.40: Theatre speed ---------------------------------------
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
      console.warn('[Kaishi v11.8.40] Theatre speed controls could not be installed',error);
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

      /* v11.8.40: preserve the sprite's original viewport ratio. */
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

      .cache-data-card{
        display:grid;gap:10px;margin:14px 0;padding:14px;
        border:1px solid #cbd5e1;border-radius:16px;background:#f8fafc
      }
      .cache-data-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
      .cache-data-heading h3,.cache-data-heading p{margin:2px 0}
      .cache-data-heading p{color:#64748b;font-size:.74rem;line-height:1.4}
      .cache-data-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
      .cache-data-grid span{display:grid;gap:2px;padding:9px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;color:#64748b;font-size:.65rem}
      .cache-data-grid strong{color:#0f172a;font-size:.88rem;overflow-wrap:anywhere}
      .cache-data-actions{display:flex;gap:8px;flex-wrap:wrap}
      .cache-data-actions button{flex:1;min-width:140px}
      .cache-data-actions .danger{background:#fff1f2;color:#be123c;border-color:#fecdd3}
      .cache-data-note{color:#64748b;font-size:.66rem;line-height:1.4}
      @media(max-width:430px){.cache-data-grid{grid-template-columns:1fr 1fr}.cache-data-actions{flex-direction:column}}

      .offline-mode-card{display:grid;gap:12px;margin:14px 0;padding:14px;border:1px solid #a7f3d0;border-radius:17px;background:linear-gradient(145deg,#f0fdf4,#eff6ff)}
      .offline-mode-heading h3,.offline-mode-heading p{margin:2px 0}.offline-mode-heading p{font-size:.74rem;line-height:1.4;color:#64748b}
      .offline-pack-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
      .offline-pack-option{display:grid;gap:3px;align-content:start;min-height:96px;padding:10px;text-align:left;border:1px solid #dbe7e0;border-radius:13px;background:#fff}
      .offline-pack-option strong{font-size:.82rem;color:#0f172a}.offline-pack-option small{font-size:.63rem;line-height:1.35;color:#64748b}.offline-pack-option.active{border-color:#16a34a;box-shadow:0 0 0 2px #16a34a25;background:#f0fdf4}.offline-pack-option b{font-size:.62rem;color:#166534}
      .offline-pack-progress{display:grid;gap:5px}.offline-pack-progress>div{height:9px;overflow:hidden;border-radius:999px;background:#dbe7dc}.offline-pack-progress i{display:block;width:0;height:100%;border-radius:inherit;background:linear-gradient(90deg,#16a34a,#0d9488);transition:width .18s linear}.offline-pack-progress span{font-size:.67rem;color:#475569}
      .offline-pack-meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.offline-pack-meta span{display:grid;gap:2px;padding:8px;border:1px solid #dbe7e0;border-radius:11px;background:#ffffffbd;color:#64748b;font-size:.6rem}.offline-pack-meta strong{color:#0f172a;font-size:.78rem}
      .offline-pack-actions{display:flex;gap:8px;flex-wrap:wrap}.offline-pack-actions button{flex:1;min-width:145px}.offline-remove{background:#fff;color:#be123c;border-color:#fecdd3}
      .offline-status-pill{display:inline-flex;align-items:center;gap:5px;margin-left:5px;padding:4px 7px;border-radius:999px;background:#dcfce7;color:#166534;font-size:.58rem;font-weight:850}.offline-status-pill.offline-now{background:#fef3c7;color:#92400e}
      @media(max-width:560px){.offline-pack-options{grid-template-columns:1fr}.offline-pack-option{min-height:0}.offline-pack-meta{grid-template-columns:1fr 1fr}}

      #offlineModeBanner{position:fixed;top:max(8px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:2147483000;display:flex;align-items:center;gap:7px;padding:8px 12px;max-width:calc(100vw - 24px);border:1px solid #fbbf24;border-radius:999px;background:#fffbeb;color:#92400e;box-shadow:0 5px 18px rgba(15,23,42,.12);font-size:.68rem;font-weight:800;text-align:center}
      .force-offline-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0}
      .force-offline-copy{display:grid;gap:3px}.force-offline-copy strong{font-size:.78rem;color:#0f172a}.force-offline-copy small{font-size:.64rem;line-height:1.4;color:#64748b}
      .force-offline-toggle{position:relative;flex:0 0 auto;width:48px;height:28px;border:0;border-radius:999px;background:#cbd5e1;cursor:pointer;padding:0}
      .force-offline-toggle::after{content:"";position:absolute;top:4px;left:4px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(15,23,42,.25);transition:transform .18s ease}
      .force-offline-toggle[aria-checked="true"]{background:#16a34a}.force-offline-toggle[aria-checked="true"]::after{transform:translateX(20px)}
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



  // ----- v11.8.40: Opt-in Offline Mode -----------------------------------
  const OFFLINE_CACHE=`kaishi-offline-${CURRENT_VERSION}`;
  const OFFLINE_STATE_KEY='kq-offline-pack';
  const FORCE_OFFLINE_KEY='kq-force-offline';

  function isForceOffline(){
    try{return localStorage.getItem(FORCE_OFFLINE_KEY)==='1'}catch{return false}
  }

  // navigator.onLine only reflects whether the OS reports an active network
  // interface - it does NOT confirm the interface can actually reach the
  // internet. Browsers (particularly on flaky wifi, VPNs, and some Linux/
  // Android setups) can leave it stuck at `false`, or fire a spurious
  // 'offline' event, even though requests succeed fine. To avoid Kaishi
  // falsely declaring itself offline, we treat navigator.onLine as only a
  // first guess and confirm any "offline" reading with a real, uncached
  // network request before trusting it.
  let netIsOnline=navigator.onLine;
  let netCheckInFlight=null;

  async function verifyConnectivity(){
    if(netCheckInFlight) return netCheckInFlight;
    netCheckInFlight=(async()=>{
      kaishiLog('offline-check','Starting connectivity verification');
      kaishiLog('offline-check','navigator.onLine = '+navigator.onLine);
      // If the OS itself reports no network interface at all, there is no
      // point probing - trust that direction, it's the reliable one.
      if(!navigator.onLine){
        kaishiLog('offline-check','OS reports no network, marking offline');
        netIsOnline=false;
        return netIsOnline;
      }
      try{
        const controller=new AbortController();
        const timer=setTimeout(()=>{
          kaishiLog('offline-check','Timeout reached, aborting request');
          controller.abort();
        },5000);
        // Attempt to fetch version.json from our own origin with aggressive
        // cache-busting. The service worker is configured to always try the
        // network first for this endpoint. If this succeeds (any HTTP response),
        // we have network connectivity. If it times out or network error, we're offline.
        kaishiLog('offline-check','Fetching version.json with no-cache headers...');
        const response=await fetch(`version.json?t=${Date.now()}`,{
          cache:'no-store',
          method:'GET',
          headers:{
            'Cache-Control':'no-cache, no-store, must-revalidate, max-age=0',
            'Pragma':'no-cache'
          },
          signal:controller.signal
        });
        clearTimeout(timer);
        kaishiLog('offline-check','Fetch succeeded with HTTP '+response.status);
        // Any HTTP response (2xx, 3xx, 4xx, 5xx) means we reached the server
        netIsOnline=true;
      }catch(error){
        // Network unreachable, timeout (AbortError), or other fetch failure
        kaishiLog('offline-check','Fetch failed: '+error.name+': '+error.message);
        netIsOnline=false;
      }
      kaishiLog('offline-check','Final result: netIsOnline = '+netIsOnline);
      return netIsOnline;
    })();
    try{return await netCheckInFlight}
    finally{
      netCheckInFlight=null;
      kaishiLog('offline-check','Updating UI');
      updateOfflineStatusUI();
      ensureOfflineIndicator();
    }
  }

  function isKaishiOffline(){return isForceOffline() || !netIsOnline}
  function saveForceOffline(enabled){
    try{
      if(enabled)localStorage.setItem(FORCE_OFFLINE_KEY,'1');
      else localStorage.removeItem(FORCE_OFFLINE_KEY);
    }catch{}
  }
  function offlineModeLabel(){
    if(isForceOffline()) return 'Forced offline';
    if(!netIsOnline) return 'Offline';
    return 'Online';
  }
  function syncForceOfflineWithWorker(){
    navigator.serviceWorker?.controller?.postMessage({
      type:'KAISHI_FORCE_OFFLINE', enabled:isForceOffline()
    });
  }
  function updateOfflineStatusUI(){
    const pill=document.getElementById('offlineStatusPill');
    const banner=document.getElementById('offlineModeBanner');
    const forced=isForceOffline(), disconnected=!netIsOnline, offline=forced||disconnected;

    if(pill){
      pill.hidden=!offline;
      pill.classList.toggle('offline-now',offline);
      pill.textContent=forced?'● Offline mode':disconnected?'● No internet':'';
      pill.title=forced?'Kaishi is intentionally running in offline mode.':'Kaishi cannot currently reach the internet.';
    }
    if(banner){
      banner.hidden=!offline;
      const text=banner.querySelector('[data-offline-banner-text]');
      if(text) text.textContent=forced
        ?'Offline mode is forced. Online-only features are paused.'
        :'No internet connection. Kaishi is using your downloaded offline content.';
    }
    const toggle=document.getElementById('forceOfflineToggle');
    if(toggle){
      toggle.setAttribute('aria-checked',String(forced));
      toggle.setAttribute('aria-label',forced?'Disable forced offline mode':'Force offline mode');
    }
    const status=document.getElementById('forceOfflineStatus');
    if(status)status.textContent=offlineModeLabel();
    syncForceOfflineWithWorker();
  }

  // ----- v11.8.42: Application logging system for offline diagnostics -----
  const logs=[];
  const MAX_LOGS=200;
  const pageLoadTime=performance.now();

  function kaishiLog(category,message){
    const timestamp=Math.round(performance.now()-pageLoadTime);
    const entry=`[${timestamp}ms] [${category}] ${message}`;
    logs.push(entry);
    if(logs.length>MAX_LOGS) logs.shift();
    // Also echo to console
    console.log(entry);
    updateAdminLogViewer();
  }

  function updateAdminLogViewer(){
    const viewer=document.getElementById('adminLogViewer');
    if(!viewer) return;
    viewer.textContent=logs.join('\n');
    // Auto-scroll to bottom
    viewer.scrollTop=viewer.scrollHeight;
  }

  function installAdminLogging(){
    const clearBtn=document.getElementById('clearAdminLogs');
    if(clearBtn){
      clearBtn.addEventListener('click',()=>{
        logs.length=0;
        updateAdminLogViewer();
      });
    }
  }

  function installOfflineDetection(){
    if(!document.getElementById('offlineModeBanner')){
      const banner=document.createElement('div');
      banner.id='offlineModeBanner';banner.hidden=true;banner.setAttribute('role','status');
      banner.innerHTML='<span>✈️</span><span data-offline-banner-text>Kaishi is offline.</span>';
      document.body.prepend(banner);
    }
    window.addEventListener('online',async()=>{
      const wasOffline=!netIsOnline;
      await verifyConnectivity();
      if(wasOffline&&netIsOnline&&typeof notify==='function')notify('Internet connection restored.');
    });
    window.addEventListener('offline',async()=>{
      // Don't trust the browser's 'offline' event on its own - it can fire
      // incorrectly. Confirm with a real request before showing the banner.
      const wasOnline=netIsOnline;
      await verifyConnectivity();
      if(wasOnline&&!netIsOnline&&typeof notify==='function')notify('No internet connection. Using offline content.');
    });
    navigator.serviceWorker?.addEventListener?.('controllerchange',syncForceOfflineWithWorker);
    navigator.serviceWorker?.ready?.then(syncForceOfflineWithWorker).catch(()=>{});

    // Confirm real connectivity on load instead of trusting navigator.onLine
    // outright, so a stale/incorrect flag doesn't show a false offline
    // banner as soon as the app opens.
    (async()=>{
      await verifyConnectivity();
    })();

    // Self-heal: if we currently believe we're offline, keep re-checking in
    // the background. Some browsers never fire the 'online' event even once
    // the connection is actually back, so this catches that case too.
    setInterval(()=>{
      if(!netIsOnline&&!isForceOffline()) verifyConnectivity();
    },20000);
  }

  const OFFLINE_CORE=[
    './','./index.html','./manifest.webmanifest','./styles.css','./sentence-lab.css',
    './engagement-layer.css','./pronunciation-coach.css','./bonsai-progress.css','./vms.css',
    './app.js','./vms.js','./cloud.js','./reporting.js','./japan-ready.js','./supabase-config.js',
    './release-manager.js','./battle-listen.js','./kotoba-activity.js','./dashboard-clarity.js',
    './touch-enhancements.js','./learning-ui.js','./carousel-navigation.js','./micro-practice.js',
    './sentence-lab.js','./adaptive-learning.js','./campfire-recall.js','./word-rain.js','./battle-ui-patch.js',
    './data/japan-ready-v90.json','./data/sentence-lab.json',
    // v11.8.41: core learning-content data app.js needs just to boot - must
    // be in every offline pack tier, not just bundled with per-word media.
    './data/vocabulary.json','./data/kana.json','./data/manga-stories.json',
    './data/conversations.json','./data/theatre-scenes.json','./data/grammar-path.json',
    './data/kanji-components.json','./memory-scenes.json','./data/anki-content-v72.json',
    './data/topics-v72.json','./data/learning-graph-v82.json','./visual-mnemonics.json',
    './icons/icon-192.png','./icons/icon-512.png',
    './media/bonsai/bonsai-growth-stages.png','./media/bonsai/bonsai-condition-overlays.png',
    './media/guides/teacher-guide.webp','./media/guides/sensei/sensei-welcoming.webp',
    './media/guides/sensei/sensei-explaining.webp','./media/guides/sensei/sensei-celebrating.webp',
    './media/guides/sensei/sensei-encouraging.webp','./media/guides/sensei/sensei-pointing.webp',
    './media/guides/sensei/sensei-analysing.webp','./media/guides/aiko-guide-icon.webp',
    './media/guides/aiko-guide-portrait.webp','./media/guides/aiko-guide-large.webp',
    './media/profiles/guest-learner.webp','./media/profiles/boy-base.webp','./media/profiles/girl-base.webp',
    './media/profiles/master-base.webp','./media/profiles/man-base.webp','./media/profiles/woman-base.webp'
  ];

  function offlineState(){try{return JSON.parse(localStorage.getItem(OFFLINE_STATE_KEY)||'null')}catch{return null}}
  function saveOfflineState(state){try{state?localStorage.setItem(OFFLINE_STATE_KEY,JSON.stringify(state)):localStorage.removeItem(OFFLINE_STATE_KEY)}catch{}}
  function localAsset(value){
    if(typeof value!=='string'||!value)return null;
    const clean=value.trim();if(!clean||clean.startsWith('data:')||clean.startsWith('blob:'))return null;
    try{
      const url=new URL(clean,location.href);if(url.origin!==location.origin)return null;
      if(!/\.(?:js|css|json|webmanifest|png|jpe?g|webp|gif|svg|mp3|m4a|aac|ogg|wav)(?:$|\?)/i.test(url.pathname+url.search))return null;
      return url.href;
    }catch{return null}
  }
  function collectAssets(value,out=new Set(),seen=new WeakSet()){
    if(value==null)return out;
    if(typeof value==='string'){const asset=localAsset(value);if(asset)out.add(asset);return out}
    if(typeof value!=='object')return out;if(seen.has(value))return out;seen.add(value);
    (Array.isArray(value)?value:Object.values(value)).forEach(item=>collectAssets(item,out,seen));return out;
  }
  function loadedAssets(){
    const out=new Set();
    document.querySelectorAll('[src],[href]').forEach(node=>{const asset=localAsset(node.getAttribute('src')||node.getAttribute('href'));if(asset)out.add(asset)});
    performance.getEntriesByType?.('resource')?.forEach(entry=>{const asset=localAsset(entry.name);if(asset)out.add(asset)});
    return out;
  }
  function offlinePackUrls(pack){
    const urls=new Set(OFFLINE_CORE.map(item=>new URL(item,location.href).href));
    loadedAssets().forEach(item=>urls.add(item));
    try{collectAssets(currentTopic()?.words||[]).forEach(item=>urls.add(item))}catch{}
    if(pack==='standard'||pack==='full'){
      try{collectAssets(vocab.filter(word=>wordIntroduced(word))).forEach(item=>urls.add(item))}catch{}
      try{collectAssets(theatreScenes).forEach(item=>urls.add(item))}catch{}
      try{collectAssets(mangaStories).forEach(item=>urls.add(item))}catch{}
      try{collectAssets(conversations).forEach(item=>urls.add(item))}catch{}
      try{collectAssets(grammarLessons).forEach(item=>urls.add(item))}catch{}
      try{collectAssets(memoryScenes).forEach(item=>urls.add(item))}catch{}
    }
    if(pack==='full'){
      for(const source of [()=>vocab,()=>kanaData,()=>componentData,()=>topicData,()=>learningGraph,()=>ankiContent]){
        try{collectAssets(source()).forEach(item=>urls.add(item))}catch{}
      }
    }
    return [...urls];
  }
  async function offlineStorageSummary(){
    try{const e=await navigator.storage?.estimate?.();return e?{usage:Number(e.usage||0),quota:Number(e.quota||0),free:Math.max(0,Number(e.quota||0)-Number(e.usage||0))}:null}catch{return null}
  }
  async function offlineCacheStats(){
    if(!('caches'in window))return{files:0,bytes:0};
    const cache=await caches.open(OFFLINE_CACHE),keys=await cache.keys();let bytes=0;
    for(const request of keys){try{const response=await cache.match(request),length=Number(response?.headers?.get('content-length'));bytes+=Number.isFinite(length)&&length>0?length:(await response?.clone().blob())?.size||0}catch{}}
    return{files:keys.length,bytes};
  }
  function setOfflineProgress(done,total,text=''){
    const fill=document.getElementById('offlinePackFill'),label=document.getElementById('offlinePackProgressText');
    if(fill)fill.style.width=`${total?Math.round(done/total*100):0}%`;if(label)label.textContent=text||`${done} / ${total} files`;
  }
  async function downloadOfflinePack(pack){
    if(!(await verifyConnectivity())){notify('Connect to the internet before downloading an offline pack.');return}
    if(!('caches'in window)){notify('Offline packs are not supported by this browser.');return}
    const button=document.getElementById('downloadOfflinePack');if(button?.dataset.busy==='1')return;
    const urls=offlinePackUrls(pack),storage=await offlineStorageSummary();
    if(storage&&storage.free<15*1024*1024&&pack!=='essential'&&!confirm('Browser storage is running low. Download this larger pack anyway?'))return;
    if(button){button.dataset.busy='1';button.disabled=true;button.textContent='Downloading…'}
    const cache=await caches.open(OFFLINE_CACHE);let done=0,failed=0;
    setOfflineProgress(0,urls.length,'Preparing offline pack…');
    for(const raw of urls){
      try{
        const url=new URL(raw);url.searchParams.set('offline-v',CURRENT_VERSION);
        const response=await fetch(url.toString(),{cache:'no-cache'});if(!response.ok)throw new Error(String(response.status));
        await cache.put(url.toString(),response.clone());
      }catch{failed++}
      done++;setOfflineProgress(done,urls.length,`${done} / ${urls.length} files${failed?` · ${failed} unavailable`:''}`);
      if(done%10===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    const stats=await offlineCacheStats();
    saveOfflineState({pack,version:CURRENT_VERSION,downloadedAt:new Date().toISOString(),files:stats.files,bytes:stats.bytes,failed});
    await renderOfflineMode();
    if(button){button.disabled=false;button.dataset.busy='0';button.textContent='Update offline content'}
    notify(failed?`Offline pack ready with ${failed} unavailable file${failed===1?'':'s'}.`:'Offline pack is ready.');
  }
  async function removeOfflinePack(){
    if(!offlineState())return;if(!confirm('Remove downloaded Offline Mode content? Learning progress will be kept.'))return;
    const names=await caches.keys();await Promise.all(names.filter(name=>name.startsWith('kaishi-offline-')).map(name=>caches.delete(name)));
    saveOfflineState(null);await renderOfflineMode();notify('Offline pack removed. Learning progress was kept.');
  }
  function ensureOfflineIndicator(){
    let pill=document.getElementById('offlineStatusPill');
    if(!pill){pill=document.createElement('span');pill.id='offlineStatusPill';pill.className='offline-status-pill';badge()?.insertAdjacentElement('afterend',pill)}
    const ready=Boolean(offlineState());pill.hidden=!ready&&netIsOnline;pill.classList.toggle('offline-now',!netIsOnline);
    pill.textContent=!netIsOnline?'● Offline':ready?'✓ Offline ready':'';
  }
  async function renderOfflineMode(){
    const card=document.getElementById('offlineModeCard');if(!card)return;
    const state=offlineState(),stats=state?await offlineCacheStats():{files:0,bytes:0},storage=await offlineStorageSummary();
    const selected=card.querySelector('.offline-pack-option.active')?.dataset.pack||state?.pack||'standard';
    card.querySelectorAll('.offline-pack-option').forEach(option=>option.classList.toggle('active',option.dataset.pack===selected));
    const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value};
    set('offlinePackState',state?`${state.pack[0].toUpperCase()+state.pack.slice(1)} ready`:'Not downloaded');
    set('offlinePackFiles',state?String(stats.files):'0');set('offlinePackSize',state?formatBytes(stats.bytes):'0 KB');set('offlineStorageFree',storage?formatBytes(storage.free):'Unknown');
    const download=document.getElementById('downloadOfflinePack'),remove=document.getElementById('removeOfflinePack');
    if(download)download.textContent=state?'Update offline content':'Download for offline use';if(remove)remove.hidden=!state;
    state?setOfflineProgress(stats.files,stats.files,`✓ ${stats.files} files ready offline · ${new Date(state.downloadedAt).toLocaleDateString()}`):setOfflineProgress(0,1,'Choose a pack, then download it while online.');
    ensureOfflineIndicator();
  }
  function installOfflineMode(){
    const cacheCard=document.getElementById('cacheDataCard'),updateButton=document.getElementById('checkUpdateBtn');
    if((!cacheCard&&!updateButton)||document.getElementById('offlineModeCard'))return;
    const card=document.createElement('section');card.id='offlineModeCard';card.className='offline-mode-card';
    card.innerHTML=`<div class="offline-mode-heading"><div><span class="eyebrow">Travel without a connection</span><h3>Offline Mode</h3><p>Download learning content before a flight, train journey or anywhere data may be unreliable.</p></div></div>
      <div class="offline-pack-options" role="radiogroup">
        <button type="button" class="offline-pack-option" data-pack="essential"><strong>🌱 Essential</strong><small>Core app, Japan Ready, current topic and currently used media.</small><b>Smallest</b></button>
        <button type="button" class="offline-pack-option active" data-pack="standard"><strong>🎒 Standard</strong><small>Essential + introduced words and locally referenced Theatre, Manga, conversation and grammar media.</small><b>Recommended</b></button>
        <button type="button" class="offline-pack-option" data-pack="full"><strong>🗾 Full learning pack</strong><small>All locally referenced vocabulary and learning media Kaishi currently knows about.</small><b>Largest</b></button>
      </div>
      <div class="offline-pack-progress"><div><i id="offlinePackFill"></i></div><span id="offlinePackProgressText">Choose a pack, then download it while online.</span></div>
      <div class="offline-pack-meta"><span><small>Status</small><strong id="offlinePackState">Not downloaded</strong></span><span><small>Files</small><strong id="offlinePackFiles">0</strong></span><span><small>Pack size</small><strong id="offlinePackSize">0 KB</strong></span><span><small>Storage free</small><strong id="offlineStorageFree">Checking…</strong></span></div>
      <div class="offline-pack-actions"><button id="downloadOfflinePack" class="primary" type="button">Download for offline use</button><button id="removeOfflinePack" class="offline-remove" type="button" hidden>Remove offline content</button></div>
      <div class="force-offline-row">
        <div class="force-offline-copy">
          <strong>Force offline mode</strong>
          <small>Make Kaishi behave as offline even when internet is available. Online-only requests are paused until this is switched off.</small>
        </div>
        <button id="forceOfflineToggle" class="force-offline-toggle" type="button" role="switch" aria-checked="false"></button>
      </div>
      <small id="forceOfflineStatus" class="cache-data-note">Online</small>
      <small class="cache-data-note">Learning progress keeps saving on this device offline. Cloud sync and Community resume when you reconnect.</small>`;
    (cacheCard||updateButton).before(card);
    card.querySelectorAll('.offline-pack-option').forEach(option=>option.onclick=()=>card.querySelectorAll('.offline-pack-option').forEach(item=>item.classList.toggle('active',item===option)));
    document.getElementById('downloadOfflinePack').onclick=()=>downloadOfflinePack(card.querySelector('.offline-pack-option.active')?.dataset.pack||'standard');
    document.getElementById('removeOfflinePack').onclick=removeOfflinePack;
    const forceToggle=document.getElementById('forceOfflineToggle');
    if(forceToggle){
      forceToggle.addEventListener('click',()=>{
        saveForceOffline(!isForceOffline());
        updateOfflineStatusUI();
        if(typeof notify==='function')notify(isForceOffline()?'Offline mode forced. Online-only features are paused.':'Forced offline mode disabled.');
      });
    }
    installOfflineDetection();
    window.addEventListener('online',()=>{renderOfflineMode();updateOfflineStatusUI()});
    window.addEventListener('offline',()=>{ensureOfflineIndicator();updateOfflineStatusUI()});
    renderOfflineMode();
    updateOfflineStatusUI();
  }

  // ----- v11.8.40: Settings cache/offline diagnostics -------------------
  function formatBytes(bytes){
    if(!Number.isFinite(bytes)||bytes<=0) return '0 KB';
    if(bytes<1024*1024) return `${Math.max(1,Math.round(bytes/1024))} KB`;
    return `${(bytes/(1024*1024)).toFixed(1)} MB`;
  }

  async function cacheStats(){
    const result={
      supported:'caches' in window,
      names:[],
      files:0,
      bytes:0,
      shellFiles:0,
      imageFiles:0
    };
    if(!result.supported) return result;

    const names=(await caches.keys()).filter(name=>
      CACHE_PREFIXES.some(prefix=>name.startsWith(prefix))
    );
    result.names=names;

    for(const name of names){
      const cache=await caches.open(name);
      const requests=await cache.keys();
      result.files+=requests.length;
      if(name.startsWith('kaishi-shell-')) result.shellFiles+=requests.length;
      if(name.startsWith('kaishi-images-')) result.imageFiles+=requests.length;

      for(const request of requests){
        try{
          const response=await cache.match(request);
          if(!response) continue;
          const length=Number(response.headers.get('content-length'));
          if(Number.isFinite(length)&&length>0){
            result.bytes+=length;
          }else{
            const blob=await response.clone().blob();
            result.bytes+=blob.size;
          }
        }catch{}
      }
    }
    return result;
  }

  function serviceWorkerSummary(){
    if(!('serviceWorker' in navigator)) return {state:'Not supported',script:'—'};
    const controller=navigator.serviceWorker.controller;
    if(!controller) return {state:'No active controller',script:'—'};
    const script=controller.scriptURL||'';
    const file=script.split('/').pop()||script;
    return {state:controller.state||'active',script:file};
  }

  async function refreshCacheDataPanel(){
    const panel=document.getElementById('cacheDataCard');
    if(!panel) return;
    const status=document.getElementById('cacheDataStatus');
    if(status) status.textContent='Checking cached files…';

    try{
      const stats=await cacheStats();
      const worker=serviceWorkerSummary();
      const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value};

      set('cacheAppVersion',`v${CURRENT_VERSION}`);
      set('cacheWorkerState',worker.state);
      set('cacheWorkerScript',worker.script);
      set('cacheShellFiles',String(stats.shellFiles));
      set('cacheImageFiles',String(stats.imageFiles));
      set('cacheTotalFiles',String(stats.files));
      set('cacheTotalSize',formatBytes(stats.bytes));
      set('cacheNames',stats.names.length?stats.names.join(', '):'No Kaishi caches');

      if(status){
        status.textContent=stats.supported
          ?'Only downloaded app/offline files are shown here. Learning progress is stored separately.'
          :'This browser does not expose the Cache Storage API.';
      }
    }catch(error){
      console.warn('[Kaishi cache diagnostics]',error);
      if(status) status.textContent='Could not read cache information on this device.';
    }
  }

  async function clearCacheFromSettings(){
    const button=document.getElementById('clearCacheData');
    if(button?.dataset.busy==='1') return;

    const confirmed=window.confirm(
      'Clear Kaishi Quest downloaded app files and images?\\n\\n' +
      'Your learning progress, streak, settings and cloud account will NOT be deleted.'
    );
    if(!confirmed) return;

    if(button){
      button.dataset.busy='1';
      button.disabled=true;
      button.textContent='Clearing…';
    }

    try{
      await clearKaishiCaches();
      await refreshCacheDataPanel();
      notify('Cached app files cleared. Your learning progress was kept.');

      if(button){
        button.textContent='✓ Cache cleared';
        setTimeout(()=>{
          button.disabled=false;
          button.dataset.busy='0';
          button.textContent='Clear cached files';
        },1200);
      }
    }catch(error){
      console.error('[Kaishi clear cache]',error);
      notify('Could not clear the app cache on this device.');
      if(button){
        button.disabled=false;
        button.dataset.busy='0';
        button.textContent='Clear cached files';
      }
    }
  }

  function installCacheDataSettings(){
    const updateButton=document.getElementById('checkUpdateBtn');
    if(!updateButton || document.getElementById('cacheDataCard')) return;

    const card=document.createElement('section');
    card.id='cacheDataCard';
    card.className='cache-data-card';
    card.innerHTML=`
      <div class="cache-data-heading">
        <div>
          <span class="eyebrow">Storage & updates</span>
          <h3>Cache & Offline Data</h3>
          <p>See which downloaded Kaishi files this device is holding.</p>
        </div>
        <button id="refreshCacheData" type="button">Refresh</button>
      </div>
      <div class="cache-data-grid">
        <span><small>App release</small><strong id="cacheAppVersion">v${CURRENT_VERSION}</strong></span>
        <span><small>Service worker</small><strong id="cacheWorkerState">Checking…</strong></span>
        <span><small>Shell files</small><strong id="cacheShellFiles">—</strong></span>
        <span><small>Image files</small><strong id="cacheImageFiles">—</strong></span>
        <span><small>Total cached files</small><strong id="cacheTotalFiles">—</strong></span>
        <span><small>Approx. cache size</small><strong id="cacheTotalSize">—</strong></span>
      </div>
      <span class="cache-data-note">Worker: <strong id="cacheWorkerScript">—</strong></span>
      <span class="cache-data-note">Caches: <strong id="cacheNames">—</strong></span>
      <div class="cache-data-actions">
        <button id="clearCacheData" class="danger" type="button">Clear cached files</button>
      </div>
      <small id="cacheDataStatus" class="cache-data-note" aria-live="polite">Checking cached files…</small>`;

    updateButton.before(card);
    document.getElementById('refreshCacheData')?.addEventListener('click',refreshCacheDataPanel);
    document.getElementById('clearCacheData')?.addEventListener('click',clearCacheFromSettings);

    refreshCacheDataPanel();
    navigator.serviceWorker?.addEventListener?.('controllerchange',()=>setTimeout(refreshCacheDataPanel,100));
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

  // ----- v11.8.41: Tabbed settings screen --------------------------------
  function installSettingsTabsStyles(){
    if(document.getElementById('kaishiSettingsTabs11841')) return;
    const style=document.createElement('style');
    style.id='kaishiSettingsTabs11841';
    style.textContent=`
      .settings-tabs{display:flex;gap:6px;overflow-x:auto;padding:2px 2px 10px;margin:0 0 4px;-webkit-overflow-scrolling:touch;scrollbar-width:none}
      .settings-tabs::-webkit-scrollbar{display:none}
      .settings-tab{flex:0 0 auto;display:flex;align-items:center;gap:6px;padding:10px 14px;border-radius:999px;background:#e2e8f0;color:#334155;font-weight:800;font-size:.82rem;white-space:nowrap;border:2px solid transparent}
      .settings-tab span{white-space:nowrap}
      .settings-tab.active{background:var(--navy,#172554);color:#fff;box-shadow:0 6px 16px #17255440}
      .settings-tab:focus-visible{outline:3px solid #60a5fa;outline-offset:2px}
      .settings-card{padding-top:18px}
      .settings-panel{display:grid;gap:18px}
      .settings-panel[hidden]{display:none}
      @media(max-width:480px){.settings-tab{padding:9px 11px;font-size:.76rem}}
    `;
    document.head.appendChild(style);
  }

  function installSettingsTabs(){
    const tabBar=document.getElementById('settingsTabs');
    if(!tabBar||tabBar.dataset.kaishiTabsInit==='1') return;
    tabBar.dataset.kaishiTabsInit='1';
    installSettingsTabsStyles();

    const tabs=Array.from(tabBar.querySelectorAll('.settings-tab'));
    const panels=Array.from(document.querySelectorAll('.settings-panel'));
    const STORE_KEY='kq-settings-tab';

    function activate(name,{focusTab=false}={}){
      if(!tabs.some(tab=>tab.dataset.tab===name)) return;
      tabs.forEach(tab=>{
        const active=tab.dataset.tab===name;
        tab.classList.toggle('active',active);
        tab.setAttribute('aria-selected',String(active));
        tab.tabIndex=active?0:-1;
        if(active&&focusTab) tab.focus();
      });
      panels.forEach(panel=>{panel.hidden=panel.dataset.tabPanel!==name});
      try{localStorage.setItem(STORE_KEY,name)}catch{}
    }

    tabs.forEach((tab,index)=>{
      tab.addEventListener('click',()=>activate(tab.dataset.tab));
      tab.addEventListener('keydown',event=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
        event.preventDefault();
        let nextIndex=index;
        if(event.key==='ArrowLeft') nextIndex=(index-1+tabs.length)%tabs.length;
        else if(event.key==='ArrowRight') nextIndex=(index+1)%tabs.length;
        else if(event.key==='Home') nextIndex=0;
        else if(event.key==='End') nextIndex=tabs.length-1;
        activate(tabs[nextIndex].dataset.tab,{focusTab:true});
      });
    });

    let initial='learning';
    try{
      const saved=localStorage.getItem(STORE_KEY);
      if(saved&&tabs.some(tab=>tab.dataset.tab===saved)) initial=saved;
    }catch{}
    activate(initial);

    // If something elsewhere in the app deep-links into a specific settings
    // control (e.g. opening Settings and scrolling to offline packs), make
    // sure the tab containing it is switched in first.
    document.getElementById('settingsBtn')?.addEventListener('click',()=>{
      // Re-activate the current tab in case panels were re-rendered while
      // the settings screen was closed (offline/cache cards render lazily).
      const current=tabs.find(tab=>tab.classList.contains('active'));
      if(current) activate(current.dataset.tab);
    });
  }

  function install(){
    installReadingReviewPause();
    installTheatreSpeed();
    installEnhancementStyles();
    refreshVisibleReleaseVersion();
    lockVisibleReleaseVersion();
    installJapanReadyQuantitySupport();
    installCacheDataSettings();
    installOfflineMode();
    installSettingsTabs();
    installAdminLogging();
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
      if(title) title.textContent='Cache & Offline Data';
      const detail=versionCard.querySelector('small');
      if(detail) detail.textContent='Settings now shows the app cache, offline-file counts and service-worker state, with a safe button to clear cached files without deleting learning progress.';
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',install,{once:true});
  }else install();
})();
