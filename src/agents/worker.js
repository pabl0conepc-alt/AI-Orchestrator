// src/agents/worker.js
import { callWithRetry } from '../orchestrator/invoke.js';
import { resolveModel } from '../orchestrator/policy.js';
import { ROLES, roleName } from './roles.js';
import { runTool, listTools } from '../tools/registry.js';
import { buildSystemPrompt } from '../prompts/engine.js';
import { emit } from '../core/events.js';

// Protocolo de ferramenta: o agente pode emitir um bloco ```tool ``` com JSON {tool, params}.
const TOOL_BLOCK = /```tool\s*([\s\S]*?)```/gi;

export function extractToolCalls(text) {
  const calls = [];
  let clean = String(text || '');
  let match;
  TOOL_BLOCK.lastIndex = 0;
  while ((match = TOOL_BLOCK.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const list = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of list) if (item && item.tool) calls.push({ tool: item.tool, params: item.params || {} });
    } catch { /* bloco inválido é ignorado */ }
  }
  clean = clean.replace(TOOL_BLOCK, '').trim();
  return { clean, calls };
}

// Compõe o prompt de sistema modular (prompt engine) para o papel do agente.
async function toolMenu(canUseTools) {
  return canUseTools ? listTools() : [];
}

export async function buildMessages(roleDef, task, context) {
  const system = await buildSystemPrompt({
    profile: roleDef.profile === 'general' ? 'general' : 'coding',
    roleInstruction: roleDef.instruction,
    project: context.projectInfo || null,
    intent: context.global || '(vazio)',
    task: task.instruction,
    dependencies: context.dependencies || null,
    messages: context.messages || null,
    previousErrors: context.previousErrors || null,
    tools: await toolMenu(roleDef.canUseTools),
    security: true,
    outputContract: 'Be direct and technical. Never claim a command or test was executed unless it actually was.'
  });

  const projectText = typeof context.project === 'string' ? context.project : null;
  const user = [
    projectText ? `PROJECT CONTEXT:\n${projectText}` : '',
    `SUBTASK [${task.id}] — role: ${roleName(task.role)}\n\n${task.instruction}`
  ].filter(Boolean).join('\n\n');
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

// Executa a subtarefa com um modelo específico, incluindo loop de ferramentas real.
export async function executeTask({ task, models, context, maxToolSteps = 3, temperature = 0.3, maxTokens = 4096 }) {
  const roleDef = ROLES[task.role] || ROLES.implementer;
  const messages = await buildMessages(roleDef, task, context);
  let toolSteps = 0;
  let lastError;

  for (const entry of models) {
    const provider = entry.provider || entry;
    const model = resolveModel(provider, entry.modelId || entry.model);
    emit('agent.status', { agent: roleDef.name, taskId: task.id, status: 'thinking', provider: provider.id, model });
    try {
      let text = '';
      let usedModel = model;
      // Loop de ferramentas + chamada final.
      while (true) {
        const result = await callWithRetry(provider, { model: usedModel, messages, temperature, maxTokens }, { retries: 2 });
        usedModel = result.model;
        const { clean, calls } = extractToolCalls(result.text);
        text = clean || result.text;
        if (!calls.length || !roleDef.canUseTools || toolSteps >= maxToolSteps) break;
        messages.push({ role: 'assistant', content: result.text });
        for (const call of calls) {
          toolSteps += 1;
          const toolResult = await runTool(call.tool, call.params);
          messages.push({ role: 'user', content: `Resultado da ferramenta ${call.tool}:\n${JSON.stringify(toolResult).slice(0, 4000)}` });
        }
      }
      return {
        taskId: task.id,
        role: task.role,
        agent: roleDef.name,
        provider: provider.id,
        model: usedModel,
        text,
        toolSteps
      };
    } catch (error) {
      lastError = error;
      emit('agent.status', { agent: roleDef.name, taskId: task.id, status: 'error', provider: provider.id, error: error.message });
    }
  }
  throw lastError || new Error(`Nenhum modelo conseguiu executar a tarefa ${task.id}.`);
}
