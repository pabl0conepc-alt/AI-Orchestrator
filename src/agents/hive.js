// src/agents/hive.js
import { MessageBus } from './bus.js';
import { createPlan, assignModels, synthesize, reviewRejected } from './master.js';
import { executeTask } from './worker.js';
import { roleName } from './roles.js';
import { selectDiverse, TASK_PROFILES } from '../models/selection.js';
import { createRun, remember, save } from '../memory/store.js';
import { emit } from '../core/events.js';
import { metrics } from '../core/metrics.js';
import { envInt } from '../core/env.js';

function projectSummary(project) {
  if (!project) return 'Projeto não analisado.';
  const files = (project.files || []).slice(0, 80).map((f) => `${f.type === 'dir' ? '📁' : '📄'} ${f.path}`).join('\n');
  return [
    `Raiz: ${project.root}`,
    `Ecosystemas: ${(project.ecosystems || []).join(', ') || 'desconhecido'}`,
    `Scripts: ${Object.keys(project.scripts || {}).join(', ') || 'nenhum'}`,
    'Árvore (parcial):',
    files
  ].join('\n');
}

// Executa a Hive Mind completa: planejar → atribuir modelos → executar (paralelo) → revisar → sintetizar.
export async function runHive({ request, project, catalog, mode = 'hive', preferFree = true, manualKeys = [], maxAgents = envInt('MAX_HIVE_AGENTS', 7) }) {
  const run = createRun(request, { mode });
  const bus = new MessageBus(run.id);
  emit('task.start', { runId: run.id, mode, request });
  metrics.counter('task.started', { mode });

  const { plan, coordinator } = await createPlan({ request, project, catalog, preferFree, mode });
  if (plan.tasks.length > maxAgents) plan.tasks = plan.tasks.slice(0, maxAgents);
  run.plan = plan;
  emit('task.plan', { runId: run.id, summary: plan.summary, source: plan.source, tasks: plan.tasks.map((t) => ({ id: t.id, role: t.role, title: t.title, dependsOn: t.dependsOn })) });
  await remember(run, { type: 'decision', decision: `Plano (${plan.source}): ${plan.tasks.length} subtarefas.` });

  const { assignment, diversity } = await assignModels(plan, catalog, { preferFree, manualKeys });
  emit('hive.models', {
    runId: run.id,
    diversity,
    assignments: Object.entries(assignment).map(([taskId, e]) => ({ taskId, key: e.key, family: e.family, score: Number((e.score || 0).toFixed(3)) }))
  });

  bus.post({ from: 'master', to: 'all', type: 'instruction', content: `Plano com ${plan.tasks.length} subtarefas. ${plan.summary}` });

  const results = {};
  const completed = new Set();
  const pending = new Set(plan.tasks.map((t) => t.id));
  const context = { global: request, project: projectSummary(project) };

  const runOne = async (task) => {
    const models = [];
    if (assignment[task.id]) models.push(assignment[task.id]);
    const [fallback] = await selectDiverse(catalog, 1, TASK_PROFILES[task.role] || TASK_PROFILES.general, { preferFree });
    if (fallback && (!models[0] || fallback.key !== models[0].key)) models.push(fallback);

    const deps = task.dependsOn.map((d) => results[d]).filter(Boolean);
    const dependencyText = deps.map((r) => `[${r.agent} / ${r.taskId}]:\n${r.text.slice(0, 1500)}`).join('\n\n');
    const taskContext = {
      ...context,
      dependencies: dependencyText || null,
      messages: bus.digest({ taskId: task.id })
    };

    bus.post({ from: deps.length ? deps[0].agent.toLowerCase() : 'master', to: roleName(task.role), type: 'instruction', taskId: task.id, content: task.instruction.slice(0, 300) });
    emit('agent.start', { runId: run.id, taskId: task.id, agent: roleName(task.role), role: task.role, provider: models[0]?.providerId, model: models[0]?.modelId, title: task.title });

    const started = Date.now();
    try {
      const result = await executeTask({ task, models, context: taskContext });
      const durationMs = Date.now() - started;
      results[task.id] = { ...result, status: 'done', durationMs };
      completed.add(task.id);
      task.status = 'done';
      metrics.observe('agent.duration', durationMs, { role: task.role });
      metrics.counter('agent.runs', { role: task.role, ok: true });
      bus.post({ from: roleName(task.role), to: 'master', type: 'result', taskId: task.id, content: result.text.slice(0, 400) });
      emit('agent.done', { runId: run.id, taskId: task.id, agent: result.agent, provider: result.provider, model: result.model, durationMs, toolSteps: result.toolSteps, ok: true });
      return result;
    } catch (error) {
      const durationMs = Date.now() - started;
      results[task.id] = { taskId: task.id, role: task.role, agent: roleName(task.role), status: 'failed', error: error.message, text: '', durationMs };
      task.status = 'failed';
      metrics.counter('agent.runs', { role: task.role, ok: false });
      bus.post({ from: roleName(task.role), to: 'master', type: 'error', taskId: task.id, content: error.message });
      emit('agent.done', { runId: run.id, taskId: task.id, agent: roleName(task.role), ok: false, error: error.message, durationMs });
      await remember(run, { type: 'error', error: `${task.id}: ${error.message}` });
    }
  };

  // Escalonamento por dependências: tarefas prontas rodam em paralelo.
  while (pending.size) {
    const ready = plan.tasks.filter((t) => pending.has(t.id) && t.dependsOn.every((d) => completed.has(d) || !pending.has(d)));
    if (!ready.length) break;
    for (const t of ready) pending.delete(t.id);
    await Promise.all(ready.map(runOne));
  }
  // Dependências que falharam não devem travar o resto: libera o que sobrou.
  const leftovers = plan.tasks.filter((t) => pending.has(t.id));
  if (leftovers.length) await Promise.all(leftovers.map(runOne));

  bus.post({ from: 'master', to: 'master', type: 'review', content: 'Execução concluída; iniciando revisão/consenso.' });

  // Consenso: se a revisão rejeitou e o modo pede, roda uma iteração de correção.
  const reviewer = Object.values(results).find((r) => r.role === 'reviewer' && r.status === 'done');
  if (plan.requiresReview && reviewer && reviewRejected(reviewer.text)) {
    await remember(run, { type: 'decision', decision: 'Revisão rejeitou: acionando correção (debugger).' });
    const fixTask = { id: 'fix1', role: 'debugger', title: 'Corrigir problemas apontados', instruction: `A revisão rejeitou a entrega. Corrija os problemas apontados.\n\nREVISÃO:\n${reviewer.text.slice(0, 2000)}`, status: 'pending' };
    bus.post({ from: 'reviewer', to: 'Debugger', type: 'rejection', content: 'Correção necessária.' });
    try {
      const fix = await executeTask({ task: fixTask, models: [assignment['t4'] || Object.values(assignment)[0]].filter(Boolean), context });
      results.fix1 = { ...fix, status: 'done', taskId: 'fix1' };
      plan.tasks.push({ ...fixTask, status: 'done' });
      emit('agent.done', { runId: run.id, taskId: 'fix1', agent: fix.agent, provider: fix.provider, model: fix.model, ok: true });
    } catch (error) {
      await remember(run, { type: 'error', error: `fix1: ${error.message}` });
    }
  }

  const final = await synthesize({ request, results: Object.values(results), coordinator, catalog, preferFree });
  run.finalAnswer = final.text;
  run.tasks = Object.values(results).map((r) => ({ taskId: r.taskId, role: r.role, agent: r.agent, provider: r.provider, model: r.model, status: r.status, durationMs: r.durationMs }));
  run.messages = bus.history();
  run.status = 'done';
  await save(run);

  emit('task.done', { runId: run.id, mode, ok: true, agents: Object.values(results).filter((r) => r.status === 'done').length, diversity });
  metrics.counter('task.completed', { mode, ok: true });

  return {
    runId: run.id,
    mode,
    text: final.text,
    provider: final.provider,
    model: final.model,
    synthesized: final.synthesized,
    plan: { summary: plan.summary, source: plan.source, tasks: plan.tasks },
    agents: Object.values(results),
    messages: bus.history(),
    diversity,
    coordinator: coordinator ? coordinator.key : null
  };
}
