'use strict';

// i18n — English is the default language. Add a new language by adding one entry
// to DICT and to SUPPORTED; no other change is required.
const DICT = {
  en: {
    'brand.sub': 'coding intelligence platform',
    'nav.chat': 'Chat', 'nav.hive': 'Hive Mind', 'nav.files': 'Files', 'nav.terminal': 'Terminal',
    'nav.git': 'Git', 'nav.providers': 'Providers', 'nav.runs': 'Runs', 'nav.settings': 'Settings',
    'nav.super': 'Super Mode',
    'view.chat': 'Chat', 'view.hive': 'Hive Mind', 'view.files': 'Files', 'view.terminal': 'Terminal',
    'view.git': 'Git', 'view.providers': 'Providers', 'view.runs': 'Runs', 'view.settings': 'Settings',
    'status.connecting': 'connecting…', 'status.offline': 'offline', 'status.providers': '{n} providers',
    'top.mode': 'Mode', 'top.provider': 'Provider', 'top.model': 'Model', 'top.language': 'Language',
    'mode.normal': 'Normal', 'mode.fallback': 'Fallback', 'mode.auto': 'Auto', 'mode.multiAgent': 'Multi-Agent',
    'mode.hive': 'Hive Mind', 'mode.super': 'Super Mode', 'mode.build': 'Build', 'mode.debug': 'Debug',
    'mode.review': 'Review', 'mode.custom': 'Custom',
    'hint.normal': 'A single model answers.',
    'hint.fallback': 'Primary model with automatic alternatives.',
    'hint.auto': 'The system picks the best model for the task type.',
    'hint.multiAgent': 'Several agents with distinct roles, synthesized by the Master.',
    'hint.hive': 'Hive Mind: the Master plans, agents collaborate in parallel.',
    'hint.super': 'Super Mode: independent proposals, cross-critique and consensus.',
    'hint.build': 'Hive oriented to software construction.',
    'hint.debug': 'Autonomous loop: test → fix → test.',
    'hint.review': 'Focus on code review.',
    'hint.custom': 'You control everything manually.',
    'chat.empty': 'Describe a task and pick a mode (Hive Mind recommended).',
    'chat.placeholder': 'Describe the task. e.g. Build a complete authentication system for this project.',
    'chat.hint': 'Enter sends • Shift+Enter newline • local workspace + routed providers',
    'chat.newTask': 'New task', 'chat.you': 'YOU', 'chat.ai': 'AI',
    'hive.agents': 'Agents', 'hive.timeline': 'Activity timeline', 'hive.clear': 'clear',
    'hive.empty': 'No run yet. Send a task in the chat using Hive/Build mode.',
    'hive.diversity': 'diversity: {p} providers · {f} families',
    'files.workspace': 'Workspace', 'files.refresh': 'refresh', 'files.none': 'No file open',
    'files.save': 'save', 'files.placeholder': 'Select a file to view/edit', 'files.empty': 'Empty workspace.',
    'term.title': 'Controlled terminal', 'term.note': 'allowlist • no shell',
    'term.ready': '$ ready. Allowed commands: node, npm, git, rg, python3, ls, cat…', 'term.run': 'run',
    'git.title': 'Git', 'git.choose': 'Choose an operation.',
    'git.status': 'status', 'git.diff': 'diff', 'git.log': 'log', 'git.branches': 'branches',
    'git.stash': 'stash', 'git.summary': 'change summary', 'git.suggest': 'suggest commit', 'git.snapshot': 'snapshot',
    'providers.title': 'Provider Manager', 'providers.configured': '{n} configured / {m}',
    'runs.title': 'Runs (task memory)', 'runs.refresh': 'refresh', 'runs.empty': 'No run recorded yet.',
    'settings.permissions': 'Tool permissions', 'settings.matrix': 'Capability Matrix',
    'settings.project': 'Project memory',
    'state.running': 'running', 'state.done': 'done', 'state.failed': 'failed', 'state.pending': 'pending',
    'agent.pending': 'agent', 'agent.proposer': 'Proposer', 'agent.critic': 'Critic',
    'meta.fallback': 'fallback', 'meta.agents': '{n} agents', 'meta.synthesis': 'Master synthesis',
    'meta.streaming': 'streaming…', 'meta.orchestrating': 'orchestrating…', 'meta.done': 'done',
    'meta.diversity': 'diversity {p}p/{f}f',
    'toast.copied': 'Code copied.', 'toast.saved': 'Saved: {path}', 'toast.noFile': 'No file open.',
    'toast.planned': 'Master planned {n} subtasks ({source}).', 'toast.run': 'Run {id}: {n} agents'
  },
  pt: {
    'brand.sub': 'plataforma de inteligência para código',
    'nav.chat': 'Chat', 'nav.hive': 'Hive Mind', 'nav.files': 'Arquivos', 'nav.terminal': 'Terminal',
    'nav.git': 'Git', 'nav.providers': 'Providers', 'nav.runs': 'Execuções', 'nav.settings': 'Config',
    'nav.super': 'Super Mode',
    'view.chat': 'Chat', 'view.hive': 'Hive Mind', 'view.files': 'Arquivos', 'view.terminal': 'Terminal',
    'view.git': 'Git', 'view.providers': 'Providers', 'view.runs': 'Execuções', 'view.settings': 'Configuração',
    'status.connecting': 'conectando…', 'status.offline': 'offline', 'status.providers': '{n} providers',
    'top.mode': 'Modo', 'top.provider': 'Provider', 'top.model': 'Modelo', 'top.language': 'Idioma',
    'mode.normal': 'Normal', 'mode.fallback': 'Fallback', 'mode.auto': 'Auto', 'mode.multiAgent': 'Multi-Agent',
    'mode.hive': 'Hive Mind', 'mode.super': 'Super Mode', 'mode.build': 'Build', 'mode.debug': 'Debug',
    'mode.review': 'Review', 'mode.custom': 'Custom',
    'hint.normal': 'Um único modelo responde.',
    'hint.fallback': 'Modelo principal com alternativas automáticas.',
    'hint.auto': 'O sistema escolhe o melhor modelo pelo tipo da tarefa.',
    'hint.multiAgent': 'Vários agentes com papéis distintos, síntese do Master.',
    'hint.hive': 'Hive Mind: o Master planeja e os agentes trabalham em conjunto.',
    'hint.super': 'Super Mode: propostas independentes, crítica cruzada e consenso.',
    'hint.build': 'Hive orientado a construção de software.',
    'hint.debug': 'Loop autônomo: testar → corrigir → testar.',
    'hint.review': 'Foco em revisão de código.',
    'hint.custom': 'Você controla tudo manualmente.',
    'chat.empty': 'Descreva uma tarefa e escolha um modo (Hive Mind recomendado).',
    'chat.placeholder': 'Descreva a tarefa. Ex.: Crie um sistema de autenticação completo para este projeto.',
    'chat.hint': 'Enter envia • Shift+Enter quebra linha • workspace local + providers roteados',
    'chat.newTask': 'Nova tarefa', 'chat.you': 'VOCÊ', 'chat.ai': 'IA',
    'hive.agents': 'Agentes', 'hive.timeline': 'Timeline de atividade', 'hive.clear': 'limpar',
    'hive.empty': 'Nenhuma execução ainda. Envie uma tarefa no chat no modo Hive/Build.',
    'hive.diversity': 'diversidade: {p} providers · {f} famílias',
    'files.workspace': 'Workspace', 'files.refresh': 'atualizar', 'files.none': 'Nenhum arquivo aberto',
    'files.save': 'salvar', 'files.placeholder': 'Selecione um arquivo para visualizar/editar', 'files.empty': 'Workspace vazio.',
    'term.title': 'Terminal controlado', 'term.note': 'allowlist • sem shell',
    'term.ready': '$ pronto. Comandos permitidos: node, npm, git, rg, python3, ls, cat…', 'term.run': 'executar',
    'git.title': 'Git', 'git.choose': 'Escolha uma operação.',
    'git.status': 'status', 'git.diff': 'diff', 'git.log': 'log', 'git.branches': 'branches',
    'git.stash': 'stash', 'git.summary': 'resumo', 'git.suggest': 'sugerir commit', 'git.snapshot': 'checkpoint',
    'providers.title': 'Provider Manager', 'providers.configured': '{n} configurados / {m}',
    'runs.title': 'Execuções (memória de tarefas)', 'runs.refresh': 'atualizar', 'runs.empty': 'Nenhuma execução registrada.',
    'settings.permissions': 'Permissões de ferramentas', 'settings.matrix': 'Capability Matrix',
    'settings.project': 'Memória do projeto',
    'state.running': 'executando', 'state.done': 'concluído', 'state.failed': 'falhou', 'state.pending': 'pendente',
    'agent.pending': 'agente', 'agent.proposer': 'Propositor', 'agent.critic': 'Crítico',
    'meta.fallback': 'fallback', 'meta.agents': '{n} agentes', 'meta.synthesis': 'síntese do Master',
    'meta.streaming': 'streaming…', 'meta.orchestrating': 'orquestrando…', 'meta.done': 'concluído',
    'meta.diversity': 'diversidade {p}p/{f}f',
    'toast.copied': 'Código copiado.', 'toast.saved': 'Salvo: {path}', 'toast.noFile': 'Nenhum arquivo aberto.',
    'toast.planned': 'Master planejou {n} subtarefas ({source}).', 'toast.run': 'Run {id}: {n} agentes'
  },
  es: {
    'brand.sub': 'plataforma de inteligencia para código',
    'nav.chat': 'Chat', 'nav.hive': 'Hive Mind', 'nav.files': 'Archivos', 'nav.terminal': 'Terminal',
    'nav.git': 'Git', 'nav.providers': 'Providers', 'nav.runs': 'Ejecuciones', 'nav.settings': 'Ajustes',
    'nav.super': 'Super Mode',
    'view.chat': 'Chat', 'view.hive': 'Hive Mind', 'view.files': 'Archivos', 'view.terminal': 'Terminal',
    'view.git': 'Git', 'view.providers': 'Providers', 'view.runs': 'Ejecuciones', 'view.settings': 'Configuración',
    'status.connecting': 'conectando…', 'status.offline': 'sin conexión', 'status.providers': '{n} providers',
    'top.mode': 'Modo', 'top.provider': 'Provider', 'top.model': 'Modelo', 'top.language': 'Idioma',
    'mode.normal': 'Normal', 'mode.fallback': 'Fallback', 'mode.auto': 'Auto', 'mode.multiAgent': 'Multi-Agente',
    'mode.hive': 'Hive Mind', 'mode.super': 'Super Mode', 'mode.build': 'Build', 'mode.debug': 'Debug',
    'mode.review': 'Review', 'mode.custom': 'Custom',
    'hint.normal': 'Un solo modelo responde.',
    'hint.fallback': 'Modelo principal con alternativas automáticas.',
    'hint.auto': 'El sistema elige el mejor modelo según la tarea.',
    'hint.multiAgent': 'Varios agentes con roles distintos, sintetizados por el Master.',
    'hint.hive': 'Hive Mind: el Master planifica y los agentes colaboran en paralelo.',
    'hint.super': 'Super Mode: propuestas independientes, crítica cruzada y consenso.',
    'hint.build': 'Hive orientado a la construcción de software.',
    'hint.debug': 'Bucle autónomo: probar → corregir → probar.',
    'hint.review': 'Enfoque en revisión de código.',
    'hint.custom': 'Tú controlas todo manualmente.',
    'chat.empty': 'Describe una tarea y elige un modo (se recomienda Hive Mind).',
    'chat.placeholder': 'Describe la tarea. Ej.: Crea un sistema de autenticación completo para este proyecto.',
    'chat.hint': 'Enter envía • Shift+Enter salto de línea • workspace local + providers enrutados',
    'chat.newTask': 'Nueva tarea', 'chat.you': 'TÚ', 'chat.ai': 'IA',
    'hive.agents': 'Agentes', 'hive.timeline': 'Línea de actividad', 'hive.clear': 'limpiar',
    'hive.empty': 'Aún no hay ejecución. Envía una tarea en el chat en modo Hive/Build.',
    'hive.diversity': 'diversidad: {p} providers · {f} familias',
    'files.workspace': 'Workspace', 'files.refresh': 'actualizar', 'files.none': 'Ningún archivo abierto',
    'files.save': 'guardar', 'files.placeholder': 'Selecciona un archivo para ver/editar', 'files.empty': 'Workspace vacío.',
    'term.title': 'Terminal controlada', 'term.note': 'allowlist • sin shell',
    'term.ready': '$ listo. Comandos permitidos: node, npm, git, rg, python3, ls, cat…', 'term.run': 'ejecutar',
    'git.title': 'Git', 'git.choose': 'Elige una operación.',
    'git.status': 'status', 'git.diff': 'diff', 'git.log': 'log', 'git.branches': 'branches',
    'git.stash': 'stash', 'git.summary': 'resumen', 'git.suggest': 'sugerir commit', 'git.snapshot': 'checkpoint',
    'providers.title': 'Provider Manager', 'providers.configured': '{n} configurados / {m}',
    'runs.title': 'Ejecuciones (memoria de tareas)', 'runs.refresh': 'actualizar', 'runs.empty': 'Ninguna ejecución registrada.',
    'settings.permissions': 'Permisos de herramientas', 'settings.matrix': 'Capability Matrix',
    'settings.project': 'Memoria del proyecto',
    'state.running': 'ejecutando', 'state.done': 'hecho', 'state.failed': 'falló', 'state.pending': 'pendiente',
    'agent.pending': 'agente', 'agent.proposer': 'Propositor', 'agent.critic': 'Crítico',
    'meta.fallback': 'fallback', 'meta.agents': '{n} agentes', 'meta.synthesis': 'síntesis del Master',
    'meta.streaming': 'streaming…', 'meta.orchestrating': 'orquestando…', 'meta.done': 'hecho',
    'meta.diversity': 'diversidad {p}p/{f}f',
    'toast.copied': 'Código copiado.', 'toast.saved': 'Guardado: {path}', 'toast.noFile': 'Ningún archivo abierto.',
    'toast.planned': 'El Master planificó {n} subtareas ({source}).', 'toast.run': 'Run {id}: {n} agentes'
  }
};

