'use strict';
// AWS SDK v3 is supplied by the supported Lambda Node.js runtime.
function runner(io, config, clock = () => new Date(), sleep = ms => new Promise(r => setTimeout(r,ms))) {
  return async () => {
    const started = clock(), prefix = `primary-${config.account}/${started.toISOString().replace(/[:.]/g,'-')}`;
    const exported = await io.exportTable({ TableArn:config.tableArn,S3Bucket:config.bucket,S3BucketOwner:config.owner,S3Prefix:prefix+'/dynamodb',S3SseAlgorithm:'AES256',ExportFormat:'DYNAMODB_JSON',ExportType:'FULL_EXPORT' });
    const exportArn = exported.ExportDescription.ExportArn;
    const versions = [], deleteMarkers = []; let marker;
    do {
      const page=await io.versions({Bucket:config.artifacts,...(marker||{})});
      for(const v of page.Versions || []) {
        if (v.Size > 5*1024*1024*1024) throw new Error('Artifact exceeds CopyObject limit; multipart backup required before declaring this snapshot complete');
        const key=`${prefix}/artifacts/${encodeURIComponent(v.Key)}/${encodeURIComponent(v.VersionId)}`;
        await io.copy({Bucket:config.bucket,Key:key,CopySource:encodeURIComponent(`${config.artifacts}/${v.Key}`)+`?versionId=${encodeURIComponent(v.VersionId)}`,ExpectedBucketOwner:config.owner,ExpectedSourceBucketOwner:config.account,ServerSideEncryption:'AES256',ChecksumAlgorithm:'SHA256',MetadataDirective:'REPLACE',Metadata:{'source-bucket':config.artifacts,'source-key':encodeURIComponent(v.Key),'source-version':v.VersionId}});
        versions.push({sourceBucket:config.artifacts,key:v.Key,sourceVersion:v.VersionId,isLatest:v.IsLatest,recoveryKey:key});
      }
      deleteMarkers.push(...(page.DeleteMarkers||[]));
      marker=page.IsTruncated?{KeyMarker:page.NextKeyMarker,VersionIdMarker:page.NextVersionIdMarker}:null;
    } while(marker);
    const users=[];let token;
    do {
      const page=await io.users({UserPoolId:config.pool,...(token?{PaginationToken:token}:{})});
      for(const u of page.Users||[]) users.push({username:u.Username,enabled:u.Enabled,status:u.UserStatus,attributes:(u.Attributes||[]).filter(a=>['sub','email','email_verified','name','custom:personId'].includes(a.Name))});
      token=page.PaginationToken;
    } while(token);
    let description;
    for(;;) {
      description=(await io.describe({ExportArn:exportArn})).ExportDescription;
      if(description.ExportStatus==='COMPLETED') break;
      if(description.ExportStatus==='FAILED') throw new Error('DynamoDB export failed');
      if(clock().getTime()-started.getTime()>660000) throw new Error('Export still pending; no completed backup receipt was issued');
      await sleep(10000);
    }
    // This final receipt is issued only after DynamoDB and every S3 copy succeeded.
    const receipt={schemaVersion:1,sourceAccount:config.account,recoveryAccount:config.owner,createdAt:started.toISOString(),completedAt:clock().toISOString(),tableArn:config.tableArn,exportArn,exportManifest:description.ExportManifest,artifacts:versions,deleteMarkers,cognito:{pool:config.pool,users,passwordsIncluded:false,recoveryRequiresPasswordReset:true},scope:'New isolated Project Worth environment. Existing production buckets, CHAD ledger and AMOS Neptune are not included.'};
    await io.put({Bucket:config.bucket,Key:prefix+'/COMPLETED.json',ExpectedBucketOwner:config.owner,ServerSideEncryption:'AES256',ChecksumAlgorithm:'SHA256',ContentType:'application/json',Body:JSON.stringify(receipt)});
    await io.metric({Namespace:'ProjectWorth/Recovery',MetricData:[{MetricName:'CompletedBackup',Value:1,Unit:'Count'}]});
    return {completed:true,receipt:`s3://${config.bucket}/${prefix}/COMPLETED.json`};
  };
}
exports.runner=runner;
exports.handler=async()=>{
  const d=require('@aws-sdk/client-dynamodb'),s=require('@aws-sdk/client-s3'),c=require('@aws-sdk/client-cognito-identity-provider'),m=require('@aws-sdk/client-cloudwatch');
  const db=new d.DynamoDBClient({maxAttempts:3}),s3=new s.S3Client({region:process.env.RECOVERY_REGION,maxAttempts:3}),sourceS3=new s.S3Client({maxAttempts:3}),cognito=new c.CognitoIdentityProviderClient({maxAttempts:3}),metrics=new m.CloudWatchClient({maxAttempts:3});
  const io={exportTable:x=>db.send(new d.ExportTableToPointInTimeCommand(x)),describe:x=>db.send(new d.DescribeExportCommand(x)),versions:x=>sourceS3.send(new s.ListObjectVersionsCommand(x)),copy:x=>s3.send(new s.CopyObjectCommand(x)),users:x=>cognito.send(new c.ListUsersCommand(x)),put:x=>s3.send(new s.PutObjectCommand(x)),metric:x=>metrics.send(new m.PutMetricDataCommand(x))};
  return runner(io,{account:process.env.PRIMARY_ACCOUNT,owner:process.env.RECOVERY_ACCOUNT,bucket:process.env.RECOVERY_BUCKET,tableArn:process.env.TABLE_ARN,artifacts:process.env.ARTIFACTS_BUCKET,pool:process.env.POOL_ID})();
};
