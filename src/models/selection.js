// src/models/selection.js
import { profileFor } from './matrix.js';
import { equivalenceKey, familyOf, modelKey } from './identity.js';

// Pesos por tipo de tarefa. O Master usa estes perfis para escolher o especialista.
export const TASK_PROFILES = {
  architect: { reasoning: 0.9, coding: 0.6, context: 0.5, research: 0.4 },
  planner: { reasoning: 0.8, coding: 0.5, context: 0.6, writing: 0.4 },
  research: { research: 0.9, reasoning: 0.5, context: 0.6, writing: 0.4 },
  security: { security: 0.9, reasoning: 0.7, coding: 0.5 },
  performance: { coding: 0.8, reasoning: 0.8, speed: 0.4 },
  uiux: { coding: 0.7, writing: 0.6, reasoning: 0.5 },
  implement: { coding: 1.0, tools: 0.5, reasoning: 0.4 },
  debug: { coding: 0.9, reasoning: 0.7, tools: 0.5 },
  test: { coding: 0.8, reasoning: 0.5, tools: 0.6 },
  review: { reasoning: 0.7, coding: 0.7, security: 0.4, writing: 0.3 },
  docs: { writing: 0.9, reasoning: 0.4, coding: 0.3 },
  devops: { tools: 0.8, coding: 0.7, reasoning: 0.5 },
  release: { tools: 0.7, coding: 0.6, reasoning: 0.5 },
  coordinate: { reasoning: 1.0, writing: 0.5, context: 0.5 },
  general: { reasoning: 0.5, coding: 0.5, writing: 0.5 }
};

function weightedScore(caps, needs) {
  const keys = Object.keys(needs);
  const totalWeight = keys.reduce((n, k) => n + needs[k], 0) || 1;
  let score = 0;
  for (const k of keys) score += (caps[k] ?? 0) * needs[k];
  return score / totalWeight;
}

// Fator de confiabilidade/disponibilidade/latência (0..1) por provider.
export function healthFactor(provider = {}) {
  if (provider.configured === false) return 0;
  const health = provider.health || {};
  if (health.state === 'offline') return 0.05;
  const errorRate = health.errorRate ?? 0;
  const reliability = 1 - Math.min(0.9, errorRate);
  const latencyMs = health.avgLatencyMs ?? 0;
  const latencyPenalty = latencyMs ? Math.min(0.4, latencyMs / 20000) : 0;
  const degraded = health.state === 'degraded' ? 0.6 : 1;
  return Math.max(0, reliability * degraded * (1 - latencyPenalty));
}

export async function scoreEntry(entry, needs = TASK_PROFILES.general, opts = {}) {
  const profile = await profileFor(entry.providerId, entry.modelId, entry.provider || { id: entry.providerId });
  const capabilityScore = weightedScore(profile.capabilities, needs);
  const health = healthFactor(entry.provider || {});
  const freeBonus = opts.preferFree && entry.provider?.freePool ? 0.08 : 0;
  const score = capabilityScore * 0.7 + health * 0.3 + freeBonus;
  return { ...entry, key: modelKey(entry.providerId, entry.modelId), family: profile.family, capabilities: profile.capabilities, score };
}

// Remove recursos equivalentes (mesmo modelo em providers diferentes) mantendo o melhor.
export function dedupeEquivalent(entries) {
  const best = new Map();
  for (const entry of entries) {
    const eq = equivalenceKey(entry.modelId);
    const current = best.get(eq);
    if (!current || (entry.score ?? 0) > (current.score ?? 0)) best.set(eq, entry);
  }
  return [...best.values()];
}

async function rankAll(entries, needs, opts) {
  const scored = [];
  for (const entry of entries) scored.push(await scoreEntry(entry, needs, opts));
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

// Seleção com diversidade: evita pegar o mesmo provider/modelo/família repetidas vezes.
export async function selectDiverse(entries, count, needs = TASK_PROFILES.general, opts = {}) {
  const { manualKeys, ...rest } = opts;

  // Modo manual: respeita exatamente a escolha do usuário (sem dedup).
  if (Array.isArray(manualKeys) && manualKeys.length) {
    const picked = [];
    for (const key of manualKeys) {
      const entry = entries.find((e) => modelKey(e.providerId, e.modelId) === key || e.providerId === key);
      if (entry) picked.push(await scoreEntry(entry, needs, rest));
    }
    return picked;
  }

  const ranked = await rankAll(entries, needs, rest);
  const deduped = dedupeEquivalent(ranked);
  const chosen = [];
  const usedProviders = new Set();
  const usedFamilies = new Set();

  // Passada 1: máxima diversidade (provider + família distintos).
  for (const entry of deduped) {
    if (chosen.length >= count) break;
    if (usedProviders.has(entry.providerId) || usedFamilies.has(entry.family)) continue;
    chosen.push(entry);
    usedProviders.add(entry.providerId);
    usedFamilies.add(entry.family);
  }
  // Passada 2: completa com família distinta, provider já usado.
  for (const entry of deduped) {
    if (chosen.length >= count) break;
    if (chosen.includes(entry) || usedFamilies.has(entry.family)) continue;
    chosen.push(entry);
    usedFamilies.add(entry.family);
  }
  // Passada 3: completa com o restante por score.
  for (const entry of deduped) {
    if (chosen.length >= count) break;
    if (!chosen.includes(entry)) chosen.push(entry);
  }
  return chosen;
}

export function diversityReport(chosen) {
  const providers = new Set(chosen.map((c) => c.providerId));
  const families = new Set(chosen.map((c) => c.family || familyOf(c.modelId)));
  const models = new Set(chosen.map((c) => equivalenceKey(c.modelId)));
  return { count: chosen.length, providerDiversity: providers.size, familyDiversity: families.size, modelDiversity: models.size };
}

export { modelKey, equivalenceKey, familyOf };
