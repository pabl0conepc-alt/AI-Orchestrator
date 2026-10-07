// src/tools/shell.js
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { workspaceRoot } from '../core/workspace.js';
import { logger } from '../core/logger.js';

const execFileAsync = promisify(execFile);

// Binários permitidos no terminal controlado. Nada de shell (`sh -c`) para evitar injeção.
export const ALLOWED_BINARIES = new Set([
  'node', 'npm', 'npx', 'git', 'rg', 'python3', 'diff',
  'ls', 'cat', 'head', 'tail', 'wc', 'pwd', 'echo', 'grep', 'find', 'tree'
]);

// Padrões destrutivos que exigem confirmação explícita e permissão DELETE.
const DESTRUCTIVE = [
  /\brm\b/i, /\bmv\b/i, /\bdd\b/i, /\bmkfs\b/i, /\bsudo\b/i, /\bkill\b/i, /\bchmod\b/i, /\bchown\b/i,
  /git\s+push/i, /git\s+reset\s+--hard/i, /git\s+clean/i, /git\s+branch\s+-D/i, /git\s+checkout\s+--/i,
  /\bcurl\b/i, /\bwget\b/i, /npm\s+publish/i, /shutdown/i, /reboot/i
];

const MAX_OUTPUT = 200_000;

// Tokeniza respeitando aspas, sem interpretar metacaracteres de shell.
export function tokenize(command) {
  const text = String(command || '').trim();
  if (!text) throw Object.assign(new Error('Comando vazio.'), { status: 400 });
  if (/[;|&`$><]/.test(stripQuoted(text))) {
    const error = new Error('Metacaracteres de shell não são permitidos no terminal controlado.');
    error.status = 400;
    error.code = 'UNSAFE_COMMAND';
    throw error;
  }
  const tokens = [];
  const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3]);
  }
  return tokens;
}

function stripQuoted(text) {
  return text.replace(/"[^"]*"|'[^']*'/g, ' ');
}

export function isDestructive(command) {
  const text = String(command || '');
  return DESTRUCTIVE.some((re) => re.test(text));
}

export async function runCommand({ command, cwd = '.', timeoutMs = 120000 } = {}) {
  const tokens = tokenize(command);
  const [bin, ...args] = tokens;
  if (!ALLOWED_BINARIES.has(bin)) {
    const error = new Error(`Binário não permitido: ${bin}. Permitidos: ${[...ALLOWED_BINARIES].join(', ')}`);
    error.status = 403;
    error.code = 'BINARY_NOT_ALLOWED';
    throw error;
  }
  const workdir = cwd ? new URL(`file://${workspaceRoot()}/`).pathname : workspaceRoot();
  const started = Date.now();
  try {
    const { stdout, stderr } = await execFileAsync(bin, args, {
      cwd: workdir,
      timeout: Math.min(timeoutMs, 180000),
      maxBuffer: MAX_OUTPUT * 4,
      windowsHide: true
    });
    logger.info('tool.shell', `Executado: ${bin}`, { args: args.length });
    return { ok: true, bin, args, stdout: clip(stdout), stderr: clip(stderr), durationMs: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      bin,
      args,
      code: error.code ?? 1,
      stdout: clip(error.stdout || ''),
      stderr: clip(error.stderr || error.message || ''),
      durationMs: Date.now() - started
    };
  }
}

function clip(text, max = MAX_OUTPUT) {
  const value = String(text || '');
  return value.length > max ? `${value.slice(0, max)}\n... [saída truncada]` : value;
}
