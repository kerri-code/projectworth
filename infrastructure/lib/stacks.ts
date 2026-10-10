import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Stack, App, Annotations, Duration, RemovalPolicy, CfnOutput, aws_s3 as s3, aws_dynamodb as dynamodb, aws_cognito as cognito, aws_iam as iam, aws_lambda as lambda, aws_logs as logs, aws_cloudfront as cf, aws_cloudfront_origins as origins, aws_apigatewayv2 as api, aws_sns as sns, aws_sns_subscriptions as subscriptions, aws_cloudwatch as cw, aws_events as events, aws_events_targets as targets } from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';
import { Config, recoveryBucketName, backupRoleName } from './config.js';
import { backendForRelease } from './releases.js';
const retain = RemovalPolicy.RETAIN;
function bucket(stack: Stack, id: string): s3.Bucket {
  return new s3.Bucket(stack, id, { blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, enforceSSL: true, encryption: s3.BucketEncryption.S3_MANAGED, versioned: true, removalPolicy: retain });
}
export class DataStack extends Stack {
  readonly table: dynamodb.Table; readonly pool: cognito.UserPool; readonly client: cognito.UserPoolClient;
  readonly artifacts: s3.Bucket; readonly backupRole: iam.Role;
  constructor(app: App, id: string, readonly config: Config) {
    super(app, id, { env: { account: config.primaryAccount, region: config.region }, terminationProtection: true });
    this.table = new dynamodb.Table(this, 'Messages', { partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING }, sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING }, billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true, recoveryPeriodInDays: 35 }, deletionProtection: true, removalPolicy: retain });
    this.pool = new cognito.UserPool(this, 'Identity', { selfSignUpEnabled: false, signInAliases: { email: true }, autoVerify: { email: true }, mfa: cognito.Mfa.REQUIRED, mfaSecondFactor: { sms: false, otp: true }, accountRecovery: cognito.AccountRecovery.EMAIL_ONLY, passwordPolicy: { minLength: 14, requireLowercase: true, requireUppercase: true, requireDigits: true, requireSymbols: true }, removalPolicy: retain });
    this.client = this.pool.addClient('Browser', { generateSecret: false, authFlows: { userPassword: true }, preventUserExistenceErrors: true, accessTokenValidity: Duration.minutes(15), idTokenValidity: Duration.minutes(15), refreshTokenValidity: Duration.days(1) });
    const accessLogs = bucket(this, 'AccessLogs');
    this.artifacts = new s3.Bucket(this, 'Artifacts', { blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, enforceSSL: true, encryption: s3.BucketEncryption.S3_MANAGED, versioned: true, removalPolicy: retain, serverAccessLogsBucket: accessLogs, serverAccessLogsPrefix: 'artifacts/' });
    this.backupRole = new iam.Role(this, 'RecoveryWriter', { roleName: backupRoleName(config), assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com') });
    this.backupRole.addToPolicy(new iam.PolicyStatement({ actions: ['dynamodb:ExportTableToPointInTime','dynamodb:DescribeContinuousBackups'], resources: [this.table.tableArn] }));
    this.backupRole.addToPolicy(new iam.PolicyStatement({ actions: ['dynamodb:DescribeExport'], resources: [`${this.table.tableArn}/export/*`] }));
    this.backupRole.addToPolicy(new iam.PolicyStatement({ actions: ['s3:PutObject','s3:PutObjectAcl','s3:AbortMultipartUpload'], resources: [`arn:aws:s3:::${recoveryBucketName(config)}/primary-${config.primaryAccount}/*`] }));
    this.backupRole.addToPolicy(new iam.PolicyStatement({ actions: ['s3:GetBucketLocation'], resources: [`arn:aws:s3:::${recoveryBucketName(config)}`] }));
    this.artifacts.grantRead(this.backupRole);
    this.backupRole.addToPolicy(new iam.PolicyStatement({ actions: ['cognito-idp:ListUsers'], resources: [this.pool.userPoolArn] }));
    this.backupRole.addToPolicy(new iam.PolicyStatement({ actions: ['cloudwatch:PutMetricData'], resources: ['*'], conditions: { StringEquals: { 'cloudwatch:namespace': 'ProjectWorth/Recovery' } } }));
    const backupLogs = new logs.LogGroup(this, 'BackupLogs', { retention: logs.RetentionDays.ONE_MONTH, removalPolicy: retain });
    backupLogs.grantWrite(this.backupRole);
    const backup = new lambda.Function(this, 'BackupWorker', { runtime: lambda.Runtime.NODEJS_24_X, handler: 'index.handler', code: lambda.Code.fromInline(readFileSync(resolve(__dirname,'../runtime/backup.cjs'),'utf8')), role: this.backupRole, logGroup: backupLogs, timeout: Duration.minutes(12), memorySize: 512, reservedConcurrentExecutions: 1, environment: { PRIMARY_ACCOUNT: config.primaryAccount, RECOVERY_ACCOUNT: config.recoveryAccount, RECOVERY_BUCKET: recoveryBucketName(config), RECOVERY_REGION: config.recoveryRegion, TABLE_ARN: this.table.tableArn, ARTIFACTS_BUCKET: this.artifacts.bucketName, POOL_ID: this.pool.userPoolId } });
    const schedule = new events.Rule(this, 'BackupSchedule', { schedule: events.Schedule.rate(Duration.hours(1)), enabled: config.backupsEnabled === true });
    schedule.addTarget(new targets.LambdaFunction(backup, { retryAttempts: 1, maxEventAge: Duration.hours(1) }));
    new CfnOutput(this, 'BackupFunction', { value: backup.functionName });
    NagSuppressions.addResourceSuppressions(backup, [{ id:'AwsSolutions-L1', reason:'Supported Node.js 24 runtime; backups contain data only in the destination bucket, never in logs.' }]);

    new CfnOutput(this, 'MessagesTable', { value: this.table.tableName });
    new CfnOutput(this, 'PoolId', { value: this.pool.userPoolId });
    new CfnOutput(this, 'ClientId', { value: this.client.userPoolClientId });
    new CfnOutput(this, 'ArtifactsBucket', { value: this.artifacts.bucketName });
    NagSuppressions.addResourceSuppressions(accessLogs, [{ id: 'AwsSolutions-S1', reason: 'Terminal access-log bucket; recursive logging would produce an unbounded logging chain.' }]);
    NagSuppressions.addResourceSuppressions(this.pool, [{ id: 'AwsSolutions-COG8', reason: 'Advanced adaptive-risk protection is not enabled for this initial isolated dev pool; mandatory TOTP, no signup and explicit membership deny access.' }]);
    NagSuppressions.addResourceSuppressions(this.backupRole, [{ id: 'AwsSolutions-IAM5', reason: 'S3 backup prefix and DynamoDB generated export IDs require suffix wildcards; no source-account read/delete or retention administration is granted on the recovery bucket. CloudWatch PutMetricData has no resource ARN and is constrained by namespace.' }], true);
  }
}
export class RecoveryStack extends Stack {
  readonly vault: s3.Bucket;
  constructor(app: App, id: string, c: Config) {
    super(app, id, { env: { account: c.recoveryAccount, region: c.recoveryRegion }, terminationProtection: true });
    const accessLogs = bucket(this, 'AccessLogs');
    this.vault = new s3.Bucket(this, 'RecoveryVault', { bucketName: recoveryBucketName(c), objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED, blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, enforceSSL: true, encryption: s3.BucketEncryption.S3_MANAGED, versioned: true, objectLockEnabled: true, objectLockDefaultRetention: s3.ObjectLockRetention.compliance(Duration.days(c.retentionDays)), removalPolicy: retain, serverAccessLogsBucket: accessLogs, serverAccessLogsPrefix: 'recovery/' });
    // No source-account principal may assume an administration role in this account.
    const writer = new iam.ArnPrincipal(`arn:aws:iam::${c.primaryAccount}:role/${backupRoleName(c)}`);
    this.vault.addToResourcePolicy(new iam.PolicyStatement({ principals: [writer], actions: ['s3:PutObject','s3:PutObjectAcl','s3:AbortMultipartUpload'], resources: [this.vault.arnForObjects(`primary-${c.primaryAccount}/*`)] }));
    this.vault.addToResourcePolicy(new iam.PolicyStatement({ principals: [writer], actions: ['s3:GetBucketLocation'], resources: [this.vault.bucketArn] }));
    new CfnOutput(this, 'RecoveryBucket', { value: this.vault.bucketName });
    const monitorLogs = new logs.LogGroup(this,'MonitorLogs',{retention:logs.RetentionDays.ONE_MONTH,removalPolicy:retain});
    const monitorRole = new iam.Role(this,'MonitorRole',{assumedBy:new iam.ServicePrincipal('lambda.amazonaws.com')});
    monitorLogs.grantWrite(monitorRole);
    monitorRole.addToPolicy(new iam.PolicyStatement({actions:['s3:ListBucket'],resources:[this.vault.bucketArn],conditions:{StringLike:{'s3:prefix':[`primary-${c.primaryAccount}/*`]}}}));
    monitorRole.addToPolicy(new iam.PolicyStatement({actions:['s3:GetObjectRetention'],resources:[this.vault.arnForObjects(`primary-${c.primaryAccount}/*`)]}));
    monitorRole.addToPolicy(new iam.PolicyStatement({actions:['cloudwatch:PutMetricData'],resources:['*'],conditions:{StringEquals:{'cloudwatch:namespace':'ProjectWorth/Recovery'}}}));
    const monitor = new lambda.Function(this,'FreshnessMonitor',{runtime:lambda.Runtime.NODEJS_24_X,handler:'index.handler',code:lambda.Code.fromInline(readFileSync(resolve(__dirname,'../runtime/freshness.cjs'),'utf8')),role:monitorRole,logGroup:monitorLogs,timeout:Duration.minutes(5),environment:{BUCKET:this.vault.bucketName,PRIMARY_ACCOUNT:c.primaryAccount}});
    new events.Rule(this,'MonitorSchedule',{schedule:events.Schedule.rate(Duration.hours(1))}).addTarget(new targets.LambdaFunction(monitor));
    const topic = new sns.Topic(this,'RecoveryAlerts',{enforceSSL:true});
    topic.addSubscription(new subscriptions.EmailSubscription(c.alarmEmail));
    new cw.Alarm(this,'MissingBackup',{metric:new cw.Metric({namespace:'ProjectWorth/Recovery',metricName:'FreshLockedBackup',statistic:'Minimum',period:Duration.hours(1)}),threshold:1,comparisonOperator:cw.ComparisonOperator.LESS_THAN_THRESHOLD,evaluationPeriods:1,treatMissingData:cw.TreatMissingData.BREACHING}).addAlarmAction({bind:()=>({alarmActionArn:topic.topicArn})});
    NagSuppressions.addResourceSuppressions(monitorRole,[{id:'AwsSolutions-IAM5',reason:'Versioned backup prefix and runtime log streams require suffix wildcards. PutMetricData lacks resource ARNs and is restricted to the recovery namespace.'}],true);
    NagSuppressions.addResourceSuppressions(monitor,[{id:'AwsSolutions-L1',reason:'Supported Node.js 24 runtime.'}]);
    NagSuppressions.addResourceSuppressions(topic,[{id:'AwsSolutions-SNS2',reason:'Independent recovery alarms contain only freshness metadata, no private messages.'}]);

    NagSuppressions.addResourceSuppressions(accessLogs, [{ id: 'AwsSolutions-S1', reason: 'Terminal access-log bucket avoids recursive access logging.' }]);
  }
}
export class ReleaseStack extends Stack {
  constructor(app: App, id: string, c: Config, data: DataStack) {
    super(app, id, { env: { account: c.primaryAccount, region: c.region } });
    const accessLogs = new s3.Bucket(this, 'AccessLogs', { blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, enforceSSL: true, encryption: s3.BucketEncryption.S3_MANAGED, versioned: true, removalPolicy: retain, objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED });
    const slotBuckets: Record<string,s3.Bucket> = {};
    const endpoints: Record<string,string> = {};
    const alerts = new sns.Topic(this, 'ReleaseAlerts', { enforceSSL: true });
    alerts.addSubscription(new subscriptions.EmailSubscription(c.alarmEmail));
    for (const slot of ['A','B'] as const) {
      const assets = new s3.Bucket(this, `Assets${slot}`, { blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, enforceSSL: true, encryption: s3.BucketEncryption.S3_MANAGED, versioned: true, removalPolicy: retain, serverAccessLogsBucket: accessLogs, serverAccessLogsPrefix: `slot-${slot}/` });
      slotBuckets[slot] = assets;
      const group = new logs.LogGroup(this, `MessagesLogs${slot}`, { retention: logs.RetentionDays.ONE_MONTH, removalPolicy: retain });
      const role = new iam.Role(this, `MessagesRole${slot}`, { assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com') });
      group.grantWrite(role);
      role.addToPolicy(new iam.PolicyStatement({ actions: ['dynamodb:GetItem','dynamodb:Query','dynamodb:PutItem','dynamodb:UpdateItem','dynamodb:ConditionCheckItem'], resources: [data.table.tableArn], conditions: { 'ForAllValues:StringEquals': { 'dynamodb:LeadingKeys': ['DM#zac-kerri'] }, Null: { 'dynamodb:LeadingKeys': 'false' } } }));
      role.addToPolicy(new iam.PolicyStatement({ actions: ['cognito-idp:AdminGetUser'], resources: [data.pool.userPoolArn] }));
      const fn = new lambda.Function(this, `Messages${slot}`, { runtime: lambda.Runtime.NODEJS_24_X, handler: 'index.handler', code: lambda.Code.fromInline(backendForRelease(slot === 'A' ? c.releaseA : c.releaseB, c.fixture)), timeout: Duration.seconds(10), memorySize: 256, role, logGroup: group, environment: { CHAT_TABLE: data.table.tableName, CHAT_POOL: data.pool.userPoolId, CHAT_CLIENT: data.client.userPoolClientId, CHAT_IDENTITY_REGION: c.region } });
      const version = fn.currentVersion;
      version.applyRemovalPolicy(retain);
      const alias = new lambda.Alias(this, `Alias${slot}`, { aliasName: 'live', version });
      const gateway = new api.CfnApi(this, `API${slot}`, { name: `projectworth-${c.environment}-${slot}`, protocolType: 'HTTP', corsConfiguration: { allowOrigins: [], allowHeaders: ['authorization','content-type'], allowMethods: ['GET','POST','OPTIONS'] } });
      endpoints[slot] = gateway.attrApiEndpoint;
      const auth = new api.CfnAuthorizer(this, `Auth${slot}`, { apiId: gateway.ref, name: 'ProjectWorth', authorizerType: 'JWT', identitySource: ['$request.header.Authorization'], jwtConfiguration: { audience: [data.client.userPoolClientId], issuer: data.pool.userPoolProviderUrl.startsWith('https://') ? data.pool.userPoolProviderUrl : `https://${data.pool.userPoolProviderUrl}` } });
      const integration = new api.CfnIntegration(this, `Integration${slot}`, { apiId: gateway.ref, integrationType: 'AWS_PROXY', integrationUri: alias.functionArn, payloadFormatVersion: '2.0', timeoutInMillis: 10000 });
      ['GET /api/chat/session','GET /api/chat/messages','POST /api/chat/messages','POST /api/chat/read'].forEach((route,i) => new api.CfnRoute(this, `Route${slot}${i}`, { apiId: gateway.ref, routeKey: route, target: `integrations/${integration.ref}`, authorizationType: 'JWT', authorizerId: auth.ref, authorizationScopes: ['aws.cognito.signin.user.admin'] }));
      new api.CfnStage(this, `Stage${slot}`, { apiId: gateway.ref, stageName: '$default', autoDeploy: true, accessLogSettings: { destinationArn: group.logGroupArn, format: JSON.stringify({ requestId:'$context.requestId',status:'$context.status',route:'$context.routeKey' }) }, defaultRouteSettings: { throttlingBurstLimit: 30, throttlingRateLimit: 15 } });
      alias.addPermission(`APIInvoke${slot}`, { principal: new iam.ServicePrincipal('apigateway.amazonaws.com'), sourceArn: `arn:aws:execute-api:${c.region}:${c.primaryAccount}:${gateway.ref}/*` });
      new cw.Alarm(this, `Errors${slot}`, { metric: fn.metricErrors(), threshold: 3, evaluationPeriods: 2, treatMissingData: cw.TreatMissingData.NOT_BREACHING }).addAlarmAction({ bind: () => ({ alarmActionArn: alerts.topicArn }) });
      new CfnOutput(this, `AssetsBucket${slot}`, { value: assets.bucketName });
      new CfnOutput(this, `ApiEndpoint${slot}`, { value: gateway.attrApiEndpoint });
      NagSuppressions.addResourceSuppressions(role, [{ id:'AwsSolutions-IAM5',reason:'Log stream names are created at runtime and scoped to this function log group; DynamoDB/Cognito statements are resource-scoped.' }], true);
      NagSuppressions.addResourceSuppressions(fn, [{ id:'AwsSolutions-L1',reason:'Node.js 24 is the selected supported Lambda runtime for this application.' }]);
    }
    const activeRelease = c.activeSlot === 'A' ? c.releaseA : c.releaseB;
    const redirect = new cf.Function(this, 'ReleaseRouter', { runtime: cf.FunctionRuntime.JS_2_0, code: cf.FunctionCode.fromInline(`function handler(e){var r=e.request;if(r.uri.indexOf('/releases/')===0)return r;return {statusCode:302,statusDescription:'Found',headers:{location:{value:'/releases/${c.activeSlot}/${activeRelease}'+(r.uri==='/'?'/index.html':r.uri)},'cache-control':{value:'no-store'}}};}`) });
    const behavior = (assets: s3.Bucket): cf.BehaviorOptions => ({ origin: origins.S3BucketOrigin.withOriginAccessControl(assets), viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, cachePolicy: cf.CachePolicy.CACHING_DISABLED, functionAssociations: [{ eventType: cf.FunctionEventType.VIEWER_REQUEST, function: redirect }] });
    const distribution = new cf.Distribution(this, 'FrontDoor', { defaultBehavior: behavior(slotBuckets[c.activeSlot]), additionalBehaviors: { '/releases/A/*': behavior(slotBuckets.A), '/releases/B/*': behavior(slotBuckets.B) }, enableLogging: true, logBucket: accessLogs, logFilePrefix: 'cloudfront/', minimumProtocolVersion: cf.SecurityPolicyProtocol.TLS_V1_2_2021, defaultRootObject: 'index.html' });
    for (const slot of ['A','B'] as const) {
      const gateway = this.node.findChild(`API${slot}`) as api.CfnApi;
      gateway.addPropertyOverride('CorsConfiguration.AllowOrigins', [`https://${distribution.distributionDomainName}`]);
    }
    Annotations.of(distribution).acknowledgeWarning('@aws-cdk/aws-cloudfront:minimumProtocolVersionWithoutCertificate', 'Dev uses the AWS-issued CloudFront certificate. A custom domain and TLS policy are required before production promotion.');
    new CfnOutput(this, 'FrontDoorURL', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'ActiveSlot', { value: c.activeSlot });
    new CfnOutput(this, 'CandidateURL', { value: `https://${distribution.distributionDomainName}/releases/${c.activeSlot === 'A' ? 'B' : 'A'}/${c.activeSlot === 'A' ? c.releaseB : c.releaseA}/index.html` });
    NagSuppressions.addResourceSuppressions(accessLogs, [{ id:'AwsSolutions-S1',reason:'Terminal access log bucket avoids recursive logging.' }]);
    NagSuppressions.addResourceSuppressions(distribution, [{ id:'AwsSolutions-CFR1',reason:'Organization and family messaging is not geographically restricted.' },{ id:'AwsSolutions-CFR2',reason:'WAF integration remains a production promotion prerequisite; JWT authorization, membership and application rate limits protect the isolated dev API.' },{ id:'AwsSolutions-CFR4',reason:'Default CloudFront certificate is used for the dev endpoint; custom domain TLS must be reviewed before production promotion.' }]);
    NagSuppressions.addResourceSuppressions(alerts, [{ id:'AwsSolutions-SNS2',reason:'Email topic contains infrastructure alarm metadata only; no chat content or credentials.' }]);
  }
}
