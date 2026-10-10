'use strict';
const { createHash } = require('node:crypto');
const PK = 'DM#zac-kerri';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CURSOR = /^M#\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z#[0-9a-f-]{36}$/;
const error = (status, message) => Object.assign(new Error(message), { status });
const response = (statusCode, data) => ({ statusCode, headers: {
  'content-type': 'application/json', 'cache-control': 'no-store',
  'x-content-type-options': 'nosniff'
}, body: JSON.stringify(data) });
function parse(event) {
  if (event.isBase64Encoded || typeof event.body !== 'string' || Buffer.byteLength(event.body) > 16384)
    throw error(400, 'Invalid request body.');
  try { const value = JSON.parse(event.body); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value; }
  catch { throw error(400, 'Use a JSON object.'); }
}
function createHandler(repo, { clientId, issuer, now = () => new Date().toISOString() }) {
  return async event => {
    try {
      // Only trust API Gateway's verified JWT context, never a decoded request token.
      const claims = event.requestContext?.authorizer?.jwt?.claims;
      if (!claims || claims.iss !== issuer || claims.client_id !== clientId || claims.token_use !== 'access' || !claims.sub)
        throw error(401, 'Sign in with your Project Worth account.');
      const membership = await repo.membership();
      const role = membership?.active && membership.subjects?.[claims.sub];
      if (!['Zac', 'Kerri'].includes(role)) throw error(403, 'Private messaging is not enabled for this account yet.');
      // Cognito disable/delete takes effect on each request, including unexpired tokens.
      if (!await repo.activeUser(claims.sub)) throw error(403, 'This account is no longer active.');
      const partner = role === 'Zac' ? 'Kerri' : 'Zac';
      const method = event.requestContext.http.method, path = event.rawPath;
      if (method === 'GET' && path === '/api/chat/session') {
        const state = await repo.state(role);
        return response(200, { name: role, partner, room: 'zac-kerri', muted: true,
          unread: Math.max(0, (state.received || 0) - (state.read || 0)), companion: 'EMIE' });
      }
      if (path === '/api/chat/messages' && method === 'GET') {
        const cursor = event.queryStringParameters?.cursor || null;
        if (cursor && !CURSOR.test(cursor)) throw error(400, 'Invalid message cursor.');
        // Snapshot before the strongly consistent query prevents marking a later
        // concurrent incoming message read without first displaying it.
        const state = await repo.state(role);
        const page = await repo.messages(cursor);
        return response(200, { messages: page.messages.reverse(), cursor: page.cursor,
          received: state.received || 0 });
      }
      if (path === '/api/chat/messages' && method === 'POST') {
        const b = parse(event);
        if (typeof b.text !== 'string' || !b.text.trim() || b.text.length > 4000 || !UUID.test(b.requestId || ''))
          throw error(400, 'Write a message of up to 4,000 characters.');
        const text = b.text.trim(), fingerprint = createHash('sha256').update(text).digest('hex');
        const existing = await repo.request(b.requestId);
        if (existing) {
          if (existing.subject !== claims.sub || existing.fingerprint !== fingerprint) throw error(409, 'Message retry does not match the original.');
          return response(200, { message: existing.message });
        }
        const message = { id: b.requestId, name: role, text, created: now() };
        try { await repo.send({ subject: claims.sub, role, partner, fingerprint, message }); }
        catch (e) {
          if (e.name !== 'TransactionCanceledException') throw e;
          const saved = await repo.request(b.requestId);
          if (saved?.subject === claims.sub && saved.fingerprint === fingerprint) return response(200, { message: saved.message });
          if (saved) throw error(409, 'Message identifier is already in use.');
          throw error(409, 'Your access changed or too many messages were sent. Please retry.');
        }
        return response(201, { message });
      }
      if (path === '/api/chat/read' && method === 'POST') {
        const b = parse(event);
        if (!Number.isSafeInteger(b.received) || b.received < 0) throw error(400, 'Invalid read position.');
        await repo.markRead(role, b.received);
        return response(200, { ok: true });
      }
      throw error(404, 'Not found.');
    } catch (e) {
      if (!e.status) console.error(JSON.stringify({ event: 'chat_failed', error: e.name || 'Error' }));
      return response(e.status || 500, { error: e.status ? e.message : 'Messages are temporarily unavailable. Your draft is safe.' });
    }
  };
}

