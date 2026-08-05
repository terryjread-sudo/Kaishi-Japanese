'use strict';
(() => {
 const config=window.KAISHI_SUPABASE_CONFIG,sdk=window.supabase;
 const account=$('#cloudAccount'),status=$('#cloudStatus'),join=$('#leaderboardOptIn');
 const leaderboard=$('#leaderboardList'),leaderboardMessage=$('#leaderboardMessage');
 const AVATARS=['boy','girl','master','man','woman'],OWNER_LOGIN='terryjread-sudo';
 const FP_KEY='kq-cloud-sync-fingerprint-v1';
 let client=null,user=null,syncTimer=null,initialisedUserId='',syncing=false,selectedAvatar='boy',friendRefreshTimer=null,communityProfiles=new Map();

 const adapter=()=>window.KaishiQuestCloudAdapter;
 const setStatus=(message,state='')=>{if(status){status.textContent=message;status.dataset.state=state}};
 const setLeaderboardMessage=message=>{if(leaderboardMessage)leaderboardMessage.textContent=message};
 const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const avatarKey=value=>AVATARS.includes(value)?value:'boy';
 const avatarState=(streak=0)=>{streak=Number(streak)||0;return streak>=60?'superhero':streak>=30?'double-flex':streak>=14?'flex':streak>=7?'double-thumbs':streak>=3?'thumbs-up':'base'};
 const avatarImage=(key=selectedAvatar,streak=0)=>`media/profiles/${avatarKey(key)}-${avatarState(streak)}.webp?v=9.0.6`;

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
 function renderDashboardAvatar(){
 const streak=Number(adapter()?.stats?.().streak||0);
 const src=user?avatarImage(selectedAvatar,streak):'media/profiles/guest-learner.webp?v=9.0.6';
 const image=$('#dashboardAvatar');if(image)image.src=src;
 if($('#journeyHomeAvatar'))$('#journeyHomeAvatar').src=src;
 if($('#journeyAvatar'))$('#journeyAvatar').src=src;
 if($('#dashboardAvatarTitle'))$('#dashboardAvatarTitle').textContent=user?`@${profile().github_login}`:'Save your progress across devices';
 if($('#dashboardAvatarMilestone'))$('#dashboardAvatarMilestone').textContent=user
  ?(streak>=60?'Superhero form unlocked!':`${streak} day${streak===1?'':'s'} streak · Next pose at ${[3,7,14,30,60].find(days=>days>streak)||60} days.`)
  :'Sign in with GitHub to choose a character, protect your progress and continue on another device.';
 const heroSignIn=$('#dashboardSignIn');if(heroSignIn){heroSignIn.hidden=Boolean(user);heroSignIn.onclick=signIn}
}
 function renderStudioAccess(){const owner=isOwner(),link=$('#mnemonicStudioLink');if(link)link.hidden=!owner;window.KaishiQuestPath?.renderOwnerPathControls?.(owner)}

 function renderSignedOut(message='Sign in with GitHub to sync progress between devices.'){
  user=null;initialisedUserId='';selectedAvatar='boy';
  if(account)account.innerHTML=`<img class="cloud-avatar" src="media/profiles/guest-learner.webp?v=9.0.6" alt="Guest learner"><div><strong>Protect your Kaishi Quest progress</strong><p>Sign in with GitHub to sync learning, choose a character and continue on another device.</p></div><button id="cloudSignIn" class="github-button">Sign in with GitHub</button>`;
  $('#cloudSignIn')?.addEventListener('click',signIn);
  if(join){join.checked=true;join.disabled=true}
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
  const write=existing?await client.from('leaderboard_entries').update(values).eq('user_id',user.id):await client.from('leaderboard_entries').insert({...values,opted_in:true});
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
 function scheduleSync(){if(!user||!client)return;clearTimeout(syncTimer);syncTimer=setTimeout(async()=>{try{await saveSnapshot();setStatus('Progress synced.','ok');await loadLeaderboard();await initialiseFriends();await redeemFriendInviteFromUrl()}catch(error){console.error('Cloud sync failed',error);setStatus(describeError(error),'error')}},1400)}
 async function flush(){clearTimeout(syncTimer);if(user)try{await saveSnapshot(true)}catch(error){console.error('Cloud flush failed',error)}}

 
 async function friendRpc(name,args={}){if(!client||!user)throw new Error('Sign in with GitHub to use friends.');const{data,error}=await client.rpc(name,args);if(error)throw error;return data}
 function friendAvatar(row){return avatarImage(row.avatar_key||'boy',Number(row.streak||0))}
 function timeAgo(value){if(!value)return'not recently';const seconds=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/1000));if(seconds<60)return'just now';if(seconds<3600)return`${Math.floor(seconds/60)}m ago`;if(seconds<86400)return`${Math.floor(seconds/3600)}h ago`;return`${Math.floor(seconds/86400)}d ago`}
 async function loadFriends(){
  const incoming=$('#incomingFriendRequests'),list=$('#friendsList'),badge=$('#friendRequestBadge');
  if(!incoming||!list)return;
  if(!user){
   window.__kaishiFriendRows=[];
   incoming.innerHTML='<p class="muted">Sign in with GitHub to use friends.</p>';
   list.innerHTML='';
   if(badge)badge.hidden=true;
   renderFriendNudge([]);
   return;
  }
  try{
   const rows=await friendRpc('get_kaishi_friends');
   window.__kaishiFriendRows=rows||[];
   const requests=(rows||[]).filter(row=>row.relationship_status==='pending_incoming');
   const friends=(rows||[]).filter(row=>row.relationship_status==='accepted');
   if(badge){badge.hidden=!requests.length;badge.textContent=`${requests.length} new`}
   incoming.innerHTML=requests.length
    ?`<h4>Friend requests</h4>${requests.map(row=>`<article class="friend-row request"><img src="${friendAvatar(row)}" alt=""><div><strong>${esc(row.display_name||row.github_login)}</strong><small>@${esc(row.github_login)}</small></div><div class="friend-actions"><button data-friend-accept="${row.request_id}" class="primary">Accept</button><button data-friend-decline="${row.request_id}">Decline</button></div></article>`).join('')}`
    :'';
   list.innerHTML=`<h4>Your friends</h4>${friends.length
    ?friends.map(row=>`<article class="friend-row"><img src="${friendAvatar(row)}" alt=""><div><strong>${esc(row.display_name||row.github_login)}</strong><small>@${esc(row.github_login)} · active ${timeAgo(row.last_active_at)}</small></div><button data-unfriend="${row.user_id}">Unfriend</button></article>`).join('')
    :'<p class="muted">No friends yet. Select a learner from the leaderboard or share an invitation link.</p>'}`;
   document.querySelectorAll('[data-friend-accept]').forEach(button=>button.onclick=async()=>{
    await friendRpc('respond_kaishi_friend_request',{request_id:button.dataset.friendAccept,accept_request:true});
    await loadFriends();await loadLeaderboard();
   });
   document.querySelectorAll('[data-friend-decline]').forEach(button=>button.onclick=async()=>{
    await friendRpc('respond_kaishi_friend_request',{request_id:button.dataset.friendDecline,accept_request:false});
    await loadFriends();await loadLeaderboard();
   });
   document.querySelectorAll('[data-unfriend]').forEach(button=>button.onclick=async()=>{
    if(!confirm('Remove this friend?'))return;
    await friendRpc('remove_kaishi_friend',{friend_user_id:button.dataset.unfriend});
    await loadFriends();await loadLeaderboard();
   });
   renderFriendNudge(friends);
  }catch(error){
   window.__kaishiFriendRows=[];
   incoming.innerHTML='';
   list.innerHTML=`<p class="muted">${esc(describeError(error))}</p>`;
   renderFriendNudge([]);
  }
 }
 function renderFriendNudge(friends){const card=$('#friendActivityNudge');if(!card)return;const recent=(friends||[]).filter(r=>r.last_active_at&&Date.now()-new Date(r.last_active_at).getTime()<86400000).sort((a,b)=>new Date(b.last_active_at)-new Date(a.last_active_at))[0];if(!user||!recent){card.hidden=true;return}card.hidden=false;$('#friendActivityAvatar').src=friendAvatar(recent);$('#friendActivityTitle').textContent=`${recent.display_name||recent.github_login} has been learning`;$('#friendActivityText').textContent=`They were active ${timeAgo(recent.last_active_at)}. Complete a short mission and keep pace with them.`;$('#friendActivityOpen').onclick=()=>{$('#communityBtn')?.click();setTimeout(()=>$('#friendsPanel')?.scrollIntoView({behavior:'smooth'}),100)}}
 async function initialiseFriends(){
  await loadFriends();
  clearInterval(friendRefreshTimer);
  friendRefreshTimer=setInterval(()=>{if(document.visibilityState==='visible')loadFriends()},60000);
 }
async function loadLeaderboard(){
  if(!client||!leaderboard)return;setLeaderboardMessage('Loading leaderboard…');
  const{data,error}=await client.from('leaderboard_entries').select('user_id,github_login,display_name,avatar_key,streak,xp,mastered,accuracy,monsters_defeated').eq('opted_in',true).order('xp',{ascending:false}).order('mastered',{ascending:false}).limit(20);
  if(error){leaderboard.innerHTML='';setLeaderboardMessage(describeError(error));return}
  if(!data?.length){leaderboard.innerHTML='';setLeaderboardMessage('No learners have joined yet. Be the first!');return}
  setLeaderboardMessage('Friendly community ranking · progress is self-reported by the app.');
  communityProfiles=new Map(data.map(row=>[row.user_id,row]));
  leaderboard.innerHTML=data.map((row,index)=>{const isYou=row.user_id===user?.id;return`<article class="leaderboard-row ${isYou?'is-you':''}" data-community-user="${row.user_id}" tabindex="0" role="button" aria-label="View ${esc(row.display_name)}'s profile"><span class="leaderboard-rank">${index+1}</span><img src="${avatarImage(row.avatar_key,row.streak)}" alt="${esc(row.display_name)}'s Kaishi character"><div><strong>${esc(row.display_name)}${isYou?'<span class="you-badge">Your profile</span>':''}</strong><small>@${esc(row.github_login)}</small></div><b>${Number(row.xp).toLocaleString()} XP</b><small>${row.mastered} mastered · ${row.accuracy}% · ${row.streak||0} day streak</small></article>`}).join('');
  document.querySelectorAll('[data-community-user]').forEach(item=>{
   item.addEventListener('click',()=>openCommunityProfile(item.dataset.communityUser));
   item.addEventListener('keydown',event=>{
    if(event.key==='Enter'||event.key===' '){
     event.preventDefault();
     openCommunityProfile(item.dataset.communityUser);
    }
   });
  });
 }
 async function changeAvatar(event){const button=event.target.closest('[data-avatar]');if(!button||!user)return;selectedAvatar=avatarKey(button.dataset.avatar);renderAvatarPicker();renderDashboardAvatar();const accountAvatar=account?.querySelector('img');if(accountAvatar)accountAvatar.src=avatarImage(selectedAvatar,adapter()?.stats?.().streak);const{error}=await client.from('leaderboard_entries').update({avatar_key:selectedAvatar}).eq('user_id',user.id);if(error){setStatus(describeError(error),'error');return}setStatus('Kaishi character saved.','ok');await loadLeaderboard()}
 async function changeOptIn(){if(!user)return;join.disabled=true;const{error}=await client.from('leaderboard_entries').update({opted_in:join.checked}).eq('user_id',user.id);join.disabled=false;if(error){join.checked=!join.checked;setStatus(describeError(error),'error');return}setStatus(join.checked?'You have joined the public leaderboard.':'You have left the public leaderboard.','ok');await loadLeaderboard()}
 async function syncNow(){if(!user){await signIn();return}await initialiseAccount(true)}
 async function deleteCloudData(){if(!user||!confirm('Delete your Kaishi Quest cloud account, progress and leaderboard entry? Local progress on this device will remain.'))return;const{error}=await client.rpc('delete_my_kaishi_account');if(error){setStatus(describeError(error),'error');return}await client.auth.signOut({scope:'local'});localStorage.removeItem(FP_KEY);renderSignedOut('Cloud account deleted. Local progress was kept on this device.');await loadLeaderboard()}
 async function handleSession(session){user=session?.user||null;if(!user){renderSignedOut();await loadLeaderboard();return}renderStudioAccess();if(initialisedUserId===user.id)return;initialisedUserId=user.id;await initialiseAccount();await initialiseFriends();await redeemFriendInviteFromUrl()}


 function friendRelation(userId){
  return (window.__kaishiFriendRows||[]).find(row=>row.user_id===userId)||null;
 }
 async function openCommunityProfile(userId){
  const row=communityProfiles.get(userId),dialog=$('#communityProfileDialog');
  if(!row||!dialog)return;
  $('#communityProfileAvatar').src=friendAvatar(row);
  $('#communityProfileName').textContent=row.display_name||row.github_login;
  $('#communityProfileUsername').textContent=`@${row.github_login}`;
  $('#communityProfileStats').innerHTML=`<span><strong>${Number(row.xp||0).toLocaleString()}</strong> XP</span><span><strong>${row.mastered||0}</strong> mastered</span><span><strong>${row.streak||0}</strong> day streak</span>`;
  const relation=friendRelation(userId),actions=$('#communityProfileActions'),isYou=userId===user?.id;
  actions.innerHTML='';
  if(isYou){
   $('#communityProfileStatus').textContent='This is your community profile.';
  }else if(!user){
   $('#communityProfileStatus').textContent='Sign in to add this learner as a friend.';
   actions.innerHTML='<button id="profileSignIn" class="primary">Sign in with GitHub</button>';
   $('#profileSignIn').onclick=signIn;
  }else if(relation?.relationship_status==='accepted'){
   $('#communityProfileStatus').textContent='You are friends.';
   actions.innerHTML='<button id="profileUnfriend">Unfriend</button>';
   $('#profileUnfriend').onclick=async()=>{
    if(!confirm('Remove this friend?'))return;
    await friendRpc('remove_kaishi_friend',{friend_user_id:userId});
    await loadFriends();await loadLeaderboard();dialog.close();
   };
  }else if(relation?.relationship_status==='pending_incoming'){
   $('#communityProfileStatus').textContent='This learner sent you a friend request.';
   actions.innerHTML='<button id="profileAccept" class="primary">Accept request</button><button id="profileDecline">Decline</button>';
   $('#profileAccept').onclick=async()=>{
    await friendRpc('respond_kaishi_friend_request',{request_id:relation.request_id,accept_request:true});
    await loadFriends();await loadLeaderboard();dialog.close();
   };
   $('#profileDecline').onclick=async()=>{
    await friendRpc('respond_kaishi_friend_request',{request_id:relation.request_id,accept_request:false});
    await loadFriends();await loadLeaderboard();dialog.close();
   };
  }else if(relation?.relationship_status==='pending_outgoing'){
   $('#communityProfileStatus').textContent='Friend request sent. Waiting for them to accept.';
  }else{
   $('#communityProfileStatus').textContent='Send this learner a friend request.';
   actions.innerHTML='<button id="profileAddFriend" class="primary">Add friend</button>';
   $('#profileAddFriend').onclick=async()=>{
    const button=$('#profileAddFriend');
    button.disabled=true;button.textContent='Sending…';
    try{
     await friendRpc('send_kaishi_friend_request',{target_login:row.github_login});
     await loadFriends();await loadLeaderboard();
     $('#communityProfileStatus').textContent='Friend request sent. Waiting for them to accept.';
     actions.innerHTML='';
    }catch(error){
     button.disabled=false;button.textContent='Add friend';
     $('#communityProfileStatus').textContent=describeError(error);
    }
   };
  }
  if(!dialog.open)dialog.showModal();
 }
 function capturePendingInvite(){
  try{
   const url=new URL(location.href),token=url.searchParams.get('friendInvite');
   if(token)localStorage.setItem(PENDING_INVITE_KEY,token);
  }catch(error){console.warn('Could not retain friend invitation',error)}
 }
 function pendingInviteToken(){
  try{
   const url=new URL(location.href);
   return url.searchParams.get('friendInvite')||localStorage.getItem(PENDING_INVITE_KEY)||'';
  }catch(error){
   try{return localStorage.getItem(PENDING_INVITE_KEY)||''}catch{return''}
  }
 }
 function clearPendingInvite(){
  try{
   localStorage.removeItem(PENDING_INVITE_KEY);
   const url=new URL(location.href);
   url.searchParams.delete('friendInvite');
   history.replaceState({},'',url.toString());
  }catch(error){}
 }
 async function createFriendInviteLink(){
  if(!user){
   await signIn();
   return null;
  }
  const token=await friendRpc('create_kaishi_friend_invite');
  const url=new URL(location.href);
  url.hash='';
  url.searchParams.set('friendInvite',token);
  return url.toString();
 }
 async function redeemFriendInviteFromUrl(){
  if(!user)return false;
  const token=pendingInviteToken();
  if(!token)return false;
  try{
   const result=await friendRpc('redeem_kaishi_friend_invite',{invite_token:token});
   clearPendingInvite();
   await loadFriends();await loadLeaderboard();
   if(result?.inviter_login)toast(`You and @${result.inviter_login} are now Kaishi Quest friends`);
   return true;
  }catch(error){
   clearPendingInvite();
   console.warn('Friend invite could not be redeemed',error);
   setStatus(describeError(error),'error');
   return false;
  }
 }


 async function init(){
  capturePendingInvite();
  $('#communityProfileClose')?.addEventListener('click',()=>$('#communityProfileDialog')?.close());$('#avatarPicker')?.addEventListener('click',changeAvatar);join?.addEventListener('change',changeOptIn);$('#cloudSyncNow')?.addEventListener('click',syncNow);$('#cloudDelete')?.addEventListener('click',deleteCloudData);$('#leaderboardSignIn')?.addEventListener('click',()=>user?$('#settingsBtn').click():signIn());
  if(!config?.url||!config?.publishableKey||!sdk?.createClient){renderSignedOut('Cloud sync could not start. Guest mode is still available.');setStatus('Cloud configuration or library is unavailable.','error');return}
  client=sdk.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  client.auth.onAuthStateChange((event,session)=>{if(['TOKEN_REFRESHED','USER_UPDATED'].includes(event))return;setTimeout(()=>handleSession(session),0)});
  const{data,error}=await client.auth.getSession();if(error){renderSignedOut();setStatus(describeError(error),'error')}else await handleSession(data.session);
  addEventListener('online',()=>user&&scheduleSync());
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush()});
 }
 window.KaishiCloud={scheduleSync,loadLeaderboard,loadFriends,createFriendInviteLink,flush,avatarImage,renderDashboardAvatar,isOwner,currentAvatar:()=>selectedAvatar};
 init();
})();
