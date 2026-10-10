import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { sha256, backendForRelease } from './lib/releases.js';
const [id,endpoint,region,client,slot]=process.argv.slice(2);
if(!['A','B'].includes(slot)) throw new Error('Provide slot A or B');
if(!id||!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) throw new Error('Invalid release ID');
if(!/^https:\/\/[a-z0-9]+\.execute-api\.[a-z0-9-]+\.amazonaws\.com$/.test(endpoint)) throw new Error('Use the deployed slot API endpoint');
if(!/^[a-z]{2}(-[a-z]+)+-\d$/.test(region)||!/^[a-z0-9]{10,64}$/.test(client)) throw new Error('Use the deployed dev region/client ID');
backendForRelease(id); // Reject altered frozen source.
const root=resolve(__dirname,'..'),directory=resolve(__dirname,'releases',id,'site','releases',slot,id);
mkdirSync(directory,{recursive:true});
const files:Array<{path:string,sha256:string}>=[];
const config=`<script>window.PW_CHAT_CONFIG=${JSON.stringify({api:endpoint})};</script>`;
for(const file of readdirSync(root)) {
  if(!/\.(html|css|js|png|jpe?g|svg|webp|pdf|txt|xml|ico|woff2?)$/i.test(file)||file==='README.txt'||file==='institute-portal.html')continue;
  let bytes=readFileSync(join(root,file));
  if(file.endsWith('.html')) {
    let html=bytes.toString().replace('</head>',config+'</head>');
    if(file==='institute-login.html') html=html.replace('const REGION = "us-east-1";',`const REGION = ${JSON.stringify(region)};`).replace('const CLIENT_ID = "djbqai6h9rak2c4g6o8gq008o";',`const CLIENT_ID = ${JSON.stringify(client)};`).replace('Use at least 8 characters','Use at least 14 characters');
    bytes=Buffer.from(html);
  }
  writeFileSync(join(directory,file),bytes,{flag:'wx'});files.push({path:file,sha256:sha256(bytes)});
}
const portal=Buffer.from(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Project Worth · Dev messages</title><link rel="stylesheet" href="style.css">${config}</head><body><main class="container"><h1>Your people.</h1><p>Project Worth development workspace. Open Messages in the bottom right.</p><button id="logoutButton" type="button">Sign out</button><p><a href="index.html">Home</a></p></main><script>document.getElementById('logoutButton').addEventListener('click',()=>{sessionStorage.clear();location.href='institute-login.html'});</script><script src="chat/widget.js" defer></script></body></html>`);
writeFileSync(join(directory,'institute-portal.html'),portal,{flag:'wx'});files.push({path:'institute-portal.html',sha256:sha256(portal)});
mkdirSync(join(directory,'chat'));
for(const file of ['widget.js','widget.css']){const bytes=readFileSync(join(root,'chat',file));writeFileSync(join(directory,'chat',file),bytes,{flag:'wx'});files.push({path:'chat/'+file,sha256:sha256(bytes)});}
const backend=JSON.parse(readFileSync(resolve(__dirname,'releases',id,'manifest.json'),'utf8')) as {backendSha256:string};
const artifact={releaseId:id,slot,backendSha256:backend.backendSha256,endpoint,region,client,files};
writeFileSync(resolve(__dirname,'releases',id,'site-manifest.json'),JSON.stringify({...artifact,artifactSha256:sha256(JSON.stringify(artifact))},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({releaseId:id,artifactSha256:sha256(JSON.stringify(artifact)),siteDirectory:resolve(directory,'../../..')}));
