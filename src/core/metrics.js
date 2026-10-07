// src/core/metrics.js
// Métricas em memória: contadores, latências e erros por dimensão. Sem segredos.

const counters = new Map();
const durations = new Map();

function bump(name, labels = {}, by = 1) {
  const key = `${name}${labelSuffix(labels)}`;
  counters.set(key, (counters.get(key) || 0) + by);
}

function observe(name, ms, labels = {}) {
  const key = `${name}${labelSuffix(labels)}`;
  const list = durations.get(key) || [];
  list.push(Number(ms) || 0);
  if (list.length > 200) list.shift();
  durations.set(key, list);
}

function labelSuffix(labels) {
  const parts = Object.entries(labels).map(([k, v]) => `${k}=${v}`);
  return parts.length ? `{${parts.join(',')}}` : '';
}

function stats(list) {
  if (!list.length) return { count: 0, avg: 0, p50: 0, p95: 0, max: 0 };
  const sorted = [...list].sort((a, b) => a - b);
  const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  return { count: sorted.length, avg: Math.round(avg), p50: at(0.5), p95: at(0.95), max: sorted[sorted.length - 1] };
}

export const metrics = {
  counter: (name, labels, by) => bump(name, labels, by),
  observe,
  snapshot() {
    const out = { counters: Object.fromEntries(counters), timings: {} };
    for (const [key, list] of durations) out.timings[key] = stats(list);
    return out;
  },
  reset() { counters.clear(); durations.clear(); }
};
