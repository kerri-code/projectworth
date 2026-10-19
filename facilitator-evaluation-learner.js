(() => {
'use strict';
const $=id=>document.getElementById(id);
const box=$('learnerReadinessEvaluation');
if(!box)return;
const panel=box.closest('[data-panel="certificate"]');
const API='https://t0pckriwia.execute-api.us-east-2.amazonaws.com/api/facilitator-training';
const labels={modules:['Seven Foundations modules',28],roar:['Run to the Roar',12],room:['Group facilitation',20],workbook:['Participant workbook',15],incident:['Fictional practice report',15],values:['Project Worth values & integrity',10]};
let record=null,busy=false;
async function call(method='GET',payload) {
 const token=sessionStorage.getItem('pwInstituteIdToken');
 if(!token)throw Error('Sign in to your Institute account.');
 const response=await fetch(API,{method,cache:'no-store',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(payload?{body:JSON.stringify(payload)}:{})});
 const value=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(value.error||'Could not load your readiness review.');
 return value;
}
async function refresh() {
 if(busy)return;busy=true;
 const status=$('learnerEvaluationStatus');
 status.textContent='Checking for an evaluation from Project Worth…';
 try{
  const data=await call(); record=data.record||{};
  const ev=record.readinessEvaluation;
  const details=$('learnerEvaluationDetails');
  if(!ev||!ev.reviewedAt){details.hidden=true;status.textContent='Your evaluation will appear here after Kerri or Zac reviews your teach-back and shares feedback.';return;}
  status.textContent='Shared by Project Worth · '+new Date(ev.reviewedAt).toLocaleDateString();
  details.hidden=false;
  $('learnerEvaluationSummary').textContent=ev.total+'/100 · '+(ev.status==='meets_standard'?'Readiness standard met':'More practice recommended');
  const scores=$('learnerEvaluationScores');scores.replaceChildren();
  for(const [key,info] of Object.entries(labels)){
    const cell=document.createElement('div');
    const title=document.createElement('strong');title.textContent=info[0];cell.append(title);
    const line=document.createElement('span');line.textContent=(ev.scores?.[key]??0)+' / '+info[1];cell.append(line);scores.append(cell);
  }
  $('learnerEvaluationNotes').textContent=ev.notes||'Your facilitator reviewer will share next steps.';
  const met=Object.values(ev.checks||{}).filter(Boolean).length;
  $('learnerEvaluationSafeguards').textContent=met+'/5 safeguarding and completion checks confirmed. An evaluation is not a facilitator certificate.';
  const acknowledged=Boolean(record.evaluationAcknowledgedAt);
  $('acknowledgeEvaluation').disabled=acknowledged;
  $('acknowledgeEvaluation').textContent=acknowledged?'Evaluation reviewed ✓':'I have reviewed my evaluation ✓';
  $('learnerEvaluationAckStatus').textContent=acknowledged?'You have acknowledged this feedback.':'Review the feedback above and acknowledge it when ready. This does not affect certificate eligibility.';
 }catch(err){status.textContent='Unable to load your evaluation: '+err.message;}
 finally{busy=false;}
}
$('acknowledgeEvaluation').addEventListener('click',async()=>{
 $('acknowledgeEvaluation').disabled=true;
 $('learnerEvaluationAckStatus').textContent='Saving your acknowledgment…';
 try{
  await call('POST',{event:'evaluation-reviewed'});
  $('learnerEvaluationAckStatus').textContent='Thank you. Project Worth can see that you reviewed your evaluation.';
  $('acknowledgeEvaluation').textContent='Evaluation reviewed ✓';
 }catch(err){
  $('learnerEvaluationAckStatus').textContent='Could not save your acknowledgment: '+err.message;
  $('acknowledgeEvaluation').disabled=false;
 }
});
const observer=new MutationObserver(()=>{if(panel&&!panel.hidden)refresh();});
if(panel)observer.observe(panel,{attributes:true,attributeFilter:['hidden']});
if(panel&&!panel.hidden)refresh();
})();