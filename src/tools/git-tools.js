// src/tools/git-tools.js
import { runCommand } from './shell.js';

async function git(args, timeoutMs = 30000) {
  return runCommand({ command: `git ${args}`, timeoutMs });
}

function requireConfirm(action, confirm) {
  if (!confirm) throw Object.assign(new Error(`${action} exige confirm=true.`), { status: 400 });
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
  git_change_summary: {
    description: 'Resumo das mudanças atuais: branch, contagem por arquivo e diff stat.',
    permission: 'READ',
    async run() {
      const status = await git('status --short --branch');
      const stat = await git('diff --stat');
      const staged = await git('diff --cached --stat');
      const files = (status.stdout || '').split('\n').filter((l) => /^ ?[MADRU?]/.test(l)).map((l) => l.trim());
      return {
        branch: (status.stdout || '').split('\n')[0] || '',
        changedFiles: files,
        changedCount: files.length,
        unstagedChanges: (stat.stdout || '').trim(),
        stagedChanges: (staged.stdout || '').trim()
      };
    }
  },
  git_commit_suggest: {
    description: 'Sugere uma mensagem de commit a partir das mudanças atuais (heurística, sem commitar).',
    permission: 'READ',
    async run() {
      const stat = await git('diff --stat');
      const status = await git('status --short');
      const changed = (status.stdout || '').split('\n').filter(Boolean).map((l) => l.replace(/^\s*\S+\s+/, ''));
      const areas = [...new Set(changed.map((f) => f.split('/')[0]).filter(Boolean))].slice(0, 4);
      const verbs = changed.some((f) => /test/i.test(f)) ? 'test' : changed.some((f) => /doc|readme|\.md$/i.test(f)) ? 'docs' : 'feat';
      const subject = `${verbs}: update ${areas.join(', ') || 'project'}`;
      return { suggestion: subject, changedCount: changed.length, files: changed.slice(0, 30), diffStat: (stat.stdout || '').trim() };
    }
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
  git_snapshot: {
    description: 'Cria um checkpoint seguro das mudanças atuais sem alterar a árvore de trabalho (git stash create).',
    permission: 'READ',
    async run() {
      const result = await git('stash create');
      const sha = (result.stdout || '').trim();
      return { ok: result.ok, snapshot: sha || null, empty: !sha, note: sha ? 'Use git_rollback com este snapshot para restaurar.' : 'Sem mudanças para salvar.' };
    }
  },
  git_rollback: {
    description: 'Restaura um checkpoint criado por git_snapshot (exige confirmação).',
    permission: ['WRITE'],
    params: { snapshot: { type: 'string', required: true }, confirm: { type: 'boolean', optional: true } },
    async run({ snapshot, confirm = false }) {
      requireConfirm('git_rollback', confirm);
      return git(`stash apply ${JSON.stringify(String(snapshot))}`);
    }
  },
  git_create_branch: {
    description: 'Cria um novo branch (exige confirmação).',
    permission: ['WRITE'],
    params: { name: { type: 'string', required: true }, confirm: { type: 'boolean', optional: true } },
    async run({ name, confirm = false }) {
      requireConfirm('git_create_branch', confirm);
      return git(`checkout -b ${JSON.stringify(String(name))}`);
    }
  },
  git_switch_branch: {
    description: 'Troca para um branch existente (exige confirmação).',
    permission: ['WRITE'],
    params: { name: { type: 'string', required: true }, confirm: { type: 'boolean', optional: true } },
    async run({ name, confirm = false }) {
      requireConfirm('git_switch_branch', confirm);
      return git(`checkout ${JSON.stringify(String(name))}`);
    }
  },
  git_commit: {
    description: 'Cria um commit com os arquivos já preparados (exige confirmação).',
    permission: ['WRITE'],
    params: { message: { type: 'string', required: true }, confirm: { type: 'boolean', optional: true } },
    async run({ message, confirm = false }) {
      requireConfirm('git_commit', confirm);
      return git(`commit -m ${JSON.stringify(String(message))}`);
    }
  }
};
