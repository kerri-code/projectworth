(()=>{'use strict';
const API='https://t0pckriwia.execute-api.us-east-2.amazonaws.com';
const DEPTS=['To Be Assigned','Administration','Project Worth Leadership','Training & Education','Community Outreach','Policy & Research','Survivor Advocacy and Support','Child Advocacy','Legal & Justice Advocacy','Marketing & Public Relations','Data & Systems','Personal Enrichment'];
const LEVELS=[['student','Student'],['team_member','Team Member'],['team_lead','Team Lead'],['leadership','Leadership Team'],['admin','Admin']];
const root=document.getElementById('pwPeopleManagement');if(!root)return;
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};
const field=(label,value,kind='text')=>{const box=el('label');box.className='pw-manager-field';box.appendChild(el('span',label));const inp=el('input');inp.type=kind;inp.value=value||'';box.appendChild(inp);return {box,input:inp}};
const select=(label,value,choices)=>{const box=el('label');box.className='pw-manager-field';box.appendChild(el('span',label));const inp=el('select');for(const [v,name] of choices){const o=el('option',name);o.value=v;inp.appendChild(o)}inp.value=value||choices[0][0];box.appendChild(inp);return {box,input:inp}};
let accounts=null,perms=null,active='directory';
async function req(path,method='GET',body){const token=await window.PWSession?.getToken?.();if(!token)throw Error('Sign in required');const r=await fetch(API+path,{method,cache:'no-store',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||d.message||'HTTP '+r.status);return d}
async function list(force=false){if(force||!accounts){const d=await req('/api/admin/members');accounts=d.members||[]}return accounts}
const status=(node,text,error=false)=>{node.textContent=text;node.className='pw-manager-status'+(error?' pw-manager-error':'')};
const tabs=root.querySelectorAll('[data-pw-manage]'),view=document.getElementById('pwPeopleManageView'),directory=document.getElementById('pwPeopleDirectoryExisting');
function show(which){active=which;directory.hidden=which!=='directory';view.hidden=which==='directory';tabs.forEach(b=>{b.classList.toggle('active',b.dataset.pwManage===which);b.setAttribute('aria-selected',String(b.dataset.pwManage===which))});if(which!=='directory')render(which)}
async function render(which){
 view.replaceChildren();const info=el('p','Loading verified Project Worth records…');view.appendChild(info);
 try{if(which==='accounts')await renderAccounts();else if(which==='departments')await renderDepartments();else if(which==='permissions')await renderPermissions()}
 catch(e){view.replaceChildren();status(view,'Unable to load: '+e.message,true)}
}
function card(title){const box=el('article');box.className='pw-manager-card';box.appendChild(el('h3',title));return box}
function btn(label,handler){const b=el('button',label);b.type='button';b.className='pw-manager-button';b.onclick=async()=>{b.disabled=true;try{await handler()}catch(e){alert(e.message)}finally{b.disabled=false}};return b}
function addFields(node,arr){const grid=el('div');grid.className='pw-manager-grid';for(const x of arr)grid.appendChild(x.box);node.appendChild(grid)}
async function renderAccounts(){
 const people=await list();view.replaceChildren();
 const head=el('div');head.className='pw-manager-head';head.append(el('h2','People & Accounts'));view.appendChild(head);const actions=el('div');actions.className='pw-manager-actions';actions.append(btn('Refresh from AWS',async()=>{await list(true);await renderAccounts()}),btn('+ Create user',async()=>newUser()));view.appendChild(actions);
 let sharedProfiles=[];try{const d=await req('/api/team-directory');sharedProfiles=Array.isArray(d)?d:(Array.isArray(d.members)?d.members:[])}catch(_){}
 const count=el('p',people.length+' live account(s). Only stored account data is shown.');count.className='pw-manager-muted';view.appendChild(count);
 for(const m of people){
  const c=card((m.name||'Unnamed')+' · '+(m.email||''));c.appendChild(el('p',(m.access||'Unassigned')+' · '+(m.enabled?'Active':'Inactive')));
  const shared=sharedProfiles.find(p=>(p.email&&m.email&&p.email.toLowerCase()===m.email.toLowerCase())||(p.name&&m.name&&p.name.trim().toLowerCase()===m.name.trim().toLowerCase()));if(shared){const box=el('div');box.className='pw-shared-profile';box.appendChild(el('strong','Shared profile information'));for(const [label,key] of [['Preferred name','preferredName'],['Location','location'],['Hometown','hometown'],['College or university','college'],['Field of study','fieldOfStudy'],['Interests and strengths','interests'],['About','about'],['Why Project Worth','why'],['Myers-Briggs','mbti'],['Enneagram','enneagram'],['Work appreciation','appreciation']]){const value=shared[key];if(value!==null&&value!==undefined&&String(value).trim()){const p=el('p');p.appendChild(el('strong',label+': '));p.appendChild(document.createTextNode(Array.isArray(value)?value.join(', '):String(value)));box.appendChild(p)}}if(box.children.length>1)c.appendChild(box)}
  if(m.access==='admin'){c.appendChild(el('p','Protected Admin account — edit through the privileged workflow.'));view.appendChild(c);continue}
  const parts=(m.name||'').trim().split(/\s+/);const f=field('First name',parts.shift()||''),l=field('Last name',parts.join(' ')),email=field('Email (read only)',m.email,'email'),title=field('Public position',m.role),dept=select('Department',m.department||'To Be Assigned',DEPTS.map(x=>[x,x])),level=select('Access level',m.access,LEVELS.filter(x=>x[0]!=='admin'||perms?.groups?.includes('admin')));
  email.input.readOnly=true;addFields(c,[f,l,email,title,dept,level]);
  const msg=el('p');msg.className='pw-manager-status';
  c.appendChild(btn('Save changes',async()=>{
   if(!f.input.value.trim()||!l.input.value.trim())throw Error('First and last name are required');
   if(level.input.value==='admin'||level.input.value==='team_lead'){status(msg,level.input.value==='admin'?'Admin access requires a separate privileged grant. No account changes were submitted.':'Team Lead access requires a department-scoped grant. No account changes were submitted.',true);return;}
   if(!confirm('Save updates for '+m.name+'?'))return;
   await req('/api/admin/members/'+encodeURIComponent(m.userId)+'/update','POST',{firstName:f.input.value.trim(),lastName:l.input.value.trim(),role:title.input.value.trim(),department:dept.input.value,teamLead:level.input.value==='leadership'?'Kerri Gerhardy':m.teamLead,access:level.input.value,enabled:m.enabled});
   accounts=null;status(msg,'Saved. Refresh to verify.');
  }));
  c.appendChild(btn('Resend invitation',async()=>{if(confirm('Resend invitation to '+m.email+'?')){await req('/api/admin/members/'+encodeURIComponent(m.userId)+'/resend','POST',{});status(msg,'Invitation request sent.')}}));
  c.appendChild(btn(m.enabled?'Deactivate':'Reactivate',async()=>{if(confirm('Change account status for '+m.name+'?')){await req('/api/admin/members/'+encodeURIComponent(m.userId)+'/'+(m.enabled?'deactivate':'reactivate'),'POST',{});accounts=null;await renderAccounts()}}));
  c.appendChild(msg);view.appendChild(c);
 }
}
function newUser(){
 const c=card('New user · Unsaved');const f=field('First name',''),l=field('Last name',''),email=field('Email','', 'email'),title=field('Public position',''),dept=select('Department','To Be Assigned',DEPTS.map(x=>[x,x])),access=select('Access level','team_member',LEVELS.filter(x=>x[0]!=='team_lead'&&x[0]!=='admin'));
 addFields(c,[f,l,email,title,dept,access]);f.input.onblur=l.input.onblur=async()=>{if(!f.input.value.trim()||!l.input.value.trim())return;const q=new URLSearchParams({firstName:f.input.value.trim(),lastName:l.input.value.trim()});try{const a=await req("/api/manage-users/lookup/positions?"+q),b=await req("/api/manage-users/lookup/contacts?"+q);if(a.matchStatus==="single")title.input.value=a.matches[0].title||"";if(b.matchStatus==="single")email.input.value=b.matches[0].email||""}catch(e){console.warn("Directory lookup unavailable",e.message)}};const msg=el('p');c.appendChild(btn('Create account & send invitation',async()=>{if(!f.input.value.trim()||!l.input.value.trim()||!email.input.value.trim())throw Error('First name, last name, and email required');if(!confirm('Create and invite '+email.input.value+'?'))return;await req('/api/admin/members','POST',{firstName:f.input.value.trim(),lastName:l.input.value.trim(),email:email.input.value.trim(),role:title.input.value.trim(),department:dept.input.value,access:access.input.value,teamLead:access.input.value==='leadership'?'Kerri Gerhardy':''});accounts=null;await renderAccounts()}));c.appendChild(msg);view.prepend(c);f.input.focus();
}
async function renderDepartments(){
 const people=await list();view.replaceChildren();const h=el('div');h.className='pw-manager-head';h.append(el('h2','Departments & People'),btn('Refresh from AWS',async()=>{await list(true);await renderDepartments()}));view.appendChild(h);
 view.appendChild(el('p','Actual stored account assignments only. No inferred memberships.'));
 const groups=new Map();for(const m of people){const key=m.department||'No department assigned';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(m)}
 for(const [dep,members] of [...groups].sort((a,b)=>a[0].localeCompare(b[0]))){const c=card(dep+' · '+members.length);for(const m of members)c.appendChild(el('p',(m.name||'Unnamed')+' · '+(m.email||'')+' · '+(m.access||'No access')));view.appendChild(c)}
}
async function renderPermissions(){
 view.replaceChildren();const mine=await req('/api/authorization-test/me');const h=card('Your access');h.appendChild(el('p',(mine.groups||[]).map(x=>x.replaceAll('_',' ')).join(' · ')||'No groups'));h.appendChild(el('p',(mine.globalPermissions||[]).includes('*')?'Organization-wide Admin access':'Department-scoped access'));view.appendChild(h);
 const c=card('Manage group grants');const picker=select('Select account','', [['','Choose account'],...(await list()).map(x=>[x.userId,x.name+' · '+x.email])]);c.appendChild(picker.box);const content=el('div');c.appendChild(content);view.appendChild(c);
 picker.input.onchange=async()=>{
  content.replaceChildren();if(!picker.input.value)return;
  const user=(await list()).find(x=>x.userId===picker.input.value);
  const grants=await req('/api/admin/members/'+encodeURIComponent(picker.input.value)+'/grants');
  for(const g of grants.grants||[])content.appendChild(el('p',g.group+' · '+(g.department||'Global')+' · '+g.status));
  if(user?.access==='admin'){content.appendChild(el('p','Protected Admin account.'));return}
  const group=select('Group','team_lead',[['team_lead','Team Lead'],['leadership_team','Leadership Team'],['team_member','Team Member'],['student','Student']]),scope=select('Department','To Be Assigned',DEPTS.map(x=>[x,x]));addFields(content,[group,scope]);
  for(const action of ['grant','revoke'])content.appendChild(btn(action==='grant'?'Grant group':'Revoke group',async()=>{if(!confirm(action+' '+group.input.value+' for '+user.name+'?'))return;await req('/api/admin/members/'+encodeURIComponent(user.userId)+'/grants','POST',{group:group.input.value,department:group.input.value==='team_lead'?scope.input.value:'',action});await picker.input.onchange()}));
 };
}
(async()=>{
 try{perms=await req('/api/authorization-test/me');if(!(perms.groups||[]).includes('admin')&&!(perms.globalPermissions||[]).includes('*'))return;
 root.querySelectorAll('[data-pw-manage="directory"],[data-pw-manage="permissions"]').forEach(node=>node.remove());root.hidden=false;tabs.forEach(b=>b.addEventListener('click',()=>show(b.dataset.pwManage)));
 const wanted=new URLSearchParams(location.search).get('peopleView');show(wanted==='departments'?'departments':'accounts');
 }catch(_){root.hidden=true}
})();
})();