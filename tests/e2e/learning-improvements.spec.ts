import { test,expect } from '@playwright/test';

test('Japan Ready repairs an incomplete saved campaign and opens its first scenario',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('kq-profile-v1:guest:kq-meta',JSON.stringify({campaignProgress:{'japan-ready':{scenarioProgress:{}}}})));
  await page.goto('/');await page.getByRole('button',{name:'Explore first',exact:true}).click();
  await expect(page.getByRole('button',{name:'Continue Japan Ready 旅行学習を続ける',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Continue Japan Ready 旅行学習を続ける',exact:true}).click();
  await expect(page.locator('#japanReadyScenarioList button').first()).toBeEnabled();
  await page.locator('#japanReadyScenarioList button').first().click();
  await expect(page.getByRole('button',{name:'Focused study',exact:true})).toBeVisible();
});

test('a complete Journey lesson includes assessments and stable prerequisite counts',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Explore first',exact:true}).click();
  await page.getByRole('button',{name:'Continue · 冒険を続ける',exact:true}).click();
  await page.getByRole('button',{name:'Continue lesson',exact:true}).click();
  await expect(page.locator('#journeySessionPreviewTitle')).toContainText('Meeting people');
  await page.getByRole('button',{name:'Start session',exact:true}).click();
  const total=await page.locator('#sessionCounter').getAttribute('aria-valuemax');let recalls=0;
  for(let step=0;step<35;step++){
    if(await page.locator('#finishMissionNow').isVisible())break;
    if(await page.locator('#engagementCelebration[open]').isVisible()){await page.locator('#engagementCelebration').getByRole('button',{name:'Continue',exact:true}).click();continue;}
    await expect(page.locator('#sessionCounter')).toHaveAttribute('aria-valuemax',total!);
    const card=page.locator('#card');
    if(await card.locator('#revealBtn').isVisible()){recalls++;await card.locator('#revealBtn').click();await card.getByRole('button',{name:'Good',exact:true}).click();continue;}
    let advanced=false;
    for(const id of ['kanaUnlockContinue','firstEncounterContinue','continueBtn','pronunciationSkip','exampleContinue']){
      if(await card.locator(`#${id}`).isVisible()){await card.locator(`#${id}`).click();advanced=true;break;}
    }
    if(!advanced)throw new Error(`Unexpected card: ${await card.innerText()}`);
  }
  expect(recalls).toBe(3);await expect(page.locator('#finishMissionNow')).toBeVisible();
  await expect(page.locator('#card')).toContainText('Session complete');
  await expect(page.locator('#card')).not.toContainText('Ready to meet');
  await expect(page.locator('#missionSummaryDialog .session-can-do-award')).toContainText('I can');
  await expect(page.locator('#missionSummaryDialog .lesson-celebration-cat')).toHaveAttribute('src','media/celebrations/maneki-neko.li');
  await expect(page.locator('#engagementCelebration[open]')).toHaveCount(0);
  await page.locator('#missionSummaryDialog[open]').evaluateAll(dialogs=>dialogs.forEach(d=>(d as HTMLDialogElement).close()));
  await page.locator('#engagementCelebration[open]').evaluateAll(dialogs=>dialogs.forEach(d=>(d as HTMLDialogElement).close()));
  await page.locator('#finishMissionNow').click();await expect(page.locator('#journey')).toHaveClass(/active/);
  await expect(page.locator('#toast')).not.toContainText('Mission paused');
});

