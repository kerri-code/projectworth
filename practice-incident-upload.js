(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const pick = $('practiceIncidentPdf');
  const send = $('submitPracticeReport');
  const notice = $('practiceReportFeedback');
  if (!pick || !send || !notice) return;
  const setMessage = (msg,level='') => { notice.textContent=msg; notice.className='status '+level; notice.hidden=false; };
  function asBase64(file) {
    return new Promise((resolve,reject)=>{
      const r=new FileReader();
      r.onerror=()=>reject(Error('Unable to read the PDF. Save a copy and try again.'));
      r.onload=()=>resolve(String(r.result||'').split(',')[1]||'');
      r.readAsDataURL(file);
    });
  }
  send.addEventListener('click',async()=>{
    const file=pick.files && pick.files[0];
    if (!file) return setMessage('Choose your completed fictional Incident Documentation PDF.','error');
    if (file.size<50 || file.size>2200000 || !file.name.toLowerCase().endsWith('.pdf')) {
      return setMessage('Choose a valid PDF no larger than 2.2 MB.','error');
    }
    if (!$('practiceFictionalOnly')?.checked) {
      return setMessage('Confirm this is a fictional exercise with no real names or identifying details.','error');
    }
    const token=sessionStorage.getItem('pwInstituteIdToken');
    if (!token) return setMessage('Your session has expired. Please sign in again.','error');
    send.disabled=true; setMessage('Submitting your fictional practice PDF securely for Kerri and Zac to review…');
    try {
      if (await file.slice(0,5).text() !== '%PDF-') throw Error('The selected file is not a PDF.');
      const pdfBase64=await asBase64(file);
      const response=await fetch('https://t0pckriwia.execute-api.us-east-2.amazonaws.com/api/facilitator-training/practice-reports',{
        method:'POST', cache:'no-store',
        headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({fileName:file.name,pdfBase64,fictionalOnly:true})
      });
      const data=await response.json().catch(()=>({}));
      if (!response.ok || data.saved!==true || !data.reportId) {
        throw Error(data.error||'The server did not confirm submission.');
      }
      pick.value='';
      setMessage('Practice report submitted to the secure Facilitator Readiness review dashboard. Reference: '+data.reportId+'. Kerri or Zac can review your uploaded PDF.','good');
    } catch (error) {
      setMessage('Submission was not confirmed: '+error.message+'. If you are unsure whether it saved, ask Kerri or Zac to check before resubmitting.','error');
    } finally {send.disabled=false;}
  });
})();