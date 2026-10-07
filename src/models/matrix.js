// src/models/matrix.js
import { loadConfig } from '../core/config.js';
import { familyOf, normalizeModelId } from './identity.js';

export const CAPABILITIES = ['coding', 'reasoning', 'speed', 'context', 'tools', 'vision', 'security', 'research', 'writing'];

let compiled = null;

async function profiles() {
  if (compiled) return compiled;
  const { models } = await loadConfig();
  compiled = {
    default: models.default,
    list: models.profiles.map((p) => ({ ...p, regex: new RegExp(p.match, 'i') }))
  };
  return compiled;
}

export function invalidateMatrix() { compiled = null; }

// Retorna o perfil de capacidade de um modelo (com override opcional do provider).
export async function profileFor(providerId, modelId, provider = {}) {
  const { default: base, list } = await profiles();
  const id = normalizeModelId(modelId);
  const matched = list.find((p) => p.regex.test(id)) || list.find((p) => p.regex.test(String(modelId)));
  const profile = matched || base;
  const caps = { ...base.capabilities, ...(profile.capabilities || {}) };

  // Ajustes por provider: Groq/Cerebras são muito rápidos, providers grandes tendem a latência maior.
  if (provider.id === 'groq' || provider.id === 'cerebras') caps.speed = Math.min(1, caps.speed + 0.15);
  if (!provider.capabilities?.vision) caps.vision = 0;
  if (provider.capabilities?.tools === false) caps.tools = Math.min(caps.tools, 0.2);

  return {
    providerId,
    modelId,
    family: profile.family || familyOf(modelId),
    size: profile.size || 'medium',
    capabilities: caps
  };
}

// Matriz completa para exibição na UI: cada recurso provider:model com seu vetor.
export async function capabilityMatrix(entries) {
  const rows = [];
  for (const entry of entries) {
    const profile = await profileFor(entry.providerId, entry.modelId, entry.provider || { id: entry.providerId });
    rows.push({
      key: `${entry.providerId}:${entry.modelId}`,
      providerId: entry.providerId,
      modelId: entry.modelId,
      family: profile.family,
      size: profile.size,
      capabilities: profile.capabilities
    });
  }
  return rows;
}
