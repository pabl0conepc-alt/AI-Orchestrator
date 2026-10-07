'use strict';

/* ============================================================
   views/surfaces.js — Hive, Files, Terminal, Git, Providers,
   Runs, Settings.
   ============================================================ */

import { $, $$, el, escapeHtml, state, api, postJson, persist } from '../core.js';
import { I } from '../icons.js';
import { entrance, staggerInView, pulse } from '../motion.js';
import { t, I18n } from '../../i18n.js';
import { toast } from '../components.js';

/* -------------- shared helpers -------------- */
function statusChip(statusKey) {
  const ok = statusKey === 'done';
  const bad = statusKey === 'failed';
  const open = statusKey === 'running';
  const label = I18n.t(`state.${statusKey}`) || statusKey;
  const cls = ok ? 'chip-green' : bad ? 'chip-red' : open ? 'chip-accent' : '';
  const glyph = ok ? I.check : bad ? I.x : open ? I.spark : I.clock;
  return `<span class="chip ${cls}"><span class="chip-dot">${glyph}</span>${escapeHtml(label)}</span>`;
}

function emptyState(title, sub, iconKey = 'spark') {
  return `<div class="chat-empty" style="margin-top:var(--s-16)">
    <div class="hero-orbit">${I[iconKey] || I.spark}</div>
    <h1>${escapeHtml(title)}</h1><p>${escapeHtml(sub)}</p></div>`;
}

/* ================= HIVE ================= */
export function renderAgents() {
  const grid = $('#agent-grid');
  const emptyBox = $('#hive-empty');
  const list = [...state.agents.values()];
  if (!list.length) {
    grid.innerHTML = '';
    emptyBox.style.display = '';
    return;
  }
  emptyBox.style.display = 'none';
  grid.innerHTML = '';
  for (const a of list) {
    const model = a.provider ? `${a.provider}:${a.model || '?'}` : (a.model || '—');
    const running = a.status === 'running';
    const dur = a.durationMs != null ? ` · ${(a.durationMs / 1000).toFixed(1)}s` : '';
    const errHtml = a.error ? `<div class="ac-error">${escapeHtml(a.error)}</div>` : '';
    const card = el('div', `agent-card ${a.status}`, `
      <div class="ac-head">
        <span class="ac-role">${I.spark}<span>${escapeHtml(a.agent || a.role || t('state.idle'))}</span></span>
        <span class="ac-status ${a.status}"><span class="ac-dot ${a.status}"></span>${escapeHtml(I18n.t(`state.${a.status === 'pending' ? 'pending' : a.status}`))}</span>
      </div>
      <div class="ac-model">${escapeHtml(model)}</div>
      <div class="ac-task">${escapeHtml(a.title || '')}${dur}</div>
      ${running ? '<div class="progress"><i></i></div>' : ''}${errHtml}`);
    grid.appendChild(card);
  }
  if (state.diversity) {
    $('#hive-diversity').innerHTML = `<span class="chip chip-blue">${I.hive}</span><span class="ac-agent">${escapeHtml(I18n.t('hive.diversity', { p: state.diversity.providerDiversity, f: state.diversity.familyDiversity }))}</span>`;
  }
  staggerInView($$('.agent-card', grid));
}

/* ---------------- Timeline ---------------- */
function tlClass(kind) {
  return { agent: 'ev-agent', tool: 'ev-tool', task: 'ev-task', message: 'ev-message', debug: 'ev-debug' }[kind] || 'ev-agent';
}

export function appendTimeline(event) {
  const kind = String(event.type || '').split('.')[0];
  const box = $('#timeline');
  if (!box) return;
  if (box.querySelector('.timeline-empty')) box.innerHTML = '';
  const row = el('div', `tl-row ${tlClass(kind)}`, `
    <div class="tl-body"><span class="tl-kind tl-kind-${kind}">${escapeHtml(kind)}</span>${describeEvent(event)}</div>
    <div class="tl-time">${new Date(event.ts).toLocaleTimeString(undefined, { hour12: false })}</div>`);
  box.appendChild(row);
  entrance(row);
  while (box.children.length > 260) box.firstChild.remove();
  box.scrollTop = box.scrollHeight;
}

