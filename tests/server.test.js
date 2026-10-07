import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

let server;
let base;

test.before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => { if (server) server.close(); });

async function get(path) { const res = await fetch(base + path); return { status: res.status, body: await res.json() }; }
async function post(path, body) {
  const res = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}

test('GET /api/health', async () => {
  const { status, body } = await get('/api/health');
  assert.equal(status, 200);
  assert.equal(body.ok, true);
});

test('GET /api/providers lists the catalog', async () => {
  const { status, body } = await get('/api/providers');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body));
  assert.ok(body.length >= 10);
  assert.ok(body.every((p) => typeof p.configured === 'boolean'));
});

test('GET /api/models exposes capability matrix', async () => {
  const { status, body } = await get('/api/models');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.matrix));
});

test('GET /api/tools lists tools and permissions', async () => {
  const { status, body } = await get('/api/tools');
  assert.equal(status, 200);
  assert.ok(body.tools.length >= 8);
  assert.ok(body.permissions.some((p) => p.permission === 'READ'));
});

test('GET /api/project detects the node ecosystem', async () => {
  const { status, body } = await get('/api/project');
  assert.equal(status, 200);
  assert.ok(body.ecosystems.includes('node'));
  assert.equal(body.testCommand, 'npm test');
});

test('POST /api/chat rejects an empty conversation with 400', async () => {
  const { status, body } = await post('/api/chat', { messages: [] });
  assert.equal(status, 400);
  assert.match(body.error, /vazia/i);
});

test('POST /api/chat rejects malformed JSON with 400', async () => {
  const res = await fetch(base + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad json' });
  assert.equal(res.status, 400);
});

test('static index.html is served', async () => {
  const res = await fetch(base + '/');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /AI Orchestrator/);
});
