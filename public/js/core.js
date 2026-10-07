'use strict';

/* ============ DOM ============ */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, cls, html) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html != null) node.innerHTML = html;
  return node;
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}

/* ============ Store ============ */
export function loadState(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { localStorage.removeItem(key); return fallback; }
}
export function persist(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

/* ============ State ============ */
export const state = {
  view: 'chat',
  drawer: false,
  providers: [],           // full provider list
  code: true,
  mode: loadState('ai-orch-mode', 'hive'),
  providerId: '',
  model: '',
  convList: loadState('ai-orch-conversations', []),
  currentId: null,
  attachments: [],         // workspace files tagged to next message
  agents: new Map(),       // taskId -> agent snapshot (live run)
  diversity: null,
  runs: [],
  busy: false,
  openFile: null,
  dirty: false,
  timeline: [],
  hud: { tools: 0, roles: 0, prompts: '—' },
  status: { online: false, label: '…', providers: 0 }
};

/* helpers shared by views */
export function currentConv() {
  return state.convList.find((c) => c.id === state.currentId);
}

/* ============ API ============ */
export async function api(path, options = {}) {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
export function postJson(path, body) {
  return api(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

/* ============ Markdown-lite ============ */
export function formatText(text) {
  const escaped = escapeHtml(text);
  const parts = escaped.split(/```([\w.+-]*)\n?([\s\S]*?)```/g);
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
      const lang = escapeHtml(parts[i + 1] || 'code');
      const body = parts[i + 2];
      out += `<div class="code-wrap"><div class="code-head"><span class="code-lang">${lang}</span>`
        + `<button class="code-copy" data-copy><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> copy</button></div>`
        + `<pre class="code-block"><code>${body.replace(/\n$/, '')}</code></pre></div>`;
    }
  }
  return out;
}
