(function(){
'use strict';
if(window.PWSession)return;
const keys=['pwInstituteIdToken','pwInstituteAccessToken','pwInstituteExpiresAt','pwCognitoClientId'];
let channel=null;
try{channel=new BroadcastChannel('pw-institute-session-v1')}catch(_){}
function current(){
 const id=sessionStorage.getItem(keys[0]);
 const expires=Number(sessionStorage.getItem(keys[2])||0);
 if(!id||expires<=Date.now()+10000)return null;
 return {id,access:sessionStorage.getItem(keys[1])||'',expires,client:sessionStorage.getItem(keys[3])||''};
}
function accept(data){
 if(!data||!data.id||!Number.isFinite(data.expires)||data.expires<=Date.now()+10000)return false;
 if(current())return true;
 sessionStorage.setItem(keys[0],data.id);
 if(data.access)sessionStorage.setItem(keys[1],data.access);
 sessionStorage.setItem(keys[2],String(data.expires));
 if(data.client)sessionStorage.setItem(keys[3],data.client);
 return true;
}
const pending=new Map();
if(channel)channel.onmessage=function(event){
 const d=event.data||{};
 if(d.type==='request'){
  const session=current();
  if(session)channel.postMessage({type:'response',requestId:d.requestId,session});
 }else if(d.type==='response'){
  const resolve=pending.get(d.requestId);
  if(resolve&&accept(d.session)){pending.delete(d.requestId);resolve(current())}
 }else if(d.type==='logout'){
  keys.forEach(k=>sessionStorage.removeItem(k));
 }
};
function getSession(waitMs=420){
 const existing=current();
 if(existing)return Promise.resolve(existing);
 if(!channel)return Promise.resolve(null);
 const requestId=(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random());
 return new Promise(resolve=>{
  const timer=setTimeout(()=>{pending.delete(requestId);resolve(current())},waitMs);
  pending.set(requestId,s=>{clearTimeout(timer);resolve(s)});
  channel.postMessage({type:'request',requestId});
 });
}
function loginUrl(){return 'institute-login.html?returnTo='+encodeURIComponent(location.pathname+location.search+location.hash)}
function signOut(){keys.forEach(k=>sessionStorage.removeItem(k));sessionStorage.removeItem('pwInstituteRefreshToken');if(channel)channel.postMessage({type:'logout'})}
window.PWSession={getSession,getToken:async()=>{const s=await getSession();return s?s.id:null},loginUrl,signOut};
})();