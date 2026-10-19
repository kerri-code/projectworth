(()=>{'use strict';
const $=id=>document.getElementById(id);
const input=$('actualIncidentPdf'),button=$('submitActualIncident'),feedback=$('actualIncidentFeedback');
if(!input||!button||!feedback)return;
const message=(s,status='')=>{feedback.textContent=s;feedback.className='status '+status;feedback.hidden=false;};
const asBase64=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error('Unable to read the selected PDF.'));reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'');reader.readAsDataURL(file);});
button.addEventListener('click',async()=>{
 const file=input.files?.[0];
 if(!file)return message('Please select your completed incident report PDF.','error');
 if(file.size<5||file.size>2200000||!file.name.toLowerCase().endsWith('.pdf'))return message('The PDF must be 2.2 MB or smaller.','error');
 const token=sessionStorage.getItem('pwInstituteIdToken');
 if(!token)return message('Your session has expired. Please sign in again.','error');
 button.disabled=true;message('Submitting privately. Please keep this window open…');
 try{
  if(await file.slice(0,5).text()!=='%PDF-')throw Error('The selected file is not a PDF.');
  const pdfBase64=await asBase64(file);
  const response=await fetch('https://t0pckriwia.execute-api.us-east-2.amazonaws.com/api/incident-reports',{method:'POST',cache:'no-store',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({fileName:file.name,pdfBase64})});
  const receipt=await response.json().catch(()=>({}));
  if(!response.ok||receipt.saved!==true)throw Error(receipt.error||'The submission was not confirmed.');
  input.value='';
  message('Submitted securely. Report reference: '+receipt.reportId+'. '+(receipt.notificationStatus==='Accepted by email service'?'Kerri and Zac have been notified by email.':'The report is stored, but email delivery was not confirmed. Contact Project Worth with the reference.'),'ok');
 }catch(err){message('Submission not confirmed: '+err.message+' Ask an administrator to check before retrying to avoid duplicate reports.','error');}
 finally{button.disabled=false;}
});
})();