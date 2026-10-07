'use strict';

/* ============================================================
   app.js — entry. Wires shell (sidebar, topbar, HUD), the chat
   view, live SSE events into agents/timeline, and orchestration.
   ============================================================ */

import { $, $$, el, escapeHtml, state, api, postJson, currentConv, persist, loadState } from './js/core.js';
import { formatMarkdown } from './js/markdown.js';
import { I } from './js/icons.js';
import { entrance, staggerInView, moveNavIndicator, tickNumber, pulse } from './js/motion.js';
import { I18n, t } from './i18n.js';
import { toast, openCmdk, closeCmdk, bindNetwork } from './js/components.js';
import { createChat, createComposer } from './js/views/chat.js';
import * as S from './js/views/surfaces.js';

window.__formatMarkdown = formatMarkdown;

/* ============ network bridge for components ============ */
const net = {
  cmdkHost: document.getElementById('app'),
  open: false,
  switchView: (view) => showView(view),
  setMode: (mode) => { coreStateMode(mode); },
  commandExtras: () => [{
    label: t('nav.newTask'), icon: 'plus', run: () => { newConversation(); showView('chat'); focusComposer(); }
  }]
};
bindNetwork(net);

function coreStateMode(mode) {
  state.mode = mode;
  persist('ai-orch-mode', mode);
  const select = $('#mode-select');
  if (select && select.value !== mode) select.value = MODE_KEYS.includes(mode) ? mode : select.value;
  updateModeHint();
}

/* ============ view switching ============ */
const viewTitles = { chat: 'nav.chat', hive: 'nav.hive', files: 'nav.files', terminal: 'nav.terminal', git: 'nav.git', providers: 'nav.providers', runs: 'nav.runs', settings: 'nav.settings' };

export function showView(view) {
  state.view = view;
  $$('.view').forEach((v) => v.classList.toggle('active', v.dataset.view === view));
  $$('.conv-item').forEach((n) => n.classList.remove('active'));
  const navItem = $(`.nav-item[data-view="${view}"]`);
  if (navItem) {
    $$('.nav-item').forEach((n) => n.classList.toggle('active', n === navItem));
    moveNavIndicator($('#nav-indicator'), navItem);
  }
  $('#view-title').textContent = t(viewTitles[view] || 'nav.chat');

  /* data-bound views refresh on entry */
  const queue = [];
  if (view === 'files') queue.push(S.refreshFiles());
  if (view === 'runs') queue.push(refreshRuns());
  if (view === 'settings') queue.push(S.loadSettings());
  if (view === 'providers') queue.push(refreshProviders());
  if (view === 'terminal') queue.push(S.initTerminal(t('term.ready')));
  if (view === 'hive') renderAgents();
  if (queue.length) Promise.all(queue).catch(() => {});
}

function wireNav() {
  $$('.nav-item').forEach((n) => n.addEventListener('click', () => showView(n.dataset.view)));
  $$('.nav-item').forEach((n) => n.addEventListener(
    'mouseenter',
    () => pulse(n.querySelector('.nav-ico'))
  ));
}

/* ============ conversations ============ */
function newConversation() {
  const conv = { id: crypto.randomUUID(), title: t('chat.newTask'), titled: false, messages: [] };
  state.convList.unshift(conv);
  state.currentId = conv.id;
  persist('ai-orch-conversations', state.convList);
  renderConversations();
  chat.render();
}

