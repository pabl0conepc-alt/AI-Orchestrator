'use strict';

const t = (key, vars) => (window.I18n ? window.I18n.t(key, vars) : key);

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
  const node = $('#toast');
  node.textContent = message;
  node.className = `toast show${isError ? ' err' : ''}`;
  clearTimeout(node._timer);
  node._timer = setTimeout(() => { node.className = 'toast'; }, 3200);
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
      out += `<div class="code-wrap">${lang ? `<span class="lang-tag">${lang}</span>` : ''}`
        + `<button class="mini code-copy" data-copy>${escapeHtml(t('files.save') === 'salvar' ? 'copiar' : 'copy')}</button>`
        + `<code class="code-block">${parts[i + 2]}</code></div>`;
    }
  }
  return out;
}

/* ----------------------------- chat ----------------------------- */
function currentConv() { return state.conversations.find((c) => c.id === state.currentId); }

function newConversation() {
  const conv = { id: crypto.randomUUID(), title: t('chat.newTask'), titled: false, messages: [] };
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
    chat.innerHTML = `<div class="empty">${escapeHtml(t('chat.empty'))}</div>`;
    return;
  }
  for (const m of conv.messages) {
    const wrap = el('div', `msg ${m.role}`);
    const who = m.role === 'user' ? t('chat.you') : t('chat.ai');
    wrap.innerHTML = `<div class="avatar">${escapeHtml(who)}</div>`
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
  if (!conv.titled) { conv.title = text.slice(0, 46); conv.titled = true; }
  const placeholder = { role: 'assistant', content: '', meta: t('meta.orchestrating'), pending: true };
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
    if (streaming) await streamChat(payload, placeholder);
    else {
      const data = await postJson('/api/chat', payload);
      placeholder.pending = false;
      placeholder.content = data.text || '(empty)';
      placeholder.meta = metaFor(data);
    }
  } catch (error) {
    placeholder.pending = false;
    placeholder.content = `Error: ${error.message}`;
    placeholder.meta = 'failed';
    toast(error.message, true);
  }
  save('ai-orch-conversations', state.conversations);
  renderChat();
  refreshRuns();
}

function metaFor(data) {
  const bits = [];
  if (data.provider) bits.push(`${data.provider} · ${data.model}`);
  if (data.fallback) bits.push(t('meta.fallback'));
  if (data.agentCount) bits.push(t('meta.agents', { n: data.agentCount }));
  if (data.synthesized) bits.push(t('meta.synthesis'));
  if (data.diversity) bits.push(t('meta.diversity', { p: data.diversity.providerDiversity, f: data.diversity.familyDiversity }));
  if (data.mode) bits.push(data.mode);
  if (data.durationMs) bits.push(`${(data.durationMs / 1000).toFixed(1)}s`);
  return bits.join(' · ');
}

async function streamChat(payload, placeholder) {
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
      const ev = block.match(/^event:\s*(.+)$/m);
      const dm = block.match(/^data:\s*(.+)$/m);
      if (!ev || !dm) continue;
      let data; try { data = JSON.parse(dm[1]); } catch { continue; }
      if (ev[1].trim() === 'delta') {
        acc += data.delta || '';
        placeholder.pending = false;
        placeholder.content = acc;
        placeholder.meta = t('meta.streaming');
        renderChat();
      } else if (ev[1].trim() === 'done') {
        placeholder.pending = false;
        placeholder.content = data.text || acc;
        finalMeta = metaFor(data);
      } else if (ev[1].trim() === 'error') {
        throw new Error(data.error || 'stream error');
      }
    }
  }
  placeholder.pending = false;
  placeholder.content = placeholder.content || acc || '(empty)';
  placeholder.meta = finalMeta || t('meta.done');
}

/* ----------------------------- SSE timeline / agents ----------------------------- */
function connectEvents() {
  const source = new EventSource('/api/events');
  source.addEventListener('event', (message) => {
    let event; try { event = JSON.parse(message.data); } catch { return; }
    handleEvent(event);
  });
  source.onerror = () => setStatus(false, t('status.offline'));
  source.onopen = () => refreshStatus();
}

function timeOf(ts) { return new Date(ts).toLocaleTimeString(undefined, { hour12: false }); }

