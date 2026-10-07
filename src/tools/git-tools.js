// src/tools/git-tools.js
import { runCommand } from './shell.js';

async function git(args, timeoutMs = 30000) {
  return runCommand({ command: `git ${args}`, timeoutMs });
}

export const gitTools = {
  git_status: {
    description: 'Mostra o status do repositório (branch + arquivos modificados).',
    permission: 'READ',
    async run() { return git('status --short --branch'); }
  },
  git_diff: {
    description: 'Mostra o diff (stat por padrão; use full para diff completo).',
    permission: 'READ',
    params: { full: { type: 'boolean', optional: true } },
    async run({ full = false } = {}) { return git(full ? 'diff' : 'diff --stat'); }
  },
  git_log: {
    description: 'Lista commits recentes.',
    permission: 'READ',
    params: { limit: { type: 'number', optional: true } },
    async run({ limit = 15 } = {}) { return git(`log --oneline -n ${Math.max(1, Math.min(100, Number(limit) || 15))}`); }
  },
  git_branches: {
    description: 'Lista branches locais e remotas.',
    permission: 'READ',
    async run() { return git('branch -a'); }
  },
  git_show: {
    description: 'Mostra um commit específico.',
    permission: 'READ',
    params: { ref: { type: 'string', required: true } },
    async run({ ref }) { return git(`show --stat ${JSON.stringify(String(ref))}`); }
  },
  git_stash_list: {
    description: 'Lista entradas de stash.',
    permission: 'READ',
    async run() { return git('stash list'); }
  },
  git_create_branch: {
    description: 'Cria um novo branch (operação de escrita; exige confirmação).',
    permission: ['WRITE'],
    params: { name: { type: 'string', required: true }, confirm: { type: 'boolean', optional: true } },
    async run({ name, confirm = false }) {
      if (!confirm) throw Object.assign(new Error('git_create_branch exige confirm=true.'), { status: 400 });
      return git(`checkout -b ${JSON.stringify(String(name))}`);
    }
  },
  git_commit: {
    description: 'Cria um commit com os arquivos já preparados (exige confirmação).',
    permission: ['WRITE'],
    params: { message: { type: 'string', required: true }, confirm: { type: 'boolean', optional: true } },
    async run({ message, confirm = false }) {
      if (!confirm) throw Object.assign(new Error('git_commit exige confirm=true.'), { status: 400 });
      return git(`commit -m ${JSON.stringify(String(message))}`);
    }
  }
};
