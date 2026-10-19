(() => {
'use strict';
const $=id=>document.getElementById(id);
const panel=$('panel-admin'),old=panel?.querySelector('.pw-admin-workspaces');
if(!panel||!old||$('pwAdminCompact'))return;
const blocks={
 people:$('teamTrainingStatus'),reviews:$('facilitatorReviewHub'),kits:$('adminWelcomeKitOrders'),
 create:$('adminMemberForm')?.closest('.pw-admin-block'),
 accounts:$('adminRefreshUsers')?.closest('.pw-admin-block'),
 proposals:$('adminRefreshTrainingProposals')?.closest('.pw-admin-block'),
 incidents:$('adminRefreshReports')?.closest('.pw-admin-block')
};
if(Object.values(blocks).some(x=>!x))return;
const wrap=document.createElement('div');wrap.id='pwAdminCompact';
wrap.innerHTML="<div class=\"pw-admin-compact-head\"><div class=\"pw-admin-small\">KERRI &amp; ZAC / ADMINISTRATION</div><h2>Your Project Worth, at a glance.</h2><p>See what needs a decision, support your people, and keep the work moving.</p></div>\n<nav class=\"pw-admin-switch\" aria-label=\"Admin dashboard sections\">\n<button type=\"button\" class=\"is-active\" data-admin-view=\"now\">Needs attention</button>\n<button type=\"button\" data-admin-view=\"people\">People &amp; training</button>\n<button type=\"button\" data-admin-view=\"projects\">Projects &amp; tasks</button>\n<button type=\"button\" data-admin-view=\"tools\">Admin tools</button></nav>\n<div data-admin-pane=\"now\" class=\"pw-admin-pane\">\n<div class=\"pw-admin-quick\">\n<button type=\"button\" data-admin-jump=\"people\"><strong>Team progress</strong><small>Learning &amp; member status →</small></button>\n<button type=\"button\" data-admin-jump=\"projects\"><strong>Department work</strong><small>Projects and assignments →</small></button>\n<button type=\"button\" data-admin-jump=\"tools\" data-admin-detail=\"pwAdminFoldKits\"><strong>Welcome kits</strong><small>Fulfillment requests →</small></button>\n<button type=\"button\" data-admin-jump=\"tools\" data-admin-detail=\"pwAdminFoldIncidents\"><strong>Incident reports</strong><small>Secure review →</small></button>\n</div><div id=\"pwAdminNowMount\"></div></div>\n<div data-admin-pane=\"people\" class=\"pw-admin-pane\" hidden>\n<div class=\"pw-admin-pane-intro\"><div><h3>People &amp; training</h3><p>One place for progress, readiness, and team support. Separate accounts remain separate records.</p></div><button type=\"button\" data-admin-jump=\"tools\" data-admin-detail=\"pwAdminFoldAccounts\">Manage accounts →</button></div><div id=\"pwAdminPeopleMount\"></div></div>\n<div data-admin-pane=\"projects\" class=\"pw-admin-pane\" hidden>\n<div class=\"pw-admin-pane-intro\"><div><h3>Projects &amp; tasks</h3><p>Assign meaningful work in your department. Tasks appear in teammates' My Department workspace.</p></div><a href=\"my-department.html\" target=\"_blank\" rel=\"noopener noreferrer\">Full department workspace ↗</a></div>\n<section id=\"pwAdminDeptWork\" class=\"pw-admin-block pw-admin-work\">\n<div class=\"pw-admin-work-top\"><strong id=\"pwAdminWorkDepartment\">Your department</strong><button type=\"button\" id=\"pwAdminWorkReload\">Refresh ↻</button></div>\n<p id=\"pwAdminWorkMessage\" role=\"status\">Loading shared department projects and tasks…</p>\n<div class=\"pw-admin-work-grid\">\n<form id=\"pwAdminProjectForm\"><h4>Add a project</h4>\n<label>Project title<input name=\"title\" maxlength=\"150\" required placeholder=\"What are we working toward?\"></label>\n<label>Project lead<select name=\"owner\" id=\"pwAdminOwner\"></select></label>\n<label>Goal<textarea name=\"summary\" rows=\"2\" maxlength=\"1200\" placeholder=\"The outcome we want\"></textarea></label>\n<label>Mission connection<input name=\"mission\" maxlength=\"500\" placeholder=\"How this helps protect children\"></label>\n<button type=\"submit\">Add project →</button></form>\n<form id=\"pwAdminTaskForm\"><h4>Assign a task</h4>\n<label>Task<input name=\"title\" maxlength=\"160\" required placeholder=\"A clear next step\"></label>\n<label>Assign to<select name=\"assigneeUserId\" id=\"pwAdminAssignee\" required></select></label>\n<label>Project<select name=\"projectId\" id=\"pwAdminTaskProject\"></select></label>\n<label>Due date<input name=\"due\" type=\"date\"></label>\n<button type=\"submit\">Assign task →</button></form></div>\n<div class=\"pw-admin-work-grid\"><div><h4>Projects <span id=\"pwAdminProjectCount\"></span></h4><div id=\"pwAdminProjects\"></div></div><div><h4>Assigned tasks <span id=\"pwAdminTaskCount\"></span></h4><div id=\"pwAdminTasks\"></div></div></div>\n</section></div>\n<div data-admin-pane=\"tools\" class=\"pw-admin-pane\" hidden><div class=\"pw-admin-pane-intro\"><div><h3>Admin tools</h3><p>Open what you need. Everything else stays out of the way.</p></div></div><div id=\"pwAdminToolsMount\"></div></div>";
old.before(wrap);
$('pwAdminNowMount').append(blocks.reviews);
$('pwAdminPeopleMount').append(blocks.people);
const descriptors=[
 ['kits','pwAdminFoldKits','Welcome-kit requests','Merchandise & participant supplies'],
 ['create','pwAdminFoldCreate','Create team account','New member invitation'],
 ['accounts','pwAdminFoldAccounts','Manage accounts','Roles, departments & access'],
 ['proposals','pwAdminFoldProposals','Training proposals','Review learning ideas'],
 ['incidents','pwAdminFoldIncidents','Confidential incident reports','Restricted safety review']
];
for(const [key,id,title,description] of descriptors){
 const details=document.createElement('details');details.id=id;details.className='pw-admin-compact-fold';
 const summary=document.createElement('summary'),name=document.createElement('strong'),text=document.createElement('span');
 name.textContent=title;text.textContent=description;summary.append(name,text);
 details.append(summary,blocks[key]);$('pwAdminToolsMount').append(details);
}
old.hidden=true;
function nav(view,detail){
 wrap.querySelectorAll('[data-admin-pane]').forEach(el=>{el.hidden=el.dataset.adminPane!==view});
 wrap.querySelectorAll('[data-admin-view]').forEach(el=>{const ok=el.dataset.adminView===view;el.classList.toggle('is-active',ok);el.setAttribute('aria-pressed',String(ok))});
 if(detail&&$(detail))$(detail).open=true;
 if(view==='projects')loadWork();
 wrap.scrollIntoView({block:'start',behavior:'smooth'});
}
wrap.addEventListener('click',e=>{
 const b=e.target.closest('[data-admin-view],[data-admin-jump]');
 if(b)nav(b.dataset.adminView||b.dataset.adminJump,b.dataset.adminDetail);
});
const api='https://t0pckriwia.execute-api.us-east-2.amazonaws.com/api/department/work';
let state=null,loading=false;
const el=(tag,value)=>{const e=document.createElement(tag);e.textContent=String(value||'');return e};
async function call(method,payload){
 const token=sessionStorage.getItem('pwInstituteIdToken');
 if(!token)throw Error('Sign in as a Project Worth administrator.');
 const r=await fetch(api,{method,cache:'no-store',
 headers:{Authorization:'Bearer '+token,Accept:'application/json',...(payload?{'Content-Type':'application/json'}:{})},
 ...(payload?{body:JSON.stringify(payload)}:{})});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(data.error||'Department workspace unavailable.');
 return data;
}
const select=(node,items,placeholder)=>{
 node.replaceChildren();
 if(placeholder){const o=el('option',placeholder);o.value='';node.append(o)}
 items.forEach(v=>{const o=el('option',v.label);o.value=v.value;node.append(o)});
};
function render(){
 if(!state)return;
 $('pwAdminWorkDepartment').textContent=state.department+' · '+(state.members?.length||0)+' member(s)';
 const people=(state.members||[]).filter(x=>x.userId&&x.name).map(x=>({value:x.userId,label:x.name+(x.role?' · '+x.role:'')}));
 const projects=state.projects||[],tasks=state.tasks||[];
 select($('pwAdminOwner'),[{label:'Entire department',value:'all'},...people]);
 select($('pwAdminAssignee'),people,'Choose a teammate');
 select($('pwAdminTaskProject'),projects.map(x=>({label:x.title,value:x.id})),'No project');
 $('pwAdminProjectCount').textContent='('+projects.length+')';
 $('pwAdminTaskCount').textContent='('+tasks.length+')';
 const p=$('pwAdminProjects'),t=$('pwAdminTasks');p.replaceChildren();t.replaceChildren();
 function add(host,title,subtitle){
  const box=el('div','');box.className='pw-admin-task-line';
  box.append(el('strong',title),el('small',subtitle));host.append(box);
 }
 if(!projects.length)p.append(el('p','No projects yet.'));
 projects.forEach(x=>add(p,x.title,x.summary||x.mission||''));
 if(!tasks.length)t.append(el('p','No tasks yet.'));
 tasks.forEach(x=>add(t,x.title,(x.assignee||'Department')+' · '+(x.status||'Assigned')+(x.due?' · Due '+x.due:'')));
}
async function loadWork(){
 if(loading)return;
 loading=true;$('pwAdminWorkMessage').textContent='Loading department work…';
 try{
  state=await call('GET');
  const canLead=state.canLead&&state.department?.toLowerCase()!=='to be assigned';
  $('pwAdminWorkMessage').textContent=canLead?'Assignments save to your department’s shared workspace.':'A department and leadership access are needed to assign work.';
  [$('pwAdminProjectForm'),$('pwAdminTaskForm')].forEach(f=>f.querySelectorAll('input,textarea,select,button').forEach(x=>{x.disabled=!canLead}));
  render();
 }catch(e){$('pwAdminWorkMessage').textContent=e.message}
 finally{loading=false}
}
async function save(kind,form){
 if(!form.reportValidity())return;
 const payload=Object.fromEntries(new FormData(form));
 $('pwAdminWorkMessage').textContent='Saving securely…';
 const button=form.querySelector('button[type=submit]');button.disabled=true;
 try{
  await call('POST',{kind,payload});
  form.reset();await loadWork();
  $('pwAdminWorkMessage').textContent=kind==='project'?'Project saved to your department.':'Task assigned in your teammate’s My Tasks.';
 }catch(e){$('pwAdminWorkMessage').textContent='Could not save: '+e.message}
 finally{button.disabled=false}
}
$('pwAdminWorkReload').addEventListener('click',loadWork);
$('pwAdminProjectForm').addEventListener('submit',e=>{e.preventDefault();save('project',e.currentTarget)});
$('pwAdminTaskForm').addEventListener('submit',e=>{e.preventDefault();save('task',e.currentTarget)});
})();