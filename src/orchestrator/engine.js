// src/orchestrator/engine.js
import fs from 'node:fs/promises';
import path from 'node:path';
import { getProvider, eligibleProviders, resourceCatalog, getProviders } from '../providers/registry.js';
import { callProvider, callWithRetry, streamProvider, getCircuitState } from './invoke.js';
import { rankProviders, resolveModel, compactMessages } from './policy.js';
import { selectDiverse, TASK_PROFILES, modelKey } from '../models/selection.js';
import { runHive } from '../agents/hive.js';
import { runSuperMode } from '../agents/super.js';
import { runDebugLoop } from './debugger.js';
import { executeTask } from '../agents/worker.js';
import { synthesize } from '../agents/master.js';
import { getCircuitState as breakerState } from './breaker.js';
import { emit } from '../core/events.js';
import { metrics } from '../core/metrics.js';
import { envInt } from '../core/env.js';
import { ROOT } from '../core/config.js';
import { detectProject } from '../tools/project.js';
import { listTree } from '../core/workspace.js';
import { buildSystemPrompt } from '../prompts/engine.js';

const CHAT_SECTIONS = ['base', 'codingPolicy', 'securityRules', 'outputContract'];

// Prompt de sistema modular/versionado para os modos de provider único.
async function withSystem(messages, { coding = true, profile = 'coding' } = {}) {
  const system = await buildSystemPrompt({ profile: coding ? profile : 'general' }, { sections: CHAT_SECTIONS });
  return [
    { role: 'system', content: system },
    ...messages.filter((m) => m.role !== 'system')
  ];
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || !messages.length) throw Object.assign(new Error('A conversa está vazia.'), { status: 400 });
  if (!messages.some((m) => m && m.role === 'user' && String(m.content || '').trim())) {
    throw Object.assign(new Error('A conversa precisa conter uma mensagem do usuário.'), { status: 400 });
  }
}

async function defaultPool({ preferFree = true } = {}) {
  const eligible = await eligibleProviders({ freeOnly: false });
  const pool = await selectDiverse(eligible.map((p) => ({ providerId: p.id, modelId: p.defaultModel, provider: p })), 12, TASK_PROFILES.general, { preferFree });
  return { eligible, pool };
}

// Detecta o perfil de capacidade provável a partir do texto (usado no modo AUTO).
export function classifyNeed(text) {
  const value = String(text || '');
  if (/(seguran|security|vulnerab|injec|auth|senha|token)/i.test(value)) return 'security';
  if (/(debug|erro|error|stack ?trace|corrig|bug|falha|não funciona)/i.test(value)) return 'debug';
  if (/(arquitet|architecture|estrutura|design|planej)/i.test(value)) return 'architect';
  if (/(pesquis|research|compar|biblioteca|qual a melhor)/i.test(value)) return 'research';
  if (/(revis|review|revise|avalie)/i.test(value)) return 'review';
  if (/(teste|test|cobertura|coverage)/i.test(value)) return 'test';
  if (/(implement|implemente|crie|construa|build|escreva|refator)/i.test(value)) return 'implement';
  return 'general';
}

export async function projectContext() {
  try {
    const project = await detectProject();
    const files = await listTree('.', { depth: 3 });
    return { ...project, files };
  } catch { return null; }
}

export function getStatus() {
  return { providers: null, circuits: { ...getCircuitState(), ...breakerState() } };
}