function describeEvent(e) {
  const esc = escapeHtml;
  switch (e.type) {
    case 'task.start': return `<b>Master</b> <span>${esc(e.mode || '')}</span>`;
    case 'task.plan': return `<b>Master</b> ${esc(I18n.t('toast.planned', { n: (e.tasks || []).length, source: esc(e.source || '') }))}`;
    case 'task.done': return `<b>Master</b> · ${esc(String(e.agents || ''))}`;
    case 'hive.models': case 'super.models': return `${esc(I18n.t('hive.diversity', { p: e.diversity?.providerDiversity ?? 0, f: e.diversity?.familyDiversity ?? 0 }))}`;
    case 'agent.start': return `<b>${esc(e.agent)}</b> → ${esc(e.provider)}:${esc(e.model || '?')} · ${esc(e.title || '')}`;
    case 'agent.status': return `<b>${esc(e.agent)}</b> ${esc(e.status)}${e.model ? ` · ${esc(e.model)}` : ''}`;
    case 'agent.done': return e.ok ? `<b>${esc(e.agent)}</b> · ${((e.durationMs || 0) / 1000).toFixed(1)}s` : `<b>${esc(e.agent)}</b> ✗ ${esc(e.error || '')}`;
    case 'tool.start': return `<b>${esc(e.tool)}</b> ${esc(t('state.running'))}`;
    case 'tool.done': return `<b>${esc(e.tool)}</b> ${e.ok ? '✓' : '✗'} ${e.durationMs}ms`;
    case 'message': return `<b>${esc(e.from)}</b> → <b>${esc(e.to)}</b> [${esc(e.type)}]`;
    default: return esc(e.type);
  }
}

export function clearTimeline() {
  const box = $('#timeline');
  box.innerHTML = `<div class="timeline-empty empty-state">${escapeHtml(t('timeline.empty'))}</div>`;
}

/* ================= FILES ================= */
function fileGlyph(ext) {
  const glyph = I.file; /* simplified — one crisp glyph family */
  return glyph;
}

export async function refreshFiles() {
  try {
    const data = await api('/api/files?depth=4');
    const box = $('#file-tree');
    box.innerHTML = '';
    if (!data.entries.length) { box.innerHTML = `<div class="empty-state">${escapeHtml(t('files.empty'))}</div>`; return; }
    const byDepth = {};
    for (const entry of data.entries) byDepth[entry.depth ?? entry.path.split('/').length - 1] = (byDepth[entry.depth ?? entry.path.split('/').length - 1] || []).concat(entry);
    const flat = Object.keys(byDepth).map(Number).sort((a, b) => a - b).flatMap((d) => byDepth[d]);
    for (const entry of flat) {
      const indent = ((entry.depth ?? 0) * 12) + 'px';
      const row = el('div', `ft-row ${entry.type === 'file' ? 'file' : 'dir'}`, `
        <span class="ft-ico">${entry.type === 'dir' ? I.chevronD : fileGlyph()}</span>
        <span class="ft-name ellipsis">${escapeHtml(entry.path.split('/').pop() || entry.path)}</span>
        ${entry.size ? `<span class="ft-size">${(entry.size / 1024).toFixed(1)}k</span>` : ''}`);
      row.style.paddingLeft = `calc(var(--s-2) + ${indent})`;
      if (entry.type === 'file') {
        row.tabIndex = 0;
        row.setAttribute('role', 'button');
        row.addEventListener('click', () => openWorkspaceFile(entry.path, row));
        row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openWorkspaceFile(entry.path, row); } });
        if (state.openFile === entry.path) row.classList.add('selected');
      }
      box.appendChild(row);
    }
    staggerInView($$('.ft-row', box));
  } catch (error) { toast(error.message, 'error'); }
}

