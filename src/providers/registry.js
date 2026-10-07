// src/providers/registry.js
import { loadConfig } from '../core/config.js';

const health = new Map();

function normalize(id, p) {
  return {
    id,
    ...p,
    configured: Boolean(process.env[p.envKey]),
    priority: Number.isFinite(p.priority) ? p.priority : 100,
    models: Array.isArray(p.models) && p.models.length ? p.models : [p.defaultModel],
    capabilities: p.capabilities || { text: true, vision: false, tools: false, streaming: Boolean(p.supportsStreaming) }
  };
}

function healthFor(id) {
  if (!health.has(id)) {
    health.set(id, { requests: 0, errors: 0, totalMs: 0, avgLatencyMs: 0, errorRate: 0, lastError: null, lastOkAt: null, lastErrorAt: null });
  }
  return health.get(id);
}

export async function getProviders() {
  const { providers } = await loadConfig();
  return Object.entries(providers).map(([id, p]) => ({ ...normalize(id, p), health: deriveState(id) }));
}

export async function getProvider(id) {
  const { providers } = await loadConfig();
  const provider = providers[id];
  if (!provider) { const error = new Error(`Provider desconhecido: ${id}`); error.status = 404; throw error; }
  return { ...normalize(id, provider), health: deriveState(id) };
}

export async function eligibleProviders({ freeOnly = false, capability = null } = {}) {
  const all = await getProviders();
  return all.filter((p) => {
    if (!p.configured) return false;
    if (freeOnly && !p.freePool) return false;
    if (capability && !p.capabilities?.[capability]) return false;
    return p.health.state !== 'offline';
  });
}

export async function resourceCatalog({ configuredOnly = true } = {}) {
  const all = await getProviders();
  const entries = [];
  for (const provider of all) {
    if (configuredOnly && !provider.configured) continue;
    for (const modelId of provider.models) entries.push({ providerId: provider.id, modelId, provider });
  }
  return entries;
}

export function recordSuccess(id, ms) {
  const h = healthFor(id);
  h.requests += 1;
  h.totalMs += ms;
  h.avgLatencyMs = Math.round(h.totalMs / h.requests);
  h.errorRate = h.requests ? h.errors / h.requests : 0;
  h.lastOkAt = new Date().toISOString();
}

export function recordFailure(id, status, message) {
  const h = healthFor(id);
  h.requests += 1;
  h.errors += 1;
  h.errorRate = h.requests ? h.errors / h.requests : 0;
  h.lastError = message ? String(message).slice(0, 200) : `HTTP ${status || 'erro'}`;
  h.lastErrorAt = new Date().toISOString();
}

function deriveState(id) {
  const h = healthFor(id);
  let state = 'online';
  if (h.requests >= 3 && h.errorRate >= 0.6) state = 'degraded';
  if (h.requests >= 3 && h.errorRate >= 0.9) state = 'offline';
  return { ...h, state };
}

export function getHealth() {
  return Object.fromEntries([...health.keys()].map((id) => [id, deriveState(id)]));
}

export { deriveState };
export function resetHealth() { health.clear(); }
