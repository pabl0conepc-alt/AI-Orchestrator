// src/orchestrator/breaker.js
import { envInt } from '../core/env.js';

const breaker = new Map();

function now() { return Date.now(); }

export function isOpen(providerId) {
  const state = breaker.get(providerId);
  if (!state) return false;
  return state.openUntil > now();
}

export function registerSuccess(providerId) { breaker.delete(providerId); }

export function registerFailure(providerId) {
  const previous = breaker.get(providerId) || { failures: 0, openUntil: 0 };
  const failures = previous.failures + 1;
  const threshold = envInt('CIRCUIT_FAILURE_THRESHOLD', 3);
  const cooldown = envInt('CIRCUIT_COOLDOWN_MS', 30000);
  breaker.set(providerId, { failures, openUntil: failures >= threshold ? now() + cooldown : 0 });
}

export function getCircuitState() {
  return Object.fromEntries([...breaker.entries()].map(([id, state]) => [id, { ...state, open: state.openUntil > now() }]));
}

export function resetBreaker() { breaker.clear(); }
