import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { makeServer } from '../src/server.js';
import { createStore } from '../src/db.js';

async function withServer(run) {
  const store = createStore(':memory:');
  const server = makeServer(store);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (url, method = 'GET', user = 'ava', body) => {
    const res = await fetch(`${base}${url}`, {
      method, headers: { cookie: `collabdoc_user=${user}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
    return { status: res.status, body: await res.json() };
  };
  try { await run(call); }
  finally { await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve())); store.close(); }
}

test('Owner sharing grants editor access while unrelated users remain blocked', async () => withServer(async call => {
  const created = await call('/api/documents', 'POST', 'ava', { title: 'Roadmap' });
  assert.equal(created.status, 201);
  const id = created.body.document.id;
  assert.equal((await call(`/api/documents/${id}`, 'GET', 'jordan')).status, 403);
  assert.equal((await call(`/api/documents/${id}/share`, 'POST', 'sam', { userId: 'jordan' })).status, 403);
  assert.equal((await call(`/api/documents/${id}/share`, 'POST', 'ava', { userId: 'sam' })).status, 200);
  const sharedList = await call('/api/documents', 'GET', 'sam');
  assert.equal(sharedList.body.shared.length, 1);
  const updated = await call(`/api/documents/${id}`, 'PATCH', 'sam', { title: 'Roadmap Revised', expectedVersion: 1 });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.document.version, 2);
  assert.equal((await call(`/api/documents/${id}`, 'PATCH', 'ava', { title: 'Stale write', expectedVersion: 1 })).status, 409);
  assert.equal((await call(`/api/documents/${id}`, 'GET', 'ava')).body.document.title, 'Roadmap Revised');
  assert.equal((await call(`/api/documents/${id}/share/sam`, 'DELETE', 'ava')).status, 200);
  assert.equal((await call(`/api/documents/${id}`, 'GET', 'sam')).status, 403);
}));

test('File import creates an editable owned document that can be reopened', async () => withServer(async call => {
  const created = await call('/api/import', 'POST', 'jordan', { filename: 'notes.md', content: '## Agenda\n1. Discuss plans\n2. Share notes' });
  assert.equal(created.status, 201);
  const id = created.body.document.id;
  const reopened = await call(`/api/documents/${id}`, 'GET', 'jordan');
  assert.equal(reopened.body.document.title, 'notes');
  assert.equal(reopened.body.document.content.content[0].type, 'heading');
  assert.equal(reopened.body.document.content.content[1].type, 'orderedList');
  assert.equal((await call(`/api/documents/${id}`, 'GET', 'sam')).status, 403);
}));

test('Malformed content is rejected as 400 and does not corrupt the persisted document', async () => withServer(async call => {
  const created = await call('/api/documents', 'POST', 'ava', { title: 'Safe' });
  const id = created.body.document.id;
  const malformed = { type: 'doc', content: [{ type: 'bulletList', content: [null] }] };
  assert.equal((await call(`/api/documents/${id}`, 'PATCH', 'ava', { content: malformed, expectedVersion: 1 })).status, 400);
  const opened = await call(`/api/documents/${id}`, 'GET', 'ava');
  assert.equal(opened.body.document.version, 1);
}));
