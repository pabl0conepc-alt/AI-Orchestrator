import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyNeed } from '../src/orchestrator/engine.js';

test('classifyNeed detects security work', () => {
  assert.equal(classifyNeed('revise a autenticação e possíveis vulnerabilidades'), 'security');
});
test('classifyNeed detects debugging', () => {
  assert.equal(classifyNeed('o teste falhou, corrija o bug'), 'debug');
});
test('classifyNeed detects architecture', () => {
  assert.equal(classifyNeed('defina a arquitetura do backend'), 'architect');
});
test('classifyNeed detects implementation', () => {
  assert.equal(classifyNeed('implemente um CRUD de usuários'), 'implement');
});
test('classifyNeed falls back to general', () => {
  assert.equal(classifyNeed('olá, tudo bem?'), 'general');
});
