// src/providers/transport.js
import { callOpenAIChat, streamOpenAIChat } from './openai-chat.js';
import { callGemini, streamGemini } from './gemini.js';
import { callOpenCode } from './opencode.js';
import { recordSuccess, recordFailure } from './registry.js';
import { metrics } from '../core/metrics.js';
import { envInt } from '../core/env.js';

function adapter(provider) {
  if (provider.transport === 'gemini') return { call: callGemini, stream: streamGemini };
  if (provider.transport === 'opencode-responses') return { call: callOpenCode, stream: null };
  return { call: callOpenAIChat, stream: streamOpenAIChat };
}

export async function rawCall(provider, payload) {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), envInt('REQUEST_TIMEOUT_MS', 120000));
  try {
    const result = await adapter(provider).call(provider, { ...payload, signal: controller.signal });
    recordSuccess(provider.id, Date.now() - started);
    metrics.counter('provider.requests', { provider: provider.id, ok: true });
    metrics.observe('provider.latency', Date.now() - started, { provider: provider.id });
    return result;
  } catch (error) {
    recordFailure(provider.id, error.status, error.message);
    metrics.counter('provider.requests', { provider: provider.id, ok: false });
    if (error.name === 'AbortError') { error.status = 504; error.message = 'Timeout do provider.'; }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function supportsStreaming(provider) {
  return Boolean(provider.supportsStreaming) && Boolean(adapter(provider).stream);
}

export async function rawStream(provider, payload) {
  const streamFn = adapter(provider).stream;
  if (!streamFn) return rawCall(provider, payload);
  const started = Date.now();
  try {
    const result = await streamFn(provider, payload);
    recordSuccess(provider.id, Date.now() - started);
    metrics.observe('provider.latency', Date.now() - started, { provider: provider.id, stream: true });
    return result;
  } catch (error) {
    recordFailure(provider.id, error.status, error.message);
    throw error;
  }
}
