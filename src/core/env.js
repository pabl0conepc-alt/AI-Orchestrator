// src/core/env.js
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './config.js';

// Carrega .env local apenas se a variável ainda não estiver no ambiente.
// Nunca expõe valores; apenas popula process.env.
export async function loadEnv(file = path.join(ROOT, '.env')) {
  try {
    const text = await fs.readFile(file, 'utf8');
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx < 1) continue;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch { /* .env ausente é normal */ }
}

export function envInt(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function envBool(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return !/^(false|0|no|off)$/i.test(String(value));
}
