// src/core/config.js
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../..');

async function readJson(rel) {
  const text = await fs.readFile(path.join(ROOT, rel), 'utf8');
  try { return JSON.parse(text); }
  catch (error) { throw new Error(`JSON inválido em ${rel}: ${error.message}`); }
}

let cache = null;

export async function loadConfig() {
  if (cache) return cache;
  const [providers, models] = await Promise.all([
    readJson('config/providers.json'),
    readJson('config/models.json')
  ]);
  cache = { providers, models };
  return cache;
}

export function invalidateConfig() { cache = null; }
