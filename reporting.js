'use strict';

(() => {
  const OWNER_LOGIN='terryjread-sudo';
  const CATEGORIES={
    japanese_wrong:'Japanese wrong',
    english_wrong:'English wrong',
    audio_wrong:'Audio wrong',
    mnemonic_wrong:'Mnemonic image/story',
    graphical_issue:'Graphical/layout issue',
    answer_options_wrong:'Answer options wrong',
    other:'Other'
  };

  let client=null,user=null,isAdmin=false,currentContext=null,reports=[];

  const $=selector=>document.querySelector(selector);
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));

  function githubLogin(){
    const metadata=user?.user_metadata||{};
    return String(
      metadata.user_name||
      metadata.preferred_username||
      metadata.login||
      user?.email?.split('@')[0]||
      ''
    ).toLowerCase();
  }

  function signedIn(){return Boolean(user)}
  function ownerByLogin(){return githubLogin()===OWNER_LOGIN}

  function setReportStatus(message,state=''){
    const element=$('#learningReportStatus');
    if(element){element.textContent=message;element.dataset.state=state}
  }

  function setAdminStatus(message,state=''){
    const element=$('#reportAdminStatus');
    if(element){element.textContent=message;element.dataset.state=state}
  }

  function reportButton(){
    let button=$('#flagLearningCard');
    if(button)return button;
    button=document.createElement('button');
    button.id='flagLearningCard';
    button.type='button';
    button.className='learning-card-flag';
    button.innerHTML='<span aria-hidden="true">🚩</span> Report issue';
    button.addEventListener('click',openReportDialog);
    return button;
  }

  function attachToLearningCard(context){
    currentContext=context||null;
    const card=$('#card');
    if(!card)return;
    card.querySelector('#flagLearningCard')?.remove();
    if(!signedIn()||!currentContext?.wordId)return;
    card.appendChild(reportButton());
  }

  function refreshCurrentCardButton(){
    const card=$('#card');
    if(!card)return;
    card.querySelector('#flagLearningCard')?.remove();
    if(signedIn()&&currentContext?.wordId)card.appendChild(reportButton());
  }

  function openReportDialog(){
    if(!signedIn()){
      alert('Please sign in with GitHub from Settings before reporting a learning-card issue.');
      return;
    }
    if(!currentContext)return;
    const dialog=$('#learningReportDialog');
    $('#learningReportCategory').value='';
    $('#learningReportDescription').value='';
    $('#learningReportCharacters').textContent='0';
    $('#learningReportCardSummary').innerHTML=
      `<strong lang="ja">${escapeHtml(currentContext.japanese||currentContext.reading)}</strong>`+
      `<span>${escapeHtml(currentContext.english)}</span>`+
      `<small>${escapeHtml(currentContext.activityType)} · ${escapeHtml(currentContext.topicTitle)}</small>`;
    setReportStatus('Signed-in users can submit up to three reports per day.');
    dialog?.showModal();
  }

  function closeReportDialog(){
    $('#learningReportDialog')?.close();
  }

  async function submitReport(event){
    event.preventDefault();
    if(!client||!user||!currentContext)return;
    const category=$('#learningReportCategory').value;
    const description=$('#learningReportDescription').value.trim();
    if(!category){setReportStatus('Choose an issue category.','error');return}

    const submit=$('#submitLearningReport');
    submit.disabled=true;
    setReportStatus('Submitting report…','working');

    const payload={
      p_word_id:currentContext.wordId||null,
      p_japanese:currentContext.japanese||null,
      p_reading:currentContext.reading||null,
      p_english:currentContext.english||null,
      p_topic_id:currentContext.topicId||null,
      p_page_type:currentContext.pageType||'learning-card',
      p_activity_type:currentContext.activityType||null,
      p_card_context:{
        topicTitle:currentContext.topicTitle||'',
        cardText:currentContext.cardText||'',
        selectedAnswer:currentContext.selectedAnswer||'',
        expectedAnswer:currentContext.expectedAnswer||''
      },
      p_category:category,
      p_description:description||null,
      p_app_version:currentContext.appVersion||'8.3.0',
      p_viewport_width:window.innerWidth,
      p_viewport_height:window.innerHeight
    };

    const {data,error}=await client.rpc('submit_learning_card_report',payload);
    submit.disabled=false;
    if(error){
      const message=/daily report limit/i.test(error.message)
        ?'You have submitted three reports today. Thank you — you can report more tomorrow.'
        :/already reported/i.test(error.message)
          ?'You have already reported this issue.'
          :error.message;
      setReportStatus(message,'error');
      return;
    }

    const remaining=Number(data?.remaining??0);
    setReportStatus(`Report submitted. ${remaining} report${remaining===1?'':'s'} remaining today.`,'ok');
    setTimeout(closeReportDialog,1100);
  }

  async function checkAdmin(){
    isAdmin=false;
    if(!client||!user)return false;
    const {data,error}=await client.rpc('is_app_admin');
    if(!error)isAdmin=Boolean(data);
    const link=$('#adminAreaLink');
    if(link)link.hidden=!isAdmin;
    return isAdmin;
  }

  function moveOwnerTools(){
    const slot=$('#adminToolsSlot');
    if(!slot)return;
    const controls=$('#ownerPathControls');
    const studio=$('#mnemonicStudioLink');
    if(controls&&!slot.contains(controls)){controls.hidden=false;slot.appendChild(controls)}
    if(studio&&!slot.contains(studio)){studio.hidden=false;slot.appendChild(studio)}
  }

  async function openAdmin(){
    if(!await checkAdmin()){
      alert('Administrator access is required.');
      return;
    }
    moveOwnerTools();
    $('#adminAccessMessage').textContent=`Signed in as @${githubLogin()}. Database access is protected by Supabase policies.`;
    window.scrollTo(0,0);
    document.querySelectorAll('.screen').forEach(screen=>screen.classList.toggle('active',screen.id==='adminArea'));
    await loadReports();
  }

  function filterReports(){
    const status=$('#reportStatusFilter').value;
    const category=$('#reportCategoryFilter').value;
    const search=$('#reportSearch').value.trim().toLowerCase();
    return reports.filter(report=>{
      if(status!=='all'&&report.status!==status)return false;
      if(category!=='all'&&report.category!==category)return false;
      if(search){
        const haystack=[
          report.japanese,report.reading,report.english,report.description,
          report.github_login,report.activity_type,report.topic_id
        ].join(' ').toLowerCase();
        if(!haystack.includes(search))return false;
      }
      return true;
    });
  }

  function renderReports(){
    const list=$('#adminReportList');
    if(!list)return;
    const visible=filterReports();
    if(!visible.length){
      list.innerHTML='<p class="muted">No reports match these filters.</p>';
      return;
    }
    list.innerHTML=visible.map(report=>{
      const context=report.card_context||{};
      return `<article class="admin-report-card" data-report-id="${escapeHtml(report.id)}">
        <div class="admin-report-title">
          <div><strong lang="ja">${escapeHtml(report.japanese||report.reading||'Unknown card')}</strong>
          <span>${escapeHtml(report.english||'')}</span></div>
          <span class="report-status ${escapeHtml(report.status)}">${escapeHtml(report.status)}</span>
        </div>
        <div class="admin-report-meta">
          <span>${escapeHtml(CATEGORIES[report.category]||report.category)}</span>
          <span>${escapeHtml(report.activity_type||report.page_type)}</span>
          <span>@${escapeHtml(report.github_login||'unknown')}</span>
          <span>${new Date(report.created_at).toLocaleString()}</span>
        </div>
        <p>${escapeHtml(report.description||'No description supplied.')}</p>
        ${context.cardText?`<details><summary>Captured card context</summary><pre>${escapeHtml(context.cardText)}</pre></details>`:''}
        <small>Version ${escapeHtml(report.app_version||'unknown')} · ${Number(report.viewport_width)||'?'}×${Number(report.viewport_height)||'?'}</small>
        <div class="admin-report-actions">
          ${report.status==='reviewed'?'<button data-action="reopen">Mark new</button>':'<button data-action="review">Mark reviewed</button>'}
          <button data-action="fixed">Mark fixed</button>
          <button data-action="delete" class="danger">Delete</button>
        </div>
      </article>`;
    }).join('');

    list.querySelectorAll('[data-action]').forEach(button=>{
      button.addEventListener('click',()=>updateReport(
        button.closest('[data-report-id]').dataset.reportId,
        button.dataset.action
      ));
    });
  }

  async function loadReports(){
    if(!isAdmin)return;
    setAdminStatus('Loading reports…','working');
    const {data,error}=await client
      .from('learning_card_reports')
      .select('*')
      .order('created_at',{ascending:false})
      .limit(500);
    if(error){setAdminStatus(error.message,'error');return}
    reports=data||[];
    setAdminStatus(`${reports.filter(item=>item.status==='new').length} new · ${reports.length} total loaded.`,'ok');
    renderReports();
  }

  async function updateReport(id,action){
    if(!isAdmin)return;
    if(action==='delete'){
      if(!confirm('Permanently delete this report?'))return;
      const {error}=await client.from('learning_card_reports').delete().eq('id',id);
      if(error){setAdminStatus(error.message,'error');return}
    }else{
      const values=action==='review'
        ?{status:'reviewed',reviewed_at:new Date().toISOString(),reviewed_by:user.id}
        :action==='fixed'
          ?{status:'fixed',reviewed_at:new Date().toISOString(),reviewed_by:user.id}
          :{status:'new',reviewed_at:null,reviewed_by:null};
      const {error}=await client.from('learning_card_reports').update(values).eq('id',id);
      if(error){setAdminStatus(error.message,'error');return}
    }
    await loadReports();
  }

  function csvValue(value){
    const text=typeof value==='object'?JSON.stringify(value):String(value??'');
    return `"${text.replaceAll('"','""')}"`;
  }

  async function exportReports(){
    if(!isAdmin)return;
    const selected=filterReports().filter(report=>report.status==='new');
    if(!selected.length){setAdminStatus('There are no unreviewed reports in the current filter.');return}

    const columns=[
      'id','created_at','category','description','japanese','reading','english',
      'topic_id','page_type','activity_type','github_login','app_version',
      'viewport_width','viewport_height','card_context','status'
    ];
    const csv=[
      columns.join(','),
      ...selected.map(report=>columns.map(column=>csvValue(report[column])).join(','))
    ].join('\r\n');

    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;
    link.download=`kaishi-learning-reports-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    if($('#markExportedReviewed').checked){
      const ids=selected.map(report=>report.id);
      const now=new Date().toISOString();
      const {error}=await client
        .from('learning_card_reports')
        .update({status:'reviewed',reviewed_at:now,reviewed_by:user.id,exported_at:now})
        .in('id',ids);
      if(error){setAdminStatus(`CSV exported, but status update failed: ${error.message}`,'error');return}
      setAdminStatus(`${ids.length} reports exported and marked reviewed.`,'ok');
      await loadReports();
    }else{
      setAdminStatus(`${selected.length} reports exported. They remain unreviewed.`,'ok');
    }
  }

  async function handleSession(session){
    user=session?.user||null;
    await checkAdmin();
    refreshCurrentCardButton();
  }

  async function init(){
    const config=window.KAISHI_SUPABASE_CONFIG;
    const sdk=window.supabase;
    if(!config?.url||!config?.publishableKey||!sdk?.createClient)return;

    client=sdk.createClient(config.url,config.publishableKey,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });

    client.auth.onAuthStateChange((_event,session)=>setTimeout(()=>handleSession(session),0));
    const {data}=await client.auth.getSession();
    await handleSession(data.session);

    $('#learningReportForm')?.addEventListener('submit',submitReport);
    $('#closeLearningReport')?.addEventListener('click',closeReportDialog);
    $('#cancelLearningReport')?.addEventListener('click',closeReportDialog);
    $('#learningReportDescription')?.addEventListener('input',event=>{
      $('#learningReportCharacters').textContent=String(event.target.value.length);
    });

    $('#adminAreaLink')?.addEventListener('click',openAdmin);
    $('#adminBack')?.addEventListener('click',()=>{
      document.querySelectorAll('.screen').forEach(screen=>screen.classList.toggle('active',screen.id==='settings'));
      window.scrollTo(0,0);
    });
    $('#refreshReports')?.addEventListener('click',loadReports);
    $('#reportStatusFilter')?.addEventListener('change',renderReports);
    $('#reportCategoryFilter')?.addEventListener('change',renderReports);
    $('#reportSearch')?.addEventListener('input',renderReports);
    $('#exportReports')?.addEventListener('click',exportReports);
  }

  window.KaishiReports={attachToLearningCard,isSignedIn:signedIn,isAdmin:()=>isAdmin};
  init();
})();