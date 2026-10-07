// src/agents/super.js
// Super Mode — orquestração avançada multi-modelo:
//   Round 1: cada modelo compatível propõe uma solução independente (em paralelo).
//   Round 2: cada modelo critica as propostas anônimas e entrega versão corrigida (em paralelo).
//   Consenso: o coordenador compara, resolve discordâncias e entrega uma implementação única.
// Nunca consome mais modelos do que o necessário (limite configurável e diversidade real).

import { executeTask } from './worker.js';
import { synthesize } from './master.js';
import { selectDiverse, TASK_PROFILES, diversityReport } from '../models/selection.js';
import { createRun, remember, save } from '../memory/store.js';
import { emit } from '../core/events.js';
import { metrics } from '../core/metrics.js';
import { envInt } from '../core/env.js';

// Sinais de discordância no corpo da crítica (não no cabeçalho "DISAGREEMENTS:").
const DISAGREEMENT = /(contradict|incorrect|\bwrong\b|flawed|unsafe|not safe|insecure|vulnerab|regress|inconsist)/i;

function anonymize(solutions) {
  return solutions.map((s, i) => `### Proposal ${i + 1}\n${s.text}`).join('\n\n---\n\n');
}

// Conta quantas críticas sinalizam discordância relevante, respeitando a declaração
// explícita "DISAGREEMENTS: none" (que por si só não é uma discordância).
export function countDisagreements(texts = []) {
  let count = 0;
  for (const raw of texts) {
    const text = String(raw || '');
    const declared = /disagreements?\s*:\s*([^\n]*)/i.exec(text);
    if (declared) {
      const value = declared[1].trim().toLowerCase();
      if (value && !/^(none|nenhuma|ninguna|nenhum)\b/.test(value)) { count++; continue; }
      const rest = text.replace(declared[0], '');
      if (DISAGREEMENT.test(rest)) count++;
      continue;
    }
    if (DISAGREEMENT.test(text)) count++;
  }
  return count;
}

export async function runSuperMode({ request, project = null, catalog, preferFree = true, maxModels = envInt('MAX_SUPER_MODELS', 4) }) {
  const run = createRun(request, { mode: 'super' });
  emit('task.start', { runId: run.id, mode: 'super', request });
  metrics.counter('task.started', { mode: 'super' });

  // Seleção diversificada: evita instâncias duplicadas do mesmo modelo/provider.
  const proposers = await selectDiverse(catalog, Math.max(2, maxModels), TASK_PROFILES.implement, { preferFree });
  if (proposers.length < 2) {
    throw Object.assign(new Error('Super Mode requer pelo menos 2 modelos configurados e distintos.'), { status: 400 });
  }
  const diversity = diversityReport(proposers);
  emit('super.models', {
    runId: run.id,
    diversity,
    models: proposers.map((p) => ({ key: p.key, family: p.family, score: Number((p.score || 0).toFixed(3)) }))
  });

  const context = { global: request, project: project ? project.root || String(project) : 'não analisado' };

  // Round 1 — propostas independentes em paralelo.
  const proposalResults = await Promise.allSettled(proposers.map((entry, i) => {
    const task = {
      id: `solution-${i}`,
      role: 'implementer',
      title: `Proposta ${i + 1}`,
      instruction: `Proponha a MELHOR solução completa para o pedido, de forma autônoma. `
        + `Inclua código/arquivos quando relevante, comandos de verificação e tradeoffs. Não presuma que outros modelos existem.\n\nPEDIDO:\n${request}`
    };
    emit('agent.start', { runId: run.id, taskId: task.id, agent: `Proposer ${i + 1}`, role: 'implementer', provider: entry.providerId, model: entry.modelId, title: task.title });
    return executeTask({ task, models: [entry], context });
  }));

  const solutions = proposalResults
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);
  proposalResults.forEach((r, i) => {
    const entry = proposers[i];
    emit('agent.done', {
      runId: run.id, taskId: `solution-${i}`, agent: `Proposer ${i + 1}`,
      provider: entry.providerId, model: entry.modelId,
      ok: r.status === 'fulfilled', error: r.status === 'rejected' ? r.reason?.message : undefined
    });
  });

  if (solutions.length < 2) {
    if (solutions.length === 1) {
      await save(run);
      return { runId: run.id, mode: 'super', text: solutions[0].text, provider: solutions[0].provider, model: solutions[0].model, solutions: 1, critiques: 0, consensus: false, diversity };
    }
    throw Object.assign(new Error('Nenhuma proposta foi gerada pelos modelos.'), { status: 503 });
  }

  // Round 2 — crítica cruzada (cada modelo avalia as propostas anônimas e corrige).
  const dossier = anonymize(solutions);
  const critiqueResults = await Promise.allSettled(proposers.map((entry, i) => {
    const task = {
      id: `critique-${i}`,
      role: 'reviewer',
      title: `Crítica ${i + 1}`,
      instruction: `Abaixo estão propostas anônimas de outros engenheiros para o mesmo pedido. `
        + `Identifique erros, riscos e discordâncias objetivas, escolha a mais forte e entregue uma versão corrigida e superior. `
        + `Comece com "DISAGREEMENTS:" listando cada divergência relevante (ou "nenhuma").\n\nPEDIDO:\n${request}\n\n${dossier}`
    };
    emit('agent.start', { runId: run.id, taskId: task.id, agent: `Critic ${i + 1}`, role: 'reviewer', provider: entry.providerId, model: entry.modelId, title: task.title });
    return executeTask({ task, models: [entry], context });
  }));

  const critiques = critiqueResults.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  critiqueResults.forEach((r, i) => {
    const entry = proposers[i];
    emit('agent.done', { runId: run.id, taskId: `critique-${i}`, agent: `Critic ${i + 1}`, provider: entry.providerId, model: entry.modelId, ok: r.status === 'fulfilled' });
  });

  const disagreements = countDisagreements(critiques.map((c) => c.text));
  emit('super.consensus', { runId: run.id, disagreements, critiques: critiques.length });
  await remember(run, { type: 'decision', decision: `Super Mode: ${solutions.length} propostas, ${critiques.length} críticas, ${disagreements} com discordância.` });

  // Consenso — o coordenador compara tudo e entrega a solução final.
  const all = [...solutions, ...critiques];
  const final = await synthesize({
    request: `[Super Mode] Consolide as propostas e críticas em UMA implementação final, resolvendo discordâncias explicitamente.\n\n${request}`,
    results: all,
    coordinator: proposers[0],
    catalog,
    preferFree
  });

  run.finalAnswer = final.text;
  run.tasks = proposers.map((p, i) => ({ taskId: `solution-${i}`, agent: `Proposer ${i + 1}`, provider: p.providerId, model: p.modelId, status: 'done' }));
  run.status = 'done';
  await save(run);
  emit('task.done', { runId: run.id, mode: 'super', ok: true, agents: solutions.length + critiques.length, diversity });
  metrics.counter('task.completed', { mode: 'super', ok: true });

  return {
    runId: run.id,
    mode: 'super',
    text: final.text,
    provider: final.provider,
    model: final.model,
    synthesized: final.synthesized,
    solutions: solutions.length,
    critiques: critiques.length,
    disagreements,
    agentCount: solutions.length + critiques.length,
    agents: proposers.map((p, i) => ({ agent: `Proposer ${i + 1}`, provider: p.providerId, model: p.modelId, role: 'implementer', status: 'done' })),
    diversity
  };
}