function fileLabelText(path) {
  return path.length > 46 ? '…' + path.slice(-46) : path;
}

export async function openWorkspaceFile(path, rowNode) {
  try {
    const data = await api(`/api/file?path=${encodeURIComponent(path)}`);
    state.openFile = path;
    state.dirty = false;
    $$('#file-tree .ft-row').forEach((n) => n.classList.remove('selected'));
    rowNode?.classList.add('selected');
    const editor = $('#editor');
    $('#editor-path').textContent = fileLabelText(path);
    $('#editor').value = data.content;
    $('#dirty-dot').classList.remove('show');
    updateEditorStatus(data.content);
    const dirtyLabel = $('#editor-dirty');
    if (dirtyLabel) dirtyLabel.textContent = '';
  } catch (error) { toast(error.message, 'error'); }
}

function updateEditorStatus(content) {
  const status = $('#editor-stats');
  if (!status) return;
  const lines = content.split('\n').length;
  const chars = content.length;
  status.textContent = I18n.t('files.lines', { n: lines, c: chars });
}

export function wireEditor() {
  const editor = $('#editor');
  let timer = 0;
  editor.addEventListener('input', () => {
    state.dirty = true;
    $('#dirty-dot').classList.add('show');
    const dirtyLabel = $('#editor-dirty');
    if (dirtyLabel) dirtyLabel.textContent = t('files.dirty');
    clearTimeout(timer);
    timer = setTimeout(() => updateEditorStatus(editor.value), 300);
  });
  $('#save-file').addEventListener('click', saveFile);
  $('#refresh-files').addEventListener('click', refreshFiles);
}

export async function saveFile() {
  if (!state.openFile) { toast(t('toast.noFile'), 'error'); return; }
  try {
    const btn = $('#save-file');
    btn.classList.add('is-loading');
    await postJson('/api/file', { path: state.openFile, content: $('#editor').value });
    state.dirty = false;
    $('#dirty-dot').classList.remove('show');
    const dirtyLabel = $('#editor-dirty');
    if (dirtyLabel) dirtyLabel.textContent = '';
    toast(t('toast.saved', { path: state.openFile }), 'success');
  } catch (error) { toast(error.message, 'error'); }
  $('#save-file').classList.remove('is-loading');
}

/* ================= TERMINAL ================= */
function consoleLine(html, cls = '') {
  const term = $('#term-out');
  const line = el('div', `c-line ${cls}`, html);
  term.appendChild(line);
  term.scrollTop = term.scrollHeight;
  return line;
}

export async function runTerminal(command) {
  if (!/^[a-zA-Z_][\w.-]*\s/.test(command) && !/^[a-zA-Z_][\w.-]*$/.test(command)) {
    consoleLine(`<span class="c-err">${escapeHtml(t('term.invalid'))}</span>`);
    return;
  }
  consoleLine(`<span class="c-cmd">$ ${escapeHtml(command)}</span>`);
  try {
    const data = await postJson('/api/tools/run', { tool: 'run_command', params: { command, confirm: true } });
    const body = data.ok ? (data.stdout || data.stderr || '') : (data.error || data.stderr || '');
    consoleLine(body ? escapeHtml(body.trim()) : '<span class="c-dim">(no output)</span>', data.ok ? 'c-ok-text' : 'c-err-text');
    if (!data.ok) toast(data.error || t('term.invalid'), 'error');
  } catch (error) { consoleLine(`<span class="c-err">${escapeHtml(error.message)}</span>`); }
}

export function initTerminal(initialText) {
  const term = $('#term-out');
  term.innerHTML = '';
  consoleLine(`<span class="c-dim">${escapeHtml(initialText)}</span>`);
  $('#term-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#term-cmd');
    const cmd = input.value.trim();
    if (!cmd) return;
    input.value = '';
    runTerminal(cmd);
  });
}

