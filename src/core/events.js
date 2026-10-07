// src/core/events.js
// Barramento de eventos do sistema. Alimenta a timeline da UI via SSE (Server-Sent Events).
// Tipos: task.*, agent.*, tool.*, provider.*, message.*, log.*

const subscribers = new Set();
const ring = [];
const MAX_RING = 1000;
let seq = 0;

export function emit(type, payload = {}) {
  const event = {
    id: ++seq,
    ts: new Date().toISOString(),
    type,
    ...payload
  };
  ring.push(event);
  if (ring.length > MAX_RING) ring.shift();
  for (const sub of subscribers) {
    try { sub(event); } catch { /* subscriber quebrado não pode derrubar o emissor */ }
  }
  return event;
}

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function history(limit = 200, sinceId = 0) {
  return ring.filter((e) => e.id > sinceId).slice(-limit);
}

export function resetEvents() { ring.length = 0; seq = 0; }
