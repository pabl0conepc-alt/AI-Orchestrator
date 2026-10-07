import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt, listPromptModules, PROMPT_VERSION } from '../src/prompts/engine.js';

test('prompt modules are versioned and ordered', () => {
  const modules = listPromptModules();
  assert.ok(modules.length >= 6);
  assert.ok(modules.every((m) => m.version && m.id));
  const orders = modules.map((m) => m.order);
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
});

test('prompt engine exposes a semantic version', () => {
  assert.match(PROMPT_VERSION, /^\d+\.\d+\.\d+$/);
});

test('buildSystemPrompt composes enabled sections in order', async () => {
  const prompt = await buildSystemPrompt({
    profile: 'coding',
    roleInstruction: 'You are the Architect.',
    intent: 'build a login system',
    tools: [{ name: 'read_file', params: { path: {} }, description: 'read a file' }]
  }, { sections: ['base', 'codingPolicy', 'agentRole', 'taskContext', 'toolInstructions', 'outputContract'] });
  assert.match(prompt, /You are the Architect\./);
  assert.match(prompt, /read_file/);
  assert.match(prompt, /build a login system/);
  assert.ok(prompt.indexOf('You are the Architect.') < prompt.indexOf('read_file'));
});

test('tool section is explicit when tools are disabled', async () => {
  const prompt = await buildSystemPrompt({ profile: 'coding', tools: [] }, { sections: ['toolInstructions'] });
  assert.match(prompt, /Tool use is disabled/i);
});

test('general profile produces a general-purpose policy', async () => {
  const prompt = await buildSystemPrompt({ profile: 'general' }, { sections: ['codingPolicy'] });
  assert.match(prompt, /general-purpose/i);
});

test('project context section renders only when a project is provided', async () => {
  const withProject = await buildSystemPrompt({ project: { root: '/x', ecosystems: ['node'], languages: ['JS'] } }, { sections: ['projectContext'] });
  assert.match(withProject, /Ecosystems: node/);
  const withoutProject = await buildSystemPrompt({}, { sections: ['projectContext'] });
  assert.equal(withoutProject, '');
});

test('security section can be disabled', async () => {
  const off = await buildSystemPrompt({ security: false }, { sections: ['securityRules'] });
  assert.equal(off, '');
});
