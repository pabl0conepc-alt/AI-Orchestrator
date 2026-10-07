// src/memory/store.js
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from '../core/config.js';

const DIR = path.join(ROOT, 'data');

async function ensure() { await fs.mkdir(DIR, { recursive: true }); }

function fileFor(id) { return path.join(DIR, `run-${id}.json`); }

export function createRun(task, { mode = 'hive' } = {}) {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    task,
    mode,
    status: 'running',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    plan: null,
    tasks: [],
    messages: [],
    filesTouched: [],
    testsRun: [],
    errors: [],
    decisions: [],
    finalAnswer: null
  };
}

// Memória incremental: registra o fato e persiste (best-effort, nunca derruba a run).
export async function remember(run, fact) {
  run.updatedAt = new Date().toISOString();
  if (fact.type === 'file') push(run.filesTouched, fact.path);
  else if (fact.type === 'test') push(run.testsRun, fact.result);
  else if (fact.type === 'error') push(run.errors, fact.error);
  else if (fact.type === 'decision') push(run.decisions, fact.decision);
  await save(run);
}

function push(list, item) { if (item != null) list.push(item); }

export async function save(run) {
  try {
    await ensure();
    await fs.writeFile(fileFor(run.id), JSON.stringify(run, null, 2), 'utf8');
  } catch { /* memória é best-effort */ }
}

export async function loadRun(id) {
  try {
    const text = await fs.readFile(fileFor(id), 'utf8');
    return JSON.parse(text);
  } catch { return null; }
}

export async function listRuns(limit = 20) {
  try {
    await ensure();
    const files = (await fs.readdir(DIR)).filter((f) => f.startsWith('run-') && f.endsWith('.json'));
    const runs = [];
    for (const file of files) {
      try {
        const run = JSON.parse(await fs.readFile(path.join(DIR, file), 'utf8'));
        runs.push({ id: run.id, task: run.task, mode: run.mode, status: run.status, createdAt: run.createdAt, updatedAt: run.updatedAt });
      } catch { /* ignora arquivo corrompido */ }
    }
    return runs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, limit);
  } catch { return []; }
}
