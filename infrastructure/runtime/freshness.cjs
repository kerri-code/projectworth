'use strict';
exports.handler=async()=>{
  const s=require('@aws-sdk/client-s3'),m=require('@aws-sdk/client-cloudwatch');
  const client=new s.S3Client({maxAttempts:3}),metrics=new m.CloudWatchClient({maxAttempts:3});
  let token,latest=null;
  do {
    const page=await client.send(new s.ListObjectsV2Command({Bucket:process.env.BUCKET,Prefix:'primary-'+process.env.PRIMARY_ACCOUNT+'/',ContinuationToken:token}));
    for(const o of page.Contents||[]) if(o.Key.endsWith('/COMPLETED.json')&&(!latest||o.LastModified>latest.LastModified)) latest=o;
    token=page.NextContinuationToken;
  } while(token);
  let fresh=0;
  if(latest&&Date.now()-latest.LastModified.getTime()<3*3600000){
    const retention=await client.send(new s.GetObjectRetentionCommand({Bucket:process.env.BUCKET,Key:latest.Key}));
    fresh=retention.Retention?.Mode==='COMPLIANCE'&&retention.Retention.RetainUntilDate.getTime()>Date.now()?1:0;
  }
  await metrics.send(new m.PutMetricDataCommand({Namespace:'ProjectWorth/Recovery',MetricData:[{MetricName:'FreshLockedBackup',Value:fresh,Unit:'Count'}]}));
  return {freshLockedReceipt:fresh===1};
};
