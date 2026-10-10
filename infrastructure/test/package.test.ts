import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { verifySiteManifest } from '../lib/releases.js';
test('release packages pin dev identity/API and detect file tampering',()=>{
  const id='qa-'+randomUUID(),directory=resolve('releases',id);
  try {
    execFileSync(process.execPath,['--import',require.resolve('tsx'),'freeze-release.ts',id]);
    execFileSync(process.execPath,['--import',require.resolve('tsx'),'package-release.ts',id,'https://synthetic.execute-api.us-east-1.amazonaws.com','us-east-1','syntheticclientid123','B']);
    const manifest=verifySiteManifest(resolve(directory,'site-manifest.json'));assert.equal(manifest.slot,'B');
    const site=resolve(directory,'site','releases','B',id);
    const login=readFileSync(resolve(site,'institute-login.html'),'utf8');
    assert.ok(login.includes('syntheticclientid123'));assert.ok(!login.includes('djbqai6h9rak2c4g6o8gq008o'));assert.ok(login.includes('at least 14'));
    const portal=readFileSync(resolve(site,'institute-portal.html'),'utf8');assert.ok(!portal.includes('t0pckriwia'));assert.ok(portal.includes('synthetic.execute-api'));assert.ok(portal.includes('chat/widget.js'));
    assert.throws(()=>execFileSync(process.execPath,['--import',require.resolve('tsx'),'freeze-release.ts',id],{stdio:'pipe'}));
    writeFileSync(resolve(site,'chat/widget.js'),'tampered');assert.throws(()=>verifySiteManifest(resolve(directory,'site-manifest.json')),/hash mismatch/);
  } finally {rmSync(directory,{recursive:true,force:true});}
});
