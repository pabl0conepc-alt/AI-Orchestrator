import test from 'node:test';
import assert from 'node:assert/strict';
import { countDisagreements, runSuperMode } from '../src/agents/super.js';

test('countDisagreements detects disagreement signals', () => {
  assert.equal(countDisagreements(['DISAGREEMENTS: none', 'This approach is incorrect and insecure.']), 1);
  assert.equal(countDisagreements(['looks good', 'no issues']), 0);
  assert.equal(countDisagreements([]), 0);
});

test('Super Mode requires at least two distinct models', async () => {
  const catalog = [{ providerId: 'a', modelId: 'm', provider: { id: 'a', configured: true, freePool: true } }];
  await assert.rejects(() => runSuperMode({ request: 'do something', catalog }), (e) => e.status === 400);
});
