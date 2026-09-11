import { test,expect } from '@playwright/test';

test('a verified production pack opens a fresh page and travel content with the network disabled',async({page,context})=>{
  const remoteScripts:string[]=[];page.on('request',request=>{if(request.resourceType()==='script'&&request.url().includes('raw.githubusercontent.com'))remoteScripts.push(request.url());});
  await page.goto('/');await page.getByRole('button',{name:'Explore Journey',exact:true}).click();
  await page.locator('[data-experimental-settings-trigger]:visible').click();await page.getByRole('tab',{name:'Data & Offline'}).click();
  await expect(page.locator('#offlinePackSelect')).toBeVisible();await page.locator('#offlinePackSelect').selectOption('essential');
  await expect(page.locator('#offlineEstimate')).toContainText('Estimated pack size',{timeout:60000});
  await page.locator('#downloadOfflinePack').click();await expect(page.locator('#offlinePackState')).toHaveText('Ready',{timeout:120000});
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.close();await context.setOffline(true);
  const offline=await context.newPage(),failedBundles:string[]=[];
  offline.on('requestfailed',request=>{if(request.url().includes('/assets/'))failedBundles.push(request.url());});await offline.goto('/');
  await offline.locator('[data-experimental-nav="japan-ready"]').click();await expect(offline.getByRole('heading',{name:'Greetings & Courtesy',exact:true})).toBeVisible();
  await offline.getByRole('button',{name:'📋 Travel cheat sheet',exact:true}).click();await expect(offline.locator('#cheatSheetSections')).toContainText('ありがとう');
  expect(remoteScripts).toEqual([]);
  expect(failedBundles).toEqual([]);
});
