import { test } from 'node:test';
import assert from 'node:assert/strict';
import { App } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { validate } from '../lib/config.js';
import { DataStack, RecoveryStack, ReleaseStack } from '../lib/stacks.js';
import { readFileSync } from 'node:fs';
const c = validate(JSON.parse(readFileSync('config.example.json','utf8')));
test('recovery rejects the primary account and ambiguous release IDs', () => {
  assert.throws(() => validate({...c,recoveryAccount:c.primaryAccount}), /different/);
  assert.throws(() => validate({...c,releaseB:c.releaseA}), /distinct/);
});
test('stateful data is protected and dev has independent identity', () => {
  const app = new App(); const stack = new DataStack(app,'Data',c); const t = Template.fromStack(stack);
  t.hasResourceProperties('AWS::DynamoDB::Table',{DeletionProtectionEnabled:true,PointInTimeRecoverySpecification:{PointInTimeRecoveryEnabled:true,RecoveryPeriodInDays:35}});
  t.hasResource('AWS::DynamoDB::Table',{DeletionPolicy:'Retain',UpdateReplacePolicy:'Retain'});
  t.hasResourceProperties('AWS::Cognito::UserPool',{MfaConfiguration:'ON',AdminCreateUserConfig:{AllowAdminCreateUserOnly:true}});
  assert.equal(stack.terminationProtection,true);
});
test('destination owns immutable copies and source role gets no delete/admin/read grant', () => {
  const t=Template.fromStack(new RecoveryStack(new App(),'Recovery',c));
  t.hasResourceProperties('AWS::S3::Bucket',{ObjectLockEnabled:true,ObjectLockConfiguration:{ObjectLockEnabled:'Enabled',Rule:{DefaultRetention:{Mode:'COMPLIANCE',Days:90}}},VersioningConfiguration:{Status:'Enabled'}});
  const policies=Object.values(t.findResources('AWS::S3::BucketPolicy')) as Array<{Properties:{PolicyDocument:{Statement:Array<{Principal:unknown,Action:unknown}>}}}>;
  const source=policies.flatMap(x=>x.Properties.PolicyDocument.Statement).filter(x=>JSON.stringify(x.Principal).includes(c.primaryAccount));
  assert.equal(source.length,2);
  const actions=source.flatMap(x=>Array.isArray(x.Action)?x.Action:[x.Action]);
  assert.deepEqual(actions.sort(),['s3:AbortMultipartUpload','s3:GetBucketLocation','s3:PutObject','s3:PutObjectAcl'].sort());
});
test('each release has an authenticated API and retained Lambda version, routing uses immutable paths', () => {
  const app=new App();const data=new DataStack(app,'Data',c);const t=Template.fromStack(new ReleaseStack(app,'Release',c,data));
  t.resourceCountIs('AWS::Lambda::Function',2);t.resourceCountIs('AWS::Lambda::Alias',2);t.resourceCountIs('AWS::ApiGatewayV2::Route',8);
  for(const route of Object.values(t.findResources('AWS::ApiGatewayV2::Route')) as Array<{Properties:Record<string,unknown>}>) assert.equal(route.Properties.AuthorizationType,'JWT');
  t.hasResource('AWS::Lambda::Version',{DeletionPolicy:'Retain'});
  t.hasResourceProperties('AWS::CloudFront::Distribution',{DistributionConfig:{CacheBehaviors:Match.arrayWith([Match.objectLike({PathPattern:'/releases/B/*'})])}});
});
