/* Project Worth embedded portal panels: keep feature content while portal tabs use hashes. */
(function(){
 function initialize(){
  for(const name of ['learning','department']){
   const frame=document.querySelector('#pw-embedded-'+name);
   if(!frame)continue;
   frame.addEventListener('load',()=>{
    try{
     const doc=frame.contentDocument;
     if(!doc)return;
     const style=doc.createElement('style');
     style.textContent='body{background:transparent!important}.pw-topbar,.pw-portal>.pw-topbar,.pw-portal>.pw-shell>.pw-hero,.pw-portal>.pw-shell>.pw-tabs-wrap{display:none!important}.pw-shell>.pw-hero,.pw-shell>.pw-tabs-wrap,.pw-department-page .pw-topbar,.pw-department-page .pw-hero,.pw-department-page .pw-tabs-wrap{display:none!important}.pw-shell,.pw-department-page{min-height:0!important}.pw-main{max-width:100%!important;margin:0!important;padding:0!important}';
     doc.head.appendChild(style);
     const resize=()=>{const height=Math.max(500,doc.documentElement.scrollHeight,doc.body.scrollHeight);frame.style.height=(height+36)+'px'};
     resize();
     if(frame.contentWindow.ResizeObserver){const observer=new frame.contentWindow.ResizeObserver(resize);observer.observe(doc.body)}
     frame.contentWindow.addEventListener('resize',resize);
    }catch(_){frame.style.height='1100px'}
   });
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();