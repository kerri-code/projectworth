import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sha256 } from './lib/releases.js';
const id=process.argv[2];
if(!id||!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) throw new Error('Provide a unique release ID');
const source=readFileSync(resolve(__dirname,'../chat/handler.cjs'));
const directory=resolve(__dirname,'releases',id);
mkdirSync(resolve(__dirname,'releases'),{recursive:true});
mkdirSync(directory,{recursive:false}); // Existing release IDs are immutable.
writeFileSync(resolve(directory,'handler.cjs'),source,{flag:'wx'});
writeFileSync(resolve(directory,'manifest.json'),JSON.stringify({releaseId:id,backendSha256:sha256(source)},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({releaseId:id,backendSha256:sha256(source)}));
