import test from 'node:test';
import assert from 'node:assert/strict';
import { MessageBus, MESSAGE_TYPES } from '../src/agents/bus.js';
import { heuristicPlan, normalizePlan, hasCycle, reviewRejected } from '../src/agents/master.js';
import { extractToolCalls } from '../src/agents/worker.js';

test('message bus records typed inter-agent messages', () => {
  const bus = new MessageBus('run1');
  const msg = bus.post({ from: 'architect', to: 'implementer', type: 'instruction', taskId: 't1', priority: 'high', content: 'use JWT' });
  assert.equal(msg.from, 'architect');
  assert.equal(msg.to, 'implementer');
  assert.equal(bus.thread('t1').length, 1);
  assert.equal(bus.inbox('implementer').length, 1);
  assert.ok(MESSAGE_TYPES.includes(msg.type));
});

test('message bus rejects invalid type', () => {
  const bus = new MessageBus('run2');
  assert.throws(() => bus.post({ from: 'a', to: 'b', type: 'nonsense' }));
});

test('message bus digest summarizes recent activity', () => {
  const bus = new MessageBus('run3');
  bus.post({ from: 'a', to: 'b', type: 'instruction', content: 'do this' });
  bus.post({ from: 'b', to: 'a', type: 'result', content: 'done' });
  const digest = bus.digest();
  assert.equal(digest.length, 2);
  assert.match(digest[0], /instruction/);
});

test('heuristic plan is acyclic with real dependencies', () => {
  const plan = heuristicPlan('Crie um sistema de autenticação completo', 'hive');
  assert.ok(plan.tasks.length >= 4);
  assert.equal(hasCycle(plan.tasks), false);
  const impl = plan.tasks.find((t) => t.role === 'implementer');
  assert.ok(impl.dependsOn.length >= 1);
});

test('normalizePlan rejects cyclic plans', () => {
  const cyclic = { tasks: [
    { id: 'a', role: 'architect', dependsOn: ['b'] },
    { id: 'b', role: 'implementer', dependsOn: ['a'] }
  ] };
  assert.equal(normalizePlan(cyclic), null);
});

test('normalizePlan fixes invalid roles and unknown dependencies', () => {
  const plan = normalizePlan({ tasks: [
    { id: 'x', role: 'wizard', instruction: 'do', dependsOn: ['nope'] },
    { id: 'y', role: 'reviewer', instruction: 'review', dependsOn: ['x'] }
  ] });
  assert.equal(plan.tasks[0].role, 'implementer');
  assert.deepEqual(plan.tasks[0].dependsOn, []);
  assert.deepEqual(plan.tasks[1].dependsOn, ['x']);
});

test('reviewRejected detects rejection without blanket approval', () => {
  assert.equal(reviewRejected('A revisão reprovou: bug crítico encontrado.'), true);
  assert.equal(reviewRejected('Aprovado, looks good.'), false);
});

test('extractToolCalls parses tool blocks from agent output', () => {
  const text = 'vou ler o arquivo\n```tool\n{ "tool": "read_file", "params": { "path": "src/x.js" } }\n```\nfim';
  const { clean, calls } = extractToolCalls(text);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].tool, 'read_file');
  assert.equal(calls[0].params.path, 'src/x.js');
  assert.ok(!clean.includes('```tool'));
});
