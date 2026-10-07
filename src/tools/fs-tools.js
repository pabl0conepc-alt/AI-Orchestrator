// src/tools/fs-tools.js
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveInside, assertNotSymlinkEscape, listTree, readTextFile, writeTextFile } from '../core/workspace.js';
import { runCommand } from './shell.js';

export const fsTools = {
  list_files: {
    description: 'Lista arquivos e diretórios dentro do workspace (árvore com caminhos relativos).',
    permission: 'READ',
    params: { dir: { type: 'string', optional: true }, depth: { type: 'number', optional: true } },
    async run({ dir = '.', depth = 4 } = {}) {
      const entries = await listTree(dir, { depth });
      return { dir, count: entries.length, entries };
    }
  },

  read_file: {
    description: 'Lê o conteúdo de um arquivo de texto dentro do workspace.',
    permission: 'READ',
    params: { path: { type: 'string', required: true } },
    async run({ path: p }) {
      const content = await readTextFile(p);
      return { path: p, content, lines: content.split('\n').length };
    }
  },

  write_file: {
    description: 'Cria ou sobrescreve um arquivo de texto dentro do workspace.',
    permission: 'WRITE',
    params: { path: { type: 'string', required: true }, content: { type: 'string', required: true } },
    async run({ path: p, content }) {
      const result = await writeTextFile(p, content);
      return { ...result, ok: true };
    }
  },

  make_dir: {
    description: 'Cria um diretório (recursivo) dentro do workspace.',
    permission: 'WRITE',
    params: { path: { type: 'string', required: true } },
    async run({ path: p }) {
      const resolved = await assertNotSymlinkEscape(resolveInside(p));
      await fs.mkdir(resolved, { recursive: true });
      return { path: p, ok: true };
    }
  },

  search_code: {
    description: 'Pesquisa texto/padrão no código usando ripgrep (ou grep como fallback).',
    permission: 'READ',
    params: { query: { type: 'string', required: true }, path: { type: 'string', optional: true } },
    async run({ query, path: p = '.' } = {}) {
      const target = String(p);
      const result = await runCommand({ command: `rg --line-number --hidden --glob !node_modules ${JSON.stringify(query)} ${target}`, timeoutMs: 30000 });
      if (!result.ok && /not found|ENOENT/i.test(result.stderr || '')) {
        return runCommand({ command: `grep -rn ${JSON.stringify(query)} ${target}`, timeoutMs: 30000 });
      }
      return result;
    }
  },

  delete_file: {
    description: 'Remove um arquivo do workspace (requer permissão DELETE e confirmação).',
    permission: 'DELETE',
    params: { path: { type: 'string', required: true }, confirm: { type: 'boolean', optional: true } },
    async run({ path: p, confirm = false }) {
      if (!confirm) throw Object.assign(new Error('delete_file exige confirm=true.'), { status: 400 });
      const resolved = await assertNotSymlinkEscape(resolveInside(p));
      await fs.rm(resolved, { recursive: false, force: false });
      return { path: p, ok: true };
    }
  },

  move_file: {
    description: 'Move/renomeia um arquivo dentro do workspace.',
    permission: ['WRITE', 'DELETE'],
    params: { from: { type: 'string', required: true }, to: { type: 'string', required: true } },
    async run({ from, to }) {
      const src = await assertNotSymlinkEscape(resolveInside(from));
      const dst = await assertNotSymlinkEscape(resolveInside(to));
      await fs.mkdir(path.dirname(dst), { recursive: true });
      await fs.rename(src, dst);
      return { from, to, ok: true };
    }
  }
};
