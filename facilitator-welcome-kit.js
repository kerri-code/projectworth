(() => {
'use strict';
const $ = id => document.getElementById(id);
const API = 'https://t0pckriwia.execute-api.us-east-2.amazonaws.com/api/facilitator-welcome-kit';
const form = $('facilitatorKitForm'), open = $('kitShowForm'), panel = $('kitRequestPanel');
const message = $('kitOrderStatus'), result = $('kitOrderResult');
if (!form || !open || !panel || !message) return;
function status(text){message.textContent=text;}
function receipt(order) {
 if (!order) return;
 const requestId = order.requestId || 'Project Worth welcome-kit request';
 result.textContent = 'Request received: '+requestId+'. Project Worth will review your choices and arrange fulfillment. You do not need to submit another request.';
 result.hidden = false;
 form.hidden = true;
 panel.hidden = false;
 open.disabled = true;
 open.textContent = 'Welcome-kit request received';
 status('Request on file.');
}
const billingSame=$('kitBillingSame'),billing=$('kitBillingFields');
billingSame?.addEventListener('change',()=>{
 const separate=!billingSame.checked;
 billing.hidden=!separate;billing.disabled=!separate;
 ['kitBillingRecipient','kitBillingAddress1','kitBillingCity','kitBillingState','kitBillingPostal'].forEach(id=>{if($(id))$(id).required=separate});
});
const auth=()=>sessionStorage.getItem('pwInstituteIdToken') || '';
async function request(method,data) {
 const token=auth();
 if(!token)throw Error('Your Institute session has expired. Please sign in again.');
 const response=await fetch(API, {method,cache:'no-store',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  ...(data ? {body:JSON.stringify(data)} : {})});
 const value=await response.json().catch(()=>({}));
 if (!response.ok)throw Error(value.error || 'Unable to reach the welcome-kit service.');
 return value;
}
async function refresh(){
 status('Checking official Project Worth facilitator approval…');
 try{
  const data=await request('GET');
  if(data.submitted && data.order && !data.needsDetails){receipt(data.order);return;}
  if(data.needsDetails){
   status('Project Worth requested updated details. Please resubmit your selections and addresses.');
   open.disabled=false;open.textContent='Update welcome-kit details →';
   result.hidden=false;result.textContent='Please provide complete merchandise, shipping, and billing information.';
  }
  if(!data.approved){open.disabled=true;status('This form becomes available when Project Worth officially approves your facilitator status.');return;}
  open.disabled=false;
  status('Your facilitator status is approved. You may request your complimentary welcome kit.');
 }catch(e){open.disabled=true;status('Could not verify approval: '+e.message);}
}
open.addEventListener('click',()=>{
 if(open.disabled)return;
 panel.hidden=false;
 panel.scrollIntoView({behavior:'smooth',block:'start'});
 $('kitItem1')?.focus();
});
form.addEventListener('submit',async(e)=>{
 e.preventDefault();
 if(!form.reportValidity())return;
 const submit=$('kitSubmit');
 const value=id=>($(id)?.value||'').trim();
 const number=id=>Number($(id)?.value||'0');
 const payload={
  item1:value('kitItem1'),size1:value('kitSize1'),url1:value('kitUrl1'),
  item2:value('kitItem2'),size2:value('kitSize2'),url2:value('kitUrl2'),
  participantCount:number('kitAttendees'),pens:number('kitPens'),stickers:number('kitStickers'),
  recipient:value('kitRecipient'),address1:value('kitAddress1'),address2:value('kitAddress2'),
  city:value('kitCity'),state:value('kitState'),postal:value('kitPostal'),notes:value('kitNotes'),
  billingSameAsShipping:billingSame.checked,
  billingRecipient:value('kitBillingRecipient'),billingAddress1:value('kitBillingAddress1'),
  billingAddress2:value('kitBillingAddress2'),billingCity:value('kitBillingCity'),
  billingState:value('kitBillingState'),billingPostal:value('kitBillingPostal')
 };
 submit.disabled=true;
 result.hidden=false;
 result.textContent='Saving your request securely…';
 try{
  const saved=await request('POST',payload);
  if(!saved.saved)throw Error('The request was not confirmed.');
  result.textContent='Request '+saved.requestId+' received by Project Worth. We will review your two Spark Shop selections, participant materials, shipping address, and billing details before approving fulfillment. This is a request—not an automatically placed order.';
  form.hidden=true;
  open.textContent='Welcome-kit request received';
  open.disabled=true;
  status(saved.emailStatus==='sent'?'Kerri has been emailed about your request.':'Request saved. Project Worth will review it; the email notification may be pending.');
 }catch(error){
  result.textContent='Request was not confirmed: '+error.message+'. If you are unsure whether it saved, contact Project Worth before submitting again.';
 }finally{submit.disabled=false;}
});
refresh();
})();