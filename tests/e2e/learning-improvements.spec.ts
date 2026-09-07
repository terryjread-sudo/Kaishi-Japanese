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
