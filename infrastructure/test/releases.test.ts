import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approvePromotion, ReleaseEvidence } from '../lib/releases.js';
const candidate={releaseId:'abc',artifactSha256:'123',url:'https://dev.example.com/releases/abc/index.html'};
const evidence:ReleaseEvidence={...candidate,unit:'passed',build:'passed',e2e:'passed',authenticatedSmoke:'passed',testedURL:candidate.url,testedAt:new Date().toISOString(),schemaCompatible:true};
test('promotion requires tests for this exact artifact and live candidate',()=>{
  assert.equal(approvePromotion(candidate,evidence).releaseId,'abc');
  assert.throws(()=>approvePromotion(candidate,{...evidence,artifactSha256:'other'}),/another/);
  assert.throws(()=>approvePromotion(candidate,{...evidence,authenticatedSmoke:'failed' as 'passed'}),/authenticatedSmoke/);
  assert.throws(()=>approvePromotion(candidate,{...evidence,schemaCompatible:false}),/schema/);
  assert.throws(()=>approvePromotion(candidate,{...evidence,testedAt:'2020-01-01T00:00:00Z'}),/24 hours/);
});
