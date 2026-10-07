// src/agents/worker.js
import { callWithRetry } from '../orchestrator/invoke.js';
import { resolveModel } from '../orchestrator/policy.js';
import { ROLES, roleName } from './roles.js';
import { runTool, listTools } from '../tools/registry.js';
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

function toolMenu(canUseTools) {
  if (!canUseTools) return 'Ferramentas desabilitadas para este papel.';
  const tools = listTools().map((t) => `- ${t.name}(${Object.keys(t.params).join(', ')}): ${t.description}`);
  return [
    'Você pode usar ferramentas emitindo um bloco de código exatamente assim:',
    '```tool',
    '{ "tool": "read_file", "params": { "path": "src/x.js" } }',
    '```',
    'Ferramentas disponíveis:',
    ...tools
  ].join('\n');
}

export function buildMessages(roleDef, task, context) {
  const system = [
    roleDef.instruction,
    '',
    'CONTEXTO GLOBAL (pedido do usuário):',
    context.global || '(vazio)',
    '',
    'CONTEXTO DO PROJETO:',
    context.project || '(não analisado)',
    '',
    context.dependencies ? `RESULTADOS DE DEPENDÊNCIAS:\n${context.dependencies}` : '',
    context.messages ? `COMUNICAÇÃO DA EQUIPE (resumo):\n${context.messages}` : '',
    '',
    toolMenu(roleDef.canUseTools),
    '',
    'Regras: seja direto e técnico. Nunca afirme que executou algo que não executou.'
  ].filter(Boolean).join('\n');

  const user = `SUBTAREFA [${task.id}] — papel: ${roleName(task.role)}\n\n${task.instruction}`;
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

// Executa a subtarefa com um modelo específico, incluindo loop de ferramentas real.
export async function executeTask({ task, models, context, maxToolSteps = 3, temperature = 0.3, maxTokens = 4096 }) {
  const roleDef = ROLES[task.role] || ROLES.implementer;
  const messages = buildMessages(roleDef, task, context);
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
