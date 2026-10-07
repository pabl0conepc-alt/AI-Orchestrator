// src/orchestrator/policy.js
// Regras puras e testáveis: quando cair para outro provider, como resolver modelo e como compactar contexto.

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const TEMPORARY_MESSAGE = /rate|quota|limit|temporar|unavailable|timeout|credits|balance|overloaded|capacity|busy|too many|exceeded/i;
const MODEL_ERROR_MESSAGE = /model.*(not found|not available|unsupported|invalid|does not exist)|unsupported.*model|invalid model|unknown model/i;

export function isModelSpecificError(error = {}) {
  return Number(error.status || 0) === 400 && MODEL_ERROR_MESSAGE.test(String(error.message || ''));
}

export function shouldFallback(error = {}) {
  const status = Number(error.status || 0);
  if (RETRYABLE_STATUS.has(status) || status === 401 || status === 402 || status === 403) return true;
  if (TEMPORARY_MESSAGE.test(String(error.message || ''))) return true;
  return isModelSpecificError(error) || (status === 404 && /model|deployment|endpoint/i.test(String(error.message || '')));
}

// Regras de segurança: erros de validação do usuário nunca devem disparar fallback cego.
export function isUserError(error = {}) {
  const status = Number(error.status || 0);
  if (status === 400 && !isModelSpecificError(error)) return true;
  return false;
}

export function resolveModel(provider, requestedModel) {
  const requested = String(requestedModel || '').trim();
  if (!requested || requested === 'auto') return provider.defaultModel;
  if (requested.startsWith(`${provider.id}:`)) return requested.slice(provider.id.length + 1);
  return requested;
}

export function rankProviders(providers, { primaryId, preferFree = false } = {}) {
  return [...providers]
    .filter(Boolean)
    .sort((a, b) => {
      const aPrimary = a.id === primaryId ? 1 : 0;
      const bPrimary = b.id === primaryId ? 1 : 0;
      if (aPrimary !== bPrimary) return bPrimary - aPrimary;
      const aHealth = a.health?.state === 'offline' ? 1 : a.health?.state === 'degraded' ? 0.5 : 0;
      const bHealth = b.health?.state === 'offline' ? 1 : b.health?.state === 'degraded' ? 0.5 : 0;
      if (aHealth !== bHealth) return aHealth - bHealth;
      if (preferFree && a.freePool !== b.freePool) return Number(b.freePool) - Number(a.freePool);
      return (a.priority ?? 100) - (b.priority ?? 100);
    });
}

export function compactMessages(messages, maxChars = 90000, minKeep = 4) {
  const normalized = Array.isArray(messages) ? messages.filter(Boolean) : [];
  const total = normalized.reduce((n, m) => n + String(m.content || '').length, 0);
  if (total <= maxChars) return normalized;

  const system = normalized.filter((m) => m.role === 'system');
  const nonSystem = normalized.filter((m) => m.role !== 'system');
  const kept = [];
  let size = system.reduce((n, m) => n + String(m.content || '').length, 0);
  for (let i = nonSystem.length - 1; i >= 0; i--) {
    const len = String(nonSystem[i].content || '').length;
    if (size + len > maxChars && kept.length >= minKeep) break;
    kept.unshift(nonSystem[i]);
    size += len;
  }
  const dropped = nonSystem.length - kept.length;
  const summary = dropped > 0
    ? [{ role: 'system', content: `[${dropped} mensagens antigas foram compactadas para caber no contexto.]` }]
    : [];
  return [...system, ...summary, ...kept];
}

export function backoffMs(attempt) {
  const base = 350 * (2 ** Math.max(0, attempt - 1));
  return Math.min(5000, base + Math.floor(Math.random() * 120));
}

// Extrai o primeiro bloco JSON de um texto de modelo (tolerante a cercas de código).
export function extractJson(text) {
  const raw = String(text || '');
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try { return JSON.parse(candidate.slice(start, end + 1)); }
  catch { return null; }
}