function renderConversations() {
  const list = $('#conv-list');
  list.innerHTML = '';
  for (const conv of state.convList.slice(0, 12)) {
    const item = el('div', `conv-item ${conv.id === state.currentId ? 'active' : ''}`, `
      <span class="conv-title">${escapeHtml(conv.title || t('chat.newTask'))}</span>
      <button class="conv-del" aria-label="delete">${I.x}</button>`);
    item.addEventListener('click', (e) => {
      if (e.target.closest('.conv-del')) { return; }
      state.currentId = conv.id;
      persist('ai-orch-conversations', state.convList);
      renderConversations();
      chat.render();
    });
    item.querySelector('.conv-del').addEventListener('click', (e) => {
      e.stopPropagation();
      state.convList = state.convList.filter((c) => c.id !== conv.id);
      if (state.currentId === conv.id) state.currentId = state.convList[0]?.id || null;
      persist('ai-orch-conversations', state.convList);
      renderConversations();
      chat.render();
    });
    list.appendChild(item);
  }
}

/* ============ orchestration (send) ============ */
const STREAM_MODES = new Set(['normal', 'fallback', 'auto']);

async function sendMessage(text) {
  if (!currentConv()) newConversation();
  const conv = currentConv();
  const attachmentBlock = state.attachments.length ? `\n\n[${state.attachments.join('\n')}]` : '';
  conv.messages.push({ role: 'user', content: text + attachmentBlock });
  if (!conv.titled) { conv.title = text.slice(0, 46); conv.titled = true; }
  const pending = { role: 'assistant', content: '', pending: true, meta: t('meta.orchestrating') };
  conv.messages.push(pending);
  persist('ai-orch-conversations', state.convList);
  renderConversations();
  composer.setBusy(true);
  chat.render();
  document.body.classList.add('is-orchestrating');
  startPipeline(text);

  const attachmentPaths = [...state.attachments];
  state.attachments = [];
  composer.renderAttach();

  /* request context may reference attached files; backend accepts extra messages role user */
  const payload = {
    providerId: state.providerId || undefined,
    model: state.model || undefined,
    mode: state.mode,
    messages: conv.messages.filter((m) => m !== pending).map((m) => ({ role: m.role, content: m.content })),
    profile: state.code ? 'coding' : 'general',
    temperature: 0.3,
    maxTokens: 6144
  };

  const streaming = STREAM_MODES.has(state.mode);
  try {
    if (streaming) await streamChat(payload, pending);
    else {
      const result = await postJson('/api/chat', payload);
      pending.pending = false;
      pending.content = result.text || '(empty)';
      pending.meta = metaFor(result);
      pipelineStep(3);
    }
    agentStatus = 'done';
  } catch (error) {
    pending.pending = false;
    pending.content = '';
    pending.meta = t('meta.failed');
    pending.error = error.message;
    toast(error.message, 'error');
    pipelineFail();
  }
  persist('ai-orch-conversations', state.convList);
  composer.setBusy(false);
  document.body.classList.remove('is-orchestrating');
  chat.render();
  refreshRuns();
}

async function streamChat(payload, pending) {
  const res = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
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
      const ev = block.match(/^event:\s*(.+)$/m)?.[1]?.trim();
      const dm = block.match(/^data:\s*(.+)$/m)?.[1];
      if (!ev || !dm) continue;
      let data; try { data = JSON.parse(dm); } catch { continue; }
      if (ev === 'delta') {
        acc += data.delta || '';
        pending.pending = false;
        pending.streaming = true;
        pending.content = acc;
        pending.meta = t('meta.streaming');
        chat.streamUpdate();
      } else if (ev === 'done') {
        pending.pending = false;
        pending.streaming = false;
        pending.content = data.text || acc;
        pending.meta = metaFor(data);
        finalMeta = pending.meta;
      } else if (ev === 'error') { throw new Error(data.error || 'stream error'); }
    }
  }
  pending.streaming = false;
  pending.meta = finalMeta || t('meta.done');
}

function metaFor(data) {
  const bits = [];
  if (data.provider) bits.push(`${data.provider}·${data.model || ''}`);
  if (data.fallback) bits.push(t('meta.fallback'));
  if (data.agentCount) bits.push(t('meta.agents', { n: data.agentCount }));
  if (data.synthesized) bits.push(t('meta.synthesis'));
  if (data.diversity) bits.push(t('meta.diversity', { p: data.diversity.providerDiversity, f: data.diversity.familyDiversity }));
  if (data.mode) bits.push(data.mode);
  if (data.durationMs) bits.push(`${(data.durationMs / 1000).toFixed(1)}s`);
  return bits.join(' · ');
}

