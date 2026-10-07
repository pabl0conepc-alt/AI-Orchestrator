// src/orchestrator/invoke.js
import { rawCall, rawStream, supportsStreaming } from '../providers/transport.js';
import { isOpen, registerSuccess, registerFailure } from './breaker.js';
import { shouldFallback, backoffMs } from './policy.js';
import { getCircuitState } from './breaker.js';

// Invoca um provider aplicando circuit breaker.
export async function callProvider(provider, payload) {
  if (!provider?.configured) {
    const error = new Error(`Provider ${provider?.id || 'desconhecido'} não está configurado.`);
    error.status = 400;
    throw error;
  }
  if (isOpen(provider.id)) {
    const error = new Error(`Provider ${provider.id} pausado temporariamente após falhas repetidas.`);
    error.status = 503;
    throw error;
  }
  try {
    const result = await rawCall(provider, payload);
    registerSuccess(provider.id);
    return result;
  } catch (error) {
    registerFailure(provider.id);
    throw error;
  }
}

export async function callWithRetry(provider, payload, { retries = 2 } = {}) {
  const attempts = Math.max(1, Number(retries) || 1);
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await callProvider(provider, payload); }
    catch (error) {
      lastError = error;
      if (!shouldFallback(error) || attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, backoffMs(attempt)));
    }
  }
  throw lastError;
}

export async function streamProvider(provider, payload, onDelta) {
  if (!supportsStreaming(provider)) return callProvider(provider, payload);
  if (isOpen(provider.id)) {
    const error = new Error(`Provider ${provider.id} pausado temporariamente.`);
    error.status = 503;
    throw error;
  }
  try {
    const result = await rawStream(provider, { ...payload, onDelta });
    registerSuccess(provider.id);
    return result;
  } catch (error) {
    registerFailure(provider.id);
    throw error;
  }
}

export { getCircuitState };
