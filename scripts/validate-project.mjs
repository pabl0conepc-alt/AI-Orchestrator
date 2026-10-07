import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = process.cwd();

const required = [
  'package.json',
  'config/providers.json',
  'config/models.json',
  'prompts/coding-system.md',
  'src/server.js',
  'src/core/config.js',
  'src/core/workspace.js',
  'src/models/selection.js',
  'src/orchestrator/engine.js',
  'src/orchestrator/policy.js',
  'src/agents/master.js',
  'src/agents/hive.js',
  'src/agents/super.js',
  'src/agents/worker.js',
  'src/prompts/engine.js',
  'src/memory/project.js',
  'src/tools/registry.js',
  'public/index.html',
  'public/app.js',
  'public/i18n.js',
  'public/styles.css',
  'LICENSE',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'docs/INSTALLATION.md',
  'docs/CONFIGURATION.md',
  'docs/PROVIDERS.md'
];

for (const file of required) {
  try { await fs.access(path.join(root, file)); }
  catch { throw new Error(`Arquivo obrigatório ausente: ${file}`); }
}

// Valida todos os JSONs versionados de config.
for (const json of ['package.json', 'config/providers.json', 'config/models.json']) {
  JSON.parse(await fs.readFile(path.join(root, json), 'utf8'));
}

// Verifica sintaxe de todo o JavaScript (src, tests, public e scripts).
const targets = ['src', 'tests', 'public', 'scripts'];
const files = [];
async function walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.isFile() && (full.endsWith('.js') || full.endsWith('.mjs'))) files.push(full);
  }
}
for (const target of targets) await walk(path.join(root, target));
for (const file of files) await execFileAsync(process.execPath, ['--check', file], { cwd: root });

console.log(`Build/validação OK: ${required.length} arquivos obrigatórios e ${files.length} arquivos JS verificados.`);
