// src/agents/bus.js
import { emit } from '../core/events.js';

// Protocolo de comunicação entre agentes. Não é concatenação de textos:
// cada mensagem tem remetente, destinatário, tipo, tarefa e prioridade.
export const MESSAGE_TYPES = [
  'instruction', 'result', 'warning', 'error', 'question',
  'review', 'approval', 'rejection', 'dependency', 'request-help'
];

let seq = 0;

export class MessageBus {
  constructor(runId) {
    this.runId = runId;
    this.messages = [];
  }

  post({ from, to, type = 'instruction', taskId = null, priority = 'normal', content = '', replyTo = null, data = null }) {
    if (!MESSAGE_TYPES.includes(type)) throw new Error(`Tipo de mensagem inválido: ${type}`);
    const message = {
      id: `msg_${++seq}`,
      ts: new Date().toISOString(),
      runId: this.runId,
      from,
      to,
      type,
      taskId,
      priority,
      content: String(content || '').slice(0, 4000),
      replyTo,
      data
    };
    this.messages.push(message);
    emit('message', {
      messageId: message.id,
      from, to, type, taskId, priority,
      content: message.content.slice(0, 200)
    });
    return message;
  }

  inbox(agentId, { unreadOnly = false } = {}) {
    return this.messages.filter((m) => m.to === agentId && (!unreadOnly || !m.read));
  }

  thread(taskId) {
    return this.messages.filter((m) => m.taskId === taskId);
  }

  history() { return [...this.messages]; }

  // Resumo compacto usado como contexto para outros agentes (evita duplicar tudo).
  digest({ taskId = null, max = 12 } = {}) {
    const source = taskId ? this.thread(taskId) : this.messages;
    return source.slice(-max).map((m) => `[${m.type}] ${m.from}→${m.to}: ${m.content.slice(0, 240)}`);
  }
}
