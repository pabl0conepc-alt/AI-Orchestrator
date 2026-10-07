import test from 'node:test';
import assert from 'node:assert/strict';
import { modelKey, parseModelKey, normalizeModelId, equivalenceKey, familyOf } from '../src/models/identity.js';
import { selectDiverse, dedupeEquivalent, TASK_PROFILES, scoreEntry } from '../src/models/selection.js';
import { profileFor } from '../src/models/matrix.js';

test('model identity is provider:model', () => {
  assert.equal(modelKey('nvidia', 'llama-3.3-70b'), 'nvidia:llama-3.3-70b');
  assert.deepEqual(parseModelKey('groq:llama-3.3-70b'), { providerId: 'groq', modelId: 'llama-3.3-70b' });
});

test('normalizeModelId strips vendor prefix and suffixes', () => {
  assert.equal(normalizeModelId('meta/llama-3.3-70b-instruct'), 'llama-3.3-70b');
  assert.equal(normalizeModelId('deepseek-ai/DeepSeek-V3'), 'deepseek-v3');
});

test('same model name across providers shares equivalence key', () => {
  assert.equal(equivalenceKey('meta/llama-3.3-70b-instruct'), equivalenceKey('llama-3.3-70b-instruct'));
});

test('familyOf detects families', () => {
  assert.equal(familyOf('deepseek-ai/DeepSeek-V3'), 'deepseek');
  assert.equal(familyOf('Qwen/Qwen2.5-Coder-32B-Instruct'), 'qwen');
  assert.equal(familyOf('gemini-2.5-flash'), 'gemini');
});

test('dedupeEquivalent keeps the highest-scored instance of an equivalent model', () => {
  const entries = [
    { providerId: 'nvidia', modelId: 'meta/llama-3.3-70b-instruct', score: 0.8, key: 'a' },
    { providerId: 'groq', modelId: 'llama-3.3-70b-instruct', score: 0.7, key: 'b' }
  ];
  const deduped = dedupeEquivalent(entries);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].providerId, 'nvidia');
});

test('dedupeEquivalent keeps genuinely different models separate', () => {
  const entries = [
    { providerId: 'nvidia', modelId: 'meta/llama-3.3-70b-instruct', score: 0.8, key: 'a' },
    { providerId: 'groq', modelId: 'llama-3.3-70b-versatile', score: 0.7, key: 'b' }
  ];
  assert.equal(dedupeEquivalent(entries).length, 2);
});

test('selectDiverse favors different providers when deduping', async () => {
  const entries = [
    { providerId: 'nvidia', modelId: 'meta/llama-3.3-70b-instruct', provider: { id: 'nvidia', configured: true, freePool: true } },
    { providerId: 'groq', modelId: 'llama-3.3-70b-versatile', provider: { id: 'groq', configured: true, freePool: true } },
    { providerId: 'deepseek', modelId: 'deepseek-chat', provider: { id: 'deepseek', configured: true, freePool: false } },
    { providerId: 'mistral', modelId: 'codestral-latest', provider: { id: 'mistral', configured: true, freePool: true } }
  ];
  const chosen = await selectDiverse(entries, 3, TASK_PROFILES.general, { preferFree: true });
  const providers = new Set(chosen.map((c) => c.providerId));
  assert.equal(providers.size, chosen.length); // provider diversity
});

test('manual selection respects the exact user choice', async () => {
  const entries = [
    { providerId: 'nvidia', modelId: 'meta/llama-3.3-70b-instruct', provider: { id: 'nvidia', configured: true } },
    { providerId: 'groq', modelId: 'llama-3.3-70b-versatile', provider: { id: 'groq', configured: true } }
  ];
  const chosen = await selectDiverse(entries, 2, TASK_PROFILES.general, { manualKeys: ['groq'] });
  assert.equal(chosen.length, 1);
  assert.equal(chosen[0].providerId, 'groq');
});

test('capability matrix resolves known model profiles', async () => {
  const coder = await profileFor('siliconflow', 'Qwen/Qwen2.5-Coder-32B-Instruct', { id: 'siliconflow' });
  assert.ok(coder.capabilities.coding >= 0.9);
  assert.equal(coder.family, 'qwen');
});

test('scoreEntry rewards capability match', async () => {
  const security = await scoreEntry({ providerId: 'deepseek', modelId: 'deepseek-reasoner', provider: { id: 'deepseek', configured: true, health: {} } }, TASK_PROFILES.security);
  const fast = await scoreEntry({ providerId: 'cerebras', modelId: 'llama3.1-8b', provider: { id: 'cerebras', configured: true, health: {} } }, TASK_PROFILES.security);
  assert.ok(security.score > fast.score);
});
