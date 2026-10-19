(() => {
'use strict';
const $=id=>document.getElementById(id);
const pane=$('panel-admin'),refresh=$('refreshWelcomeKitOrders'),list=$('welcomeKitOrdersList'),status=$('welcomeKitOrdersStatus');
if(!pane||!refresh||!list||!status)return;
const API='https://t0pckriwia.execute-api.us-east-2.amazonaws.com/api/facilitator-welcome-kit/admin';
let busy=false;
const token=()=>sessionStorage.getItem('pwInstituteIdToken')||'';
async function send(path,method='GET',payload) {
 const r=await fetch(API+path,{method,cache:'no-store',headers:{Authorization:'Bearer '+token(),Accept:'application/json',...(payload?{'Content-Type':'application/json'}:{})},...(payload?{body:JSON.stringify(payload)}:{})});
 const d=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(d.error||'Project Worth could not complete the request.');
 return d;
}
function line(parent,title,value){
 const p=document.createElement('p');p.style.margin='5px 0';
 const b=document.createElement('strong');b.textContent=title+': ';
 p.append(b,document.createTextNode(String(value||'—')));parent.append(p);
}
function addr(o,prefix){
 if(prefix==='billing'){
  return [o.billingRecipient,o.billingAddress1,o.billingAddress2,[o.billingCity,o.billingState,o.billingPostal].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
 }
 return [o.recipient,o.address1,o.address2,[o.city,o.state,o.postal].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
}
const complete=o=>Boolean(o.item1&&o.item2&&o.item1!=='Selection to coordinate'&&o.recipient&&o.address1&&o.city&&o.state&&o.postal&&o.billingRecipient&&o.billingAddress1&&o.billingCity&&o.billingState&&o.billingPostal&&typeof o.billingSameAsShipping==='boolean');
function action(parent,label,act,o,cls){
 const b=document.createElement('button');b.type='button';b.textContent=label;b.className='pw-button '+(cls||'soft');
 b.style.cssText='margin:8px 8px 2px 0;min-height:36px;padding:8px 12px;font-size:12px;';
 b.addEventListener('click',async()=>{
  if(act==='approve'&&!complete(o)){status.textContent='This request needs complete selections and billing/shipping details before it can be approved.';return}
  const prompt=act==='approve'?'Approve this complete kit request for fulfillment? This does NOT place an order.':act==='fulfilled'?'Confirm that the items were ordered or fulfilled?':'Return this request for updated merchandise or address details?';
  if(!confirm(prompt))return;
  const note=act==='needs_details'?window.prompt('What information should the member update? (Optional)'):'';
  if(act==='needs_details'&&note===null)return;
  b.disabled=true;status.textContent='Saving welcome-kit review…';
  try{
   await send('/review','POST',{requestId:o.requestId,action:act,note:note||''});
   await load();
   status.textContent='Welcome-kit request updated. '+(act==='approve'?'Approved for fulfillment. No order was placed.':act==='fulfilled'?'Marked fulfilled.':'Member can update their request.');
  }catch(e){status.textContent='Unable to update: '+e.message;b.disabled=false;}
 });
 parent.append(b);
}
function orderCard(order){
 const leader=order.requestType==='leadership',ready=complete(order);
 const box=document.createElement('article');box.className='pw-kit-admin-order';
 const h=document.createElement('h4');h.textContent=(leader?'Leadership':'Facilitator')+' · '+(order.name||'Project Worth member');box.append(h);
 const flag=document.createElement('p');
 flag.style.cssText='font-weight:800;color:#997122;margin:3px 0 10px';
 flag.textContent=order.status==='approved_for_fulfillment'?'Approved for fulfillment':order.status==='fulfilled'?'Fulfilled':order.status==='needs_details'||!ready?'Needs merchandise / address details':'Awaiting your approval';
 box.append(flag);
 line(box,'Request',order.requestId);
 line(box,'Submitted',order.submittedAt?new Date(order.submittedAt).toLocaleString():'');
 line(box,'Email',order.email);
 line(box,'Spark Shop item 1',(order.item1==='Selection to coordinate'?'Not yet selected':order.item1||'Not provided')+(order.size1?' · '+order.size1:''));
 line(box,'Spark Shop item 2',(order.item2==='Selection to coordinate'?'Not yet selected':order.item2||'Not provided')+(order.size2?' · '+order.size2:''));
 for(const [num,key] of [[1,'url1'],[2,'url2']]){
  if(order[key]&&/^https:\/\//i.test(order[key])){
   const p=document.createElement('p');const a=document.createElement('a');
   a.href=order[key];a.target='_blank';a.rel='noopener noreferrer';a.textContent='View Spark Shop item '+num+' ↗';p.append(a);box.append(p);
  }
 }
 line(box,'Shipping address',addr(order));
 line(box,'Billing address',order.billingSameAsShipping?'Same as shipping · '+addr(order,'billing'):addr(order,'billing'));
 if(leader)line(box,'Included','Two Spark Shop items + Project Worth Leader Swag Box');
 else{
  line(box,'Facilitator certificate',order.certificateId);
  line(box,'Participant materials',(order.pens??0)+' pens · '+(order.stickers??0)+' stickers · '+(order.participantCount??0)+' participants');
 }
 if(order.notes)line(box,'Delivery notes',order.notes);
 if(order.reviewNote)line(box,'Reviewer notes',order.reviewNote);
 line(box,'Notification to Kerri',order.notificationSentAt?'Sent':'Not confirmed');
 const actions=document.createElement('div');
 actions.style.marginTop='12px';
 if(order.status==='approved_for_fulfillment'){
  action(actions,'Mark Fulfilled ✓','fulfilled',order,'gold');
  action(actions,'Request Changes','needs_details',order);
 }else if(order.status==='fulfilled')line(actions,'Status','Completed');
 else{
  if(ready)action(actions,'Approve for Fulfillment ✓','approve',order,'gold');
  action(actions,'Request Changes','needs_details',order);
  if(!ready)line(actions,'Before approval','The member must enter both selections and complete shipping and billing details.');
 }
 box.append(actions);return box;
}
async function load(){
 if(busy)return;
 busy=true;refresh.disabled=true;status.textContent='Loading secure welcome-kit requests…';
 try{
  if(!token())throw Error('Sign into your Project Worth admin account.');
  const d=await send('');
  const orders=Array.isArray(d.orders)?d.orders:[];
  list.replaceChildren();
  const pending=orders.filter(o=>o.status!=='fulfilled'&&o.status!=='approved_for_fulfillment');
  status.textContent=orders.length?pending.length+' request(s) awaiting attention · '+orders.length+' total. These are fulfillment requests, not shop orders.':'No welcome-kit requests yet.';
  orders.sort((a,b)=>{const stage=x=>x.status==='requested'?0:x.status==='needs_details'?1:x.status==='approved_for_fulfillment'?2:3;return stage(a)-stage(b)});
  orders.forEach(o=>list.append(orderCard(o)));
 }catch(e){status.textContent='Unable to load kit requests: '+e.message}
 finally{busy=false;refresh.disabled=false;}
}
refresh.addEventListener('click',load);
const observer=new MutationObserver(()=>{if(!pane.hidden&&!busy)load()});
observer.observe(pane,{attributes:true,attributeFilter:['hidden','class']});
if(!pane.hidden)load();
})();