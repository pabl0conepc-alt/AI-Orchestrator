// src/agents/master.js
import { selectDiverse, TASK_PROFILES, modelKey, diversityReport } from '../models/selection.js';
import { roleProfile, ROLES } from './roles.js';
import { callWithRetry } from '../orchestrator/invoke.js';
import { resolveModel, extractJson } from '../orchestrator/policy.js';
import { emit } from '../core/events.js';
import { metrics } from '../core/metrics.js';

const VALID_ROLES = Object.keys(ROLES);

// ---------- Planejamento ----------

export async function createPlan({ request, project, catalog, preferFree = true, mode = 'hive' }) {
  const [coordinator] = await selectDiverse(catalog, 1, TASK_PROFILES.coordinate, { preferFree });
  if (coordinator) {
    try {
      const plan = await planWithModel({ request, project, coordinator, mode });
      if (plan) return { plan, coordinator };
    } catch (error) {
      emit('master.status', { status: 'plan-fallback', error: error.message });
    }
  }
  return { plan: heuristicPlan(request, mode), coordinator: coordinator || null };
}

async function planWithModel({ request, project, coordinator, mode }) {
  const provider = coordinator.provider || coordinator;
  const model = resolveModel(provider, coordinator.modelId);
  const system = [
    ROLES.master.instruction,
    '',
    'Responda SOMENTE com JSON válido no formato:',
    '{"summary": "string", "requiresReview": boolean, "requiresTests": boolean, "tasks": [',
    '  {"id": "t1", "role": "architect|researcher|security|implementer|tester|debugger|reviewer",',
    '   "title": "string", "instruction": "string detalhada", "dependsOn": ["t0"]}]}',
    '',
    'Regras: use de 3 a 7 subtarefas. Tarefas independentes devem ter dependsOn vazio (rodarão em paralelo).',
    'Só crie dependências reais. Cada instruction deve ser auto-contida e acionável.'
  ].join('\n');
  const user = `PEDIDO:\n${request}\n\nPROJETO DETECTADO:\n${project || 'desconhecido'}\n\nMODO: ${mode}`;

  emit('master.status', { status: 'planning', provider: provider.id, model });
  const started = Date.now();
  const result = await callWithRetry(provider, {
    model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    temperature: 0.2,
    maxTokens: 2048
  }, { retries: 2 });
  metrics.observe('master.plan', Date.now() - started, { provider: provider.id });
  const parsed = extractJson(result.text);
  return normalizePlan(parsed, { source: `${provider.id}:${result.model}` });
}

