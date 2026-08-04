'use strict';
(() => {
 const config=window.KAISHI_SUPABASE_CONFIG,sdk=window.supabase;
 const account=$('#cloudAccount'),status=$('#cloudStatus'),join=$('#leaderboardOptIn');
 const leaderboard=$('#leaderboardList'),leaderboardMessage=$('#leaderboardMessage');
 const AVATARS=['boy','girl','master','man','woman'],OWNER_LOGIN='terryjread-sudo';
 const FP_KEY='kq-cloud-sync-fingerprint-v1';
 let client=null,user=null,syncTimer=null,initialisedUserId='',syncing=false,selectedAvatar='boy';

 const adapter=()=>window.KaishiQuestCloudAdapter;
 const setStatus=(message,state='')=>{if(status){status.textContent=message;status.dataset.state=state}};
 const setLeaderboardMessage=message=>{if(leaderboardMessage)leaderboardMessage.textContent=message};
 const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const avatarKey=value=>AVATARS.includes(value)?value:'boy';
 const avatarState=(streak=0)=>{streak=Number(streak)||0;return streak>=60?'superhero':streak>=30?'double-flex':streak>=14?'flex':streak>=7?'double-thumbs':streak>=3?'thumbs-up':'base'};
 const avatarImage=(key=selectedAvatar,streak=0)=>`media/profiles/${avatarKey(key)}-${avatarState(streak)}.webp?v=9.0.3`;

 function profile(){const m=user?.user_metadata||{},login=m.user_name||m.preferred_username||m.login||user?.email?.split('@')[0]||'learner';return{github_login:String(login),display_name:String(m.full_name||m.name||login),avatar_url:m.avatar_url||null}}
 function isOwner(){return Boolean(user&&profile().github_login.toLowerCase()===OWNER_LOGIN)}
 function setupMissing(error){return['42P01','42703'].includes(error?.code)||/(relation|column) .* does not exist/i.test(error?.message||'')}
 function describeError(error){return setupMissing(error)?'Cloud setup is incomplete. Run the supplied Supabase SQL migrations in order.':(error?.message||'Cloud service is unavailable.')}

 function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(
   Object.keys(value).sort()
    .filter(key=>!['updatedAt','updated_at','dailyJourneyRoute','dailyActivity'].includes(key))
    .map(key=>[key,stable(value[key])])
  );
  return value;
 }
 function hash(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)}
 function fingerprint(snapshot){return hash(JSON.stringify(stable({version:snapshot?.version||2,progress:snapshot?.progress||{},meta:snapshot?.meta||{},settings:snapshot?.settings||{}})))}
 function remember(snapshot){localStorage.setItem(FP_KEY,fingerprint(snapshot))}
 function remembered(){return localStorage.getItem(FP_KEY)||''}

 function renderAvatarPicker(){const picker=$('#avatarPicker');if(!picker)return;picker.disabled=!user;picker.querySelector('p').textContent=user?'Your character evolves at 3, 7, 14, 30 and 60 streak days.':'Sign in to choose and sync a character.';picker.querySelectorAll('[data-avatar]').forEach(button=>{const chosen=button.dataset.avatar===selectedAvatar;button.classList.toggle('selected',chosen);button.setAttribute('aria-pressed',String(chosen))})}
 function renderDashboardAvatar(){const streak=Number(adapter()?.stats?.().streak||0),src=avatarImage(selectedAvatar,streak),image=$('#dashboardAvatar');if(image)image.src=src;if($('#journeyHomeAvatar'))$('#journeyHomeAvatar').src=src;if($('#journeyAvatar'))$('#journeyAvatar').src=src;if($('#dashboardAvatarTitle'))$('#dashboardAvatarTitle').textContent=user?`@${profile().github_login}`:'Sign in to choose your character';if($('#dashboardAvatarMilestone'))$('#dashboardAvatarMilestone').textContent=streak>=60?'Superhero form unlocked!':`${streak} day${streak===1?'':'s'} streak · Next pose at ${[3,7,14,30,60].find(days=>days>streak)||60} days.`}
 function renderStudioAccess(){const owner=isOwner(),link=$('#mnemonicStudioLink');if(link)link.hidden=!owner;window.KaishiQuestPath?.renderOwnerPathControls?.(owner)}

 function renderSignedOut(message='Sign in with GitHub to sync progress between devices.'){
  user=null;initialisedUserId='';selectedAvatar='boy';
  if(account)account.innerHTML=`<div><strong>Play as a guest or save to the cloud</strong><p>${esc(message)}</p></div><button id="cloudSignIn" class="github-button">Continue with GitHub</button>`;
  $('#cloudSignIn')?.addEventListener('click',signIn);
  if(join){join.checked=false;join.disabled=true}
  setStatus('Guest progress is saved only on this device.');
  renderAvatarPicker();renderDashboardAvatar();renderStudioAccess();
 }
 function renderSignedIn(entry){
  const p=profile();selectedAvatar=avatarKey(entry?.avatar_key);
  if(account)account.innerHTML=`<img class="cloud-avatar" src="${avatarImage(selectedAvatar,entry?.streak)}" alt=""><div><strong>${esc(p.display_name)}</strong><p>@${esc(p.github_login)} · GitHub account connected</p></div><button id="cloudSignOut">Sign out</button>`;
  $('#cloudSignOut')?.addEventListener('click',signOut);
  if(join){join.disabled=false;join.checked=Boolean(entry?.opted_in)}
  renderAvatarPicker();renderDashboardAvatar();renderStudioAccess();
 }

 async function signIn(){if(!client)return;setStatus('Opening GitHub sign-in…','working');const redirectTo=new URL('.',location.href).href.split('#')[0].split('?')[0];const{error}=await client.auth.signInWithOAuth({provider:'github',options:{redirectTo}});if(error)setStatus(describeError(error),'error')}
 async function signOut(){if(!client)return;await flush();const{error}=await client.auth.signOut();if(error)setStatus(describeError(error),'error');else renderSignedOut('Signed out. Your local progress remains on this device.')}

 async function ensureLeaderboardEntry(){
  if(!user)return null;
  const p=profile(),stats=adapter()?.stats?.()||{};
  const{data:existing,error:readError}=await client.from('leaderboard_entries').select('user_id,avatar_key').eq('user_id',user.id).maybeSingle();
  if(readError)throw readError;
  selectedAvatar=avatarKey(existing?.avatar_key||selectedAvatar);
  const values={user_id:user.id,...p,...stats,avatar_key:selectedAvatar};
  const write=existing?await client.from('leaderboard_entries').update(values).eq('user_id',user.id):await client.from('leaderboard_entries').insert({...values,opted_in:false});
  if(write.error)throw write.error;
  const{data,error}=await client.from('leaderboard_entries').select('*').eq('user_id',user.id).maybeSingle();
  if(error)throw error;return data;
 }

 async function chooseProgress(){
  const dialog=$('#cloudConflictDialog');if(!dialog)return'cloud';
  return new Promise(resolve=>{dialog.showModal();const finish=choice=>{dialog.close();resolve(choice)};$('#useCloudProgress').onclick=()=>finish('cloud');$('#keepDeviceProgress').onclick=()=>finish('device')});
 }
 async function reconcile(local,remote,forceChoice=false){
  const lf=fingerprint(local),rf=fingerprint(remote),last=remembered();
  if(lf===rf)return'cloud';
  if(!forceChoice&&last){
   if(rf===last&&lf!==last)return'device';
   if(lf===last&&rf!==last)return'cloud';
  }
  const la=Number(local?.meta?.totalAnswers||0),ra=Number(remote?.meta?.totalAnswers||0);
  if(!forceChoice&&la!==ra)return la>ra?'device':'cloud';
  const lt=Number(local?.meta?.updatedAt||0),rt=Number(remote?.meta?.updatedAt||0);
  if(!forceChoice&&Math.abs(lt-rt)<10000)return lt>=rt?'device':'cloud';
  return chooseProgress();
 }

 async function initialiseAccount(forceChoice=false){
  if(!user||syncing)return;syncing=true;setStatus('Checking cloud progress…','working');
  try{
   const entry=await ensureLeaderboardEntry();renderSignedIn(entry);
   const{data,error}=await client.from('user_progress').select('payload,updated_at').eq('user_id',user.id).maybeSingle();
   if(error)throw error;
   const local=adapter()?.snapshot?.()||{},remote=data?.payload;
   const localStarted=Object.keys(local.progress||{}).length>0,remoteStarted=Object.keys(remote?.progress||{}).length>0;
   if(!data){await saveSnapshot(true);setStatus('Cloud backup created.','ok')}
   else if(remoteStarted&&!localStarted){adapter()?.restore?.(remote);remember(adapter()?.snapshot?.()||remote);setStatus('Progress restored from the cloud.','ok')}
   else if(remoteStarted&&localStarted){
    const choice=await reconcile(local,remote,forceChoice);
    if(choice==='cloud'){adapter()?.restore?.(remote);remember(adapter()?.snapshot?.()||remote);setStatus('Progress synced from the cloud.','ok')}
    else{await saveSnapshot(true);setStatus('This device is now the cloud version.','ok')}
   }else{await saveSnapshot(true);setStatus('Progress is synced.','ok')}
   await loadLeaderboard();
  }catch(error){console.error('Cloud initialisation failed',error);setStatus(describeError(error),'error');setLeaderboardMessage(describeError(error))}
  finally{syncing=false}
 }

 async function saveSnapshot(force=false){
  if(!user||!client||(!force&&syncing))return;
  const payload=adapter()?.snapshot?.();if(!payload)return;
  const{error}=await client.from('user_progress').upsert({user_id:user.id,schema_version:2,payload},{onConflict:'user_id'});
  if(error)throw error;
  remember(payload);await ensureLeaderboardEntry();
 }
 function scheduleSync(){if(!user||!client)return;clearTimeout(syncTimer);syncTimer=setTimeout(async()=>{try{await saveSnapshot();setStatus('Progress synced.','ok');await loadLeaderboard()}catch(error){console.error('Cloud sync failed',error);setStatus(describeError(error),'error')}},1400)}
 async function flush(){clearTimeout(syncTimer);if(user)try{await saveSnapshot(true)}catch(error){console.error('Cloud flush failed',error)}}

 async function loadLeaderboard(){
  if(!client||!leaderboard)return;setLeaderboardMessage('Loading leaderboard…');
  const{data,error}=await client.from('leaderboard_entries').select('user_id,github_login,display_name,avatar_key,streak,xp,mastered,accuracy,monsters_defeated').eq('opted_in',true).order('xp',{ascending:false}).order('mastered',{ascending:false}).limit(20);
  if(error){leaderboard.innerHTML='';setLeaderboardMessage(describeError(error));return}
  if(!data?.length){leaderboard.innerHTML='';setLeaderboardMessage('No learners have joined yet. Be the first!');return}
  setLeaderboardMessage('Friendly community ranking · progress is self-reported by the app.');
  leaderboard.innerHTML=data.map((row,index)=>{const isYou=row.user_id===user?.id;return`<article class="leaderboard-row ${isYou?'is-you':''}"><span class="leaderboard-rank">${index+1}</span><img src="${avatarImage(row.avatar_key,row.streak)}" alt="${esc(row.display_name)}'s Kaishi character"><div><strong>${esc(row.display_name)}${isYou?'<span class="you-badge">Your profile</span>':''}</strong><small>@${esc(row.github_login)}</small></div><b>${Number(row.xp).toLocaleString()} XP</b><small>${row.mastered} mastered · ${row.accuracy}% · ${row.streak||0} day streak</small></article>`}).join('');
 }
 async function changeAvatar(event){const button=event.target.closest('[data-avatar]');if(!button||!user)return;selectedAvatar=avatarKey(button.dataset.avatar);renderAvatarPicker();renderDashboardAvatar();const accountAvatar=account?.querySelector('img');if(accountAvatar)accountAvatar.src=avatarImage(selectedAvatar,adapter()?.stats?.().streak);const{error}=await client.from('leaderboard_entries').update({avatar_key:selectedAvatar}).eq('user_id',user.id);if(error){setStatus(describeError(error),'error');return}setStatus('Kaishi character saved.','ok');await loadLeaderboard()}
 async function changeOptIn(){if(!user)return;join.disabled=true;const{error}=await client.from('leaderboard_entries').update({opted_in:join.checked}).eq('user_id',user.id);join.disabled=false;if(error){join.checked=!join.checked;setStatus(describeError(error),'error');return}setStatus(join.checked?'You have joined the public leaderboard.':'You have left the public leaderboard.','ok');await loadLeaderboard()}
 async function syncNow(){if(!user){await signIn();return}await initialiseAccount(true)}
 async function deleteCloudData(){if(!user||!confirm('Delete your Kaishi Quest cloud account, progress and leaderboard entry? Local progress on this device will remain.'))return;const{error}=await client.rpc('delete_my_kaishi_account');if(error){setStatus(describeError(error),'error');return}await client.auth.signOut({scope:'local'});localStorage.removeItem(FP_KEY);renderSignedOut('Cloud account deleted. Local progress was kept on this device.');await loadLeaderboard()}
 async function handleSession(session){user=session?.user||null;if(!user){renderSignedOut();await loadLeaderboard();return}renderStudioAccess();if(initialisedUserId===user.id)return;initialisedUserId=user.id;await initialiseAccount()}

 async function init(){
  $('#avatarPicker')?.addEventListener('click',changeAvatar);join?.addEventListener('change',changeOptIn);$('#cloudSyncNow')?.addEventListener('click',syncNow);$('#cloudDelete')?.addEventListener('click',deleteCloudData);$('#leaderboardSignIn')?.addEventListener('click',()=>user?$('#settingsBtn').click():signIn());
  if(!config?.url||!config?.publishableKey||!sdk?.createClient){renderSignedOut('Cloud sync could not start. Guest mode is still available.');setStatus('Cloud configuration or library is unavailable.','error');return}
  client=sdk.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  client.auth.onAuthStateChange((event,session)=>{if(['TOKEN_REFRESHED','USER_UPDATED'].includes(event))return;setTimeout(()=>handleSession(session),0)});
  const{data,error}=await client.auth.getSession();if(error){renderSignedOut();setStatus(describeError(error),'error')}else await handleSession(data.session);
  addEventListener('online',()=>user&&scheduleSync());
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush()});
 }
 window.KaishiCloud={scheduleSync,loadLeaderboard,flush,avatarImage,renderDashboardAvatar,isOwner,currentAvatar:()=>selectedAvatar};
 init();
})();
