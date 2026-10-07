import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldFallback, isUserError, resolveModel, compactMessages, rankProviders, backoffMs, extractJson } from '../src/orchestrator/policy.js';

test('fallback: rate limiting', () => assert.equal(shouldFallback({ status: 429 }), true));
test('fallback: temporary provider error', () => assert.equal(shouldFallback({ status: 503 }), true));
test('fallback: model mismatch 400', () => assert.equal(shouldFallback({ status: 400, message: 'model not found' }), true));
test('fallback: ordinary validation error does not fallback', () => assert.equal(shouldFallback({ status: 400, message: 'invalid request field' }), false));
test('fallback: unauthorized credentials failover', () => assert.equal(shouldFallback({ status: 401, message: 'invalid api key' }), true));
test('fallback: model error as 404', () => assert.equal(shouldFallback({ status: 404, message: 'model not found' }), true));
test('isUserError flags generic 400', () => assert.equal(isUserError({ status: 400, message: 'bad field' }), true));

test('resolveModel: default for empty and auto', () => {
  const p = { id: 'nvidia', defaultModel: 'x' };
  assert.equal(resolveModel(p, ''), 'x');
  assert.equal(resolveModel(p, 'auto'), 'x');
});
test('resolveModel: provider-scoped model', () => {
  const p = { id: 'nvidia', defaultModel: 'x' };
  assert.equal(resolveModel(p, 'nvidia:abc'), 'abc');
});

test('compactMessages keeps newest context and summarises drops', () => {
  const input = Array.from({ length: 30 }, (_, i) => ({ role: 'user', content: `${i}-` + 'x'.repeat(500) }));
  const result = compactMessages(input, 6000, 4);
  assert.ok(result.length < input.length);
  assert.equal(result.at(-1).content.startsWith('29-'), true);
});

test('rankProviders keeps primary first', () => {
  const p = [{ id: 'b', priority: 1 }, { id: 'a', priority: 90 }];
  assert.deepEqual(rankProviders(p, { primaryId: 'a' }).map((x) => x.id), ['a', 'b']);
});

test('rankProviders prefers healthy providers', () => {
  const p = [{ id: 'a', priority: 1, health: { state: 'offline' } }, { id: 'b', priority: 5, health: { state: 'online' } }];
  assert.equal(rankProviders(p, {}).map((x) => x.id)[0], 'b');
});

test('backoff is bounded and positive', () => {
  for (let i = 1; i <= 6; i++) {
    const ms = backoffMs(i);
    assert.ok(ms > 0 && ms <= 5200);
  }
});

test('extractJson parses fenced JSON', () => {
  const parsed = extractJson('text before ```json\n{"a": 1}\n``` after');
  assert.deepEqual(parsed, { a: 1 });
});
