import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, isDestructive, ALLOWED_BINARIES } from '../src/tools/shell.js';
import { resolveInside, workspaceRoot } from '../src/core/workspace.js';
import { registerAllTools, runTool, listTools } from '../src/tools/index.js';
import { assertPermission } from '../src/tools/permissions.js';

registerAllTools();

test('tokenize splits quoted arguments', () => {
  assert.deepEqual(tokenize('git commit -m "hello world"'), ['git', 'commit', '-m', 'hello world']);
});

test('tokenize rejects shell metacharacters', () => {
  assert.throws(() => tokenize('ls; rm -rf /'), (e) => e.code === 'UNSAFE_COMMAND');
  assert.throws(() => tokenize('cat x | grep y'), (e) => e.code === 'UNSAFE_COMMAND');
  assert.throws(() => tokenize('echo $(whoami)'), (e) => e.code === 'UNSAFE_COMMAND');
});

test('destructive commands are detected', () => {
  assert.equal(isDestructive('git push origin main'), true);
  assert.equal(isDestructive('rm -rf build'), true);
  assert.equal(isDestructive('npm test'), false);
});

test('allowlist contains expected binaries only', () => {
  assert.ok(ALLOWED_BINARIES.has('npm'));
  assert.ok(ALLOWED_BINARIES.has('git'));
  assert.ok(!ALLOWED_BINARIES.has('bash'));
  assert.ok(!ALLOWED_BINARIES.has('sh'));
});

test('resolveInside blocks path traversal', () => {
  assert.throws(() => resolveInside('../../etc/passwd'), (e) => e.status === 403);
  assert.ok(resolveInside('src/index.js').startsWith(workspaceRoot()));
});

test('runTool rejects an unknown tool', async () => {
  await assert.rejects(() => runTool('not_a_tool', {}), (e) => e.status === 404);
});

test('runTool rejects unknown parameters before executing', async () => {
  await assert.rejects(() => runTool('read_file', { path: 'package.json', bogus: 'x' }), (e) => e.status === 400 && /desconhecido/i.test(e.message));
});

test('delete_file requires confirmation even when DELETE is enabled', async () => {
  const original = process.env.TOOLS_ALLOW_DELETE;
  process.env.TOOLS_ALLOW_DELETE = 'true';
  const result = await runTool('delete_file', { path: 'nothing.txt' });
  assert.equal(result.ok, false);
  assert.match(result.error, /confirm=true/i);
  if (original === undefined) delete process.env.TOOLS_ALLOW_DELETE; else process.env.TOOLS_ALLOW_DELETE = original;
});

test('listTools exposes registered tools with permissions', () => {
  const tools = listTools().map((t) => t.name);
  for (const expected of ['read_file', 'write_file', 'git_status', 'run_command', 'run_tests', 'project_analyze']) {
    assert.ok(tools.includes(expected), `faltando ${expected}`);
  }
});

test('assertPermission blocks disabled permissions', () => {
  const original = process.env.TOOLS_ALLOW_DELETE;
  process.env.TOOLS_ALLOW_DELETE = 'false';
  assert.throws(() => assertPermission('DELETE', 'delete_file'), (e) => e.status === 403);
  if (original === undefined) delete process.env.TOOLS_ALLOW_DELETE; else process.env.TOOLS_ALLOW_DELETE = original;
});
