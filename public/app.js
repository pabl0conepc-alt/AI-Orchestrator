'use strict';

/* ----------------------------- state ----------------------------- */
const state = {
  view: 'chat',
  providers: [],
  code: true,
  conversations: load('ai-orch-conversations', []),
  currentId: null,
  agents: new Map(),
  diversity: null,
  runs: [],
  openFile: null
};

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { localStorage.removeItem(key); return fallback; }
}
function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function $(sel) { return document.querySelector(sel); }
function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }

/* ----------------------------- api ----------------------------- */
async function api(path, options) {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
function postJson(path, body) { return api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }

function toast(message, isError) {
  const t = $('#toast');
  t.textContent = message;
  t.className = `toast show${isError ? ' err' : ''}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = 'toast'; }, 3200);
}

/* ----------------------------- markdown ----------------------------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}

function formatText(text) {
  const escaped = escapeHtml(text);
  const parts = escaped.split(/```([\w.+-]*)\n([\s\S]*?)```/g);
  let out = '';
  for (let i = 0; i < parts.length; i += 3) {
    const chunk = parts[i] || '';
    out += chunk
      .replace(/^### (.*)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*)$/gm, '<h1>$1</h1>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
      .replace(/\n/g, '<br>');
    if (parts[i + 2] !== undefined) {
      const lang = escapeHtml(parts[i + 1] || '');
      const code = parts[i + 2];
      out += `<div class="code-wrap">${lang ? `<span class="lang-tag">${lang}</span>` : ''}`
        + `<button class="mini code-copy" data-copy>copiar</button>`
        + `<code class="code-block">${code}</code></div>`;
    }
  }
  return out;
}

/* ----------------------------- chat ----------------------------- */
function currentConv() { return state.conversations.find((c) => c.id === state.currentId); }

function newConversation() {
  const conv = { id: crypto.randomUUID(), title: 'Nova tarefa', messages: [] };
  state.conversations.unshift(conv);
  state.currentId = conv.id;
  save('ai-orch-conversations', state.conversations);
  renderChat();
}

function renderChat() {
  const chat = $('#chat');
  const conv = currentConv();
  chat.innerHTML = '';
  if (!conv || !conv.messages.length) {
    chat.innerHTML = '<div class="empty">Descreva uma tarefa e escolha um modo (Hive Mind recomendado).</div>';
    return;
  }
  for (const m of conv.messages) {
    const wrap = el('div', `msg ${m.role}`);
    wrap.innerHTML = `<div class="avatar">${m.role === 'user' ? 'YOU' : 'AI'}</div>`
      + `<div><div class="bubble">${m.pending ? '<span class="thinking"><span></span><span></span><span></span></span>' : formatText(m.content)}</div>`
      + `<div class="meta">${escapeHtml(m.meta || '')}</div></div>`;
    chat.appendChild(wrap);
  }
  chat.scrollTop = chat.scrollHeight;
}

async function sendMessage(text) {
  if (!currentConv()) newConversation();
  const conv = currentConv();
  conv.messages.push({ role: 'user', content: text });
  if (conv.title === 'Nova tarefa') conv.title = text.slice(0, 46);
  const placeholder = { role: 'assistant', content: '', meta: 'orquestrando…', pending: true };
  conv.messages.push(placeholder);
  save('ai-orch-conversations', state.conversations);
  renderChat();

  const mode = $('#modeSelect').value;
  const payload = {
    providerId: $('#providerSelect').value,
    model: $('#modelInput').value.trim() || undefined,
    mode,
    messages: conv.messages.filter((m) => m !== placeholder).map((m) => ({ role: m.role, content: m.content })),
    profile: state.code ? 'coding' : 'general',
    temperature: 0.3,
    maxTokens: 6144
  };

  const streaming = ['normal', 'fallback', 'auto'].includes(mode);
  try {
    if (streaming) {
      await streamChat(payload, placeholder, conv);
    } else {
      const data = await postJson('/api/chat', payload);
      placeholder.pending = false;
      placeholder.content = data.text || '(sem resposta)';
      placeholder.meta = metaFor(data);
    }
  } catch (error) {
    placeholder.pending = false;
    placeholder.content = `Erro: ${error.message}`;
    placeholder.meta = 'falha do orquestrador';
    toast(error.message, true);
  }
  save('ai-orch-conversations', state.conversations);
  renderChat();
  refreshRuns();
}

function metaFor(data) {
  const bits = [];
  if (data.provider) bits.push(`${data.provider} · ${data.model}`);
  if (data.fallback) bits.push('fallback');
  if (data.agentCount) bits.push(`${data.agentCount} agentes`);
  if (data.synthesized) bits.push('síntese do Master');
  if (data.diversity) bits.push(`diversidade ${data.diversity.providerDiversity}p/${data.diversity.familyDiversity}f`);
  if (data.durationMs) bits.push(`${(data.durationMs / 1000).toFixed(1)}s`);
  return bits.join(' · ');
}

async function streamChat(payload, placeholder, conv) {
  const res = await fetch('/api/chat/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let acc = '';
  let finalMeta = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() || '';
    for (const block of blocks) {
      const evMatch = block.match(/^event:\s*(.+)$/m);
      const dataMatch = block.match(/^data:\s*(.+)$/m);
      if (!evMatch || !dataMatch) continue;
      const type = evMatch[1].trim();
      let data; try { data = JSON.parse(dataMatch[1]); } catch { continue; }
      if (type === 'delta') {
        acc += data.delta || '';
        placeholder.pending = false;
        placeholder.content = acc;
        placeholder.meta = 'streaming…';
        renderChat();
      } else if (type === 'done') {
        placeholder.pending = false;
        placeholder.content = data.text || acc;
        finalMeta = metaFor(data);
      } else if (type === 'error') {
        throw new Error(data.error || 'erro no streaming');
      }
    }
  }
  placeholder.pending = false;
  placeholder.content = placeholder.content || acc || '(sem resposta)';
  placeholder.meta = finalMeta || 'concluído';
}

/* ----------------------------- SSE timeline / agents ----------------------------- */
function connectEvents() {
  const source = new EventSource('/api/events');
  source.addEventListener('event', (message) => {
    let event; try { event = JSON.parse(message.data); } catch { return; }
    handleEvent(event);
  });
  source.onerror = () => setStatus(false, 'reconectando…');
  source.onopen = () => refreshStatus();
}

function timeOf(ts) { return new Date(ts).toLocaleTimeString('pt-BR', { hour12: false }); }

function handleEvent(event) {
  const kind = String(event.type || '').split('.')[0];
  appendTimeline(event, kind);

  if (event.type === 'agent.start') {
    state.agents.set(event.taskId, { id: event.taskId, role: event.role, agent: event.agent, provider: event.provider, model: event.model, title: event.title, status: 'running' });
    renderAgents();
  }
  if (event.type === 'agent.status') {
    const a = findAgentByName(event.agent); if (a) { a.status = event.status === 'error' ? 'failed' : 'running'; a.model = event.model || a.model; renderAgents(); }
  }
  if (event.type === 'agent.done') {
    const a = state.agents.get(event.taskId); if (a) { a.status = event.ok ? 'done' : 'failed'; a.durationMs = event.durationMs; a.error = event.error; renderAgents(); }
  }
  if (event.type === 'hive.models') {
    state.diversity = event.diversity;
    renderAgents();
  }
  if (event.type === 'task.plan') {
    state.agents.clear();
    (event.tasks || []).forEach((t) => state.agents.set(t.id, { id: t.id, role: t.role, title: t.title, status: 'pending', dependsOn: t.dependsOn }));
    renderAgents();
    toast(`Master planejou ${event.tasks.length} subtarefas (${event.source}).`);
  }
}

function findAgentByName(name) { for (const a of state.agents.values()) if (a.agent === name) return a; return null; }

function appendTimeline(event, kind) {
  const box = $('#timeline');
  if (box.querySelector('.empty')) box.innerHTML = '';
  const row = el('div', 'tl-row');
  const label = describeEvent(event);
  row.innerHTML = `<div class="tl-time">${timeOf(event.ts)}</div>`
    + `<div class="tl-body"><span class="tl-kind ${kind}">${kind}</span>${label}</div>`;
  box.appendChild(row);
  box.scrollTop = box.scrollHeight;
  const rows = box.querySelectorAll('.tl-row');
  if (rows.length > 300) rows[0].remove();
}

function describeEvent(e) {
  const esc = escapeHtml;
  switch (e.type) {
    case 'task.start': return `<b>Master</b> iniciou tarefa no modo ${esc(e.mode)}`;
    case 'task.plan': return `<b>Master</b> planejou: ${esc(e.summary || '')}`;
    case 'task.done': return `<b>Master</b> finalizou (${e.agents} agentes)`;
    case 'hive.models': return `Modelos atribuídos — diversidade ${e.diversity?.providerDiversity}p/${e.diversity?.familyDiversity}f`;
    case 'agent.start': return `<b>${esc(e.agent)}</b> iniciou "${esc(e.title || e.taskId)}" em ${esc(e.provider)}:${esc(e.model || '?')}`;
    case 'agent.status': return `<b>${esc(e.agent)}</b> ${esc(e.status)}${e.model ? ` · ${esc(e.model)}` : ''}`;
    case 'agent.done': return e.ok ? `<b>${esc(e.agent)}</b> concluiu em ${(e.durationMs / 1000).toFixed(1)}s` : `<b>${esc(e.agent)}</b> falhou: ${esc(e.error || '')}`;
    case 'tool.start': return `ferramenta <b>${esc(e.tool)}</b> iniciada`;
    case 'tool.done': return `ferramenta <b>${esc(e.tool)}</b> ${e.ok ? 'ok' : 'falhou'} (${e.durationMs}ms)`;
    case 'message': return `<b>${esc(e.from)}</b> → <b>${esc(e.to)}</b> [${esc(e.type)}] ${esc(e.content || '')}`;
    case 'debug.attempt': return `debug tentativa ${e.attempt}`;
    case 'debug.fixing': return `debug corrigindo com ${esc(e.provider)}:${esc(e.model)}`;
    case 'debug.done': return `debug ${e.ok ? 'convergiu' : 'não convergiu'}`;
    case 'server.ready': return 'servidor pronto';
    default: return esc(e.type);
  }
}

/* ----------------------------- agents render ----------------------------- */
function renderAgents() {
  const grid = $('#agentGrid');
  if (!state.agents.size) { grid.innerHTML = '<div class="empty">Nenhuma execução ainda. Envie uma tarefa no chat no modo Hive/Build.</div>'; return; }
  grid.innerHTML = '';
  for (const a of state.agents.values()) {
    const card = el('div', `agent-card ${a.status}`);
    const model = a.provider ? `${a.provider}:${a.model || '?'}` : (a.model || '—');
    card.innerHTML = `<div class="ac-head"><span class="ac-role">${escapeHtml(a.agent || a.role || 'Agente')}</span><span class="ac-status ${a.status}">${statusLabel(a.status)}</span></div>`
      + `<div class="ac-model">${escapeHtml(model)}</div>`
      + `<div class="ac-task">${escapeHtml((a.title || a.role || ''))}${a.durationMs ? ` · ${(a.durationMs / 1000).toFixed(1)}s` : ''}</div>`
      + (a.status === 'running' ? '<div class="progress"><i></i></div>' : '');
    grid.appendChild(card);
  }
  if (state.diversity) $('#hiveDiversity').textContent = `diversidade: ${state.diversity.providerDiversity} providers · ${state.diversity.familyDiversity} famílias`;
}
function statusLabel(s) { return ({ running: 'executando', done: 'concluído', failed: 'falhou', pending: 'pendente' }[s]) || s; }

/* ----------------------------- files ----------------------------- */
async function refreshFiles() {
  try {
    const data = await api('/api/files?depth=4');
    const box = $('#fileTree');
    box.innerHTML = '';
    if (!data.entries.length) { box.innerHTML = '<div class="empty">Workspace vazio.</div>'; return; }
    for (const entry of data.entries) {
      const row = el('div', `ft-row ${entry.type === 'file' ? 'file' : ''}`);
      row.innerHTML = `<span>${entry.type === 'dir' ? '📁' : fileIcon(entry.path)}</span><span>${escapeHtml(entry.path)}</span>`
        + (entry.size ? `<span class="sz">${(entry.size / 1024).toFixed(1)}k</span>` : '');
      if (entry.type === 'file') row.onclick = () => openFile(entry.path);
      box.appendChild(row);
    }
  } catch (error) { toast(error.message, true); }
}
function fileIcon(p) {
  const ext = p.split('.').pop();
  return ({ js: '🟨', ts: '🔷', json: '🟦', md: '📘', css: '🎨', html: '🌐', sh: '🐚', py: '🐍' }[ext]) || '📄';
}
async function openFile(path) {
  try {
    const data = await api(`/api/file?path=${encodeURIComponent(path)}`);
    state.openFile = path;
    $('#editorPath').textContent = path;
    $('#editor').value = data.content;
  } catch (error) { toast(error.message, true); }
}
async function saveFile() {
  if (!state.openFile) return toast('Nenhum arquivo aberto.', true);
  try {
    await postJson('/api/file', { path: state.openFile, content: $('#editor').value });
    toast(`Salvo: ${state.openFile}`);
  } catch (error) { toast(error.message, true); }
}

/* ----------------------------- terminal / git ----------------------------- */
async function runTerminal(command) {
  const out = $('#termOut');
  out.textContent += `\n$ ${command}\n`;
  try {
    const data = await postJson('/api/tools/run', { tool: 'run_command', params: { command, confirm: true } });
    const text = data.stdout || data.stderr || data.error || '(sem saída)';
    out.textContent += `${data.ok ? '✓' : '✗'} ${text}\n`;
  } catch (error) { out.textContent += `erro: ${error.message}\n`; }
  out.textContent += `---\n`;
  out.scrollTop = out.scrollHeight;
}
async function runGit(tool) {
  const out = $('#gitOut');
  out.textContent = `Executando ${tool}…`;
  try {
    const data = await postJson('/api/tools/run', { tool, params: {} });
    out.textContent = `${data.ok ? '✓' : '✗'} ${data.stdout || data.stderr || data.error || '(sem saída)'}`;
  } catch (error) { out.textContent = error.message; }
}

/* ----------------------------- providers / settings ----------------------------- */
async function refreshProviders() {
  try {
    const providers = await api('/api/providers');
    state.providers = providers;
    const configured = providers.filter((p) => p.configured);
    $('#providerSelect').innerHTML = configured.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('') || '<option value="">nenhum</option>';
    setStatus(configured.length > 0, `${configured.length} providers`);
    $('#providerCount').textContent = `${configured.length} configurados / ${providers.length}`;
    renderProviderGrid(providers);
    loadMatrix();
  } catch (error) { setStatus(false, 'offline'); }
}

function renderProviderGrid(providers) {
  const grid = $('#providerGrid');
  grid.innerHTML = '';
  for (const p of providers) {
    const health = p.health || {};
    const stateClass = p.configured ? (health.state === 'degraded' ? 'warn' : health.state === 'offline' ? 'bad' : 'ok') : 'bad';
    const card = el('div', 'provider-card');
    card.innerHTML = `<div class="pc-top"><div><b>${escapeHtml(p.name)}</b><div class="id">${escapeHtml(p.id)}</div></div>`
      + `<span class="pill ${stateClass}">${p.configured ? health.state || 'online' : 'sem chave'}</span></div>`
      + `<div class="pc-meta"><span class="pill">${escapeHtml(p.transport)}</span><span class="pill">prioridade ${p.priority}</span>`
      + `<span class="pill">${p.freePool ? 'gratuito' : 'pago'}</span><span class="pill">${health.avgLatencyMs ? health.avgLatencyMs + 'ms' : 'sem dados'}</span></div>`
      + `<div class="id">modelo: ${escapeHtml(p.defaultModel)}</div>`
      + `<div class="caps">${Object.entries(p.capabilities || {}).filter(([, v]) => v).map(([k]) => `<span class="pill">${escapeHtml(k)}</span>`).join('')}</div>`;
    grid.appendChild(card);
  }
}

async function loadMatrix() {
  try {
    const { matrix } = await api('/api/models');
    const caps = ['coding', 'reasoning', 'security', 'research', 'speed'];
    const head = `<tr><th>Modelo</th>${caps.map((c) => `<th>${c}</th>`).join('')}</tr>`;
    const rows = matrix.slice(0, 60).map((m) => `<tr><td>${escapeHtml(m.providerId)}:<b>${escapeHtml(m.modelId)}</b></td>`
      + caps.map((c) => `<td><span class="mbar"><i style="width:${Math.round((m.capabilities[c] || 0) * 100)}%"></i></span></td>`).join('') + '</tr>').join('');
    $('#matrixWrap').innerHTML = `<table class="matrix">${head}${rows}</table>`;
  } catch { /* opcional */ }
}

async function loadPermissions() {
  try {
    const { permissions } = await api('/api/tools');
    $('#permList').innerHTML = permissions.map((p) => `<div class="perm-row"><span>${p.permission}</span>`
      + `<span class="pill ${p.enabled ? 'ok' : 'bad'}">${p.enabled ? 'habilitado' : 'bloqueado'}</span></div>`).join('');
  } catch { /* opcional */ }
}

async function refreshRuns() {
  try {
    const { runs } = await api('/api/memory/runs');
    state.runs = runs;
    const box = $('#runsList');
    box.innerHTML = runs.length ? '' : '<div class="empty">Nenhuma execução registrada.</div>';
    for (const r of runs) {
      const row = el('div', 'run-row');
      row.innerHTML = `<div><div class="r-task">${escapeHtml(r.task || '')}</div><div class="r-meta">${escapeHtml(r.mode)} · ${new Date(r.createdAt).toLocaleString('pt-BR')}</div></div><span class="pill">${escapeHtml(r.status)}</span>`;
      row.onclick = () => loadRun(r.id);
      box.appendChild(row);
    }
  } catch { /* opcional */ }
}

async function loadRun(id) {
  try {
    const run = await api(`/api/memory/runs/${id}`);
    if (!state.agents.size) state.agents.clear();
    const detail = (run.tasks || []).map((t) => ({ id: t.taskId, role: t.role, agent: t.agent, provider: t.provider, model: t.model, status: t.status, durationMs: t.durationMs }));
    if (detail.length) { state.agents.clear(); detail.forEach((t) => state.agents.set(t.id, t)); }
    showView('hive'); renderAgents();
    toast(`Run ${id}: ${detail.length} agentes`);
  } catch (error) { toast(error.message, true); }
}

/* ----------------------------- status / nav ----------------------------- */
function setStatus(ok, text) {
  const dot = $('#statusDot');
  dot.className = `dot ${ok ? 'online' : 'offline'}`;
  $('#statusText').textContent = text;
}
async function refreshStatus() {
  try {
    const s = await api('/api/status');
    const configured = (s.providers || []).filter((p) => p.configured).length;
    setStatus(configured > 0, `${configured} providers`);
    $('#projectChip').textContent = `${s.tools?.project?.name || 'projeto'} · ${(s.tools?.project?.ecosystems || []).join(', ') || '?'}`;
    $('#wsPath').textContent = s.workspace || '';
  } catch { setStatus(false, 'offline'); }
}

function showView(view) {
  state.view = view;
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.view === view));
  const titles = { chat: 'Chat', hive: 'Hive Mind', files: 'Arquivos', terminal: 'Terminal', git: 'Git', providers: 'Providers', runs: 'Execuções', settings: 'Configuração' };
  $('#viewTitle').textContent = titles[view] || view;
  if (view === 'files') refreshFiles();
  if (view === 'runs') refreshRuns();
  if (view === 'settings') loadPermissions();
  if (view === 'providers') refreshProviders();
}

/* ----------------------------- wiring ----------------------------- */
function wire() {
  document.querySelectorAll('.nav-item').forEach((n) => n.onclick = () => showView(n.dataset.view));

  $('#composer').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('#input').value.trim();
    if (!text) return;
    $('#input').value = '';
    sendMessage(text);
  });
  $('#input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#composer').requestSubmit(); }
  });
  $('#codeToggle').onclick = (e) => { state.code = !state.code; e.currentTarget.classList.toggle('on', state.code); };

  $('#modeSelect').addEventListener('change', () => {
    const mode = $('#modeSelect').value;
    const hints = {
      normal: 'Um único modelo responde.',
      fallback: 'Modelo principal com alternativas automáticas.',
      auto: 'O sistema escolhe o melhor modelo pelo tipo da tarefa.',
      'multi-agent': 'Vários agentes com papéis distintos, síntese do Master.',
      hive: 'Hive Mind: Master planeja, agentes colaboram em paralelo.',
      build: 'Foco em construção de software (Hive orientado a build).',
      debug: 'Loop autônomo de teste → correção → teste.',
      review: 'Foco em revisão de código.',
      custom: 'Você controla tudo manualmente.'
    };
    $('#modeHint').textContent = hints[mode] || '';
  });

  $('#clearTimeline').onclick = () => { $('#timeline').innerHTML = '<div class="empty">Eventos do sistema aparecerão aqui.</div>'; };
  $('#refreshFiles').onclick = refreshFiles;
  $('#saveFile').onclick = saveFile;
  $('#refreshRuns').onclick = refreshRuns;
  $('#termForm').addEventListener('submit', (e) => { e.preventDefault(); const c = $('#termCmd').value.trim(); if (!c) return; $('#termCmd').value = ''; runTerminal(c); });
  document.querySelectorAll('[data-git]').forEach((b) => b.onclick = () => runGit(b.dataset.git));

  document.addEventListener('click', (e) => {
    const copy = e.target.closest('[data-copy]');
    if (copy) {
      const code = copy.closest('.code-wrap')?.querySelector('.code-block')?.textContent || '';
      navigator.clipboard.writeText(code).then(() => toast('Código copiado.')).catch(() => {});
    }
  });
}

/* ----------------------------- boot ----------------------------- */
function boot() {
  wire();
  if (!state.conversations.length) newConversation(); else { state.currentId = state.conversations[0].id; renderChat(); }
  renderAgents();
  refreshStatus();
  refreshProviders();
  refreshRuns();
  connectEvents();
  setInterval(refreshStatus, 20000);
}

boot();
