(()=>{'use strict';
const host=document.querySelector('[data-panel="certificate"]');if(!host)return;
const API='https://t0pckriwia.execute-api.us-east-2.amazonaws.com/api/facilitator-training/renewal';
const panel=document.createElement('section');panel.id='facAnnualRenewal';panel.className='fac-annual-renewal';
panel.innerHTML='<div class="fac-renewal-eyebrow">YOUR ANNUAL FACILITATOR APPROVAL</div>'+
'<h3>Keep carrying the light.</h3>'+
'<p id="facRenewalIntro">Checking your current facilitator approval…</p>'+
'<div id="facRenewalRequirements"></div>'+
'<form id="facRenewalForm" hidden>'+
'<label class="fac-renewal-check"><input type="checkbox" name="confirmCurrent" required> I have reviewed the current Project Worth training, policies, forms, and safeguarding responsibilities.</label>'+
'<button type="submit" class="btn btn-gold" id="facRenewNow">Renew Light the Way Facilitator →</button>'+
'</form>'+
'<p id="facRenewalMessage" role="status" aria-live="polite"></p>'+
'<a id="facRenewedPDF" class="btn btn-soft" target="_blank" rel="noopener noreferrer" hidden>Open Renewed Certificate PDF ↗</a>';
host.append(panel);
const $=id=>document.getElementById(id);
const token=()=>sessionStorage.getItem('pwInstituteIdToken')||'';
function nice(date){if(!date)return 'your expiration date';const x=new Date(date+'T12:00:00Z');return Number.isNaN(x.getTime())?date:x.toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'});}
async function api(method,body){
 const value=token();if(!value)throw Error('Sign in to your Project Worth Institute account.');
 const resp=await fetch(API,{method,cache:'no-store',headers:{Authorization:'Bearer '+value,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const result=await resp.json().catch(()=>({}));
 if(!resp.ok)throw Error(result.error||'Unable to check annual renewal. Please try again.');
 return result;
}
function showRequirements(checks){
 const el=$('facRenewalRequirements');el.replaceChildren();
 if(!Array.isArray(checks)||!checks.length)return;
 const list=document.createElement('ul');list.className='fac-renewal-steps';
 checks.forEach(check=>{
  const li=document.createElement('li');li.className=check.complete?'ready':'missing';
  const icon=document.createElement('span');icon.textContent=check.complete?'✓':'○';
  const title=document.createElement('span');title.textContent=check.label;
  li.append(icon,title);list.append(li);
 });el.append(list);
}
function show(data){
 if(!data.approved){panel.hidden=true;return;}panel.hidden=false;
 $('facRenewalForm').hidden=true;$('facRenewedPDF').hidden=true;
 showRequirements(data.requirements);
 const exp=nice(data.validUntil);
 if(!data.renewalWindowOpen){
  const opens=data.validUntil?new Date(new Date(data.validUntil+'T12:00:00Z').getTime()-42*24*60*60*1000):null;
  $('facRenewalIntro').textContent='Approved through '+exp+'.';
  $('facRenewalMessage').textContent='Annual renewal opens six weeks before expiration'+(opens?' on '+opens.toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}):'')+'. We will email you a reminder.';
  return;
 }
 $('facRenewalIntro').textContent='Your approval '+(data.daysRemaining<0?'expired on ':'expires on ')+exp+'.';
 if(!data.trainingAndFormsCurrent){
  const missing=(data.requirements||[]).filter(v=>!v.complete);
  $('facRenewalMessage').textContent=missing.length?'Please update the unchecked requirements above before renewal. Your certificate cannot be issued until they are current.':'Please review your training and policies before renewing.';
  return;
 }
 $('facRenewalMessage').textContent='Your required training, policies, and forms are current. Confirm below to renew for another year.';
 $('facRenewalForm').hidden=false;
}
async function refresh(){if(!token())return;try{show(await api('GET'));}catch(e){$('facRenewalMessage').textContent=e.message;}}
$('facRenewalForm').addEventListener('submit',async event=>{
 event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;
 const button=$('facRenewNow');button.disabled=true;
 $('facRenewalMessage').textContent='Verifying training and issuing your annual certificate…';
 try{
  const updated=await api('POST',{confirmCurrent:true});
  if(!updated.renewed||!updated.certificate?.url)throw Error('Your renewal could not be verified.');
  $('facRenewalForm').hidden=true;
  $('facRenewalMessage').textContent=updated.emailStatus==='sent'?'Your Light the Way Facilitator approval is renewed! Your new certificate is ready and a PDF copy was emailed to you.':'Your Light the Way Facilitator approval is renewed! Your new PDF is ready below. Email delivery is still pending.';
  const link=$('facRenewedPDF');link.href=updated.certificate.url;link.hidden=false;
  $('facRenewalIntro').textContent='Renewed through '+nice(updated.certificate.validUntil)+'.';
  showRequirements(updated.renewal?.requirements||[]);
  // The next visit to My Learning or Facilitator Training will display the new certificate automatically.
 }catch(e){$('facRenewalMessage').textContent='Renewal not completed: '+e.message;}
 finally{button.disabled=false;}
});
refresh();window.addEventListener('pageshow',refresh);
})();