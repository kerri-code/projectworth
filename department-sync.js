/* Project Worth shared department work | 2026-10-18 */
(() => {
  'use strict';
  const API='https://t0pckriwia.execute-api.us-east-2.amazonaws.com/api';
  const $=id=>document.getElementById(id);
  const token=sessionStorage.getItem('pwInstituteIdToken');
  if(!token)return;
  let claims={};
  try{claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))}catch(_){return}
  const me=String(claims.sub||'');
  const raw=claims['cognito:groups']||[];
  const groups=Array.isArray(raw)?raw:String(raw).replace(/[\[\]"]/g,'').split(',').map(v=>v.trim());
  let leader=['PW-FullAdmin','PW-Leadership','PW-DepartmentLead'].some(g=>groups.includes(g));
  let people=[],projects=[],tasks=[],activities=[],loaded=false,busy=false;
  const val=id=>String($(id)?.value||'').trim();
  function status(id,message){const x=$(id);if(x)x.textContent=message}
  function node(tag,content){const e=document.createElement(tag);if(content!==undefined)e.textContent=String(content);return e}
  async function api(path,method='GET',data){
    const response=await fetch(API+path,{method,cache:'no-store',headers:{Authorization:'Bearer '+sessionStorage.getItem('pwInstituteIdToken'),Accept:'application/json',...(data===undefined?{}:{'Content-Type':'application/json'})},body:data===undefined?undefined:JSON.stringify(data)});
    const json=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(json.error||'Workspace unavailable ('+response.status+').');
    return json;
  }
  function fill(id,items,prompt){
    const select=$(id);if(!select)return;
    const old=select.value;select.replaceChildren();
    if(prompt){const p=node('option',prompt);p.value='';select.appendChild(p)}
    items.forEach(item=>{const o=node('option',item.label);o.value=item.value;select.appendChild(o)});
    if([...select.options].some(o=>o.value===old))select.value=old;
  }
  function button(label,func){
    const b=node('button',label);b.type='button';b.className='pw-button soft';
    b.style.cssText='margin:6px 8px 0 0;min-height:36px;padding:7px 13px;font-size:.82rem;';
    b.addEventListener('click',func);return b;
  }
  function card(host,title,small,extra,actions){
    const box=node('div');box.className='pw-task-item';
    box.appendChild(node('strong',title));
    if(small)box.appendChild(node('small',small));
    if(extra)box.appendChild(node('small',extra));
    if(actions)actions(box);
    host.appendChild(box);
  }
  function draw(){
    const p=$('departmentProjectsList'),m=$('memberTaskList'),all=$('leadTaskTableWrap');
    if(!p||!m||!all)return;
    p.replaceChildren();m.replaceChildren();all.replaceChildren();
    const titles=new Map(projects.map(x=>[x.id,x.title]));
    if(!projects.length)p.appendChild(node('p','No current projects yet.'));
    projects.forEach(x=>card(p,x.title,x.summary,x.mission,box=>{
      if(leader)box.appendChild(button('Remove project',()=>remove(x.itemId)));
    }));
    const assigned=tasks.filter(t=>leader||t.assigneeUserId===me||t.assigneeUserId==='all');
    if(!assigned.length)m.appendChild(node('p','No tasks assigned yet.'));
    assigned.forEach(t=>card(m,t.title,t.kind==='training_assignment'?'Department learning assignment':titles.get(t.projectId)||'Department task',(t.status||'Assigned')+(t.due?' · Due '+t.due:''),box=>{
      if(t.status!=='Complete'&&(leader||t.assigneeUserId===me||t.assigneeUserId==='all'))box.appendChild(button('Mark Complete',()=>complete(t.itemId)));
    }));
    if(!tasks.length)all.appendChild(node('p','No tasks assigned yet.'));
    tasks.forEach(t=>card(all,t.title,'Assigned to '+(t.assignee||'Team')+' · '+(t.status||'Assigned'),t.due?'Due '+t.due:'',box=>{
      if(leader)box.appendChild(button('Remove',()=>remove(t.itemId)));
    }));
    const entries=people.filter(x=>x.userId&&x.name).map(x=>({label:x.name,value:x.userId}));
    fill('newProjectOwner',[{label:'Entire team',value:'all'},...entries]);
    fill('newTaskAssignee',[...entries,{label:'Entire team',value:'all'}],'Choose a teammate');
    fill('newTaskProject',projects.map(x=>({label:x.title,value:x.id})),'No specific project');
    fill('trainingAssignee',entries,'Select a teammate');
    const roster=$('memberTeamRoster');
    if(roster){roster.replaceChildren();people.forEach(x=>card(roster,x.name,x.role,''));status('memberTeamTitle',people.length+' member(s)')}
    const latest=activities.filter(x=>x.kind==='checkin').sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0];
    if(latest){
      status('monthlyContactRecent','Last recorded: '+latest.date+' · '+latest.method);
      status('teamContactMonthStatus',String(latest.date).slice(0,7)===new Date().toISOString().slice(0,7)?'Team check-in recorded this month':'Monthly check-in not yet recorded');
    }
    const previous=activities.filter(x=>x.kind==='meeting_details').sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0];
    if(previous&&!val('meetingTitle')&&!val('meetingAgenda')){
      Object.entries({title:'meetingTitle',schedule:'meetingSchedule',location:'meetingLocation',agenda:'meetingAgenda'}).forEach(([key,id])=>{if($(id))$(id).value=previous[key]||''});
    }
    const draft=activities.filter(x=>x.kind==='monthly_draft').sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0];
    if(draft&&!val('monthlyProgress')&&!val('monthlyNext')){
      Object.entries({date:'monthlyMeetingDate',progress:'monthlyProgress',next:'monthlyNext',support:'monthlySupport',notes:'monthlyNotes'}).forEach(([key,id])=>{if($(id))$(id).value=draft[key]||''});
    }
  }
  async function refresh(){
    if(busy||document.hidden)return;
    busy=true;status('departmentSyncStatus','Syncing your department…');
    try{
      const d=await api('/department/work');
      leader=Boolean(d.canLead);
      people=d.members||[];projects=d.projects||[];tasks=d.tasks||[];activities=d.activities||[];
      loaded=true;window.__pwDeptSynced=true;draw();
      status('departmentSyncStatus','Shared securely with your department · Updated '+new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}));
    }catch(e){status('departmentSyncStatus','Sync unavailable: '+e.message+' Your prior browser drafts have not been changed.')}
    finally{busy=false}
  }
  async function create(kind,payload,statusId,message){
    if(!loaded)return status(statusId,'Shared workspace is not connected; refresh before saving.');
    status(statusId,'Saving securely…');
    try{await api('/department/work','POST',{kind,payload});status(statusId,message||'Saved securely.');await refresh()}
    catch(e){status(statusId,e.message)}
  }
  async function remove(id){
    if(!confirm('Remove this item from the shared department workspace?'))return;
    try{await api('/department/work/'+encodeURIComponent(id),'DELETE');await refresh()}
    catch(e){status('departmentSyncStatus',e.message)}
  }
  async function complete(id){
    try{await api('/department/work/'+encodeURIComponent(id)+'/complete','POST',{});await refresh()}
    catch(e){status('departmentSyncStatus',e.message)}
  }
  const controls={
    saveDepartmentPlan:()=>{
      const title=val('leadProjectTitle');
      if(!title)return status('departmentPlanSaveStatus','Enter a project title.');
      create('project',{title,owner:val('newProjectOwner'),summary:val('leadProjectSummary'),mission:val('leadMissionConnection')},'departmentPlanSaveStatus','Project shared with your team.');
    },
    addDepartmentTask:()=>{
      const title=val('newTaskTitle'),assigneeUserId=val('newTaskAssignee');
      if(!title||!assigneeUserId)return status('taskSaveStatus','Enter a task and select a teammate.');
      create('task',{title,assigneeUserId,projectId:val('newTaskProject'),due:val('newTaskDue')},'taskSaveStatus','Task assigned; it now appears on the teammate’s My Tasks.');
    },
    saveMonthlyContact:()=>{
      const date=val('monthlyContactDate'),summary=val('monthlyContactSummary');
      if(!date||!summary)return status('monthlyContactSaveStatus','Enter a date and an update.');
      create('checkin',{date,summary,method:val('monthlyContactMethod'),next:val('monthlyContactNext')},'monthlyContactSaveStatus','Check-in recorded securely.');
    },
    saveMeeting:()=>create('meeting_details',{title:val('meetingTitle'),schedule:val('meetingSchedule'),location:val('meetingLocation'),agenda:val('meetingAgenda')},'meetingSaveStatus','Meeting details saved securely.'),
    saveMonthlyUpdate:()=>{
      if(!['monthlyProgress','monthlyNext','monthlySupport','monthlyNotes'].some(val))return status('monthlySaveStatus','Enter an update first.');
      create('monthly_draft',{date:val('monthlyMeetingDate'),progress:val('monthlyProgress'),next:val('monthlyNext'),support:val('monthlySupport'),notes:val('monthlyNotes')},'monthlySaveStatus','Draft saved securely. Use Email Update to send it to Kerri.');
    },
    saveTrainingProposal:()=>{
      if(!val('trainingProposalTitle'))return status('trainingProposalStatus','Enter a training title.');
      create('training_outline',{title:val('trainingProposalTitle'),know:val('trainingProposalKnow'),do:val('trainingProposalDo'),boundaries:val('trainingProposalBoundaries'),links:val('trainingProposalLinks'),notes:val('trainingProposalNotes')},'trainingProposalStatus','Outline saved securely. Attachments were not uploaded.');
    },
    assignTraining:()=>{
      const assigneeUserId=val('trainingAssignee');
      if(!assigneeUserId)return status('trainingSaveStatus','Select a teammate.');
      create('training_assignment',{assigneeUserId,course:val('trainingCourse')},'trainingSaveStatus','Learning task assigned in My Tasks. The course catalog is not yet linked.');
    },
    refreshSharedWork:refresh
  };
  function start(){
    const main=$('departmentPageMain');
    if(!main)return;
    document.addEventListener('click',event=>{
      const clicked=event.target instanceof Element?event.target.closest('button'):null;
      if(!clicked)return;
      const fn=controls[clicked.id];
      if(!fn)return;
      event.preventDefault();event.stopImmediatePropagation();
      if(!leader&&clicked.id!=='refreshSharedWork'){
        status('departmentSyncStatus','Department leadership access is required to assign or save shared work.');
        return;
      }
      fn();
    },true);
    function initIfReady(){if(main.hidden)return;observer.disconnect();refresh()}
    const observer=new MutationObserver(initIfReady);
    observer.observe(main,{attributes:true,attributeFilter:['hidden']});
    initIfReady();
    window.addEventListener('focus',()=>{if(loaded)refresh()});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&loaded)refresh()});
    window.setInterval(()=>{if(loaded&&!document.hidden)refresh()},90000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();