const SUPPORTED = ['en', 'pt', 'es'];
const DEFAULT_LANG = 'en';

let current = DEFAULT_LANG;

function detect() {
  try {
    const saved = localStorage.getItem('ai-orch-lang');
    if (saved && SUPPORTED.includes(saved)) return saved;
    const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
    if (SUPPORTED.includes(nav)) return nav;
  } catch { /* ignore */ }
  return DEFAULT_LANG;
}

function interpolate(text, vars) {
  return String(text).replace(/\{(\w+)\}/g, (_, k) => (vars && k in vars ? vars[k] : `{${k}}`));
}

const I18n = {
  SUPPORTED,
  DEFAULT_LANG,
  get lang() { return current; },
  setLang(lang) {
    current = SUPPORTED.includes(lang) ? lang : DEFAULT_LANG;
    try { localStorage.setItem('ai-orch-lang', current); } catch { /* ignore */ }
    return current;
  },
  init() { current = detect(); return current; },
  t(key, vars) {
    const table = DICT[current] || DICT[DEFAULT_LANG];
    const value = table[key] ?? DICT[DEFAULT_LANG][key] ?? key;
    return interpolate(value, vars);
  },
  apply(root = document) {
    document.documentElement.lang = current === 'pt' ? 'pt-BR' : current;
    root.querySelectorAll('[data-i18n]').forEach((node) => { node.textContent = I18n.t(node.dataset.i18n); });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((node) => { node.placeholder = I18n.t(node.dataset.i18nPlaceholder); });
    root.querySelectorAll('[data-i18n-title]').forEach((node) => { node.title = I18n.t(node.dataset.i18nTitle); });
  }
};

window.I18n = I18n;