test('wrong answers persist until Continue and are recorded once',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Explore first',exact:true}).click();
  await page.evaluate(()=>{
    const app=window as typeof window & {KaishiJapanReadyBridge:{getVocab:()=>Array<{id:string;reading:string;word:string}>;startFocusedStudy:(ids:string[])=>void};KaishiLessonMastery:unknown};
    const word=app.KaishiJapanReadyBridge.getVocab().find(w=>w.word==='大丈夫')!;
    // Exercise the core reading renderer with a deterministic question, independently of SRS scheduling.
    (window as unknown as {makeTargetedMasterySession:(ids:string[],skill:string)=>void}).makeTargetedMasterySession([word.id],'reading');
  });
  await page.getByRole('button',{name:'Start session',exact:true}).click();
  const wrong=page.locator('#card .choice').filter({hasNotText:'だいじょうぶ'}).first();await wrong.click();
  await expect(page.locator('.lesson-answer-feedback')).toContainText('Your choice');
  await expect(page.locator('.lesson-answer-feedback')).toContainText('大丈夫');
  const count=await page.evaluate(()=>(window as unknown as {KaishiJapanReadyBridge:{getMeta:()=>{totalAnswers:number}}}).KaishiJapanReadyBridge.getMeta().totalAnswers);
  await page.waitForTimeout(1300);await expect(page.locator('.lesson-answer-feedback')).toBeVisible();
  expect(await page.evaluate(()=>(window as unknown as {KaishiJapanReadyBridge:{getMeta:()=>{totalAnswers:number}}}).KaishiJapanReadyBridge.getMeta().totalAnswers)).toBe(count);
  await page.locator('.lesson-answer-feedback').getByRole('button',{name:'Continue',exact:true}).click();
});

test('trip plan persists and prioritises selected scenarios after courtesy',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Explore first',exact:true}).click();
  await page.getByRole('button',{name:'Continue Japan Ready 旅行学習を続ける',exact:true}).click();
  await page.getByRole('button',{name:'Plan my trip',exact:true}).click();await page.getByLabel('Departure date').fill('2027-01-15');await page.getByLabel('Daily study time').selectOption('5');
  await page.getByRole('button',{name:'Save trip plan',exact:true}).click();await expect(page.locator('#tripPlan')).toContainText('5 minutes a day');await expect(page.locator('#tripPlan')).toContainText('Greetings & Courtesy');
  await page.reload();await page.getByRole('button',{name:'Continue Japan Ready 旅行学習を続ける',exact:true}).click();await expect(page.locator('#tripPlan')).toContainText('5 minutes a day');
  await page.getByRole('button',{name:'Remove plan',exact:true}).click();await expect(page.getByRole('button',{name:'Plan my trip',exact:true})).toBeVisible();
});

test('experimental mobile Journey keeps lessons separated and restores them after exit',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');await page.getByRole('button',{name:'Explore first',exact:true}).click();
  await page.getByRole('button',{name:'Open settings'}).click();
  await page.getByRole('checkbox',{name:/Experimental Journey experience/}).check();
  await page.locator('#settingsBack').click();
  await expect(page.locator('#journeyHistoryTrack .experimental-timeline-item')).toHaveCount(10);

  const geometry=await page.locator('#journeyHistoryTrack').evaluate(()=>{
    const rows=[...document.querySelectorAll<HTMLElement>('.experimental-timeline-item')].slice(0,6).map(row=>row.getBoundingClientRect());
    return{gaps:rows.slice(1).map((row,index)=>Math.round(row.top-rows[index]!.bottom)),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
  });
  expect(Math.min(...geometry.gaps)).toBeGreaterThanOrEqual(10);
  expect(geometry.overflow).toBeLessThanOrEqual(1);

  await page.getByRole('button',{name:'Continue lesson',exact:true}).click();
  await page.getByRole('button',{name:'Start session',exact:true}).click();
  await expect(page.locator('#study')).toHaveClass(/active/);
  const clearance=await page.evaluate(()=>{const header=document.querySelector('#appHeader')!.getBoundingClientRect(),exit=document.querySelector('#exitBtn')!.getBoundingClientRect(),progress=document.querySelector('#sessionCounter')!.getBoundingClientRect();return{scrollY,headerBottom:header.bottom,exitTop:exit.top,progressTop:progress.top}});
  expect(clearance.scrollY).toBe(0);expect(clearance.exitTop).toBeGreaterThanOrEqual(clearance.headerBottom);expect(clearance.progressTop).toBeGreaterThanOrEqual(clearance.headerBottom);

  await page.locator('#exitBtn').click();await expect(page.locator('#exitSessionDialog')).toBeVisible();
  await page.getByRole('button',{name:'Keep learning',exact:true}).click();await expect(page.locator('#study')).toHaveClass(/active/);
  await page.locator('#exitBtn').click();await page.getByRole('button',{name:'Exit lesson',exact:true}).click();
  await expect(page.locator('#journey')).toHaveClass(/active/);
  await expect(page.locator('#journeyHistoryTrack .experimental-timeline-item')).toHaveCount(10);
});