/* ============ pipeline drive ============ */
const PIPE_STEPS = ['pipe.request', 'pipe.plan', 'pipe.agents', 'pipe.process', 'pipe.result'];
let pipelineNodes = [];

function startPipeline() {
  const host = $('#pipeline-host');
  host.innerHTML = '';
  pipelineNodes = [];
  const pipe = document.createElement('div');
  pipe.className = 'pipeline';
  pipe.innerHTML = `<div class="pipeline-bar"><span class="loader-dots"><i></i><i></i><i></i></span>
      <span class="pb-label">${escapeHtml(t('meta.orchestrating'))}</span></div>
    <div class="pipeline-steps">${PIPE_STEPS.map((k) => `
      <div class="pipe-step"><span class="pipe-node"></span><span class="pipe-text">${escapeHtml(t(k))}</span></div>`).join('<span class="pipe-link"></span>')}
    </div>
    <div class="pipe-status"></div>`;
  host.appendChild(pipe);
  entrance(pipe);
  pipelineNodes = $$('.pipe-step', pipe);
  pipelineStep(1);                 // request acknowledged → planning
}

function pipelineStep(index) {
  pipelineNodes.forEach((n, j) => {
    n.classList.toggle('done', j < index);
    n.classList.toggle('active', j === index);
  });
}

function pipelineDone(seconds) {
  pipelineNodes.forEach((n) => { n.classList.remove('active'); n.classList.add('done'); });
  const status = $('.pipe-status', $('#pipeline-host'));
  if (status) status.textContent = t('pipe.status.done', { s: seconds });
}

function pipelineFail() {
  pipelineNodes.forEach((n) => n.classList.remove('active'));
  const status = $('.pipe-status', $('#pipeline-host'));
  if (status) { status.textContent = t('pipe.status.error'); status.style.color = 'var(--red)'; }
}
function finalizePipeline(seconds) { pipelineDone(seconds); }
void finalizePipeline;

/* ============ SSE events → agents + timeline ============ */
function connectEvents() {
  const source = new EventSource('/api/events');
  source.addEventListener('event', (m) => {
    try { S.appendTimeline(JSON.parse(m.data)); handleEvent(JSON.parse(m.data)); } catch { /* malformed */ }
  });
  source.onerror = () => setStatus(false, t('status.offline'));
  source.onopen = () => refreshStatus();
}

function handleEvent(event) {
  if (event.type === 'agent.start') {
    state.agents.set(event.taskId, { id: event.taskId, role: event.role, agent: event.agent, provider: event.provider, model: event.model, title: event.title, status: 'running' });
    renderAgents();
  }
  if (event.type === 'agent.status') {
    for (const a of state.agents.values()) {
      if (a.agent === event.agent) { a.status = 'running'; a.model = event.model || a.model; }
    }
    renderAgents();
  }
  if (event.type === 'agent.done') {
    const a = state.agents.get(event.taskId);
    if (a) { a.status = event.ok ? 'done' : 'failed'; a.durationMs = event.durationMs; a.error = event.error; }
    renderAgents();
  }
  if (event.type === 'hive.models' || event.type === 'super.models') {
    state.diversity = event.diversity;
    renderAgents();
  }
  if (event.type === 'task.plan') {
    state.agents.clear();
    (event.tasks || []).forEach((task) => state.agents.set(task.id, { id: task.id, role: task.role, agent: task.role, title: task.title, status: 'pending', dependsOn: task.dependsOn }));
    renderAgents();
    pipelineStep(2);
    toast(t('toast.planned', { n: event.tasks.length, source: event.source }), 'info');
  }
  if (event.type === 'agent.start' && !document.body.classList.contains('is-orchestrating')) {
    document.body.classList.add('is-orchestrating');
  }
  if (event.type === 'task.done') { pipelineStep(4); setTimeout(() => pipelineDone(((event.durationMs || 0) / 1000).toFixed(1)), 250); }
}

