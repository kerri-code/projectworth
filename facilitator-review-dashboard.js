(() => {
'use strict';
const $ = id => document.getElementById(id);
const panel=$('panel-admin'),hub=$('facilitatorReviewHub'),open=$('facReviewOpen');
if(!panel||!hub||!open)return;
const API='https://t0pckriwia.execute-api.us-east-2.amazonaws.com/api/facilitator-training/admin/queue';
let loaded=false,busy=false;
function openReview(userId) {
 const frame=$('facReviewFrame');
 const target='facilitator-approvals.html'+(userId?'?userId='+encodeURIComponent(userId):'');
 if(frame.getAttribute('src')!==target)frame.src=target;
 $('facReviewFramePanel').hidden=false;
 open.textContent='Hide facilitator review tools ↑';
 $('facReviewFramePanel').scrollIntoView({behavior:'smooth',block:'start'});
}
open.addEventListener('click',()=>{
 if(!$('facReviewFramePanel').hidden){
  $('facReviewFramePanel').hidden=true;open.textContent='Open facilitator review tools ↓';
 }else openReview();
});
async function refresh(){
 if(busy)return;busy=true;
 $('facReviewHubStatus').textContent='Checking your facilitator reviews…';
 try{
  const token=sessionStorage.getItem('pwInstituteIdToken');
  if(!token)throw Error('Sign in as a Project Worth administrator.');
  const r=await fetch(API,{cache:'no-store',headers:{Authorization:'Bearer '+token,Accept:'application/json'}});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(d.error||'Unable to load pending facilitator reviews.');
  const list=Array.isArray(d.candidates)?d.candidates:[];
  $('facReviewReady').textContent=d.counts?.ready??0;
  $('facReviewDemo').textContent=d.counts?.awaitingDemo??0;
  $('facReviewApproved').textContent=d.counts?.approved??0;
  const pending=list.filter(p=>p.stage==='ready');
  $('facReviewHubStatus').textContent=pending.length?
    pending.length+' facilitator applicant(s) ready for Kerri or Zac to review.':
    'No facilitator applicants ready for final review right now.';
  const items=$('facReviewPendingList');items.replaceChildren();
  for(const p of pending.slice(0,8)){
   const btn=document.createElement('button');btn.type='button';
   const label=document.createElement('strong');label.textContent=p.name||'Facilitator applicant';
   const note=document.createElement('span');note.textContent=p.evaluation?.reviewedAt?'Evaluation shared · Review/approve →':'Needs evaluation →';
   btn.append(label,note);btn.addEventListener('click',()=>openReview(p.userId));items.append(btn);
  }
  loaded=true;
 }catch(e){$('facReviewHubStatus').textContent='Facilitator queue: '+e.message;}
 finally{busy=false;}
}
const watch=new MutationObserver(()=>{if(!panel.hidden&&!loaded&&!busy)refresh();});
watch.observe(panel,{attributes:true,attributeFilter:['hidden','class']});
if(!panel.hidden)refresh();
})();