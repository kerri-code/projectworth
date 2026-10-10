'use strict';
// Validate staged sources against installed, pinned dependencies without putting
// node_modules in the immutable archive.
const {readFileSync,writeFileSync,unlinkSync}=require('node:fs');
const {resolve}=require('node:path');
const {spawnSync}=require('node:child_process');
const infrastructure=resolve(__dirname),dependencies=process.env.PW_CDK_DEPENDENCIES;
if(!dependencies)throw new Error('Set PW_CDK_DEPENDENCIES to the installed infrastructure/node_modules directory');
const mode=process.argv[2],env={...process.env,NODE_PATH:dependencies};
function run(args){const r=spawnSync(process.execPath,args,{cwd:infrastructure,env,encoding:'utf8'});process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');if(r.status!==0)throw new Error('Snapshot validation failed');}
if(mode==='unit')run([resolve(dependencies,'tsx/dist/cli.mjs'),'--test',...['backup','releases','stacks','package'].map(x=>resolve(infrastructure,'test',x+'.test.ts'))]);
else if(mode==='build'){
 const config=JSON.parse(readFileSync(resolve(infrastructure,'tsconfig.json'),'utf8'));
 config.compilerOptions.typeRoots=[resolve(dependencies,'@types')];
 config.compilerOptions.paths=Object.fromEntries(['aws-cdk-lib','aws-cdk-lib/*','constructs','cdk-nag'].map(x=>[x,[resolve(dependencies,x)]]));
 const path=resolve(infrastructure,'tsconfig.snapshot.json');writeFileSync(path,JSON.stringify(config),{flag:'wx'});
 try{run([resolve(dependencies,'typescript/lib/tsc.js'),'--project',path]);}
 finally{unlinkSync(path);}
 run([resolve(dependencies,'aws-cdk/bin/cdk'),'synth','--strict','--app',process.execPath+' '+resolve(dependencies,'tsx/dist/cli.mjs')+' '+resolve(infrastructure,'app.ts'),'-c','config=config.example.json']);
}else throw new Error('Use unit or build');