function renderAgents() {
  S.renderAgents();
  const running = [...state.agents.values()].filter((a) => a.status === 'running').length;
  $('#busybar').classList.toggle('show', running > 0);
  if (running > 0) $('#busybar-count').textContent = t('busybar.working', { n: running });
}

/* ============ status / HUD ============ */
function setStatus(ok, text) {
  state.status.online = ok;
  state.status.label = text;
  $('#status-dot').className = `dot ${ok ? 'online' : 'offline'}`;
  $('#status-text').textContent = text;
}

async function refreshStatus() {
  try {
    const s = await api('/api/status');
    const configured = (s.providers || []).filter((p) => p.configured).length;
    const workspaceText = s.workspace ? t('status.workspace') : t('status.connecting');
    setStatus(configured > 0, configured > 0 ? t('status.providers', { n: configured }) : t('status.noProviders'));
    $('#ws-path').textContent = s.workspace || '';
    $('#topbar-sub').textContent = `${s.tools?.project?.name || 'project'} · ${(s.tools?.project?.ecosystems || []).join(', ') || '—'}`;
    state.hud.tools = s.tools?.tool_count ?? state.hud.tools;
    renderHUD();
  } catch { setStatus(false, t('status.offline')); }
}

function renderHUD() {
  const hud = $('#hud');
  if (!hud) return;
  hud.innerHTML = `
    <div class="hud-cell"><span class="hud-num">${state.hud.tools}</span><span class="hud-label meta-label">${t('hud.tools')}</span></div>
    <div class="hud-cell"><span class="hud-num">${state.hud.roles}</span><span class="hud-label meta-label">${t('hud.agents')}</span></div>
    <div class="hud-cell"><span class="hud-num serif">${escapeHtml(state.hud.prompts)}</span><span class="hud-label meta-label">${t('hud.prompts')}</span></div>`;
}

async function refreshProviders() {
  try {
    const providers = await api('/api/providers');
    state.providers = providers;
    const configured = providers.filter((p) => p.configured);
    S.renderProviders(providers);
    $('#provider-count').innerHTML = `<span class="chip chip-green">${t('providers.configured', { n: configured.length, m: providers.length })}</span>`;
    composer?.syncProviders();
    if (!configured.length) toast(t('toast.noProviders'), 'info');
  } catch (error) { setStatus(false, t('status.offline')); }
}

async function refreshRuns() {
  try {
    const { runs } = await api('/api/memory/runs');
    state.runs = runs;
    S.renderRuns(runs, S.openRunDetail);
  } catch { /* optional */ }
}

/* ============ composer + chat wiring ============ */
let chat, composer;
const MODE_KEYS = ['hive', 'build', 'multi-agent', 'super', 'debug', 'review', 'auto', 'fallback', 'custom'];

function updateModeHint() {
  const mode = state.mode;
  const hint = $('#mode-hint');
  if (hint) {
    hint.innerHTML = `${t('hint.' + mode)}`;
  }
  const select = $('#mode-select');
  if (select && select.value !== mode) {
    select.value = MODE_KEYS.includes(mode) ? mode : mode;
  }
}

function focusComposer() { $('#composer-textarea')?.focus(); }

