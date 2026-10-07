// src/tools/registry.js
import { assertPermission } from './permissions.js';
import { emit } from '../core/events.js';
import { logger } from '../core/logger.js';
import { metrics } from '../core/metrics.js';

const tools = new Map();

export function registerTool(name, def) {
  if (!def || typeof def.run !== 'function') throw new Error(`Ferramenta inválida: ${name}`);
  tools.set(name, { name, permission: def.permission || 'READ', description: def.description || '', params: def.params || {}, run: def.run });
}

export function registerTools(bundle) {
  for (const [name, def] of Object.entries(bundle)) registerTool(name, def);
}

export function listTools() {
  return [...tools.values()].map(({ name, description, permission, params }) => ({ name, description, permission, params }));
}

export function getTool(name) { return tools.get(name); }

export function validateParams(name, def, params = {}) {
  const out = {};
  for (const [key, spec] of Object.entries(def.params || {})) {
    const value = params[key];
    if (value === undefined || value === null || value === '') {
      if (spec.required) throw Object.assign(new Error(`Parâmetro obrigatório ausente em ${name}: ${key}`), { status: 400 });
      continue;
    }
    if (spec.type === 'number') {
      const num = Number(value);
      if (!Number.isFinite(num)) throw Object.assign(new Error(`Parâmetro ${key} deve ser numérico.`), { status: 400 });
      out[key] = num;
    } else if (spec.type === 'boolean') {
      out[key] = value === true || value === 'true';
    } else {
      out[key] = String(value);
    }
  }
  // Rejeita parâmetros desconhecidos para evitar surpresas.
  for (const key of Object.keys(params)) {
    if (!(def.params || {})[key]) throw Object.assign(new Error(`Parâmetro desconhecido em ${name}: ${key}`), { status: 400 });
  }
  return out;
}

export async function runTool(name, params = {}, { timeoutMs = 180000 } = {}) {
  const def = tools.get(name);
  if (!def) throw Object.assign(new Error(`Ferramenta não permitida: ${name}`), { status: 404 });
  assertPermission(def.permission, name);
  const args = validateParams(name, def, params);
  const started = Date.now();
  emit('tool.start', { tool: name, args: redactArgs(args) });
  let handle;
  const timer = new Promise((_, reject) => {
    handle = setTimeout(() => reject(Object.assign(new Error(`Timeout na ferramenta ${name}.`), { status: 504 })), timeoutMs);
  });
  try {
    const result = await Promise.race([def.run(args), timer]);
    const durationMs = Date.now() - started;
    metrics.counter('tool.runs', { tool: name, ok: true });
    metrics.observe('tool.duration', durationMs, { tool: name });
    emit('tool.done', { tool: name, ok: true, durationMs });
    logger.debug('tool', `OK ${name}`, { durationMs });
    return { tool: name, ok: true, durationMs, ...result };
  } catch (error) {
    const durationMs = Date.now() - started;
    metrics.counter('tool.runs', { tool: name, ok: false });
    emit('tool.done', { tool: name, ok: false, durationMs, error: error.message });
    logger.warn('tool', `Falha ${name}: ${error.message}`);
    return { tool: name, ok: false, durationMs, error: error.message, status: error.status || 500 };
  } finally {
    clearTimeout(handle);
  }
}

function redactArgs(args) {
  const out = {};
  for (const [k, v] of Object.entries(args)) out[k] = /content|secret|key|token/i.test(k) ? '[redacted]' : v;
  return out;
}
