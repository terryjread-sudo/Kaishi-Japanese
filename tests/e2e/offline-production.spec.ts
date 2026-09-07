import { test,expect } from '@playwright/test';

test('a verified production pack opens a fresh page and travel content with the network disabled',async({page,context})=>{
  const remoteScripts:string[]=[];page.on('request',request=>{if(request.resourceType()==='script'&&request.url().includes('raw.githubusercontent.com'))remoteScripts.push(request.url());});
  await page.goto('/');await page.getByRole('button',{name:'Explore first',exact:true}).click();
  await page.getByRole('button',{name:'⚙️',exact:true}).click();await page.getByRole('tab',{name:'Data & Offline'}).click();
  await expect(page.locator('#offlinePackSelect')).toBeVisible();await page.locator('#offlinePackSelect').selectOption('essential');
  await expect(page.locator('#offlineEstimate')).toContainText('Estimated pack size',{timeout:60000});
  await page.locator('#downloadOfflinePack').click();await expect(page.locator('#offlinePackState')).toHaveText('Ready',{timeout:120000});
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.close();await context.setOffline(true);
  const offline=await context.newPage(),failedBundles:string[]=[];
  offline.on('requestfailed',request=>{if(request.url().includes('/assets/'))failedBundles.push(request.url());});await offline.goto('/');
  await expect(offline.getByRole('button',{name:'Continue Japan Ready 旅行学習を続ける',exact:true})).toBeVisible();
  await offline.getByRole('button',{name:'Continue Japan Ready 旅行学習を続ける',exact:true}).click();await expect(offline.getByRole('heading',{name:'Greetings & Courtesy',exact:true})).toBeVisible();
  await offline.getByRole('button',{name:'📋 Travel cheat sheet',exact:true}).click();await expect(offline.locator('#cheatSheetSections')).toContainText('ありがとう');
  expect(remoteScripts).toEqual([]);
  await offline.getByRole('button',{name:'← Japan Ready',exact:true}).click();await offline.getByRole('button',{name:'← Dashboard',exact:true}).click();
  await offline.getByRole('button',{name:'Continue · 冒険を続ける',exact:true}).click();await offline.getByRole('button',{name:'Continue lesson',exact:true}).click();await offline.getByRole('button',{name:'Start session',exact:true}).click();
  await expect(offline.locator('.lesson-shell-heading')).toContainText('Meeting people');
  for(let step=0;step<35;step++){
    if(await offline.locator('#finishMissionNow').isVisible())break;
    const card=offline.locator('#card');
    if(await card.locator('#revealBtn').isVisible()){await card.locator('#revealBtn').click();await card.getByRole('button',{name:'Good',exact:true}).click();continue;}
    let advanced=false;for(const id of ['kanaUnlockContinue','firstEncounterContinue','continueBtn','pronunciationSkip','exampleContinue'])if(await card.locator(`#${id}`).isVisible()){await card.locator(`#${id}`).click();advanced=true;break;}
    if(!advanced)throw new Error(`Unexpected offline card: ${await card.innerText()}`);
  }
  await expect(offline.locator('#finishMissionNow')).toBeVisible();
  expect(failedBundles).toEqual([]);
  expect(await offline.evaluate(async()=>{
    const catalog=await fetch('offline-catalog.json').then(r=>r.json());
    const lesson=catalog.groups.find((group:{id:string})=>group.id==='lesson-1');
    const audio=catalog.assets.find((asset:{url:string;kind:string})=>asset.kind==='audio'&&lesson.urls.includes(asset.url));
    const response=await fetch(audio.url);return response.ok&&(await response.arrayBuffer()).byteLength===audio.bytes;
  })).toBe(true);
});
