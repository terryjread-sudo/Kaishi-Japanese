'use strict';

(() => {
  const config=window.KAISHI_SUPABASE_CONFIG;
  const sdk=window.supabase;
  const account=$('#cloudAccount'),status=$('#cloudStatus'),join=$('#leaderboardOptIn');
  const leaderboard=$('#leaderboardList'),leaderboardMessage=$('#leaderboardMessage');
  let client=null,user=null,syncTimer=null,initialisedUserId='',syncing=false;

  function adapter(){return window.KaishiQuestCloudAdapter}
  function setStatus(message,state=''){if(status){status.textContent=message;status.dataset.state=state}}
  function setLeaderboardMessage(message){if(leaderboardMessage)leaderboardMessage.textContent=message}
  function nameFor(value=''){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
  function profile(){
    const m=user?.user_metadata||{};
    const login=m.user_name||m.preferred_username||m.login||user?.email?.split('@')[0]||'learner';
    return {github_login:String(login),display_name:String(m.full_name||m.name||login),avatar_url:m.avatar_url||null};
  }
  function setupMissing(error){return error?.code==='42P01'||/relation .* does not exist/i.test(error?.message||'')}
  function describeError(error){return setupMissing(error)?'Cloud tables are not installed yet. Run the supplied Supabase SQL migration.':(error?.message||'Cloud service is unavailable.')}

  function renderSignedOut(message='Sign in with GitHub to sync progress between devices.'){
    user=null;initialisedUserId='';
    if(account)account.innerHTML=`<div><strong>Play as a guest or save to the cloud</strong><p>${nameFor(message)}</p></div><button id="cloudSignIn" class="github-button">Continue with GitHub</button>`;
    $('#cloudSignIn')?.addEventListener('click',signIn);
    if(join){join.checked=false;join.disabled=true}
    setStatus('Guest progress is saved only on this device.');
  }

  function renderSignedIn(entry){
    const p=profile();
    if(account)account.innerHTML=`<img class="cloud-avatar" src="${nameFor(p.avatar_url||'')}" alt=""><div><strong>${nameFor(p.display_name)}</strong><p>@${nameFor(p.github_login)} · GitHub account connected</p></div><button id="cloudSignOut">Sign out</button>`;
    $('#cloudSignOut')?.addEventListener('click',signOut);
    if(join){join.disabled=false;join.checked=Boolean(entry?.opted_in)}
  }

  async function signIn(){
    if(!client)return;
    setStatus('Opening GitHub sign-in…','working');
    const redirectTo=new URL('.',location.href).href.split('#')[0].split('?')[0];
    const {error}=await client.auth.signInWithOAuth({provider:'github',options:{redirectTo}});
    if(error)setStatus(describeError(error),'error');
  }

  async function signOut(){
    if(!client)return;
    await flush();
    const {error}=await client.auth.signOut();
    if(error)setStatus(describeError(error),'error');else renderSignedOut('Signed out. Your local progress remains on this device.');
  }

  async function ensureLeaderboardEntry(){
    if(!user)return null;
    const p=profile(),stats=adapter()?.stats?.()||{};
    const values={user_id:user.id,...p,...stats};
    const {data:existing,error:readError}=await client.from('leaderboard_entries').select('user_id').eq('user_id',user.id).maybeSingle();
    if(readError)throw readError;
    const write=existing
      ?await client.from('leaderboard_entries').update(values).eq('user_id',user.id)
      :await client.from('leaderboard_entries').insert({...values,opted_in:false});
    if(write.error)throw write.error;
    const {data,error}=await client.from('leaderboard_entries').select('*').eq('user_id',user.id).maybeSingle();
    if(error)throw error;
    return data;
  }

  async function chooseProgress(local,remote){
    if(JSON.stringify(local)===JSON.stringify(remote))return'cloud';
    const dialog=$('#cloudConflictDialog');
    if(!dialog)return'cloud';
    return new Promise(resolve=>{
      dialog.showModal();
      const finish=choice=>{dialog.close();resolve(choice)};
      $('#useCloudProgress').onclick=()=>finish('cloud');
      $('#keepDeviceProgress').onclick=()=>finish('device');
    });
  }

  async function initialiseAccount(forceChoice=false){
    if(!user||syncing)return;
    syncing=true;setStatus('Checking cloud progress…','working');
    try{
      const entry=await ensureLeaderboardEntry();
      renderSignedIn(entry);
      const {data,error}=await client.from('user_progress').select('payload,updated_at').eq('user_id',user.id).maybeSingle();
      if(error)throw error;
      const local=adapter()?.snapshot?.()||{},remote=data?.payload;
      const localStarted=Object.keys(local.progress||{}).length>0,remoteStarted=Object.keys(remote?.progress||{}).length>0;
      if(!data){
        await saveSnapshot(true);
        setStatus('Cloud backup created.','ok');
      }else if(remoteStarted&&!localStarted){
        adapter()?.restore?.(remote);
        setStatus('Progress restored from the cloud.','ok');
      }else if(remoteStarted&&localStarted){
        const remoteTime=Number(remote?.meta?.updatedAt||Date.parse(data.updated_at)||0),localTime=Number(local?.meta?.updatedAt||0);
        const choice=forceChoice||Math.abs(remoteTime-localTime)>1500?await chooseProgress(local,remote):(remoteTime>localTime?'cloud':'device');
        if(choice==='cloud'){
          adapter()?.restore?.(remote);
          setStatus('Cloud progress restored on this device.','ok');
        }else{
          await saveSnapshot(true);
          setStatus('This device is now the cloud version.','ok');
        }
      }else{
        await saveSnapshot(true);
        setStatus('Progress is synced.','ok');
      }
      await loadLeaderboard();
    }catch(error){
      console.error('Cloud initialisation failed',error);
      setStatus(describeError(error),'error');
      setLeaderboardMessage(describeError(error));
    }finally{syncing=false}
  }

  async function saveSnapshot(force=false){
    if(!user||!client||(!force&&syncing))return;
    const payload=adapter()?.snapshot?.();
    if(!payload)return;
    const {error}=await client.from('user_progress').upsert({user_id:user.id,schema_version:2,payload},{onConflict:'user_id'});
    if(error)throw error;
    await ensureLeaderboardEntry();
  }

  function scheduleSync(){
    if(!user||!client)return;
    clearTimeout(syncTimer);
    syncTimer=setTimeout(async()=>{
      try{await saveSnapshot();setStatus('Progress synced.','ok');await loadLeaderboard()}
      catch(error){console.error('Cloud sync failed',error);setStatus(describeError(error),'error')}
    },1400);
  }

  async function flush(){
    clearTimeout(syncTimer);
    if(user)try{await saveSnapshot(true)}catch(error){console.error('Cloud flush failed',error)}
  }

  async function loadLeaderboard(){
    if(!client||!leaderboard)return;
    setLeaderboardMessage('Loading leaderboard…');
    const {data,error}=await client.from('leaderboard_entries').select('user_id,github_login,display_name,avatar_url,xp,mastered,accuracy,monsters_defeated').eq('opted_in',true).order('xp',{ascending:false}).order('mastered',{ascending:false}).limit(20);
    if(error){leaderboard.innerHTML='';setLeaderboardMessage(describeError(error));return}
    if(!data?.length){leaderboard.innerHTML='';setLeaderboardMessage('No learners have joined yet. Be the first!');return}
    setLeaderboardMessage('Friendly community ranking · progress is self-reported by the app.');
    leaderboard.innerHTML=data.map((row,index)=>`<article class="leaderboard-row ${row.user_id===user?.id?'is-you':''}"><span class="leaderboard-rank">${index+1}</span><img src="${nameFor(row.avatar_url||'')}" alt=""><div><strong>${nameFor(row.display_name)}</strong><small>@${nameFor(row.github_login)}${row.user_id===user?.id?' · You':''}</small></div><b>${Number(row.xp).toLocaleString()} XP</b><small>${row.mastered} mastered · ${row.accuracy}% · ${row.monsters_defeated} yōkai</small></article>`).join('');
  }

  async function changeOptIn(){
    if(!user)return;
    join.disabled=true;
    const {error}=await client.from('leaderboard_entries').update({opted_in:join.checked}).eq('user_id',user.id);
    join.disabled=false;
    if(error){join.checked=!join.checked;setStatus(describeError(error),'error');return}
    setStatus(join.checked?'You have joined the public leaderboard.':'You have left the public leaderboard.','ok');
    await loadLeaderboard();
  }

  async function syncNow(){
    if(!user){await signIn();return}
    await initialiseAccount(true);
  }

  async function deleteCloudData(){
    if(!user||!confirm('Delete your cloud progress and leaderboard entry? Local progress on this device will remain.'))return;
    const progressDelete=await client.from('user_progress').delete().eq('user_id',user.id);
    const leaderboardDelete=await client.from('leaderboard_entries').delete().eq('user_id',user.id);
    const error=progressDelete.error||leaderboardDelete.error;
    if(error){setStatus(describeError(error),'error');return}
    renderSignedIn(null);setStatus('Cloud data deleted. Local progress was kept.','ok');await loadLeaderboard();
  }

  async function handleSession(session){
    user=session?.user||null;
    if(!user){renderSignedOut();await loadLeaderboard();return}
    if(initialisedUserId===user.id)return;
    initialisedUserId=user.id;
    await initialiseAccount();
  }

  async function init(){
    join?.addEventListener('change',changeOptIn);
    $('#cloudSyncNow')?.addEventListener('click',syncNow);
    $('#cloudDelete')?.addEventListener('click',deleteCloudData);
    $('#leaderboardSignIn')?.addEventListener('click',()=>user?$('#settingsBtn').click():signIn());
    if(!config?.url||!config?.publishableKey||!sdk?.createClient){
      renderSignedOut('Cloud sync could not start. Guest mode is still available.');
      setStatus('Cloud configuration or library is unavailable.','error');return;
    }
    client=sdk.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    client.auth.onAuthStateChange((_event,session)=>setTimeout(()=>handleSession(session),0));
    const {data,error}=await client.auth.getSession();
    if(error){renderSignedOut();setStatus(describeError(error),'error')}else await handleSession(data.session);
    addEventListener('online',()=>user&&scheduleSync());
  }

  window.KaishiCloud={scheduleSync,loadLeaderboard,flush};
  init();
})();
