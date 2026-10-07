// src/memory/project.js
// Inteligência persistente do projeto: arquitetura, tecnologias, convenções,
// arquivos-chave, decisões, bugs conhecidos e tarefas anteriores.
// O contexto enviado aos modelos é selecionado e compactado — não é o projeto inteiro.

import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from '../core/config.js';

const FILE = path.join(ROOT, 'data', 'project-memory.json');

const EMPTY = {
  architecture: [],
  technologies: [],
  conventions: [],
  keyFiles: [],
  decisions: [],
  knownBugs: [],
  tasks: [],
  updatedAt: null
};

export async function loadProjectMemory() {
  try {
    const text = await fs.readFile(FILE, 'utf8');
    return { ...EMPTY, ...JSON.parse(text) };
  } catch { return { ...EMPTY }; }
}

export async function saveProjectMemory(memory) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const trimmed = {
    ...memory,
    decisions: (memory.decisions || []).slice(-50),
    knownBugs: (memory.knownBugs || []).slice(-50),
    tasks: (memory.tasks || []).slice(-50),
    updatedAt: new Date().toISOString()
  };
  await fs.writeFile(FILE, JSON.stringify(trimmed, null, 2), 'utf8');
  return trimmed;
}

const CONVENTION_FILES = {
  '.editorconfig': 'editorconfig',
  '.eslintrc': 'eslint',
  '.eslintrc.json': 'eslint',
  'eslint.config.js': 'eslint',
  '.prettierrc': 'prettier',
  'tsconfig.json': 'typescript',
  '.github/workflows': 'ci',
  'Dockerfile': 'docker',
  'docker-compose.yml': 'docker-compose'
};

// Observa o projeto e atualiza a memória (idempotente).
export async function observeProject({ project, files = [] } = {}) {
  const memory = await loadProjectMemory();
  const root = project?.root || ROOT;

  // Arquitetura: diretórios de primeiro nível.
  const dirs = [...new Set(files.filter((f) => f.type === 'dir' && !f.path.includes('/')).map((f) => f.path))];
  memory.architecture = dirs.slice(0, 40);

  // Tecnologias.
  const tech = new Set([...(project?.ecosystems || []), ...memory.technologies]);
  let pkg = null;
  try { pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')); } catch { /* opcional */ }
  if (pkg?.dependencies) for (const dep of Object.keys(pkg.dependencies)) tech.add(dep);
  memory.technologies = [...tech].slice(0, 60);

  // Convenções por arquivos presentes.
  const present = new Set();
  for (const key of Object.keys(CONVENTION_FILES)) {
    try { await fs.access(path.join(root, key)); present.add(CONVENTION_FILES[key]); } catch { /* ausente */ }
  }
  if (pkg?.type === 'module') present.add('esm');
  if (files.some((f) => f.path.startsWith('tests') || f.path.includes('.test.'))) present.add('tests');
  memory.conventions = [...present].slice(0, 30);
  memory.projectName = pkg?.name || project?.name || memory.projectName;
  memory.testCommand = project?.testCommand || memory.testCommand || null;

  return saveProjectMemory(memory);
}

export async function recordDecision(decision) {
  const memory = await loadProjectMemory();
  memory.decisions.push({ ts: new Date().toISOString(), decision });
  return saveProjectMemory(memory);
}

export async function recordBug(bug) {
  const memory = await loadProjectMemory();
  memory.knownBugs.push({ ts: new Date().toISOString(), bug });
  return saveProjectMemory(memory);
}

export async function recordTask(task) {
  const memory = await loadProjectMemory();
  memory.tasks.push({ ts: new Date().toISOString(), task });
  return saveProjectMemory(memory);
}

// Seleção inteligente de contexto: escolhe o que é relevante para o pedido e
// compacta para respeitar `maxChars`, evitando mandar o projeto inteiro.
export function selectContext(memory, request, { maxChars = 4000 } = {}) {
  const words = String(request || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  const score = (text) => {
    const value = String(text || '').toLowerCase();
    return words.reduce((n, w) => n + (value.includes(w) ? 1 : 0), 0);
  };

  const lines = [];
  const pushIf = (label, values) => {
    const relevant = (values || []).map((v) => (typeof v === 'string' ? v : JSON.stringify(v)));
    if (!relevant.length) return;
    // Traz primeiro os itens relevantes ao pedido, depois o restante (limitado).
    const sorted = relevant.slice().sort((a, b) => score(b) - score(a));
    lines.push(`${label}: ${sorted.slice(0, 8).join('; ')}`);
  };

  pushIf('Project', [memory.projectName, memory.testCommand].filter(Boolean));
  pushIf('Technologies', memory.technologies);
  pushIf('Architecture', memory.architecture);
  pushIf('Conventions', memory.conventions);
  pushIf('Key files', (memory.keyFiles || []).map((f) => (typeof f === 'string' ? f : f.path)));
  pushIf('Recent decisions', (memory.decisions || []).slice(-6).map((d) => d.decision || d));
  pushIf('Known bugs', (memory.knownBugs || []).slice(-6).map((b) => b.bug || b));

  const text = lines.join('\n');
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n... [context compacted]` : text;
}
