import test from 'node:test';
import assert from 'node:assert/strict';
import { gitTools } from '../src/tools/git-tools.js';

test('git_change_summary returns structured data', async () => {
  const result = await gitTools.git_change_summary.run();
  assert.ok('branch' in result);
  assert.ok('changedCount' in result);
  assert.ok(Array.isArray(result.changedFiles));
});

test('git_commit_suggest proposes a message without committing', async () => {
  const result = await gitTools.git_commit_suggest.run();
  assert.equal(typeof result.suggestion, 'string');
  assert.ok(result.suggestion.length > 0);
});

test('git_rollback requires confirmation', async () => {
  await assert.rejects(() => gitTools.git_rollback.run({ snapshot: 'abc' }), (e) => e.status === 400);
});

test('git_switch_branch requires confirmation', async () => {
  await assert.rejects(() => gitTools.git_switch_branch.run({ name: 'main' }), (e) => e.status === 400);
});

test('git_snapshot is non-destructive and reports a snapshot id or empty', async () => {
  const result = await gitTools.git_snapshot.run();
  assert.equal(typeof result.ok, 'boolean');
  assert.ok('empty' in result);
});
