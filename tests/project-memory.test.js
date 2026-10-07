import test from 'node:test';
import assert from 'node:assert/strict';
import { observeProject, loadProjectMemory, selectContext, recordDecision, recordBug } from '../src/memory/project.js';

test('observeProject records technologies, architecture and conventions', async () => {
  const memory = await observeProject({
    project: { root: process.cwd(), ecosystems: ['node'], scripts: { test: 'node --test' }, testCommand: 'npm test' },
    files: [{ path: 'src', type: 'dir' }, { path: 'tests', type: 'dir' }, { path: 'src/server.js', type: 'file' }]
  });
  assert.ok(memory.technologies.includes('node'));
  assert.ok(memory.architecture.includes('src'));
  assert.ok(memory.conventions.includes('esm'));
  assert.equal(memory.testCommand, 'npm test');
});

test('recordDecision and recordBug persist entries', async () => {
  await recordDecision('Use JWT for authentication');
  await recordBug('Race condition in worker pool');
  const memory = await loadProjectMemory();
  assert.ok(memory.decisions.some((d) => /JWT/.test(d.decision)));
  assert.ok(memory.knownBugs.some((b) => /Race condition/.test(b.bug)));
});

test('selectContext returns a compacted string', async () => {
  const memory = await loadProjectMemory();
  const context = selectContext(memory, 'implement authentication login', { maxChars: 200 });
  assert.equal(typeof context, 'string');
  assert.ok(context.length <= 240);
});

test('selectContext prioritizes request-relevant items first', async () => {
  const memory = {
    projectName: 'demo',
    technologies: ['node', 'postgres', 'redis'],
    architecture: ['src', 'public'],
    conventions: ['esm', 'tests'],
    decisions: [],
    knownBugs: [],
    keyFiles: [],
    tasks: []
  };
  const context = selectContext(memory, 'redis caching', { maxChars: 4000 });
  assert.ok(context.indexOf('redis') < context.indexOf('postgres') || !context.includes('postgres'));
});