test('experimental panels return to their origin and guest account actions stay hidden',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');await page.getByRole('button',{name:'Explore first',exact:true}).click();
  await page.getByRole('button',{name:'Open settings'}).click();await page.getByRole('checkbox',{name:/Experimental Journey experience/}).check();await page.locator('#settingsBack').click();
  await page.getByRole('navigation',{name:'Experimental quick navigation'}).getByRole('button',{name:'Progress'}).click();
  await expect(page.locator('#skillsOverview')).toHaveClass(/experimental-panel/);
  await page.getByRole('button',{name:'Close panel'}).click();await expect(page.locator('#journey')).toHaveClass(/active/);
  await page.getByRole('button',{name:'Open settings'}).click();await page.getByRole('tab',{name:/Account/}).click();
  await expect(page.locator('.cloud-actions')).toBeHidden();await expect(page.locator('#adminAreaLink')).toBeHidden();
});

test('experimental profile reveals rhythm and keeps guest sign-in explicit',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');await page.getByRole('button',{name:'Explore first',exact:true}).click();
  await page.getByRole('button',{name:'Open settings'}).click();await page.getByRole('checkbox',{name:/Experimental Journey experience/}).check();await page.locator('#settingsBack').click();
  const profile=page.locator('#experimentalProfile');await expect(profile).toHaveAttribute('aria-expanded','false');await profile.click();
  const dialog=page.locator('#experimentalProfileDialog');await expect(dialog).toBeVisible();await expect(profile).toHaveAttribute('aria-expanded','true');
  await expect(dialog.getByRole('heading',{name:'Guest learner'})).toBeVisible();await expect(dialog.locator('#experimentalProfileRhythmDays .learning-rhythm-week-day')).toHaveCount(7);
  await expect(dialog.getByRole('button',{name:'Sign in to save progress',exact:true})).toBeVisible();
  const geometry=await dialog.evaluate(element=>{const avatar=element.querySelector('#experimentalProfileLargeAvatar')!.getBoundingClientRect();return{avatarWidth:avatar.width,overflow:element.scrollWidth-element.clientWidth}});
  expect(geometry.avatarWidth).toBeGreaterThanOrEqual(130);expect(geometry.overflow).toBeLessThanOrEqual(1);
  await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await expect(profile).toBeFocused();

  await profile.click();await dialog.getByRole('button',{name:'View full calendar',exact:true}).click();await expect(dialog).toBeHidden();await expect(page.locator('#learningRhythmDialog')).toBeVisible();
  await page.locator('#learningRhythmClose').click();
  await page.evaluate(()=>{const cloud=(window as typeof window&{KaishiCloud?:{isSignedIn?:()=>boolean}}).KaishiCloud;if(cloud)cloud.isSignedIn=()=>true;document.querySelector('#experimentalProfileName')!.textContent='Terry'});
  await profile.click();await expect(dialog.getByRole('heading',{name:'Terry'})).toBeVisible();await dialog.getByRole('button',{name:'Edit character',exact:true}).click();
  await expect(page.locator('#settings')).toHaveClass(/active/);await expect(page.locator('#settingsPanel-character')).toBeVisible();
});

test('Japan Ready uses curated words and opens the matching cheat-sheet category',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Explore first',exact:true}).click();
  await page.getByRole('button',{name:'Continue Japan Ready 旅行学習を続ける',exact:true}).click();
  await page.locator('#japanReadyScenarioList button').first().click();
  const words=page.locator('.scenario-word-preview');await expect(words).toContainText('はい');await expect(words).toContainText('すみません');await expect(words).not.toContainText('うるさい');
  await page.locator('#scenarioListBack').click();await page.locator('#openJapanReadyCheatSheet').click();
  await expect(page.locator('.cheat-sheet-nav [aria-current="page"]')).toContainText('Greetings & Courtesy');
  await expect(page.locator('.cheat-sheet-group')).toHaveCount(1);
});
