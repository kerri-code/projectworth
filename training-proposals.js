/* Project Worth | secure training proposal submissions & administrative review */
(() => {
  'use strict';
  const API='https://t0pckriwia.execute-api.us-east-2.amazonaws.com/api';
  const $=id=>document.getElementById(id);
  const get=id=>String($(id)?.value||'').trim();
  const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);return e;};
  async function call(path,method='GET',body){
    const token=sessionStorage.getItem('pwInstituteIdToken');
    if(!token)throw Error('Please sign in again to continue.');
    const r=await fetch(API+path,{
      method,cache:'no-store',
      headers:{Authorization:'Bearer '+token,Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'})},
      body:body===undefined?undefined:JSON.stringify(body)
    });
    const result=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(result.error||'The request could not be completed.');
    return result;
  }
  const idKey='pwPendingTrainingProposalId';
  function id(){
    let value=sessionStorage.getItem(idKey);
    if(!value||!/^[A-Za-z0-9_-]{12,80}$/.test(value)){
      value='PW'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2)).replace(/-/g,'');
      sessionStorage.setItem(idKey,value);
    }
    return value;
  }
  function newId(){
    sessionStorage.removeItem(idKey);
    return id();
  }
  function initSubmit(){
    const form=$('trainingProposalSubmissionForm');
    if(!form)return;
    const button=$('trainingProposalSubmitButton');
    const status=$('trainingProposalSubmitStatus');
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if(!form.reportValidity())return;
      button.disabled=true;
      status.textContent='Submitting your proposal securely…';
      try{
        const receipt=await call('/training-proposals','POST',{
          submissionId:id(),
          title:get('proposalTitle'),
          audience:get('proposalAudience'),
          purpose:get('proposalPurpose'),
          learningGoals:get('proposalGoals'),
          boundaries:get('proposalBoundaries'),
          resourceLink:get('proposalResource'),
          notes:get('proposalNotes')
        });
        if(!receipt.saved)throw Error('The proposal was not confirmed.');
        const note=receipt.notificationStatus==='accepted'
          ? 'An email copy was accepted for Kerri.'
          : receipt.notificationStatus==='failed'
            ? 'The proposal is saved, but the email notification could not be confirmed. Contact Kerri with the reference.'
            : 'Your proposal is on file.';
        status.textContent='Proposal received · '+receipt.reference+'. '+note+' Kerri and Zac can review it in the Admin Dashboard.';
        newId();
        form.reset();
      }catch(error){
        status.textContent='Submission not confirmed: '+error.message+' Check with an administrator before retrying.';
      }finally{button.disabled=false;}
    });
  }
  function makeLabel(title,input){
    const label=el('label',title);
    label.style.cssText='display:grid;gap:5px;font-weight:650;font-size:.9rem;flex:1;min-width:185px';
    label.appendChild(input);
    return label;
  }
  async function refresh(){
    const list=$('adminTrainingProposalsList');
    const status=$('adminTrainingProposalsStatus');
    if(!list||!status)return;
    status.textContent='Loading submitted proposals…';
    try{
      const data=await call('/training-proposals');
      list.replaceChildren();
      const proposals=Array.isArray(data.proposals)?data.proposals:[];
      if(!proposals.length)list.appendChild(el('p','No training proposals submitted yet.'));
      for(const proposal of proposals){
        const card=el('article');
        card.style.cssText='margin:14px 0;padding:16px;border:1px solid #e1cca1;border-radius:14px;background:#fffaf3';
        const title=el('h4',proposal.title||'Untitled training proposal');
        title.style.cssText='margin:0 0 6px;color:#0f3158';
        card.appendChild(title);
        const meta=el('p',(proposal.submitterName||'Team member')+' · '+(proposal.department||'Unassigned')+' · '+(proposal.submittedAt?new Date(proposal.submittedAt).toLocaleDateString():'Date unavailable'));
        meta.style.cssText='font-size:.86rem;color:#4d6070;margin:0 0 12px';
        card.appendChild(meta);
        const rows=[
          ['Audience',proposal.audience],
          ['Purpose',proposal.purpose],
          ['Learning goals',proposal.learningGoals],
          ['Safety boundaries',proposal.boundaries],
          ['Additional notes',proposal.notes]
        ];
        for(const [label,value] of rows){
          if(!value)continue;
          const p=el('p');
          p.style.cssText='margin:7px 0;white-space:pre-wrap;overflow-wrap:anywhere';
          p.appendChild(el('strong',label+': '));
          p.appendChild(document.createTextNode(value));
          card.appendChild(p);
        }
        if(proposal.resourceLink){
          const p=el('p');
          const a=el('a','Supporting resource ↗');
          a.href=proposal.resourceLink;
          a.target='_blank';
          a.rel='noopener noreferrer';
          p.appendChild(a);
          card.appendChild(p);
        }
        const fields=el('div');
        fields.style.cssText='display:flex;flex-wrap:wrap;gap:14px;margin:12px 0';
        const select=el('select');
        ['New','In Review','Approved','Needs Changes'].forEach(v=>{
          const option=el('option',v);
          option.value=v;
          if(v===proposal.status)option.selected=true;
          select.appendChild(option);
        });
        select.style.cssText='padding:9px;border:1px solid #cfbb95;border-radius:8px';
        fields.appendChild(makeLabel('Review status',select));
        const input=el('input');
        input.value=proposal.reviewNote||'';
        input.maxLength=1000;
        input.placeholder='Internal review notes (optional)';
        input.style.cssText='padding:9px;border:1px solid #cfbb95;border-radius:8px;width:100%';
        fields.appendChild(makeLabel('Internal note',input));
        card.appendChild(fields);
        const save=el('button','Save Review Status');
        save.type='button';
        save.className='pw-button soft';
        const resultText=el('p');
        resultText.style.cssText='font-size:.84rem;margin:8px 0 0';
        save.addEventListener('click',async()=>{
          save.disabled=true;
          resultText.textContent='Saving review…';
          try{
            await call('/training-proposals/'+encodeURIComponent(proposal.itemId)+'/review','POST',{
              status:select.value,reviewNote:input.value.trim()
            });
            resultText.textContent='Review saved securely.';
          }catch(error){resultText.textContent=error.message;}
          finally{save.disabled=false;}
        });
        card.appendChild(save);
        card.appendChild(resultText);
        list.appendChild(card);
      }
      status.textContent=proposals.length+' proposal'+(proposals.length===1?'':'s')+' available for review.';
    }catch(error){status.textContent=error.message;}
  }
  function start(){
    initSubmit();
    const button=$('adminRefreshTrainingProposals');
    if(button)button.addEventListener('click',refresh);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();