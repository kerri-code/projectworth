(()=>{"use strict";
const API="https://t0pckriwia.execute-api.us-east-2.amazonaws.com/api/messenger";
const token=()=>sessionStorage.getItem("pwInstituteIdToken");
if(!token()||location.protocol==="file:")return;
let myId="";try{const p=token().split(".")[1];myId=JSON.parse(atob(p.replace(/-/g,"+").replace(/_/g,"/"))).sub||""}catch(_){return}
const style=document.createElement("style");
style.textContent=`
#pwm-root{position:fixed;right:20px;bottom:0;z-index:9999;font-family:system-ui,-apple-system,sans-serif;color:#112c4d}
#pwm-launch{background:#102c4e;color:white;border:2px solid #d8b346;border-radius:14px 14px 0 0;padding:12px 17px;cursor:pointer;box-shadow:0 0 17px #0003;font-weight:700;min-width:180px;text-align:left}
#pwm-window{height:min(510px,70vh);width:min(360px,94vw);background:#fff;border:2px solid #d8b346;box-shadow:0 0 20px #0003;border-radius:15px 15px 0 0;display:flex;flex-direction:column;overflow:hidden}
#pwm-window[hidden]{display:none}
#pwm-header{background:#112f55;color:#fff;padding:13px;display:flex;align-items:center;justify-content:space-between}
#pwm-back,#pwm-close{background:transparent;color:#fff;border:0;cursor:pointer;font-size:18px;padding:2px 8px}
#pwm-list,#pwm-messages{overflow:auto;flex:1;padding:12px}
.pwm-person{display:block;width:100%;padding:12px 8px;background:#fff;border:0;border-bottom:1px solid #e0e6ec;text-align:left;color:#123456;cursor:pointer}
.pwm-person:hover{background:#f5f6f8}
.pwm-person small{display:block;color:#64748b;font-size:11px}
.pwm-msg{margin:8px 0;display:flex}.pwm-msg.mine{justify-content:flex-end}
.pwm-bubble{border-radius:14px;padding:10px 12px;max-width:82%;overflow-wrap:anywhere;background:#eef1f5;white-space:pre-wrap;font-size:14px}
.pwm-msg.mine .pwm-bubble{background:#173b66;color:white}
#pwm-compose{border-top:1px solid #ddd;padding:10px;display:flex;gap:7px}
#pwm-text{min-width:0;flex:1;border:1px solid #a5acb6;border-radius:20px;padding:10px;font:inherit}
#pwm-send{background:#173b66;color:white;border:0;border-radius:20px;padding:9px 12px;cursor:pointer}
#pwm-status{padding:8px 12px;font-size:12px;color:#5b6673}
#pwm-search{margin:9px;border:1px solid #a5acb6;border-radius:8px;padding:9px}
@media(max-width:600px){#pwm-root{right:0;left:0}#pwm-launch{float:right;min-width:170px;margin-right:8px}#pwm-window{height:85dvh;width:100%;border-radius:16px 16px 0 0}}
`;
document.head.appendChild(style);
const root=document.createElement("div");root.id="pwm-root";
root.innerHTML=`<button type="button" id="pwm-launch" aria-expanded="false">✦ Team Messages</button>
<section id="pwm-window" hidden aria-label="Private Project Worth messages">
<div id="pwm-header"><button type="button" id="pwm-back" hidden aria-label="Back to members">‹</button><strong id="pwm-title">Team Messages</strong><button id="pwm-close" type="button" aria-label="Close messages">×</button></div>
<input id="pwm-search" placeholder="Find a team member" aria-label="Search team members">
<div id="pwm-list"></div><div id="pwm-messages" hidden role="log" aria-live="polite"></div>
<div id="pwm-status">Private messages between active Project Worth members. Not an emergency or abuse reporting channel.</div>
<form id="pwm-compose" hidden><input id="pwm-text" required maxlength="2000" autocomplete="off" placeholder="Write a message..." aria-label="Message text"><button id="pwm-send" type="submit">Send</button></form>
</section>`;
document.body.appendChild(root);
const $=id=>document.getElementById(id);
let open=false,chat="",members=[],lastShown="";
async function request(path,options={}){const r=await fetch(API+path,{...options,headers:{"Authorization":"Bearer "+token(),"content-type":"application/json",...(options.headers||{})}});let data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||"Request failed");return data}
function status(msg){$("pwm-status").textContent=msg}
function toggle(show){open=show;$("pwm-window").hidden=!show;$("pwm-launch").hidden=show;$("pwm-launch").setAttribute("aria-expanded",String(show));if(show)loadMembers()}
function drawMembers(query=""){const el=$("pwm-list");el.replaceChildren();for(const m of members.filter(x=>(x.name+" "+x.role).toLowerCase().includes(query.toLowerCase()))){const b=document.createElement("button");b.type="button";b.className="pwm-person";b.textContent=m.name;const s=document.createElement("small");s.textContent=m.role||"Project Worth member";b.appendChild(s);b.addEventListener("click",()=>selectMember(m));el.appendChild(b)}}
async function loadMembers(){if(chat)return;try{status("Loading members...");const r=await request("/members");members=r.members||[];drawMembers($("pwm-search").value);status(members.length?"Choose a team member to start a private conversation.":"No other active members found.")}catch(e){status(e.message)}}
async function selectMember(m){try{status("Opening conversation...");const r=await request("/chats",{method:"POST",body:JSON.stringify({userId:m.userId})});chat=r.chatId;lastShown="";$("pwm-title").textContent=m.name;$("pwm-back").hidden=false;$("pwm-list").hidden=true;$("pwm-search").hidden=true;$("pwm-messages").hidden=false;$("pwm-compose").hidden=false;await loadMessages()}catch(e){status(e.message)}}
async function loadMessages(){if(!chat||!open)return;try{const r=await request("/chats/"+encodeURIComponent(chat)+"/messages");const sig=(r.messages||[]).map(x=>x.id).join("|");if(sig===lastShown)return;lastShown=sig;const log=$("pwm-messages");const nearBottom=(log.scrollHeight-log.scrollTop-log.clientHeight)<90;log.replaceChildren();for(const m of r.messages||[]){const row=document.createElement("div");row.className="pwm-msg"+(m.senderId===myId?" mine":"");const b=document.createElement("div");b.className="pwm-bubble";b.textContent=m.text;row.appendChild(b);log.appendChild(row)}if(nearBottom||!log.scrollTop)log.scrollTop=log.scrollHeight;status("Private conversation · Not an official reporting channel.")}catch(e){status(e.message)}}
$("pwm-launch").addEventListener("click",()=>toggle(true));$("pwm-close").addEventListener("click",()=>toggle(false));
$("pwm-back").addEventListener("click",()=>{chat="";lastShown="";$("pwm-title").textContent="Team Messages";$("pwm-back").hidden=true;$("pwm-list").hidden=false;$("pwm-search").hidden=false;$("pwm-messages").hidden=true;$("pwm-compose").hidden=true;loadMembers()});
$("pwm-search").addEventListener("input",e=>drawMembers(e.target.value));
$("pwm-compose").addEventListener("submit",async e=>{e.preventDefault();const field=$("pwm-text");const text=field.value.trim();if(!text||!chat)return;$("pwm-send").disabled=true;try{await request("/chats/"+encodeURIComponent(chat)+"/messages",{method:"POST",body:JSON.stringify({text})});field.value="";lastShown="";await loadMessages()}catch(err){status(err.message)}finally{$("pwm-send").disabled=false}});
setInterval(()=>{if(open&&chat&&document.visibilityState==="visible")loadMessages()},5000);
})();