/* ============ boot ============ */
function boot() {
  I18n.init();
  document.title = I18n.t('brand.name');
  $('#brand-name').textContent = I18n.t('brand.name');
  $('#brand-sub').textContent = I18n.t('brand.sub');
  buildShellText();
  wireTopbar();
  wireNav();
  wireSidebar();
  wireKeys();
  chat = createChat({ onChange: renderConversations });
  composer = createComposer({ onSend: sendMessage, onModeChange: updateModeHint });
  wireSidebarData();
  if (!state.convList.length) newConversation();
  else { state.currentId = state.convList[0].id; renderConversations(); chat.render(); }
  const savedMode = loadState('ai-orch-mode', state.mode);
  if (MODE_KEYS.includes(savedMode)) state.mode = savedMode;
  if (!$('#mode-select').value) updateModeHint();
  connectEvents();
  refreshStatus();
  refreshProviders();
  refreshRuns();
  setInterval(refreshStatus, 20000);
  setTimeout(() => toast(t('toast.welcome'), 'info'), 900);
}

function wireSidebar() {
  /* ícones estáticos + chips do hero + fluxos fixos */
  $$('.nav-item [data-ico]').forEach((n) => { n.innerHTML = I[n.dataset.ico] || I.spark; });
  $('#attach-btn').innerHTML = I.paperclip;
  $('#composer-send').innerHTML = I.send;
  $('#refresh-files').innerHTML = I.refresh;
  const heroChips = $('#hero-chips');
  if (heroChips) {
    heroChips.innerHTML = [
      { k: 'hive', ico: 'hive' }, { k: 'multi-agent', ico: 'spark' }, { k: 'super', ico: 'jarvis' }, { k: 'debug', ico: 'bolt' }
    ].map((c) => `<button class="hero-chip" data-mode="${c.k}" type="button">${I[c.ico]}<span>${escapeHtml(I18n.t('mode.' + c.k))}</span></button>`).join('');
    $$('.hero-chip', heroChips).forEach((chip) => {
      chip.addEventListener('click', () => {
        coreStateMode(chip.dataset.mode);
        focusComposer();
        toast(I18n.t('hint.' + chip.dataset.mode), 'info');
      });
    });
  }
}

function wireSidebarData() {
  $('#refresh-files')?.addEventListener('click', S.refreshFiles);
  $('#clear-timeline')?.addEventListener('click', S.clearTimeline);
  $('#refresh-runs')?.addEventListener('click', refreshRuns);
}

function buildShellText() {
  const titles = Object.entries(viewTitles);
  $$('.nav-item').forEach((n) => {
    const span = n.querySelector('.nav-label');
    if (span) span.textContent = t(viewTitles[n.dataset.view] || '');
  });
  $('#tb-menu-icon').innerHTML = I.menu;
  $('#topbar-cmdk').innerHTML = `${I.search}<span class="meta-label">${t('top.cmdk')} ⌘K</span>`;
  $('#nav-new-task').innerHTML = `${I.plus}<span>${t('nav.newTask')}</span>`;
  $('#lang-select').value = I18n.lang;
}
function wireTopbar() {
  $$('.view').forEach((v) => { if (!v.dataset.view) v.dataset.view = v.id.replace('view-', ''); });
  $('#tb-menu').addEventListener('click', () => $('#app').classList.toggle('drawer-open'));
  $('#drawer-overlay').addEventListener('click', () => $('#app').classList.remove('drawer-open'));
  $('#topbar-cmdk').addEventListener('click', openCmdk);
  $('#lang-select').addEventListener('change', (e) => {
    I18n.setLang(e.target.value);
    buildShellText();
    updateModeHint();
    chat.render();
    S.clearTimeline();
  });
  $('#code-toggle').addEventListener('click', (e) => {
    state.code = !state.code;
    e.currentTarget.classList.toggle('on', state.code);
    if (state.code) pulse(e.currentTarget.querySelector('.seg-dot'));
  });
}
function wireKeys() {
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); net.open ? closeCmdk() : openCmdk(); }
    if (e.key === 'Escape' && net.open) closeCmdk();
    if (e.key === '/' && !['TEXTAREA', 'INPUT'].includes(document.activeElement?.tagName)) { e.preventDefault(); openCmdk(); }
  });
}

boot();