function handleEvent(event) {
  const kind = String(event.type || '').split('.')[0];
  appendTimeline(event, kind);

  if (event.type === 'agent.start') {
    state.agents.set(event.taskId, { id: event.taskId, role: event.role, agent: event.agent, provider: event.provider, model: event.model, title: event.title, status: 'running' });
    renderAgents();
  }
  if (event.type === 'agent.status') {
    const a = findAgentByName(event.agent);
    if (a) { a.status = event.status === 'error' ? 'failed' : 'running'; a.model = event.model || a.model; renderAgents(); }
  }
  if (event.type === 'agent.done') {
    const a = state.agents.get(event.taskId);
    if (a) { a.status = event.ok ? 'done' : 'failed'; a.durationMs = event.durationMs; a.error = event.error; renderAgents(); }
  }
  if (event.type === 'hive.models' || event.type === 'super.models') { state.diversity = event.diversity; renderAgents(); }
  if (event.type === 'task.plan') {
    state.agents.clear();
    (event.tasks || []).forEach((task) => state.agents.set(task.id, { id: task.id, role: task.role, title: task.title, status: 'pending', dependsOn: task.dependsOn }));
    renderAgents();
    toast(t('toast.planned', { n: event.tasks.length, source: event.source }));
  }
}

function findAgentByName(name) { for (const a of state.agents.values()) if (a.agent === name) return a; return null; }

function appendTimeline(event, kind) {
  const box = $('#timeline');
  if (!box.querySelector('.empty')) { /* keep */ }
  const row = el('div', 'tl-row');
  row.innerHTML = `<div class="tl-time">${timeOf(event.ts)}</div>`
    + `<div class="tl-body"><span class="tl-kind ${kind}">${kind}</span>${describeEvent(event)}</div>`;
  box.appendChild(row);
  box.scrollTop = box.scrollHeight;
  const rows = box.querySelectorAll('.tl-row');
  if (rows.length > 300) rows[0].remove();
}

function describeEvent(e) {
  const esc = escapeHtml;
  switch (e.type) {
    case 'task.start': return `<b>Master</b> started task (${esc(e.mode)})`;
    case 'task.plan': return `<b>Master</b> planned: ${esc(e.summary || '')}`;
    case 'task.done': return `<b>Master</b> finished (${e.agents} agents)`;
    case 'hive.models': return `Models assigned — diversity ${e.diversity?.providerDiversity}p/${e.diversity?.familyDiversity}f`;
    case 'super.models': return `Super Mode models — diversity ${e.diversity?.providerDiversity}p/${e.diversity?.familyDiversity}f`;
    case 'super.consensus': return `Consensus — ${e.critiques} critiques, ${e.disagreements} with disagreement`;
    case 'agent.start': return `<b>${esc(e.agent)}</b> started "${esc(e.title || e.taskId)}" on ${esc(e.provider)}:${esc(e.model || '?')}`;
    case 'agent.status': return `<b>${esc(e.agent)}</b> ${esc(e.status)}${e.model ? ` · ${esc(e.model)}` : ''}`;
    case 'agent.done': return e.ok ? `<b>${esc(e.agent)}</b> finished in ${((e.durationMs || 0) / 1000).toFixed(1)}s` : `<b>${esc(e.agent)}</b> failed: ${esc(e.error || '')}`;
    case 'tool.start': return `tool <b>${esc(e.tool)}</b> started`;
    case 'tool.done': return `tool <b>${esc(e.tool)}</b> ${e.ok ? 'ok' : 'failed'} (${e.durationMs}ms)`;
    case 'message': return `<b>${esc(e.from)}</b> → <b>${esc(e.to)}</b> [${esc(e.type)}] ${esc(e.content || '')}`;
    case 'debug.attempt': return `debug attempt ${e.attempt}`;
    case 'debug.fixing': return `debug fixing with ${esc(e.provider)}:${esc(e.model)}`;
    case 'debug.done': return `debug ${e.ok ? 'converged' : 'did not converge'}`;
    case 'server.ready': return 'server ready';
    default: return esc(e.type);
  }
}

/* ----------------------------- agents render ----------------------------- */
function renderAgents() {
  const grid = $('#agentGrid');
  if (!state.agents.size) { grid.innerHTML = `<div class="empty">${escapeHtml(t('hive.empty'))}</div>`; return; }
  grid.innerHTML = '';
  for (const a of state.agents.values()) {
    const card = el('div', `agent-card ${a.status}`);
    const model = a.provider ? `${a.provider}:${a.model || '?'}` : (a.model || '—');
    card.innerHTML = `<div class="ac-head"><span class="ac-role">${escapeHtml(a.agent || a.role || t('agent.pending'))}</span><span class="ac-status ${a.status}">${escapeHtml(statusLabel(a.status))}</span></div>`
      + `<div class="ac-model">${escapeHtml(model)}</div>`
      + `<div class="ac-task">${escapeHtml(a.title || a.role || '')}${a.durationMs ? ` · ${(a.durationMs / 1000).toFixed(1)}s` : ''}</div>`
      + (a.status === 'running' ? '<div class="progress"><i></i></div>' : '');
    grid.appendChild(card);
  }
  if (state.diversity) $('#hiveDiversity').textContent = t('hive.diversity', { p: state.diversity.providerDiversity, f: state.diversity.familyDiversity });
}
function statusLabel(s) { return t(`state.${s === 'running' ? 'running' : s === 'done' ? 'done' : s === 'failed' ? 'failed' : 'pending'}`); }

