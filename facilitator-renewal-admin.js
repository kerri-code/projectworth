(()=>{'use strict';
const section=document.querySelector('.metrics');if(!section)return;
const block=document.createElement('section');block.className='fac-renewal-admin';
block.innerHTML='<div class="fac-renewal-admin-top"><h2>Annual facilitator renewals</h2><button type="button" id="refreshFacRenewals" class="secondary">Refresh ↻</button></div>'+
 '<p class="muted" id="facRenewalQueueStatus">Checking renewal requests…</p><div id="facRenewalQueue"></div>';
section.after(block);
const $=id=>document.getElementById(id),token=()=>sessionStorage.getItem('pwInstituteIdToken')||'';
const api='https://t0pckriwia.execute-api.us-east-2.amazonaws.com/api/facilitator-training';
let busy=false;
async function request(path,method,body){
 const t=token();if(!t)throw Error('Sign in as Kerri or Zac.');
 const r=await fetch(api+path,{method,cache:'no-store',headers:{Authorization:'Bearer '+t,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Could not complete renewal review.');return d;
}
function renderCard(person,host){
 const item=document.createElement('article');item.className='fac-renewal-admin-card';
 const title=document.createElement('strong');title.textContent=person.name||'Facilitator applicant';item.append(title);
 const detail=document.createElement('p');detail.className='muted';
 detail.textContent='Certificate '+(person.certificateId||'')+' · Valid through '+(person.validUntil||'date not found')+' · Submitted '+(person.renewalRequestedAt?person.renewalRequestedAt.slice(0,10):'recently');
 item.append(detail);
 const label=document.createElement('label');label.className='fac-renewal-admin-check';
 const checkbox=document.createElement('input');checkbox.type='checkbox';
 label.append(checkbox,document.createTextNode('I verified current training, required forms, and safeguarding readiness.'));
 item.append(label);
 const notes=document.createElement('textarea');notes.maxLength=800;notes.rows=2;notes.placeholder='Optional renewal reviewer note (no personal case details)';notes.setAttribute('aria-label','Renewal reviewer notes');item.append(notes);
 const button=document.createElement('button');button.type='button';button.className='gold';button.textContent='Approve Renewal & Issue Certificate →';button.disabled=true;
 checkbox.addEventListener('change',()=>{button.disabled=!checkbox.checked;});
 const result=document.createElement('p');result.className='muted';result.setAttribute('role','status');
 button.addEventListener('click',async()=>{
  if(!checkbox.checked||!confirm('Renew '+(person.name||'this facilitator')+' for one year and email the official PDF certificate?'))return;
  button.disabled=true;result.textContent='Verifying records and issuing the renewed certificate…';
  try{
   const d=await request('/admin/renewal','POST',{userId:person.userId,notes:notes.value.trim()});
   result.textContent='Renewal issued: '+(d.certificate?.id||'new certificate')+' · Email '+(d.emailStatus||'pending')+'.';
   await load();
  }catch(e){result.textContent='Renewal not issued: '+e.message;button.disabled=false;}
 });
 item.append(button,result);host.append(item);
}
async function load(){
 if(busy)return;busy=true;$('refreshFacRenewals').disabled=true;
 $('facRenewalQueueStatus').textContent='Checking annual renewal requests…';
 try{
  const data=await request('/admin/queue','GET');
  const requested=(data.candidates||[]).filter(p=>p.renewalStatus==='requested');
  const host=$('facRenewalQueue');host.replaceChildren();
  $('facRenewalQueueStatus').textContent=requested.length?
    requested.length+' facilitator renewal request(s) need your approval.':'No annual renewals awaiting approval.';
  requested.forEach(p=>renderCard(p,host));
 }catch(err){$('facRenewalQueueStatus').textContent='Unable to check renewals: '+err.message;}
 finally{busy=false;$('refreshFacRenewals').disabled=false;}
}
$('refreshFacRenewals').addEventListener('click',load);load();
})();