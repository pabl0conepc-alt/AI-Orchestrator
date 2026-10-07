// src/core/logger.js
// Log estruturado com redaction de segredos e ring buffer em memória.
// Nunca imprime valores de chaves: apenas nomes de campos sensíveis são mascarados.

const SECRET_KEY = /(key|token|secret|password|authorization|bearer|credential)/i;
const SECRET_VALUE = /(sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,}|AIza[A-Za-z0-9_-]{10,})/g;

const ring = [];
const MAX_RING = 500;

function redact(value, depth = 0) {
  if (depth > 4) return '[deep]';
  if (value == null) return value;
  if (typeof value === 'string') return value.replace(SECRET_VALUE, '[redacted]');
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEY.test(k) ? '[redacted]' : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

function write(level, scope, message, meta) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    scope,
    message: String(message ?? '').replace(SECRET_VALUE, '[redacted]'),
    ...(meta ? { meta: redact(meta) } : {})
  };
  ring.push(entry);
  if (ring.length > MAX_RING) ring.shift();
  if (process.env.LOG_LEVEL !== 'silent') {
    const line = `[${entry.ts}] ${level.toUpperCase()} ${scope} ${entry.message}`;
    if (level === 'error') console.error(line, entry.meta ?? '');
    else if (level === 'warn') console.warn(line, entry.meta ?? '');
    else if (process.env.LOG_LEVEL !== 'quiet') console.log(line);
  }
  return entry;
}

export const logger = {
  debug: (scope, message, meta) => write('debug', scope, message, meta),
  info: (scope, message, meta) => write('info', scope, message, meta),
  warn: (scope, message, meta) => write('warn', scope, message, meta),
  error: (scope, message, meta) => write('error', scope, message, meta),
  recent: (limit = 100) => ring.slice(-limit),
  redact
};
