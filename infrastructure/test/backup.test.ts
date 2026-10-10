import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const {runner}=createRequire(__filename)('../runtime/backup.cjs') as {runner:(io:Record<string,(x:Record<string,unknown>)=>Promise<unknown>>,config:Record<string,string>,clock?:()=>Date,sleep?:(ms:number)=>Promise<void>)=>()=>Promise<{completed:boolean}>};
const config={account:'111111111111',owner:'222222222222',tableArn:'table',bucket:'recovery',artifacts:'artifacts',pool:'pool'};
function fixture(status='COMPLETED'){
  const calls:string[]=[];
  const io={exportTable:async(x:Record<string,unknown>)=>{assert.equal(x.S3BucketOwner,config.owner);assert.equal(x.S3SseAlgorithm,'AES256');return {ExportDescription:{ExportArn:'export'}}},versions:async()=>({Versions:[{Key:'release.tar',VersionId:'v1',Size:10,IsLatest:true}],DeleteMarkers:[{Key:'old',VersionId:'v2',IsLatest:true}]}),copy:async()=>{calls.push('copy')},users:async()=>({Users:[]}),describe:async()=>({ExportDescription:{ExportStatus:status,ExportManifest:'manifest'}}),put:async(x:Record<string,unknown>)=>{assert.equal(x.ChecksumAlgorithm,'SHA256');calls.push('receipt');const r=JSON.parse(x.Body as string);assert.equal(r.deleteMarkers.length,1);assert.equal(r.cognito.passwordsIncluded,false)},metric:async()=>{calls.push('metric')}};
  return {io,calls};
}
test('receipt is written only after export and every version copy complete',async()=>{
  const {io,calls}=fixture();assert.equal((await runner(io,config)()).completed,true);assert.deepEqual(calls,['copy','receipt','metric']);
});
test('failed or unfinished export never produces a completed receipt',async()=>{
  for(const status of ['FAILED','IN_PROGRESS']){
    const {io,calls}=fixture(status);let time=0;
    await assert.rejects(runner(io,config,()=>new Date((time++)*700000),async()=>{})());assert.ok(!calls.includes('receipt'));
  }
});
test('failed copy prevents a false backup success',async()=>{
  const {io,calls}=fixture();io.copy=async()=>{throw new Error('copy failed')};await assert.rejects(runner(io,config)(),/copy failed/);assert.ok(!calls.includes('receipt'));
});
