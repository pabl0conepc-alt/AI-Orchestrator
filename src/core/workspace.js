// src/core/workspace.js
// Resolução do workspace e caminhos seguros. Toda operação de arquivo passa por `resolveInside`.
import path from 'node:path';
import fs from 'node:fs/promises';
import { ROOT } from './config.js';

export function workspaceRoot() {
  const configured = process.env.WORKSPACE_ROOT?.trim();
  return path.resolve(configured || ROOT);
}

// Garante que o caminho resolvido permaneça dentro da raiz do workspace.
// Rejeita traversal (../), caminhos absolutos externos e symlinks que escapam.
export function resolveInside(target = '.') {
  const root = workspaceRoot();
  const normalized = path.isAbsolute(target) ? target : path.join(root, target);
  const resolved = path.resolve(normalized);
  const rel = path.relative(root, resolved);
  if (rel === '') return root;
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    const error = new Error(`Caminho fora do workspace: ${target}`);
    error.status = 403;
    error.code = 'OUTSIDE_WORKSPACE';
    throw error;
  }
  return resolved;
}

export async function assertNotSymlinkEscape(resolved) {
  try {
    const real = await fs.realpath(resolved);
    const rootReal = await fs.realpath(workspaceRoot());
    const rel = path.relative(rootReal, real);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      const error = new Error('Symlink aponta para fora do workspace.');
      error.status = 403;
      error.code = 'SYMLINK_ESCAPE';
      throw error;
    }
    return real;
  } catch (error) {
    if (error.code === 'ENOENT') return resolved; // caminho novo ainda não existe
    throw error;
  }
}

const IGNORED = new Set(['node_modules', '.git', 'dist', 'build', '.cache', 'coverage']);
const MAX_ENTRIES = 4000;

export async function listTree(dir = '.', { depth = 6, includeIgnored = false } = {}) {
  const start = resolveInside(dir);
  const out = [];
  async function walk(current, level, prefix) {
    if (out.length >= MAX_ENTRIES) return;
    let entries;
    try { entries = await fs.readdir(current, { withFileTypes: true }); }
    catch { return; }
    entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (!includeIgnored && IGNORED.has(entry.name)) continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        out.push({ path: rel, type: 'dir' });
        if (level < depth) await walk(full, level + 1, rel);
      } else if (entry.isFile()) {
        let size = 0;
        try { size = (await fs.stat(full)).size; } catch { /* ignore */ }
        out.push({ path: rel, type: 'file', size });
      }
    }
  }
  await walk(start, 0, '');
  return out;
}

export async function readTextFile(rel) {
  const resolved = await assertNotSymlinkEscape(resolveInside(rel));
  const stat = await fs.stat(resolved);
  if (stat.size > 2_000_000) throw new Error('Arquivo muito grande para leitura (limite 2MB).');
  return fs.readFile(resolved, 'utf8');
}

export async function writeTextFile(rel, content) {
  const resolved = await assertNotSymlinkEscape(resolveInside(rel));
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, String(content ?? ''), 'utf8');
  return { path: rel, bytes: Buffer.byteLength(String(content ?? '')) };
}
