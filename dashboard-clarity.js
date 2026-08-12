'use strict';

/*
 * Kaishi Quest v11.7.3 — Dashboard Clarity
 *
 * Goal: the front dashboard should answer three questions:
 *   1. What should I do now?
 *   2. How is my Japanese progressing?
 *   3. Is there anything important I should know?
 *
 * Existing learning/progress data is reused. This file does not change SRS,
 * mission composition, grading or cloud progress.
 */
(() => {
  const RELEASE='11.7.3';
  let installed=false;

  function el(id){ return document.getElementById(id); }

  function ensureStyles(){
    if(el('dashboardClarityStyles')) return;
    const style=document.createElement('style');
    style.id='dashboardClarityStyles';
    style.textContent=`
      /* Calm the existing hero and remove text that doesn't help a learning decision. */
      #home .hero{align-items:stretch}
      #home #summary,#home #dashboardAvatarMilestone,#home #dashboardAvatarTitle{display:none!important}
      #home .hero-copy{display:flex;flex-direction:column;justify-content:center;gap:8px}
      #home .hero-profile>div{display:flex;flex-direction:column;gap:3px}
      #home .hero-profile h2{margin:2px 0 0!important;font-size:1.5rem!important}
      #home .streak-qualifier{margin-top:5px}
      #home .ring span{line-height:1.05}

      /* Study mode selector: keep the choice, remove permanent explanatory copy. */
      #campaignChooser>.campaign-chooser-heading>div:first-child{display:none!important}
      #campaignChooser>.campaign-chooser-heading{
        justify-content:center!important;
        margin-bottom:10px!important;
      }
      #campaignChooser .campaign-choice-actions{
        width:100%;display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important
      }
      #campaignChooser .campaign-choice-actions button{width:100%!important}
      #campaignChooser{min-height:0!important}

      /* The old Journey sub-panels are still populated by app.js, but hidden.
         v11.5 reads their live values and presents one useful card instead. */
      #journeyHome>.home-sensei,
      #journeyHome>.journey-home-main,
      #journeyHome>.journey-home-progress,
      #journeyHome>#adaptiveLearningInsight{display:none!important}
      #journeyHome>.journey-home-actions,
      #journeyHome>.adventure-home-links,
      #journeyHome>.journey-utility-actions{display:none!important}
      #home .stats{display:none!important}
      #home #classicActions{display:none!important}

      .dashboard-today{
        display:grid;gap:13px;padding:18px;border-radius:22px;
        background:linear-gradient(145deg,#ffffff,#f8fafc);
        border:1px solid #dbe4f0;box-shadow:0 8px 25px #17255410
      }
      .dashboard-today-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
      .dashboard-today-top h2{margin:2px 0 0;font-size:1.25rem}
      .dashboard-topic-progress{
        min-width:54px;text-align:right;font-weight:900;color:#2563eb;font-size:1.05rem
      }
      .dashboard-focus{
        display:flex;gap:10px;align-items:flex-start;padding:11px 12px;border-radius:14px;
        background:#eef2ff;color:#312e81
      }
      .dashboard-focus img{width:38px;height:38px;object-fit:cover;border-radius:50%}
      .dashboard-focus strong{display:block;font-size:.78rem;margin-bottom:2px}
      .dashboard-focus p{margin:0;font-size:.88rem;line-height:1.42}
      .dashboard-mission-meta{
        display:flex;gap:7px;flex-wrap:wrap;color:#475569;font-size:.78rem
      }
      .dashboard-mission-meta span{
        background:#f1f5f9;border-radius:999px;padding:5px 9px;font-weight:750
      }
      .dashboard-main-actions{display:grid;grid-template-columns:2fr 1fr;gap:9px}
      .dashboard-main-actions button{min-height:56px}
      .dashboard-main-actions #continueJourney{font-size:1rem}
      .dashboard-main-actions #openReviews{font-size:.85rem}

      .dashboard-learning{
        margin-top:14px;padding:17px;border-radius:22px;background:#fff;
        border:1px solid #e2e8f0;box-shadow:0 7px 22px #1725540d
      }
      .dashboard-learning-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;margin-bottom:14px}
      .dashboard-learning-head h3{margin:2px 0 0}
      .dashboard-learning-head small{color:#64748b;text-align:right}
      .learning-state-chart{display:grid;gap:11px}
      .learning-state-row{
        display:grid;grid-template-columns:92px 1fr 44px;gap:9px;align-items:center
      }
      .learning-state-label{font-weight:800;font-size:.8rem}
      .learning-state-track{height:12px;background:#e2e8f0;border-radius:999px;overflow:hidden}
      .learning-state-fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,#2563eb,#6366f1);min-width:0}
      .learning-state-row[data-state="recall"] .learning-state-fill{background:linear-gradient(90deg,#7c3aed,#6366f1)}
      .learning-state-row[data-state="usable"] .learning-state-fill{background:linear-gradient(90deg,#16a34a,#22c55e)}
      .learning-state-value{text-align:right;font-weight:900}
      .learning-state-help{margin:12px 0 0;color:#64748b;font-size:.76rem;line-height:1.4}

      .dashboard-nav{
        margin-top:14px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px
      }
      .dashboard-nav button{
        min-height:66px;padding:10px 7px;display:grid;place-items:center;gap:2px;
        background:#fff;border:1px solid #e2e8f0;box-shadow:0 5px 14px #1725540b;font-size:.8rem
      }
      .dashboard-nav button b{font-size:1.25rem}
      .dashboard-nav button span{font-size:.72rem;color:#475569}
      #journeyInvite{display:none!important}

      /* Japan Ready: remove permanent generic summary; keep scenario, confidence and action. */
      #home .japan-ready-home-summary{display:none!important}

      @media(max-width:520px){
        .dashboard-main-actions{grid-template-columns:1fr}
        .dashboard-nav{grid-template-columns:repeat(2,1fr)}
        .learning-state-row{grid-template-columns:82px 1fr 36px}
      }
    `;
    document.head.appendChild(style);
  }

  function parseProgressPercent(){
    const fill=el('journeyHomeFill');
    if(fill?.style?.width) return fill.style.width;
    const text=el('journeyHomeProgress')?.textContent||'';
    const m=text.match(/(\d{1,3})%/);
    return m?`${m[1]}%`:'';
  }

  function missionPlanText(){
    try{
      const p=meta?.lastAdaptiveMissionPlan;
      if(!p) return [];
      const bits=[];
      if(Number(p.newWords)>0) bits.push(`${p.newWords} new`);
      if(Number(p.reviews)>0) bits.push(`${p.reviews} reviews`);
      if(Number(p.legacy)>0) bits.push(`${p.legacy} older`);
      return bits;
    }catch{
      return [];
    }
  }

  function focusText(){
    const adaptive=el('adaptiveLearningInsight')?.textContent?.trim();
    if(adaptive) return adaptive;
    const teacher=el('journeyHomeActivity')?.textContent?.trim();
    if(teacher && !/preparing|choosing/i.test(teacher)) return teacher;
    return 'Kaishi will choose the next mix of new words, reviews and recall practice for you.';
  }

  function ensureTodayCard(){
    if(el('dashboardToday')) return;
    const home=el('journeyHome');
    if(!home) return;

    const card=document.createElement('section');
    card.id='dashboardToday';
    card.className='dashboard-today';
    card.innerHTML=`
      <div class="dashboard-today-top">
        <div>
          <span class="eyebrow">Today's learning</span>
          <h2 id="dashboardTodayTopic">Current topic</h2>
        </div>
        <div id="dashboardTodayProgress" class="dashboard-topic-progress"></div>
      </div>
      <div class="dashboard-focus">
        <img src="media/guides/teacher-guide.webp?v=${RELEASE}" alt="">
        <div>
          <strong>Sensei's focus</strong>
          <p id="dashboardFocusText">Preparing your learning focus…</p>
        </div>
      </div>
      <div id="dashboardMissionMeta" class="dashboard-mission-meta"></div>
      <div id="dashboardMainActions" class="dashboard-main-actions"></div>
    `;
    home.prepend(card);

    const actionHost=el('dashboardMainActions');
    const continueButton=el('continueJourney');
    const reviewsButton=el('openReviews');
    if(continueButton) actionHost.appendChild(continueButton);
    if(reviewsButton) actionHost.appendChild(reviewsButton);

    if(continueButton){
      const main=[...continueButton.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);
      if(main) main.textContent='Continue · ';
    }
  }

  function ensureLearningChart(){
    if(el('dashboardLearning')) return;
    const chooser=el('campaignChooser');
    if(!chooser) return;

    const panel=document.createElement('section');
    panel.id='dashboardLearning';
    panel.className='dashboard-learning';
    panel.innerHTML=`
      <div class="dashboard-learning-head">
        <div><span class="eyebrow">Your Japanese</span><h3>What you can do</h3></div>
        <small>Stronger stages are harder to earn.</small>
      </div>
      <div class="learning-state-chart" aria-label="Vocabulary capability chart">
        <div class="learning-state-row" data-state="recognising">
          <span class="learning-state-label">Recognising</span>
          <div class="learning-state-track"><div id="recognisingBar" class="learning-state-fill"></div></div>
          <strong id="recognisingCount" class="learning-state-value">0</strong>
        </div>
        <div class="learning-state-row" data-state="recall">
          <span class="learning-state-label">Recall</span>
          <div class="learning-state-track"><div id="recallBar" class="learning-state-fill"></div></div>
          <strong id="recallCount" class="learning-state-value">0</strong>
        </div>
        <div class="learning-state-row" data-state="usable">
          <span class="learning-state-label">Usable</span>
          <div class="learning-state-track"><div id="usableBar" class="learning-state-fill"></div></div>
          <strong id="usableCount" class="learning-state-value">0</strong>
        </div>
      </div>
      <p class="learning-state-help">Recognising = you can identify it. Recall = you can bring the Japanese to mind. Usable = you are also showing context or strong listening knowledge.</p>
    `;
    chooser.insertAdjacentElement('afterend',panel);
  }

  function makeNavButton(button,icon,label,sub=''){
    if(!button) return;
    button.innerHTML=`<b aria-hidden="true">${icon}</b><span>${label}</span>${sub?`<small>${sub}</small>`:''}`;
    button.removeAttribute('hidden');
  }

  function ensureNavigation(){
    if(el('dashboardNav')) return;
    const learning=el('dashboardLearning');
    if(!learning) return;

    const nav=document.createElement('nav');
    nav.id='dashboardNav';
    nav.className='dashboard-nav';
    nav.setAttribute('aria-label','Dashboard sections');
    learning.insertAdjacentElement('afterend',nav);

    const practice=el('openPracticeHub');
    const collection=el('openCollection');
    const progress=el('journeySkills');
    const community=el('journeyCommunity');

    makeNavButton(practice,'🎯','Practice');
    makeNavButton(collection,'📚','Collection');
    makeNavButton(progress,'📊','Progress');
    makeNavButton(community,'👥','Community');

    [practice,collection,progress,community].forEach(button=>{
      if(button) nav.appendChild(button);
    });
  }

  function refreshHero(){
    const title=document.querySelector('#dashboardProfile h2');
    if(title) title.textContent="Today's Japanese";

    const dueLabel=el('dueProgressLabel');
    if(dueLabel) dueLabel.textContent='reviews due';

    const streak=el('streakActivity');
    if(streak){
      const m=(streak.textContent||'').match(/(\d+)\s*\/\s*(\d+)/);
      if(m){
        const current=Number(m[1]),target=Number(m[2]);
        streak.textContent=current>=target
          ? '✓ Today’s streak is protected'
          : `${target-current} answer${target-current===1?'':'s'} to protect today’s streak`;
      }
    }
  }

  function refreshToday(){
    const topic=el('currentTopicTitle')?.textContent?.trim();
    if(topic) el('dashboardTodayTopic').textContent=topic;

    const percent=parseProgressPercent();
    el('dashboardTodayProgress').textContent=percent;

    el('dashboardFocusText').textContent=focusText();

    const host=el('dashboardMissionMeta');
    const bits=missionPlanText();
    host.innerHTML=bits.length
      ? bits.map(bit=>`<span>${bit}</span>`).join('')
      : '<span>Adaptive mission</span><span>about 5 min</span>';

    const reviewCount=Number(el('homeReviewCount')?.textContent||0);
    const reviews=el('openReviews');
    if(reviews){
      reviews.innerHTML=reviewCount>0
        ? `🧠 ${reviewCount} extra review${reviewCount===1?'':'s'}`
        : '🧠 Reviews';
      reviews.hidden=reviewCount<=0;
    }
  }

  function refreshLearningChart(){
    const api=window.KaishiLearning;
    if(!api?.wordsAtLeast) return;

    let recognising=0,recall=0,usable=0;
    try{
      recognising=api.wordsAtLeast('Recognising').length;
      recall=api.wordsAtLeast('Recall').length;
      usable=api.wordsAtLeast('Usable').length;
    }catch{
      return;
    }

    const base=Math.max(recognising,1);
    const values=[
      ['recognising',recognising],
      ['recall',recall],
      ['usable',usable],
    ];
    values.forEach(([key,value])=>{
      const count=el(`${key}Count`);
      const bar=el(`${key}Bar`);
      if(count) count.textContent=String(value);
      if(bar) bar.style.width=`${Math.max(0,Math.min(100,value/base*100))}%`;
    });
  }

  function relabelPractice(){
    const heading=el('practiceHubTitle');
    if(heading) heading.textContent='Practice Activities';
    const intro=document.querySelector('.activity-village-intro');
    if(intro) intro.textContent='Use activities to strengthen Japanese you have already learned. Locked activities open when enough suitable words are ready.';
  }

  function refresh(){
    try{
      refreshHero();
      refreshToday();
      refreshLearningChart();
      relabelPractice();
    }catch(error){
      console.warn('[Kaishi dashboard clarity]',error);
    }
  }

  function install(){
    if(installed) return;
    installed=true;
    ensureStyles();
    ensureTodayCard();
    ensureLearningChart();
    ensureNavigation();
    refresh();

    // Refresh only on meaningful lifecycle events. Previous releases used a
    // permanent 2.5-second timer, which added avoidable work during navigation.
    [350,900,1800].forEach(ms=>setTimeout(refresh,ms));
    window.addEventListener('focus',refresh);
    window.addEventListener('pageshow',refresh);
    document.addEventListener('kaishi:dashboard-refresh',refresh);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',install,{once:true});
  }else install();
})();
