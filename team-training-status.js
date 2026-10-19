(() => {
'use strict';
const $=id=>document.getElementById(id);
const pane=$('panel-admin'),table=$('teamTrainingStatus'),tbody=$('teamTrainingRows'),status=$('teamTrainingMessage');
if(!pane||!table||!tbody||!status)return;
const API='https://t0pckriwia.execute-api.us-east-2.amazonaws.com/api/facilitator-training/admin/team-status';
let rows=[],loaded=false,busy=false;
const textEl=(tag,value,className)=>{
 const el=document.createElement(tag);el.textContent=value;
 if(className)el.className=className;
 return el;
};
const pill=(label,type)=>textEl('span',label,'pw-training-pill'+(type?' '+type:''));
function foundationStatus(v){
 if(v.status==='completed')return pill('Complete','complete');
 if(v.status==='in_progress')return pill('In progress · '+v.modules+'/7','');
 return pill('Not started','');
}
function leadershipStatus(v){
 if(v.status==='completed')return pill('Complete','complete');
 if(v.status==='in_progress')return pill(v.slides+'/49 slides','');
 return pill('Not started','');
}
function facilitatorStatus(v){
 switch(v.status) {
 case 'approved':return pill('Approved','complete');
 case 'ready_for_review':return pill('Ready for review','ready');
 case 'awaiting_demo':return pill('Awaiting demo / report','ready');
 case 'in_progress':return pill('In progress','');
 default:return pill('Not started','');
 }
}
function openReview(id){
 const hub=$('facilitatorReviewHub'),panel=$('facReviewFramePanel'),frame=$('facReviewFrame'),button=$('facReviewOpen');
 const path='facilitator-approvals.html?userId='+encodeURIComponent(id);
 if(hub&&panel&&frame){
   frame.setAttribute('src',path);
   panel.hidden=false;
   if(button)button.textContent='Hide facilitator review tools ↑';
   hub.scrollIntoView({behavior:'smooth',block:'start'});
 }else window.location.assign(path);
}
function draw() {
 const query=($('teamTrainingSearch').value||'').toLowerCase().trim();
 const shown=rows.filter(r=>(r.name+' '+r.role+' '+r.department).toLowerCase().includes(query));
 tbody.replaceChildren();
 if(!shown.length){
   const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=5;td.textContent=query?'No team members match that search.':'No team records available.';tr.append(td);tbody.append(tr);return;
 }
 for(const r of shown) {
   const tr=document.createElement('tr');
   const person=document.createElement('td');
   person.append(textEl('strong',r.name||'Team member'),textEl('small',[r.role,r.department].filter(Boolean).join(' · ')));
   tr.append(person);
   for(const node of [foundationStatus(r.foundations||{}),leadershipStatus(r.leadership||{}),facilitatorStatus(r.facilitator||{})]){
     const td=document.createElement('td');td.append(node);tr.append(td);
   }
   const td=document.createElement('td');
   if(r.facilitator?.status!=='not_started'){
     const btn=document.createElement('button');btn.type='button';btn.className='pw-team-review-btn';
     btn.textContent=['ready_for_review','approved'].includes(r.facilitator?.status)?'Review / Approve →':'View progress →';
     btn.addEventListener('click',()=>openReview(r.userId));td.append(btn);
   }else td.append(textEl('span','—',''));
   tr.append(td);tbody.append(tr);
 }
}
async function load(){
 if(busy)return;
 busy=true;$('teamTrainingRefresh').disabled=true;status.textContent='Loading team training statuses…';
 try{
  const token=sessionStorage.getItem('pwInstituteIdToken');
  if(!token)throw Error('Sign in to your Project Worth admin account.');
  const res=await fetch(API,{cache:'no-store',headers:{Authorization:'Bearer '+token,Accept:'application/json'}});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(data.error||'Training statuses could not be loaded.');
  rows=Array.isArray(data.members)?data.members:[];
  $('teamTrainingTotal').textContent=data.counts?.members??rows.length;
  $('teamFoundationsComplete').textContent=data.counts?.foundationsComplete??0;
  $('teamLeadershipComplete').textContent=data.counts?.leadershipComplete??0;
  $('teamFacilitatorReady').textContent=data.counts?.facilitatorsReadyForReview??0;
  status.textContent='Showing '+rows.length+' team members. Only Kerri and Zac can publish evaluations or approve facilitators.';
  loaded=true;draw();
 }catch(error){status.textContent='Unable to load team training statuses: '+error.message;}
 finally{busy=false;$('teamTrainingRefresh').disabled=false;}
}
$('teamTrainingRefresh').addEventListener('click',load);
$('teamTrainingSearch').addEventListener('input',draw);
const observe=new MutationObserver(()=>{if(!pane.hidden&&!loaded&&!busy)load();});
observe.observe(pane,{attributes:true,attributeFilter:['hidden','class']});
if(!pane.hidden)load();
})();