/* ================= GIT ================= */
export async function runGitOp(tool) {
  const out = $('#git-out');
  out.innerHTML = `<span class="c-dim">${escapeHtml(tool)}…</span>`;
  try {
    const data = await postJson('/api/tools/run', { tool, params: {} });
    const body = data.stdout || data.stderr || data.error || JSON.stringify(data, null, 2);
    out.innerHTML = `<span class="${data.ok ? 'c-ok' : 'c-err'}">${escapeHtml(data.ok ? '' : '')} ${escapeHtml(body)}</span>`;
  } catch (error) { out.innerHTML = `<span class="c-err">${escapeHtml(error.message)}</span>`; }
  entrance(out);
}

export function wireGit() {
  $$('[data-git]').forEach((btn) => btn.addEventListener('click', () => runGitOp(btn.dataset.git)));
}

/* ================= PROVIDERS ================= */
export function renderProviders(providers) {
  const grid = $('#provider-grid');
  grid.innerHTML = '';
  for (const p of providers) {
    const health = p.health || {};
    const stateClass = !p.configured ? 'bad' : health.state === 'offline' ? 'bad' : health.state === 'degraded' ? 'warn' : 'ok';
    const card = el('div', 'provider-card', `
      <div class="pc-top">
        <div><div class="pc-name">${escapeHtml(p.name)}</div><div class="pc-id">${escapeHtml(p.id)} · ${escapeHtml(p.transport)}</div></div>
        <span class="pc-health ${stateClass}"><span class="dot ${p.configured ? stateClass : 'offline'}"></span>${escapeHtml(p.configured ? (health.state || t('state.online')) : t('state.nokey'))}</span>
      </div>
      <div class="pc-meta">
        <span class="chip chip-blue">${escapeHtml(health.avgLatencyMs ? `${health.avgLatencyMs}ms` : '—')}</span>
        <span class="chip">${escapeHtml(p.freePool ? 'free pool' : 'paid pool')}</span>
        <span class="chip">P${escapeHtml(String(p.priority))}</span>
      </div>
      <div class="pc-model">${escapeHtml(p.defaultModel || '—')}</div>
      <div class="pc-caps">${Object.entries(p.capabilities || {}).filter(([, v]) => v).map(([k]) => `<span class="cap">${escapeHtml(k)}</span>`).join('')}</div>`);
    grid.appendChild(card);
  }
  staggerInView($$('.provider-card', grid));
}

/* ================= RUNS ================= */
export function renderRuns(runs, onOpen) {
  const box = $('#runs-list');
  const emptyBox = $('#runs-empty');
  box.innerHTML = '';
  if (!runs.length) { emptyBox.style.display = ''; box.style.display = 'none'; return; }
  emptyBox.style.display = 'none';
  box.style.display = '';
  for (const r of runs) {
    const row = el('div', 'run-row', `
      <div class="r-main">
        <div class="r-task">${escapeHtml(r.task || '(untitled)')}</div>
        <div class="r-meta">${escapeHtml(r.mode || '')} · ${new Date(r.createdAt).toLocaleString()}</div>
      </div>
      ${statusChip(r.status === 'ok' ? 'done' : 'failed')}
      <span class="r-open">${I.chevronL}</span>`);
    row.addEventListener('click', () => onOpen(r));
    box.appendChild(row);
  }
  staggerInView($$('.run-row', box));
}

function statusChip2(s) { return statusChip(s); }
void statusChip2;

export async function openRunDetail(run) {
  try {
    const detail = await api(`/api/memory/runs/${run.id}`);
    state.agents.clear();
    (detail.tasks || []).forEach((task, i) => state.agents.set(task.taskId || `t${i}`, {
      id: task.taskId || `t${i}`, role: task.role, agent: task.agent,
      provider: task.provider, model: task.model, title: task.title || task.instruction,
      status: task.status, durationMs: task.durationMs, error: task.error
    }));
    window.__switchView?.('hive');
    renderAgents();
    toast(I18n.t('toast.run', { id: run.id, n: detail.tasks?.length || 0 }), 'info');
  } catch (error) { toast(error.message, 'error'); }
}

