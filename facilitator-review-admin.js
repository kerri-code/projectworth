(() => {
'use strict';
const $ = id => document.getElementById(id);
const API='https://t0pckriwia.execute-api.us-east-2.amazonaws.com';
const token=sessionStorage.getItem('pwInstituteIdToken') || '';
const keys=['modules','roar','room','workbook','incident','values'];
const limits={modules:28,roar:12,room:20,workbook:15,incident:15,values:10};
const checks={sevenModules:'seven',workbookCompleted:'workbookDone',practiceIncidentReport:'reportDone',safetyPassed:'safety',teachbackCompleted:'teachback'};
let people=[], selected=null, reports=[], filter='pending';
if (!token) { window.location.replace('institute-login.html'); return; }
async function request(path,method='GET',data) {
  const r=await fetch(API+path,{method,cache:'no-store',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
  const result=await r.json().catch(()=>({}));
  if(!r.ok) throw Error(result.error||'Project Worth could not complete this request.');
  return result;
}
const labelStage=stage=>({ready:'Ready for review',awaiting_demo:'Awaiting demo / report',training:'In training',approved:'Approved'})[stage]||'In progress';
const byId=id=>people.find(p=>p.userId===id);
function score(){
  const total=keys.reduce((n,k)=>n+(Number($(k).value)||0),0);
  $('scoreTotal').textContent=total+' / 100';
  return total;
}
function scoreData(){return Object.fromEntries(keys.map(k=>[k,Number($(k).value)]));}
function checkData(){return Object.fromEntries(Object.entries(checks).map(([key,id])=>[key,$(id).checked]));}
function canApprove(p){
  const ev=p.evaluation||{};
  return p.stage==='ready' && ev.reviewedAt && ev.total>=85 &&
    Object.keys(checks).every(k=>ev.checks?.[k]===true);
}
function clearWorkspace(){
  $('reviewWorkspace').hidden=true;$('emptyWorkspace').hidden=false;
}
function line(container,text,type=''){
  const p=document.createElement('p');p.textContent=text;p.className='muted '+type;container.append(p);
}
function renderQueue(){
  const list=$('queueItems');list.replaceChildren();
  const visible=people.filter(p=>filter==='all'||filter==='approved'&&p.stage==='approved'||filter==='pending'&&['ready','awaiting_demo'].includes(p.stage));
  if(!visible.length){line(list,filter==='pending'?'No applicants currently awaiting review or a demo.':'No applicants in this view.');return;}
  for(const candidate of visible){
    const btn=document.createElement('button');btn.type='button';btn.className='candidate'+(selected?.userId===candidate.userId?' selected':'');
    const title=document.createElement('strong');title.textContent=candidate.name||'Facilitator applicant';btn.append(title);
    const stage=document.createElement('span');stage.className='status'+(candidate.stage==='approved'?' approved':'');stage.textContent=labelStage(candidate.stage);btn.append(stage);
    if(candidate.evaluation?.reviewedAt){
      const sm=document.createElement('small');sm.textContent='Evaluation sent · '+candidate.evaluation.total+'/100'+(candidate.evaluationAcknowledgedAt?' · Applicant reviewed':'');btn.append(sm);
    } else {
      const sm=document.createElement('small');sm.textContent=candidate.stage==='ready'?'Ready for Kerri or Zac':candidate.stage==='awaiting_demo'?'Waiting on practice / teach-back': 'Progress on file';btn.append(sm);
    }
    btn.addEventListener('click',()=>selectCandidate(candidate.userId));
    list.append(btn);
  }
}
async function refreshQueue(targetId){
  $('queueStatus').textContent='Loading facilitator records…';
  $('refreshQueue').disabled=true;
  try{
    const data=await request('/api/facilitator-training/admin/queue');
    people=Array.isArray(data.candidates)?data.candidates:[];
    const counts=data.counts||{};
    $('countReady').textContent=counts.ready??0;
    $('countDemo').textContent=counts.awaitingDemo??0;
    $('countTraining').textContent=counts.training??0;
    $('countApproved').textContent=counts.approved??0;
    $('queueStatus').textContent='Showing '+people.length+' facilitator records. Only Kerri or Zac may publish evaluations and approve certificates.';
    try{
      const pdf=await request('/api/facilitator-training/practice-reports');
      reports=Array.isArray(pdf.reports)?pdf.reports:[];
    }catch(e){reports=[];console.warn('Practice report list not available.');}
    const id=targetId||selected?.userId||new URLSearchParams(location.search).get('userId');
    const next=id&&byId(id)?id:(people.find(p=>p.stage==='ready')||people.find(p=>p.stage==='awaiting_demo'))?.userId;
    if(next)selectCandidate(next);
    else{selected=null;clearWorkspace();renderQueue();}
  }catch(error){$('queueStatus').textContent='Unable to load pending reviews: '+error.message;clearWorkspace();}
  finally{$('refreshQueue').disabled=false;}
}
async function openPracticeReport(report) {
  const tab=window.open('about:blank','_blank');
  try{
    const d=await request('/api/facilitator-training/practice-reports/'+encodeURIComponent(report.reportId)+'/download');
    if(!d.downloadUrl)throw Error('PDF link not available.');
    if(tab)tab.location.replace(d.downloadUrl);
    else window.location.assign(d.downloadUrl);
  }catch(error){if(tab)tab.close();$('evaluationStatus').textContent='Could not open practice PDF: '+error.message;}
}
function renderPractice(p){
  const box=$('candidatePractice');box.replaceChildren();
  const found=reports.filter(r=>r.userId===p.userId);
  const title=document.createElement('h3');title.textContent='Fictional practice report';box.append(title);
  if(!found.length){line(box,'No practice PDF in the review inbox yet. The learner must upload it after the fictional teach-back.');return;}
  for(const item of found){
    const wrap=document.createElement('div');wrap.className='practice-entry';
    const h=document.createElement('strong');h.textContent='FICTIONAL PRACTICE · '+new Date(item.submittedAt).toLocaleDateString();wrap.append(h);
    const open=document.createElement('button');open.className='secondary';open.type='button';open.textContent='Open secure PDF ↗';open.addEventListener('click',()=>openPracticeReport(item));wrap.append(open);box.append(wrap);
  }
}
function displayEvaluation(p){
  const ev=p.evaluation||{},saved=ev.scores||{},checked=ev.checks||{};
  for(const k of keys)$(k).value=saved[k]??'';
  for(const [k,id] of Object.entries(checks))$(id).checked=checked[k]===true;
  $('notes').value=ev.notes||'';
  score();
  $('evaluationStatus').textContent=ev.reviewedAt?
    'Evaluation shared with the applicant · '+ev.total+'/100 · '+(p.evaluationAcknowledgedAt?'Applicant has reviewed it.':'Awaiting applicant review.') :
    'Complete the evaluation, then choose “Send evaluation to applicant.” This will appear in their Institute portal.';
  $('sendEvaluation').disabled=!p.passed||!p.agreementAccepted;
  $('approveCertificate').disabled=!canApprove(p);
  $('approvalExplanation').textContent=p.stage==='approved'?
    'Project Worth has already issued this facilitator’s numbered certificate.' :
    canApprove(p)?'All required steps are verified. Approval will issue and email the numbered facilitator certificate.':
    'Certification requires a published evaluation of at least 85/100, all safety checks, a signed agreement, and the submitted fictional practice report.';
  $('approvalStatus').textContent=p.stage==='approved'?'Certificate '+(p.certificateId||'issued')+' · Approved by Project Worth.':'';
}
function selectCandidate(id){
  const p=byId(id);
  if(!p)return;
  selected=p;
  $('reviewWorkspace').hidden=false;$('emptyWorkspace').hidden=true;
  $('workspaceTitle').textContent=p.name||'Facilitator applicant';
  $('candidateEmail').textContent=p.email||'No member email available';
  $('candidateSummary').textContent='Assessment: '+(p.passed?'Passed':'Not passed')+' · Final authorization: '+labelStage(p.stage);
  const steps=[['Knowledge test',p.passed],['Agreement',p.agreementAccepted],['Demo scheduled',p.teachbackScheduled],['Practice report',p.practiceReportSubmitted]];
  const stepBox=$('candidateSteps');stepBox.replaceChildren();
  for(const [label,done] of steps){
    const chip=document.createElement('span');chip.textContent=(done?'✓ ':'○ ')+label;if(done)chip.className='done';stepBox.append(chip);
  }
  renderPractice(p);displayEvaluation(p);renderQueue();
}
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{
  filter=b.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(x=>{x.classList.toggle('active',x===b);x.classList.toggle('secondary',x!==b);});
  renderQueue();
}));
$('refreshQueue').addEventListener('click',()=>refreshQueue());
keys.forEach(k=>$(k).addEventListener('input',score));
$('evaluationForm').addEventListener('submit',async e=>{
  e.preventDefault();
  if(!selected)return;
  if(!$('evaluationForm').reportValidity())return;
  if(!confirm('Send this readiness evaluation and feedback to the applicant’s Institute portal? This does not issue a certificate.'))return;
  const btn=$('sendEvaluation');btn.disabled=true;$('evaluationStatus').textContent='Saving the evaluation to the learner record…';
  try{
    const data=await request('/api/facilitator-training/admin/evaluation','POST',{
      userId:selected.userId,scores:scoreData(),checks:checkData(),notes:$('notes').value.trim()
    });
    $('evaluationStatus').textContent='Evaluation published · '+data.total+'/100. '+(data.emailStatus==='sent'?'The applicant has been emailed.':'The applicant can review it in the portal; email delivery is not confirmed.');
    await refreshQueue(selected.userId);
  }catch(err){$('evaluationStatus').textContent='Evaluation was not published: '+err.message;}
  finally{btn.disabled=false;}
});
$('approveCertificate').addEventListener('click',async()=>{
  if(!selected||!canApprove(selected))return;
  if(!confirm('Approve '+(selected.name||'this learner')+' and issue an official numbered Project Worth facilitator certificate?'))return;
  const btn=$('approveCertificate');btn.disabled=true;$('approvalStatus').textContent='Verifying safety requirements and issuing the certificate…';
  try{
    const data=await request('/api/facilitator-training/approve','POST',{userId:selected.userId,teachbackApproved:true});
    $('approvalStatus').textContent='Certificate issued: '+(data.certificate?.id||'see learner record')+'. '+(data.emailStatus==='sent'?'PDF emailed to applicant.':'PDF available in learner portal; email may be pending.');
    await refreshQueue(selected.userId);
  }catch(e){$('approvalStatus').textContent='Approval not completed: '+e.message;}
  finally{btn.disabled=false;}
});
refreshQueue();
})();