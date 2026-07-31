'use strict';

(() => {
  const OWNER_LOGIN='terryjread-sudo';
  const gate=document.querySelector('#studioAccessGate');
  const config=window.KAISHI_SUPABASE_CONFIG;
  const sdk=window.supabase;

  function loginFor(user){
    const metadata=user?.user_metadata||{};
    return String(metadata.user_name||metadata.preferred_username||metadata.login||'').toLowerCase();
  }

  function showDenied(title,message){
    const eyebrow=document.createElement('span');eyebrow.className='eyebrow';eyebrow.textContent='Private development tool';
    const heading=document.createElement('h1');heading.textContent=title;
    const detail=document.createElement('p');detail.textContent=message;
    const back=document.createElement('a');back.className='back-to-app';back.href='index.html';back.textContent='← Back to Kaishi Quest';
    gate.replaceChildren(eyebrow,heading,detail,back);
  }

  function unlock(){
    document.documentElement.classList.remove('studio-locked');
    gate.hidden=true;
    const script=document.createElement('script');script.src='mnemonic-studio.js?v=5.8.3';
    script.onerror=()=>showDenied('Studio could not start','The editor script could not be loaded. Please return to the app and try again.');
    document.body.append(script);
  }

  async function checkAccess(){
    if(!config?.url||!config?.publishableKey||!sdk?.createClient){
      showDenied('Access check unavailable','Kaishi Quest could not verify the signed-in account.');return;
    }
    const client=sdk.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const {data,error}=await client.auth.getSession();
    if(error){showDenied('Access check failed','Return to Kaishi Quest and sign in again.');return}
    const login=loginFor(data.session?.user);
    if(login===OWNER_LOGIN){unlock();return}
    if(login){showDenied('Access restricted',`You are signed in as @${login}. Mnemonic Studio is available only to @${OWNER_LOGIN}.`);return}
    showDenied('Owner sign-in required',`Return to Kaishi Quest and sign in as @${OWNER_LOGIN} to open Mnemonic Studio.`);
  }

  checkAccess().catch(()=>showDenied('Access check failed','Return to Kaishi Quest and sign in again.'));
})();