/* ================= SETTINGS ================= */
function permRow(permission, enabled) {
  const names = { READ: 'files · git · search', WRITE: 'editor · workspace', EXECUTE: 'terminal · tests', DELETE: 'rm (confirm)', NETWORK: 'provider calls' };
  return `<div class="perm-row">
    <div><span class="perm-name">${escapeHtml(permission)}</span><div class="perm-desc">${escapeHtml(names[permission] || '')}</div></div>
    <span class="chip ${enabled ? 'chip-green' : 'chip-red'}">${enabled ? I.check : I.x}${enabled ? 'on' : 'blocked'}</span>
  </div>`;
}

export async function loadSettings() {
  try {
    const { permissions, tools } = await api('/api/tools');
    $('#perm-list').innerHTML = permissions.map((p) => permRow(p.permission, p.enabled)).join('');
    state.hud.tools = tools.length;
  } catch { /* optional */ }

  try {
    const { matrix } = await api('/api/models');
    const caps = ['coding', 'reasoning', 'security', 'research', 'speed'];
    $('#matrix-wrap').innerHTML = `<table class="matrix"><thead><tr>
      <th>model</th>${caps.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
      <tbody>${matrix.slice(0, 24).map((m) => `<tr><td class="m-name">${escapeHtml(m.providerId)}:<b>${escapeHtml(m.modelId)}</b></td>
        ${caps.map((c) => { const v = Math.round((m.capabilities[c] || 0) * 100); const cls = v >= 75 ? 'hi' : v >= 45 ? 'mid' : ''; return `<td><span class="mbar ${cls}"><i style="width:${v}%"></i></span></td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
  } catch { /* optional */ }

  try {
    const memory = await api('/api/memory/project');
    const pm = $('#project-memory');
    const chips = (arr) => (arr || []).map((x) => `<span class="cap">${escapeHtml(x)}</span>`).join('');
    const decisions = (memory.decisions || []).slice(-5).map((d) => `<div class="pm-decision">${escapeHtml(d)}</div>`).join('');
    const ecosystems = chips(memory.project?.ecosystems || []);
    const rights = chips(memory.rights || []);
    const uncertain = chips(memory.uncertain || []);
    pm.innerHTML = `
      <div class="pm-section"><span class="meta-label">${escapeHtml(t('settings.stack'))}</span>
        <div class="pm-chips">${ecosystems || `<span class="ac-agent">${escapeHtml(t('settings.none'))}</span>`}</div></div>
      <div class="pm-section"><span class="meta-label">${escapeHtml(t('settings.rights'))}</span>
        <div class="pm-chips">${rights || `<span class="ac-agent">${escapeHtml(t('settings.none'))}</span>`}</div></div>
      <div class="pm-section"><span class="meta-label">${escapeHtml(t('settings.uncertain'))}</span>
        <div class="pm-chips">${uncertain || `<span class="ac-agent">${escapeHtml(t('settings.none'))}</span>`}</div></div>
      <div class="pm-section"><span class="meta-label">${escapeHtml(t('settings.decisions'))}</span>${decisions || `<div class="ac-agent">${escapeHtml(t('settings.none'))}</div>`}</div>`;
  } catch { /* optional */ }

  try {
    const { version, modules } = await api('/api/prompts');
    $('#prompts-ver').innerHTML = `<span class="chip chip-accent">${escapeHtml(t('settings.prompts'))} · v${escapeHtml(version)}</span>
      <span class="ac-agent">${escapeHtml(modules.join(' · '))}</span>`;
  } catch { /* optional */ }
}