// Ponto de entrada principal. Retorna a resposta e metadados de execução.
export async function chat(params) {
  const {
    providerId, model, mode = 'normal', messages, temperature = 0.35, maxTokens = 4096,
    selectedProviders = [], profile = 'coding', manualModels = [], useTools = true
  } = params;
  validateMessages(messages);
  const prepared = compactMessages(await withSystem(messages, { coding: profile !== 'general', profile }), envInt('MAX_CONTEXT_CHARS', 90000));
  const latestUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
  const started = Date.now();

  if (mode === 'hive' || mode === 'build') {
    const catalog = await resourceCatalog({ configuredOnly: true });
    if (!catalog.length) throw Object.assign(new Error('Nenhum provider configurado. Adicione chaves no .env para usar o Hive Mind.'), { status: 400 });
    const project = await projectContext();
    const result = await runHive({ request: latestUser, project, catalog, mode, manualKeys: manualModels.length ? manualModels : undefined });
    return { ...result, mode };
  }

  if (mode === 'super') {
    const catalog = await resourceCatalog({ configuredOnly: true });
    if (catalog.length < 2) throw Object.assign(new Error('Super Mode requer pelo menos 2 modelos configurados.'), { status: 400 });
    const project = await projectContext();
    const result = await runSuperMode({ request: latestUser, project, catalog, preferFree: true });
    return { ...result, mode };
  }

  if (mode === 'debug') {
    const catalog = await resourceCatalog({ configuredOnly: true });
    const project = await projectContext();
    const result = await runDebugLoop({ request: latestUser, project, catalog });
    return {
      mode,
      text: result.ok
        ? `Debug autônomo concluído com sucesso em ${result.attempts.length} etapa(s).\n\n${result.attempts.map((a) => `- [${a.phase}] ${a.summary}`).join('\n')}`
        : `Debug autônomo não convergiu: ${result.reason || 'motivo desconhecido'}\n\n${result.attempts.map((a) => `- [${a.phase}] ${a.summary || a.error}`).join('\n')}`,
      provider: 'local',
      model: 'debug-loop',
      debug: result
    };
  }

  if (mode === 'multi-agent') {
    return runMultiAgent({ latestUser, prepared, selectedProviders, manualModels, temperature, maxTokens });
  }

  if (mode === 'auto') {
    const need = classifyNeed(latestUser);
    const catalog = await resourceCatalog({ configuredOnly: true });
    const [pick] = await selectDiverse(catalog, 1, TASK_PROFILES[need] || TASK_PROFILES.general, { preferFree: true });
    if (!pick) throw Object.assign(new Error('Nenhum provider configurado.'), { status: 400 });
    const provider = pick.provider;
    const result = await callWithRetry(provider, { model: resolveModel(provider, pick.modelId), messages: prepared, temperature, maxTokens }, { retries: 2 });
    return { ...result, mode, need, chosen: pick.key, fallback: false, durationMs: Date.now() - started };
  }

  const primary = await getProvider(providerId || process.env.DEFAULT_PROVIDER || 'nvidia');
  if (!primary.configured) {
    throw Object.assign(new Error(`Provider ${primary.id} não está configurado. Configure ${primary.envKey}.`), { status: 400 });
  }

  if (mode === 'normal' || mode === 'custom' || mode === 'review') {
    const result = await callProvider(primary, { model: resolveModel(primary, model), messages: prepared, temperature, maxTokens });
    metrics.observe('chat.duration', Date.now() - started, { mode, provider: primary.id });
    return { ...result, mode, fallback: false, durationMs: Date.now() - started };
  }

  // fallback (padrão para modos não reconhecidos)
  const eligible = await eligibleProviders({ freeOnly: false });
  const ordered = rankProviders(
    [primary, ...eligible.filter((p) => p.id !== primary.id)],
    { primaryId: primary.id, preferFree: true }
  );
  const errors = [];
  const retries = envInt('MAX_RETRIES_PER_PROVIDER', 2);
  for (const provider of ordered) {
    const effectiveModel = resolveModel(provider, provider.id === primary.id ? model : undefined);
    try {
      const result = await callWithRetry(provider, { model: effectiveModel, messages: prepared, temperature, maxTokens }, { retries });
      metrics.observe('chat.duration', Date.now() - started, { mode: 'fallback', provider: provider.id });
      return { ...result, mode, fallback: provider.id !== primary.id, attemptedProviders: errors.map((e) => e.provider).concat(provider.id), durationMs: Date.now() - started };
    } catch (error) {
      errors.push({ provider: provider.id, status: error?.status || 0, message: error?.message || 'erro' });
    }
  }
  const err = new Error(`Nenhum provider conseguiu concluir. ${errors.map((e) => `${e.provider}: ${e.status} ${e.message}`).join(' | ')}`);
  err.status = 503;
  throw err;
}

// Executa vários agentes em paralelo com papéis distintos e sintetiza (modo multi-agent).
async function runMultiAgent({ latestUser, prepared, selectedProviders, manualModels, temperature, maxTokens }) {
  const catalog = await resourceCatalog({ configuredOnly: true });
  const chosen = manualModels.length
    ? await selectDiverse(catalog, manualModels.length, TASK_PROFILES.general, { manualKeys: manualModels })
    : await selectDiverse(selectedProviders.length
      ? catalog.filter((e) => selectedProviders.includes(e.providerId))
      : catalog, envInt('MAX_MULTI_AGENTS', 5), TASK_PROFILES.general, { preferFree: true });
  if (!chosen.length) throw Object.assign(new Error('Nenhum provider configurado para multi-agent.'), { status: 400 });

  const roles = ['architect', 'implementer', 'reviewer', 'security', 'tester'];
  const taskResults = await Promise.allSettled(chosen.map((entry, index) => {
    const role = roles[index % roles.length];
    const task = { id: `ma${index}`, role, title: role, instruction: `Papel ${role}. Analise o pedido sob sua especialidade.\n\nPEDIDO:\n${latestUser}` };
    return executeTask({ task, models: [entry], context: { global: latestUser, project: 'não analisado' }, temperature: temperature ?? 0.25, maxTokens });
  }));

  const results = taskResults.filter((r) => r.status === 'fulfilled').map((r) => ({ ...r.value, status: 'done' }));
  if (!results.length) throw Object.assign(new Error('Todos os agentes falharam.'), { status: 503 });

  const final = await synthesize({ request: latestUser, results, coordinator: chosen[0], catalog });
  return {
    mode: 'multi-agent',
    text: final.text,
    provider: final.provider,
    model: final.model,
    synthesized: final.synthesized,
    agents: results.map((r) => ({ agent: r.agent, provider: r.provider, model: r.model, role: r.role, status: 'done' })),
    agentCount: results.length
  };
}

// Streaming: emite deltas via callback. Suportado em normal/auto/fallback (provider único).
export async function chatStream(params, onDelta) {
  const { providerId, model, mode = 'normal', messages, temperature = 0.35, maxTokens = 4096, profile = 'coding' } = params;
  validateMessages(messages);
  if (mode === 'hive' || mode === 'build' || mode === 'debug' || mode === 'multi-agent' || mode === 'super') {
    return chat(params); // modos multiagente não fazem streaming token a token; usam eventos SSE
  }
  const pool = await resourceCatalog({ configuredOnly: true });
  const prepared = compactMessages(await withSystem(messages, { coding: profile !== 'general', profile }), envInt('MAX_CONTEXT_CHARS', 90000));
  const primary = mode === 'auto'
    ? (await selectDiverse(pool, 1, TASK_PROFILES[classifyNeed(messages.at(-1)?.content)], { preferFree: true }))[0]?.provider
    : await getProvider(providerId || process.env.DEFAULT_PROVIDER || 'nvidia');
  if (!primary || !primary.configured) throw Object.assign(new Error('Provider não configurado.'), { status: 400 });
  const result = await streamProvider(primary, { model: resolveModel(primary, model), messages: prepared, temperature, maxTokens }, onDelta);
  return { ...result, mode, fallback: false };
}

export { getProviders };
