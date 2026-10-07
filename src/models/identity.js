// src/models/identity.js
// Identidade de modelo. Regra central: um modelo é SEMPRE identificado por `providerId:modelId`,
// porque o mesmo nome em providers diferentes é um recurso computacional diferente.

export function modelKey(providerId, modelId) {
  return `${providerId}:${modelId}`;
}

export function parseModelKey(key) {
  const raw = String(key || '');
  const idx = raw.indexOf(':');
  if (idx < 1) return { providerId: raw || null, modelId: null };
  return { providerId: raw.slice(0, idx), modelId: raw.slice(idx + 1) };
}

// Remove prefixos de vendor para comparação de equivalência ("meta/llama-3.3" -> "llama-3.3").
export function normalizeModelId(modelId) {
  return String(modelId || '')
    .toLowerCase()
    .trim()
    .replace(/^[a-z0-9._-]+\//, '')
    .replace(/:(latest|free|instruct|chat)$/, '')
    .replace(/-instruct$/, '')
    .replace(/-latest$/, '');
}

// Assinatura usada para deduplicação: dois recursos equivalentes compartilham a assinatura.
export function equivalenceKey(modelId) {
  return normalizeModelId(modelId).replace(/[._]/g, '-');
}

// Família aproximada do modelo, útil para diversidade.
export function familyOf(modelId) {
  const id = normalizeModelId(modelId);
  if (/llama/.test(id)) return 'llama';
  if (/qwen/.test(id)) return 'qwen';
  if (/deepseek/.test(id)) return 'deepseek';
  if (/gemini|palm/.test(id)) return 'gemini';
  if (/mistral|codestral|mixtral/.test(id)) return 'mistral';
  if (/gpt|oss/.test(id)) return 'gpt';
  if (/claude/.test(id)) return 'claude';
  if (/nemotron/.test(id)) return 'nemotron';
  return 'other';
}