// Valida e corrige o plano (ids únicos, roles válidos, dependências existentes, sem ciclos).
export function normalizePlan(raw, { source = 'heuristic' } = {}) {
  if (!raw || !Array.isArray(raw.tasks) || !raw.tasks.length) return null;
  const seen = new Set();
  const tasks = [];
  for (const [index, item] of raw.tasks.entries()) {
    const role = VALID_ROLES.includes(item?.role) ? item.role : 'implementer';
    let id = String(item?.id || `t${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!id || seen.has(id)) id = `t${index + 1}`;
    seen.add(id);
    tasks.push({
      id,
      role,
      title: String(item?.title || role).slice(0, 120),
      instruction: String(item?.instruction || item?.title || '').slice(0, 4000) || `Executar papel ${role}.`,
      dependsOn: Array.isArray(item?.dependsOn) ? item.dependsOn.map(String) : [],
      status: 'pending'
    });
  }
  // Remove dependências inexistentes e ciclos simples.
  const ids = new Set(tasks.map((t) => t.id));
  for (const t of tasks) t.dependsOn = t.dependsOn.filter((d) => ids.has(d) && d !== t.id);
  if (hasCycle(tasks)) return null;
  return {
    summary: String(raw.summary || 'Plano gerado pelo Master.').slice(0, 500),
    requiresReview: raw.requiresReview !== false,
    requiresTests: raw.requiresTests !== false,
    source,
    tasks
  };
}

export function hasCycle(tasks) {
  const graph = new Map(tasks.map((t) => [t.id, t.dependsOn]));
  const visiting = new Set(); const done = new Set();
  const visit = (id) => {
    if (done.has(id)) return false;
    if (visiting.has(id)) return true;
    visiting.add(id);
    for (const dep of graph.get(id) || []) if (visit(dep)) return true;
    visiting.delete(id); done.add(id);
    return false;
  };
  return tasks.some((t) => visit(t.id));
}

// Plano determinístico usado quando não há modelo disponível.
export function heuristicPlan(request, mode = 'hive') {
  const wantsSecurity = /auth|login|senha|token|seguran|security|api key|criptograf/i.test(request);
  const wantsResearch = /pesquis|research|compar|biblioteca|library|melhor forma/i.test(request);
  const tasks = [
    { id: 't1', role: 'architect', title: 'Analisar arquitetura', instruction: `Analise o pedido e proponha a arquitetura, módulos, contratos e riscos.\n\nPEDIDO:\n${request}`, dependsOn: [] }
  ];
  if (wantsResearch) tasks.push({ id: 't2', role: 'researcher', title: 'Pesquisar abordagens', instruction: `Pesquise abordagens e bibliotecas adequadas.\n\nPEDIDO:\n${request}`, dependsOn: [] });
  if (wantsSecurity) tasks.push({ id: 't3', role: 'security', title: 'Analisar segurança', instruction: `Identifique riscos de segurança e mitigações.\n\nPEDIDO:\n${request}`, dependsOn: [] });
  const implDeps = tasks.map((t) => t.id);
  tasks.push({ id: 't4', role: 'implementer', title: 'Implementar solução', instruction: `Implemente a solução com código completo e integrado, seguindo a arquitetura.\n\nPEDIDO:\n${request}`, dependsOn: implDeps });
  tasks.push({ id: 't5', role: 'tester', title: 'Testar', instruction: `Defina e execute a estratégia de testes; reporte resultados reais.\n\nPEDIDO:\n${request}`, dependsOn: ['t4'] });
  tasks.push({ id: 't6', role: 'reviewer', title: 'Revisar', instruction: `Revise criticamente a implementação e os testes; aprove ou rejeite com justificativa.\n\nPEDIDO:\n${request}`, dependsOn: ['t4', 't5'] });
  return { summary: `Plano ${mode} (heurístico).`, requiresReview: true, requiresTests: true, source: 'heuristic', tasks };
}

// ---------- Seleção de modelos ----------

// Atribui um modelo (provider:model) a cada tarefa, favorecendo especialização e diversidade.
export async function assignModels(plan, catalog, { preferFree = true, manualKeys } = {}) {
  if (Array.isArray(manualKeys) && manualKeys.length) {
    const chosen = await selectDiverse(catalog, manualKeys.length, TASK_PROFILES.general, { preferFree, manualKeys });
    const assignment = {};
    plan.tasks.forEach((task, i) => { assignment[task.id] = chosen[i % chosen.length]; });
    return { assignment, diversity: diversityReport(chosen), usedKeys: chosen.map((c) => c.key) };
  }

  const assignment = {};
  const usedKeys = new Set();
  const usedFamilies = new Set();
  const pool = catalog.filter(Boolean);

  for (const task of plan.tasks) {
    const needs = roleProfile(task.role);
    const ranked = await selectDiverse(pool, pool.length || 1, needs, { preferFree });
    let pick = ranked.find((e) => !usedKeys.has(e.key) && !usedFamilies.has(e.family)) || ranked.find((e) => !usedKeys.has(e.key)) || ranked[0];
    if (!pick) continue;
    assignment[task.id] = pick;
    usedKeys.add(pick.key);
    usedFamilies.add(pick.family);
  }

  const chosen = Object.values(assignment);
  return { assignment, diversity: diversityReport(chosen), usedKeys: [...usedKeys] };
}

// ---------- Síntese e decisão final ----------

export async function synthesize({ request, results, coordinator, catalog, preferFree = true, temperature = 0.2 }) {
  const successful = results.filter((r) => r && r.text && r.status === 'done');
  const dossier = successful.map((r) => `### ${r.agent} [${r.provider}:${r.model}] (${r.role})\n${r.text}`).join('\n\n---\n\n');

  const candidates = [];
  if (coordinator) candidates.push(coordinator);
  const pool = catalog.filter((e) => !coordinator || modelKey(e.providerId, e.modelId) !== modelKey(coordinator.providerId, coordinator.modelId));
  const [alt] = await selectDiverse(pool, 1, TASK_PROFILES.coordinate, { preferFree });
  if (alt) candidates.push(alt);

  const system = [
    ROLES.master.instruction,
    '',
    'Você é o COORDENADOR FINAL. Compare as análises dos agentes, elimine contradições, corrija erros e entregue UMA resposta final pronta para uso.',
    'Para tarefas de código, prefira arquivos completos, comandos de execução e testes. Não mencione que recebeu relatórios internos.',
    'Se houver conflito entre agentes, decida explicitamente e explique a decisão em uma linha curta.'
  ].join('\n');
  const user = `PEDIDO ORIGINAL:\n${request}\n\nANÁLISES DOS AGENTES:\n${dossier || '(nenhuma análise bem-sucedida)'}`;

  let lastError;
  for (const entry of candidates) {
    const provider = entry.provider || entry;
    try {
      const model = resolveModel(provider, entry.modelId);
      emit('master.status', { status: 'synthesizing', provider: provider.id, model });
      const started = Date.now();
      const result = await callWithRetry(provider, {
        model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature,
        maxTokens: 6144
      }, { retries: 2 });
      metrics.observe('master.synthesize', Date.now() - started, { provider: provider.id });
      return { text: result.text, provider: provider.id, model: result.model, synthesized: true };
    } catch (error) { lastError = error; }
  }
  // Fallback determinístico: entrega o dossiê bruto organizado.
  if (dossier) return { text: dossier, provider: 'local', model: 'deterministic', synthesized: false };
  // Sem nenhum agente bem-sucedido: sintetiza um relatório determinístico de falha,
  // para que o run seja concluído (task.done na UI) em vez de ficar preso em "running".
  const failed = results.filter((r) => r && r.status !== 'done');
  const lines = failed.slice(0, 8).map((r) => `- [${r.agent || r.role}] (${r.taskId || '?'}): ${r.error || 'falha desconhecida'}`);
  return {
    text: ['**Nenhum agente conseguiu concluído sua subtarefa.** Relatório determinístico de erros:', ...lines].join('\n'),
    provider: 'local',
    model: 'deterministic',
    synthesized: false,
    deterministicFallback: true,
    lastError: lastError?.message
  };
  throw lastError || new Error('Nenhum modelo conseguiu sintetizar a resposta final.');
}

// Detecta se a revisão rejeitou a implementação (para acionar nova iteração).
export function reviewRejected(text) {
  const value = String(text || '');
  const reject = /(rejeit|reprov|não aprovado|nao aprovado|not approved|rejected|bloqueio|blocker|crítico|critical bug)/i.test(value);
  const approve = /(aprovad|approv|ok para|pronto para|looks good|lgtm)/i.test(value);
  return reject && !approve;
}
