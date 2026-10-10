const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createHandler } = require('../handler.cjs');
const issuer = 'https://cognito.example', clientId = 'client';
function fixture() {
  const rows = [], requests = new Map(), states = { Zac: { received: 0, read: 0 }, Kerri: { received: 0, read: 0 } };
  const members = { active: true, subjects: { zac: 'Zac', kerri: 'Kerri' } }, disabled = new Set();
  const repo = {
    membership: async () => members, activeUser: async sub => !disabled.has(sub), state: async role => ({ ...states[role] }),
    request: async id => requests.get(id), messages: async () => ({ messages: [...rows].reverse(), cursor: null }),
    send: async input => {
      if (!members.active || !members.subjects[input.subject] || requests.has(input.message.id)) throw Object.assign(new Error(), { name: 'TransactionCanceledException' });
      requests.set(input.message.id, input); rows.push(input.message); states[input.partner].received++;
    },
    markRead: async (role, received) => { if (received > states[role].received) throw Object.assign(new Error('Invalid read position.'), { status: 400 }); states[role].read = Math.max(states[role].read, received); }
  };
  const handler = createHandler(repo, { issuer, clientId });
  const call = async (sub, path, method = 'GET', body, changes = {}) => {
    const event = { rawPath: '/api/chat/' + path, requestContext: { http: { method }, authorizer: { jwt: { claims: { sub, client_id: clientId, iss: issuer, token_use: 'access', ...changes } } } }, ...(body ? { body: JSON.stringify(body) } : {}) };
    const r = await handler(event); return { status: r.statusCode, ...JSON.parse(r.body) };
  };
  return { call, handler, rows, states, members, disabled, repo };
}
test('two members exchange attributed messages; outsiders and ID tokens cannot read', async () => {
  const f = fixture();
  assert.equal((await f.call('outsider', 'messages')).status, 403);
  assert.equal((await f.call('zac', 'messages', 'GET', null, { token_use: 'id' })).status, 401);
  assert.equal((await f.handler({ rawPath: '/api/chat/messages', requestContext: { http: { method: 'GET' } } })).statusCode, 401);
  assert.equal((await f.call('zac', 'messages', 'POST', { text: 'Hello Kerri', requestId: randomUUID(), name: 'Kerri' })).message.name, 'Zac');
  assert.equal((await f.call('kerri', 'messages')).messages[0].text, 'Hello Kerri');
  assert.equal((await f.call('kerri', 'messages', 'POST', { text: 'Hello Zac', requestId: randomUUID() })).status, 201);
  assert.equal((await f.call('zac', 'session')).unread, 1);
});
test('retries preserve exactly one message and reject changed content or sender', async () => {
  const f = fixture(), requestId = randomUUID(), body = { text: 'Hi', requestId };
  assert.equal((await f.call('zac', 'messages', 'POST', body)).status, 201);
  assert.equal((await f.call('zac', 'messages', 'POST', body)).status, 200);
  assert.equal((await f.call('zac', 'messages', 'POST', { ...body, text: 'Changed' })).status, 409);
  assert.equal((await f.call('kerri', 'messages', 'POST', body)).status, 409);
  assert.equal(f.rows.length, 1); assert.equal(f.states.Kerri.received, 1);
});
test('read snapshots leave concurrent arrivals unread and acknowledgements never regress', async () => {
  const f = fixture(), send = () => f.call('zac', 'messages', 'POST', { text: 'hi', requestId: randomUUID() });
  await send(); const page = await f.call('kerri', 'messages'); await send();
  await f.call('kerri', 'read', 'POST', { received: page.received });
  assert.equal((await f.call('kerri', 'session')).unread, 1);
  await f.call('kerri', 'read', 'POST', { received: 2 }); await f.call('kerri', 'read', 'POST', { received: 1 });
  assert.equal((await f.call('kerri', 'session')).unread, 0);
  assert.equal((await f.call('kerri', 'read', 'POST', { received: 3 })).status, 400);
});
test('disabled users and revoked memberships lose access even with existing token', async () => {
  const f = fixture(); f.disabled.add('zac'); assert.equal((await f.call('zac', 'messages')).status, 403);
  f.members.active = false; assert.equal((await f.call('kerri', 'messages')).status, 403);
});
test('membership revoked between authorization and persistence prevents send', async () => {
  const f = fixture(), original = f.repo.send;
  f.repo.send = async input => { f.members.active = false; return original(input); };
  assert.equal((await f.call('zac', 'messages', 'POST', { text: 'blocked', requestId: randomUUID() })).status, 409);
  assert.equal(f.rows.length, 0);
});
test('empty, oversized and malformed input fail; sender markup stays inert data', async () => {
  const f = fixture();
  for (const text of ['', '  ', 'x'.repeat(4001)]) assert.equal((await f.call('zac', 'messages', 'POST', { text, requestId: randomUUID() })).status, 400);
  assert.equal((await f.call('zac', 'messages', 'POST', { text: 'hi', requestId: 'bad' })).status, 400);
  const text = '<script>alert(1)</script>';
  assert.equal((await f.call('zac', 'messages', 'POST', { text, requestId: randomUUID() })).message.text, text);
});