/* ----------------------------- files ----------------------------- */
async function refreshFiles() {
  try {
    const data = await api('/api/files?depth=4');
    const box = $('#fileTree');
    box.innerHTML = '';
    if (!data.entries.length) { box.innerHTML = `<div class="empty">${escapeHtml(t('files.empty'))}</div>`; return; }
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
  if (!state.openFile) return toast(t('toast.noFile'), true);
  try {
    await postJson('/api/file', { path: state.openFile, content: $('#editor').value });
    toast(t('toast.saved', { path: state.openFile }));
  } catch (error) { toast(error.message, true); }
}

/* ----------------------------- terminal / git ----------------------------- */
async function runTerminal(command) {
  const out = $('#termOut');
  out.textContent += `\n$ ${command}\n`;
  try {
    const data = await postJson('/api/tools/run', { tool: 'run_command', params: { command, confirm: true } });
    out.textContent += `${data.ok ? '✓' : '✗'} ${data.stdout || data.stderr || data.error || '(no output)'}\n`;
  } catch (error) { out.textContent += `error: ${error.message}\n`; }
  out.textContent += '---\n';
  out.scrollTop = out.scrollHeight;
}
async function runGit(tool) {
  const out = $('#gitOut');
  out.textContent = `${tool}…`;
  try {
    const data = await postJson('/api/tools/run', { tool, params: {} });
    const body = data.stdout || data.stderr || data.error || JSON.stringify(data, null, 2);
    out.textContent = `${data.ok ? '✓' : '✗'} ${body}`;
  } catch (error) { out.textContent = error.message; }
}

/* ----------------------------- providers / settings ----------------------------- */
async function refreshProviders() {
  try {
    const providers = await api('/api/providers');
    state.providers = providers;
    const configured = providers.filter((p) => p.configured);
    $('#providerSelect').innerHTML = configured.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('') || '<option value="">—</option>';
    setStatus(configured.length > 0, t('status.providers', { n: configured.length }));
    $('#providerCount').textContent = t('providers.configured', { n: configured.length, m: providers.length });
    renderProviderGrid(providers);
    loadMatrix();
  } catch { setStatus(false, t('status.offline')); }
}

function renderProviderGrid(providers) {
  const grid = $('#providerGrid');
  grid.innerHTML = '';
  for (const p of providers) {
    const health = p.health || {};
    const stateClass = p.configured ? (health.state === 'degraded' ? 'warn' : health.state === 'offline' ? 'bad' : 'ok') : 'bad';
    const card = el('div', 'provider-card');
    card.innerHTML = `<div class="pc-top"><div><b>${escapeHtml(p.name)}</b><div class="id">${escapeHtml(p.id)}</div></div>`
      + `<span class="pill ${stateClass}">${p.configured ? escapeHtml(health.state || 'online') : 'no key'}</span></div>`
      + `<div class="pc-meta"><span class="pill">${escapeHtml(p.transport)}</span><span class="pill">priority ${p.priority}</span>`
      + `<span class="pill">${p.freePool ? 'free' : 'paid'}</span><span class="pill">${health.avgLatencyMs ? health.avgLatencyMs + 'ms' : 'no data'}</span></div>`
      + `<div class="id">model: ${escapeHtml(p.defaultModel)}</div>`
      + `<div class="caps">${Object.entries(p.capabilities || {}).filter(([, v]) => v).map(([k]) => `<span class="pill">${escapeHtml(k)}</span>`).join('')}</div>`;
    grid.appendChild(card);
  }
}

async function loadMatrix() {
  try {
    const { matrix } = await api('/api/models');
    const caps = ['coding', 'reasoning', 'security', 'research', 'speed'];
    const head = `<tr><th>model</th>${caps.map((c) => `<th>${c}</th>`).join('')}</tr>`;
    const rows = matrix.slice(0, 60).map((m) => `<tr><td>${escapeHtml(m.providerId)}:<b>${escapeHtml(m.modelId)}</b></td>`
      + caps.map((c) => `<td><span class="mbar"><i style="width:${Math.round((m.capabilities[c] || 0) * 100)}%"></i></span></td>`).join('') + '</tr>').join('');
    $('#matrixWrap').innerHTML = `<table class="matrix">${head}${rows}</table>`;
  } catch { /* optional */ }
}

async function loadPermissions() {
  try {
    const { permissions } = await api('/api/tools');
    $('#permList').innerHTML = permissions.map((p) => `<div class="perm-row"><span>${p.permission}</span>`
      + `<span class="pill ${p.enabled ? 'ok' : 'bad'}">${p.enabled ? 'enabled' : 'blocked'}</span></div>`).join('');
  } catch { /* optional */ }
}

async function refreshRuns() {
  try {
    const { runs } = await api('/api/memory/runs');
    state.runs = runs;
    const box = $('#runsList');
    box.innerHTML = runs.length ? '' : `<div class="empty">${escapeHtml(t('runs.empty'))}</div>`;
    for (const r of runs) {
      const row = el('div', 'run-row');
      row.innerHTML = `<div><div class="r-task">${escapeHtml(r.task || '')}</div><div class="r-meta">${escapeHtml(r.mode)} · ${new Date(r.createdAt).toLocaleString()}</div></div><span class="pill">${escapeHtml(r.status)}</span>`;
      row.onclick = () => loadRun(r.id);
      box.appendChild(row);
    }
  } catch { /* optional */ }
}

async function loadRun(id) {
  try {
    const run = await api(`/api/memory/runs/${id}`);
    const detail = (run.tasks || []).map((task) => ({ id: task.taskId, role: task.role, agent: task.agent, provider: task.provider, model: task.model, status: task.status, durationMs: task.durationMs }));
    if (detail.length) { state.agents.clear(); detail.forEach((task) => state.agents.set(task.id, task)); }
    showView('hive');
    renderAgents();
    toast(t('toast.run', { id, n: detail.length }));
  } catch (error) { toast(error.message, true); }
}

/* ----------------------------- status / nav ----------------------------- */
function setStatus(ok, text) {
  $('#statusDot').className = `dot ${ok ? 'online' : 'offline'}`;
  $('#statusText').textContent = text;
}
async function refreshStatus() {
  try {
    const s = await api('/api/status');
    const configured = (s.providers || []).filter((p) => p.configured).length;
    setStatus(configured > 0, t('status.providers', { n: configured }));
    $('#projectChip').textContent = `${s.tools?.project?.name || 'project'} · ${(s.tools?.project?.ecosystems || []).join(', ') || '?'}`;
    $('#wsPath').textContent = s.workspace || '';
  } catch { setStatus(false, t('status.offline')); }
}

const MODE_HINT_KEY = {
  normal: 'hint.normal', fallback: 'hint.fallback', auto: 'hint.auto', 'multi-agent': 'hint.multiAgent',
  hive: 'hint.hive', super: 'hint.super', build: 'hint.build', debug: 'hint.debug', review: 'hint.review', custom: 'hint.custom'
};

function showView(view) {
  state.view = view;
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.view === view));
  $('#viewTitle').textContent = t(`view.${view}`);
  if (view === 'files') refreshFiles();
  if (view === 'runs') refreshRuns();
  if (view === 'settings') loadPermissions();
  if (view === 'providers') refreshProviders();
}

