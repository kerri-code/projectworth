/* Project Worth · secured admin dashboard wiring · 2026-10-18 */
(function () {
  'use strict';
  const API='https://t0pckriwia.execute-api.us-east-2.amazonaws.com';
  const $=id=>document.getElementById(id);
  const txt=(id,value)=>{const el=$(id);if(el)el.textContent=String(value||'');};
  const elem=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=String(value);return n;};
  async function request(path,method='GET',body) {
    const token=sessionStorage.getItem('pwInstituteIdToken');
    if(!token)throw Error('Please sign in.');
    const response=await fetch(API+path,{method,cache:'no-store',headers:{Authorization:'Bearer '+token,Accept:'application/json','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(result.error||'Request failed ('+response.status+').');
    return result;
  }
  function capture(el,event,fn) {
    if(el)el.addEventListener(event,e=>{e.preventDefault();e.stopImmediatePropagation();fn(e);},true);
  }
  function input(label,value) {
    const l=elem('label',label);
    l.style.cssText='display:grid;gap:5px;min-width:125px;flex:1;font-size:.82rem;font-weight:700';
    const n=elem('input');n.value=value||'';n.maxLength=120;n.style.cssText='width:100%;min-width:0;padding:9px;border:1px solid #d8c89a;border-radius:9px';
    l.appendChild(n);return {wrap:l,input:n};
  }
  async function loadMembers() {
    const list=$('adminMembersList');if(!list)return;
    txt('adminMembersStatus','Loading accounts…');
    try{
      const data=await request('/api/admin/members');list.replaceChildren();
      const members=Array.isArray(data.members)?data.members:[];
      for(const m of members){
        const card=elem('div');card.style.cssText='border:1px solid #e0d2ad;border-radius:14px;padding:16px;margin:12px 0;background:#fff';
        card.appendChild(elem('strong',m.name+' · '+m.email));
        const meta=elem('p',(m.status||'Unknown')+' · '+(m.enabled?'Active':'Deactivated'));
        meta.style.cssText='font-size:.86rem;font-weight:750;color:'+(m.enabled?'#35556d':'#a04726');
        card.appendChild(meta);
        if(m.access==='admin'){
          card.appendChild(elem('small','Protected administrator account'));list.appendChild(card);continue;
        }
        const fields=elem('div');fields.style.cssText='display:flex;flex-wrap:wrap;gap:10px;margin:10px 0';
        const role=input('Position',m.role),dept=input('Department',m.department),lead=input('Team lead',m.teamLead);
        [role,dept,lead].forEach(v=>fields.appendChild(v.wrap));
        const accessLabel=elem('label','Access');accessLabel.style.cssText='display:grid;gap:5px;min-width:125px;flex:1';
        const access=elem('select');
        [['team_member','Team Member'],['student','Student'],['leadership','Leadership'],['facilitator','Facilitator']].forEach(pair=>{const o=elem('option',pair[1]);o.value=pair[0];o.selected=pair[0]===m.access;access.appendChild(o)});
        accessLabel.appendChild(access);fields.appendChild(accessLabel);card.appendChild(fields);
        const status=elem('p');status.style.fontSize='.83rem';
        const controls=elem('div');controls.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
        const button=(label,fn)=>{const b=elem('button',label);b.type='button';b.className='pw-button soft';b.addEventListener('click',fn);controls.appendChild(b)};
        const payload=enabled=>({role:role.input.value,department:dept.input.value,teamLead:lead.input.value,access:access.value,enabled});
        button('Save changes',async()=>{try{await request('/api/admin/members/'+encodeURIComponent(m.userId)+'/update','POST',payload(m.enabled));status.textContent='Saved. Access changes take effect on next sign-in.'}catch(e){status.textContent=e.message}});
        button('Resend setup invitation',async()=>{if(!confirm('Resend setup invitation to '+m.email+'?'))return;try{await request('/api/admin/members/'+encodeURIComponent(m.userId)+'/resend','POST');status.textContent='Invitation sent.'}catch(e){status.textContent=e.message}});
        // Reversible deactivation: preserve user records and training history.
        button(m.enabled ? 'Deactivate Account' : 'Reactivate Account', async()=>{
          const action=m.enabled ? 'deactivate' : 'reactivate';
          const question=m.enabled
            ? 'Deactivate '+m.name+' ('+m.email+')?\\n\\nThey will no longer be able to sign in. Their profile, learning history, and assignments will be preserved. You can reactivate them later.'
            : 'Reactivate '+m.name+' ('+m.email+') and restore sign-in access?';
          if(!confirm(question))return;
          status.textContent=m.enabled ? 'Deactivating account…' : 'Reactivating account…';
          try{
            const response=await request('/api/admin/members/'+encodeURIComponent(m.userId)+'/'+action,'POST',{});
            await loadMembers();
            txt('adminMembersStatus',(response.message || 'Account status updated.')+' · Account list refreshed.');
          }catch(e){status.textContent=e.message}
        });
        card.appendChild(controls);card.appendChild(status);list.appendChild(card);
      }
      txt('adminMembersStatus',members.length+' accounts loaded.');
    }catch(e){txt('adminMembersStatus',e.message)}
  }
  let selectedReport='';
  async function loadReports() {
    const list=$('adminIncidentList');if(!list)return;
    txt('adminIncidentStatus','Loading reports…');
    try{
      const d=await request('/api/incident-reports');const reports=d.reports||[];list.replaceChildren();
      if(!reports.length)list.appendChild(elem('p','No submitted incident reports.'));
      for(const item of reports){
        const b=elem('button',item.reportId+' · '+item.status);b.type='button';b.className='pw-button soft';b.style.margin='6px';
        b.addEventListener('click',async()=>{
          try{
            const d=await request('/api/incident-reports/'+encodeURIComponent(item.reportId));selectedReport=item.reportId;
            txt('adminIncidentDetailTitle','Report '+item.reportId);txt('adminIncidentMetadata','Submitted: '+d.report.submittedAt+' · Reporter: '+d.report.reporterEmail);
            $('adminIncidentCurrentStatus').value=d.report.status;$('adminIncidentDetails').hidden=false;$('adminIncidentDownload').hidden=true;
            const download=await request('/api/incident-reports/'+encodeURIComponent(item.reportId)+'/download');
            if(download.downloadUrl){$('adminIncidentDownload').href=download.downloadUrl;$('adminIncidentDownload').hidden=false;$('adminIncidentDownload').referrerPolicy='no-referrer'}
          }catch(e){txt('adminIncidentStatus',e.message)}
        });list.appendChild(b);
      }
      txt('adminIncidentStatus',reports.length+' report(s) available.');
    }catch(e){txt('adminIncidentStatus',e.message)}
  }
  function init() {
    const departments=$('adminDepartment');
    if(departments&&!departments.options.length){
      ['To Be Assigned','Administration','Training & Education','Community Outreach','Policy & Research','Survivor Advocacy and Support','Child Advocacy','Legal & Justice Advocacy','Marketing & Public Relations','Personal Enrichment'].forEach(v=>{const o=elem('option',v);o.value=v;departments.appendChild(o)});
    }
    if($('adminAccess'))$('adminAccess').addEventListener('change',()=>{if($('adminAccess').value==='student'){$('adminRole').value='Student';$('adminDepartment').value='Personal Enrichment'}});
    if($('adminCreateMember'))$('adminCreateMember').disabled=false;
    txt('adminCreationStatus','Create an account only after approving access.');
    txt('adminMembersStatus','Refresh to view accounts.');
    txt('adminIncidentStatus','Refresh to review confidential reports.');
    capture($('adminMemberForm'),'submit',async()=>{
      const button=$('adminCreateMember');button.disabled=true;txt('adminCreationStatus','Creating account…');
      try{
        const d=await request('/api/admin/members','POST',{
          firstName:$('adminFirstName').value.trim(),lastName:$('adminLastName').value.trim(),
          email:$('adminEmail').value.trim(),department:$('adminDepartment').value,
          role:$('adminRole').value.trim(),teamLead:$('adminTeamLead').value.trim(),
          access:$('adminAccess').value
        });
        txt('adminCreationStatus',d.emailStatus==='failed'?'Account created but invitation delivery was not confirmed. Do not create it again; use Resend.':d.message||'Account created.');
        $('adminMemberForm').reset();await loadMembers();
      }catch(e){txt('adminCreationStatus',e.message)}finally{button.disabled=false}
    });
    capture($('adminRefreshUsers'),'click',loadMembers);
    capture($('adminRefreshReports'),'click',loadReports);
    capture($('adminIncidentUpdate'),'click',async()=>{
      if(!selectedReport)return;
      try{
        await request('/api/incident-reports/'+encodeURIComponent(selectedReport)+'/update','POST',{status:$('adminIncidentCurrentStatus').value,note:'Reviewed by Project Worth administrator.'});
        txt('adminIncidentSaveStatus','Review status saved.');await loadReports();
      }catch(e){txt('adminIncidentSaveStatus',e.message)}
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();