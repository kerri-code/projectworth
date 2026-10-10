'use strict';
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
const root = __dirname;
for (const file of ['handler.cjs', 'widget.js', 'build.cjs']) execFileSync(process.execPath, ['--check', resolve(root, file)]);
const ref = name => ({ Ref: name }), sub = value => ({ 'Fn::Sub': value }), attr = (name, key) => ({ 'Fn::GetAtt': [name, key] });
const template = {
  AWSTemplateFormatVersion: '2010-09-09',
  Description: 'Project Worth private two-person messaging. Adds four authenticated routes to the existing portal API.',
  Parameters: {
    PortalApiId: { Type: 'String', Default: 't0pckriwia', AllowedPattern: '[a-z0-9]+' },
    PortalAuthorizerId: { Type: 'String', Default: '3gmjai', AllowedPattern: '[a-z0-9]+' },
    PoolId: { Type: 'String', Default: 'us-east-1_vJcIlzmlw', AllowedPattern: 'us-east-1_[A-Za-z0-9]+' },
    ClientId: { Type: 'String', Default: 'djbqai6h9rak2c4g6o8gq008o', AllowedPattern: '[a-z0-9]+' },
    HistoryTable: { Type: 'String', Default: 'chad-projectworth-gh-1232513288-history', AllowedPattern: '[A-Za-z0-9_.-]+' }
  },
  Resources: {
    Logs: { Type: 'AWS::Logs::LogGroup', DeletionPolicy: 'Retain', UpdateReplacePolicy: 'Retain',
      Properties: { LogGroupName: sub('/aws/lambda/${AWS::StackName}-messages'), RetentionInDays: 30 } },
    ExecutionRole: { Type: 'AWS::IAM::Role', Properties: {
      AssumeRolePolicyDocument: { Version: '2012-10-17', Statement: [{ Effect: 'Allow', Principal: { Service: 'lambda.amazonaws.com' }, Action: 'sts:AssumeRole' }] },
      Policies: [{ PolicyName: 'PrivateMessages', PolicyDocument: { Version: '2012-10-17', Statement: [
        { Effect: 'Allow', Action: ['logs:CreateLogStream', 'logs:PutLogEvents'], Resource: sub('arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/${AWS::StackName}-messages:*') },
        { Effect: 'Allow', Action: ['dynamodb:GetItem', 'dynamodb:Query', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:ConditionCheckItem'],
          Resource: sub('arn:${AWS::Partition}:dynamodb:us-east-1:${AWS::AccountId}:table/${HistoryTable}'),
          Condition: { 'ForAllValues:StringEquals': { 'dynamodb:LeadingKeys': ['DM#zac-kerri'] }, Null: { 'dynamodb:LeadingKeys': 'false' } } },
        { Effect: 'Allow', Action: 'cognito-idp:AdminGetUser', Resource: sub('arn:${AWS::Partition}:cognito-idp:us-east-1:${AWS::AccountId}:userpool/${PoolId}') }
      ] } }]
    } },
    Messages: { Type: 'AWS::Lambda::Function', DependsOn: 'Logs', Properties: {
      FunctionName: sub('${AWS::StackName}-messages'), Runtime: 'nodejs24.x', Handler: 'index.handler',
      Role: attr('ExecutionRole', 'Arn'), Timeout: 10, MemorySize: 256,
      Environment: { Variables: { CHAT_TABLE: ref('HistoryTable'), CHAT_POOL: ref('PoolId'), CHAT_CLIENT: ref('ClientId') } },
      Code: { ZipFile: readFileSync(resolve(root, 'handler.cjs'), 'utf8') }
    } },
    Integration: { Type: 'AWS::ApiGatewayV2::Integration', Properties: {
      ApiId: ref('PortalApiId'), IntegrationType: 'AWS_PROXY', IntegrationUri: attr('Messages', 'Arn'), PayloadFormatVersion: '2.0', TimeoutInMillis: 12000
    } },
    InvokePermission: { Type: 'AWS::Lambda::Permission', Properties: {
      FunctionName: ref('Messages'), Action: 'lambda:InvokeFunction', Principal: 'apigateway.amazonaws.com',
      SourceAccount: ref('AWS::AccountId'), SourceArn: sub('arn:${AWS::Partition}:execute-api:${AWS::Region}:${AWS::AccountId}:${PortalApiId}/*/*/api/chat/*')
    } }
  },
  Outputs: { FunctionName: { Value: ref('Messages'), Description: 'Private messaging Lambda' }, ApiBase: { Value: sub('https://${PortalApiId}.execute-api.${AWS::Region}.amazonaws.com'), Description: 'Existing Project Worth portal API' } }
};
for (const [name, route] of Object.entries({ Session: 'GET /api/chat/session', List: 'GET /api/chat/messages', Send: 'POST /api/chat/messages', Read: 'POST /api/chat/read' })) {
  template.Resources[name + 'Route'] = { Type: 'AWS::ApiGatewayV2::Route', Properties: {
    ApiId: ref('PortalApiId'), RouteKey: route, AuthorizationType: 'JWT', AuthorizerId: ref('PortalAuthorizerId'),
    AuthorizationScopes: ['aws.cognito.signin.user.admin'], Target: { 'Fn::Join': ['/', ['integrations', ref('Integration')]] }
  } };
}
mkdirSync(resolve(root, 'dist'), { recursive: true });
writeFileSync(resolve(root, 'dist/template.json'), JSON.stringify(template, null, 2) + '\n');
console.log('Build passed: syntax checked; CloudFormation template generated.');