/* ----------------------------- wiring ----------------------------- */
function wire() {
  document.querySelectorAll('.nav-item').forEach((n) => { n.onclick = () => showView(n.dataset.view); });

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

  const applyModeHint = () => { $('#modeHint').textContent = t(MODE_HINT_KEY[$('#modeSelect').value] || 'hint.hive'); };
  $('#modeSelect').addEventListener('change', applyModeHint);
  applyModeHint();

  $('#langSelect').addEventListener('change', (e) => {
    window.I18n.setLang(e.target.value);
    window.I18n.apply();
    applyModeHint();
    renderChat();
    renderAgents();
    refreshProviders();
    refreshRuns();
  });

  $('#clearTimeline').onclick = () => { $('#timeline').innerHTML = ''; };
  $('#refreshFiles').onclick = refreshFiles;
  $('#saveFile').onclick = saveFile;
  $('#refreshRuns').onclick = refreshRuns;
  $('#termForm').addEventListener('submit', (e) => { e.preventDefault(); const c = $('#termCmd').value.trim(); if (!c) return; $('#termCmd').value = ''; runTerminal(c); });
  document.querySelectorAll('[data-git]').forEach((b) => { b.onclick = () => runGit(b.dataset.git); });

  document.addEventListener('click', (e) => {
    const copy = e.target.closest('[data-copy]');
    if (copy) {
      const code = copy.closest('.code-wrap')?.querySelector('.code-block')?.textContent || '';
      navigator.clipboard.writeText(code).then(() => toast(t('toast.copied'))).catch(() => {});
    }
  });
}

/* ----------------------------- boot ----------------------------- */
function boot() {
  if (window.I18n) { window.I18n.init(); window.I18n.apply(); $('#langSelect').value = window.I18n.lang; }
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
