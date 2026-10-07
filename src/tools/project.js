// src/tools/project.js
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { workspaceRoot, resolveInside } from '../core/workspace.js';
import { runCommand } from './shell.js';

const execFileAsync = promisify(execFile);

const ECOSYSTEMS = [
  { file: 'package.json', ecosystem: 'node', test: 'npm test', build: 'npm run build' },
  { file: 'requirements.txt', ecosystem: 'python', test: 'python3 -m pytest', build: null },
  { file: 'pyproject.toml', ecosystem: 'python', test: 'python3 -m pytest', build: null },
  { file: 'Cargo.toml', ecosystem: 'rust', test: 'cargo test', build: 'cargo build' },
  { file: 'go.mod', ecosystem: 'go', test: 'go test ./...', build: 'go build ./...' }
];

export async function detectProject() {
  const root = workspaceRoot();
  const found = [];
  for (const eco of ECOSYSTEMS) {
    try { await fs.access(path.join(root, eco.file)); found.push(eco); }
    catch { /* ausente */ }
  }
  let packageJson = null;
  try { packageJson = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')); } catch { /* opcional */ }
  return {
    root,
    ecosystems: found.map((f) => f.ecosystem),
    testCommand: found[0]?.test || null,
    buildCommand: found[0]?.build || null,
    scripts: packageJson?.scripts || {},
    name: packageJson?.name || path.basename(root),
    version: packageJson?.version || null
  };
}

async function toolExists(bin) {
  try {
    const { stdout, stderr } = await execFileAsync(bin, ['--version'], { timeout: 4000, windowsHide: true });
    return { installed: true, version: (stdout || stderr).split(/\r?\n/)[0].trim() };
  } catch { return { installed: false, version: null }; }
}

export async function diagnostics() {
  const bins = ['node', 'npm', 'git', 'rg', 'python3'];
  const tools = {};
  for (const bin of bins) tools[bin] = await toolExists(bin);
  const project = await detectProject();
  return {
    platform: `${os.platform()} ${os.arch()}`,
    node: process.version,
    cwd: workspaceRoot(),
    tools,
    project
  };
}

export const projectTools = {
  project_analyze: {
    description: 'Analisa o projeto atual: linguagens, scripts, comando de teste e build.',
    permission: 'READ',
    async run() { return detectProject(); }
  },
  diagnostics: {
    description: 'Diagnóstico do ambiente (node, npm, git, ripgrep, python).',
    permission: 'READ',
    async run() { return diagnostics(); }
  },
  run_tests: {
    description: 'Executa a suíte de testes detectada para o projeto.',
    permission: 'EXECUTE',
    params: { command: { type: 'string', optional: true } },
    async run({ command } = {}) {
      const project = await detectProject();
      const cmd = command || project.testCommand;
      if (!cmd) throw Object.assign(new Error('Nenhum comando de teste detectado.'), { status: 400 });
      return runCommand({ command: cmd, timeoutMs: 150000 });
    }
  },
  run_command: {
    description: 'Executa um comando permitido no terminal controlado (sem shell/metacaracteres).',
    permission: 'EXECUTE',
    params: { command: { type: 'string', required: true }, confirm: { type: 'boolean', optional: true } },
    async run({ command, confirm = false }) {
      const { isDestructive } = await import('./shell.js');
      if (isDestructive(command) && !confirm) {
        throw Object.assign(new Error('Comando potencialmente destrutivo: inclua confirm=true para autorizar.'), { status: 403 });
      }
      return runCommand({ command, timeoutMs: 150000 });
    }
  }
};

export { resolveInside };
