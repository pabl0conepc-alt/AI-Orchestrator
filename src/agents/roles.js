// src/agents/roles.js
import { TASK_PROFILES } from '../models/selection.js';

// Cada papel de agente declara sua especialidade e o perfil de capacidade usado
// pelo Master para escolher qual modelo (provider:model) executa a tarefa.
export const ROLES = {
  master: {
    name: 'Master',
    title: 'Coordenador técnico',
    profile: 'coordinate',
    canUseTools: false,
    instruction: 'Você é o Master Agent: o gerente técnico da equipe. NÃO escreva a solução inteira. '
      + 'Analise o pedido, identifique objetivos e restrições, decida quais especialistas são necessários, '
      + 'divida o trabalho em subtarefas com dependências explícitas, e ao final sintetize e decida se está pronto.'
  },
  architect: {
    name: 'Architect',
    title: 'Arquiteto de software',
    profile: 'architect',
    canUseTools: true,
    instruction: 'Você é o Architect. Analise a arquitetura existente e proponha módulos, contratos, dependências e riscos. '
      + 'Não escreva a solução inteira; entregue um plano implementável com interfaces claras.'
  },
  researcher: {
    name: 'Researcher',
    title: 'Pesquisador técnico',
    profile: 'research',
    canUseTools: true,
    instruction: 'Você é o Researcher. Investigue abordagens, bibliotecas e padrões adequados ao problema. '
      + 'Compare alternativas com prós e contras objetivos e recomende a melhor para o contexto.'
  },
  security: {
    name: 'Security',
    title: 'Analista de segurança',
    profile: 'security',
    canUseTools: true,
    instruction: 'Você é o Security. Procure vulnerabilidades: injeção, path traversal, execução arbitrária, SSRF, '
      + 'exposição de segredos, permissões e abuso de ferramentas. Entregue riscos com mitigação prática e prioridade.'
  },
  implementer: {
    name: 'Implementer',
    title: 'Engenheiro de implementação',
    profile: 'implement',
    canUseTools: true,
    instruction: 'Você é o Implementer. Escreva código concreto e completo: arquivos, funções, interfaces e integração. '
      + 'Use as ferramentas disponíveis para ler e escrever arquivos quando necessário. Sinalize decisões técnicas.'
  },
  tester: {
    name: 'Tester',
    title: 'Engenheiro de testes',
    profile: 'test',
    canUseTools: true,
    instruction: 'Você é o Tester. Crie e execute testes: casos normais, de borda e de regressão. '
      + 'Use a ferramenta run_tests quando fizer sentido e reporte o resultado real (nunca invente execuções).'
  },
  debugger: {
    name: 'Debugger',
    title: 'Depurador',
    profile: 'debug',
    canUseTools: true,
    instruction: 'Você é o Debugger. A partir de um erro/stack trace, encontre a causa raiz, aplique a correção mínima '
      + 'e verifique com testes. Não pare em "há um erro nesta linha"; corrija e valide.'
  },
  reviewer: {
    name: 'Reviewer',
    title: 'Revisor de código',
    profile: 'review',
    canUseTools: true,
    instruction: 'Você é o Reviewer. Revise criticamente: bugs, incompatibilidades, segurança, manutenção e testes ausentes. '
      + 'Emita aprovação ou rejeição justificada com correções precisas.'
  }
};

export function roleProfile(roleId) {
  return TASK_PROFILES[ROLES[roleId]?.profile] || TASK_PROFILES.general;
}

export function roleName(roleId) {
  return ROLES[roleId]?.name || roleId;
}