function awsRepository() {
  const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, GetCommand, QueryCommand, UpdateCommand, TransactWriteCommand } = require('@aws-sdk/lib-dynamodb');
  const { CognitoIdentityProviderClient, AdminGetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
  const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1', maxAttempts: 3 }));
  const cognito = new CognitoIdentityProviderClient({ region: process.env.CHAT_IDENTITY_REGION || 'us-east-1', maxAttempts: 3 });
  const table = process.env.CHAT_TABLE, key = sk => ({ pk: PK, sk });
  const get = async sk => (await db.send(new GetCommand({ TableName: table, Key: key(sk), ConsistentRead: true }))).Item;
  return {
    membership: () => get('MEMBERSHIP'),
    state: async role => await get('STATE#' + role) || { received: 0, read: 0 },
    request: id => get('REQUEST#' + id),
    activeUser: async sub => {
      try {
        const u = await cognito.send(new AdminGetUserCommand({ UserPoolId: process.env.CHAT_POOL, Username: sub }));
        return u.Enabled === true && u.UserStatus === 'CONFIRMED' && u.UserAttributes.some(a => a.Name === 'sub' && a.Value === sub);
      } catch (e) { if (e.name === 'UserNotFoundException') return false; throw e; }
    },
    messages: async cursor => {
      const page = await db.send(new QueryCommand({ TableName: table, KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: { ':pk': PK, ':prefix': 'M#' }, ScanIndexForward: false, ConsistentRead: true,
        Limit: 80, ...(cursor ? { ExclusiveStartKey: key(cursor) } : {}) }));
      return { messages: (page.Items || []).map(row => row.message), cursor: page.LastEvaluatedKey?.sk || null };
    },
    send: async ({ subject, role, partner, fingerprint, message }) => {
      const minute = Math.floor(Date.now() / 60000);
      await db.send(new TransactWriteCommand({ TransactItems: [
        { ConditionCheck: { TableName: table, Key: key('MEMBERSHIP'), ConditionExpression: 'active = :yes AND subjects.#subject = :role',
          ExpressionAttributeNames: { '#subject': subject }, ExpressionAttributeValues: { ':yes': true, ':role': role } } },
        { Put: { TableName: table, Item: { ...key('M#' + message.created + '#' + message.id), message }, ConditionExpression: 'attribute_not_exists(pk)' } },
        { Put: { TableName: table, Item: { ...key('REQUEST#' + message.id), subject, fingerprint, message }, ConditionExpression: 'attribute_not_exists(pk)' } },
        { Update: { TableName: table, Key: key('STATE#' + partner), UpdateExpression: 'ADD received :one', ExpressionAttributeValues: { ':one': 1 } } },
        { Update: { TableName: table, Key: key('RATE#' + subject + '#' + minute),
          UpdateExpression: 'SET #count = if_not_exists(#count, :zero) + :one',
          ConditionExpression: 'attribute_not_exists(#count) OR #count < :limit',
          ExpressionAttributeNames: { '#count': 'count' },
          ExpressionAttributeValues: { ':zero': 0, ':one': 1, ':limit': 12 } } }
      ] }));
    },
    markRead: async (role, received) => {
      if (!received) return;
      try {
        await db.send(new UpdateCommand({ TableName: table, Key: key('STATE#' + role),
          UpdateExpression: 'SET #read = :received', ConditionExpression: 'received >= :received AND (attribute_not_exists(#read) OR #read <= :received)',
          ExpressionAttributeNames: { '#read': 'read' }, ExpressionAttributeValues: { ':received': received } }));
      } catch (e) {
        if (e.name !== 'ConditionalCheckFailedException') throw e;
        const state = await get('STATE#' + role);
        if ((state?.read || 0) < received) throw error(400, 'Invalid read position.');
      }
    }
  };
}
let live;
exports.handler = event => {
  live ||= createHandler(awsRepository(), { clientId: process.env.CHAT_CLIENT,
    issuer: 'https://cognito-idp.' + (process.env.CHAT_IDENTITY_REGION || 'us-east-1') + '.amazonaws.com/' + process.env.CHAT_POOL });
  return live(event);
};
exports.createHandler = createHandler;
