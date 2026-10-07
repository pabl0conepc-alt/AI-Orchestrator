'use strict';
/* Sessão real de usuário: importa o app.js real com fetch/SSE nativos (Node 22),
   com o banco do DOM cesado com gravação; envia uma tarefa pelo caminho real da
   UI (composer submit → state → pipeline → SSE → agente/timeline) e imprime o
   relatório do comportamento dinâmico observado. */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '.');
const root2 = path.join(__dirname, '..');
const BASE = 'http://127.0.0.1:3000';

/* ==================== shims ==================== */
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k)
};
try { Object.defineProperty(globalThis, 'navigator', { value: { language: 'en' }, configurable: true }); } catch { /* ok */ }
globalThis.window = { matchMedia: () => ({ matches: true }) };   // anime.js fica no-op (reduced motion)
globalThis.CSS = globalThis.CSS || { supports: () => true, escape: (s) => s, number: String };
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.NodeList = class NodeList extends Array {};
globalThis.HTMLCollection = class HTMLCollection extends Array {};
globalThis.SVGElement = class SVGElement {};
globalThis.HTMLElement = class HTMLElement {};
globalThis.Element = class Element {};
globalThis.SVGGElement = class SVGGElement {};
globalThis.KeyframesEffect = class KeyframesEffect {};

/* ==================== DOM stub com registro ==================== */
const obs = {
  html: [],        // innerHTML writes: {id, len, head}
  cls: [],         // classList ops
  focus: [],       // focus calls
  append: []       // appendChild ops
};
const nodes = new Map();

function makeNode(tag = 'div', id = '') {
  const node = {
    tagName: tag, id, className: '', _html: '', textContent: '', value: '',
    style: {}, dataset: {}, children: [],
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); obs.html.push({ id: this.id || tag, len: this._html.length, head: this._html.slice(0, 110) }); },
    appendChild(c) { this.children.push(c); obs.append.push({ into: this.id || tag, child: c.id || c.className || c.tagName }); return c; },
    removeChild(c) { return c; },
    addEventListener(ev, fn) { (this._ev ||= {})[ev] = fn; },
    removeEventListener() {},
    click() { this._ev?.click?.({ preventDefault() {}, stopPropagation() {}, currentTarget: this, target: this }); },
    requestSubmit() { this._ev?.submit?.({ preventDefault() {} }); },
    focus() { obs.focus.push(this.id || tag); },
    blur() {},
    classList: {
      add(c) { obs.cls.push({ id, add: c }); },
      remove(c) { obs.cls.push({ id, remove: c }); },
      toggle(c, on) { obs.cls.push({ id, toggle: c, to: on }); },
      contains: () => false
    },
    setAttribute() {}, getAttribute: () => null,
    // o app renderiza filhos via innerHTML e depois busca (.conv-del etc.);
    // o stub cria um nó coringa on-demand para satisfazer o app real.
    querySelector() { return makeNode('span'); },
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 34 }),
    scrollIntoView() {}, remove() {},
    scrollTop: 0, scrollHeight: 0, offsetWidth: 100, offsetHeight: 34, parentElement: null,
    closest: () => null
  };
  return node;
}

function getNode(id, tag = 'div') {
  if (!nodes.has(id)) nodes.set(id, makeNode(tag, id));
  return nodes.get(id);
}

globalThis.document = {
  querySelector: (sel) => (sel.startsWith('#') ? getNode(sel.slice(1)) : makeNode(sel)),
  querySelectorAll: () => [],
  getElementById: (id) => getNode(id),
  createElement: (tag) => makeNode(tag),
  createDocumentFragment: () => makeNode('fragment'),
  body: null,
  documentElement: { lang: 'en', style: {} },
  addEventListener() {}, activeElement: null, title: ''
};
const bodyNode = makeNode('body', '');
bodyNode.appendChild = (c) => { obs.append.push({ into: 'body', child: c.id || c.className || c.tagName }); return c; };
globalThis.document.body = bodyNode;

/* ==================== EventSource (SSE real) + fetch com base absoluta ==================== */
/* Node exige URLs absolutas no fetch; o app usa relativas (correto no browser).
   Envolvemos o fetch para resolver relativas contra o BASE. */
const rawFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (input, init) => {
  const url = typeof input === 'string' && input.startsWith('/') ? BASE + input : input;
  return rawFetch(url, init);
};

const sseRaw = [];      // payloads por tipo (p/ inspeção)

globalThis.EventSource = class {
  constructor(url) {
    this._h = {};
    (async () => {
      const res = await rawFetch(url.startsWith('http') ? url : BASE + url, { headers: { Accept: 'text/event-stream' } });
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const blocks = buf.split('\n\n');
        buf = blocks.pop() || '';
        for (const block of blocks) {
          const ev = block.match(/^event:\s*(.+)$/m)?.[1]?.trim() || 'event';
          const data = block.match(/^data:\s*(.+)$/m)?.[1];
          if (data === undefined) continue;
          try {
            const parsed = JSON.parse(data);
            globalThis.__sseTap?.(parsed.type || ev);
            sseRaw.push(parsed);
            this._h[ev]?.({ data });
          } catch { /* skip malformed */ }
        }
      }
    })().catch(() => {});
  }
  addEventListener(ev, fn) { (this._h ||= {})[ev] = fn; }
  removeEventListener() {}
  close() {}
};

/* contagem real de eventos SSE percebidos pela UI */
const sseSeq = [];
globalThis.__sseTap = (type) => { if (sseSeq.length < 500) sseSeq.push(type); };

/* ==================== boot real do app ==================== */
const appURL = pathToFileURL(path.join(root2, 'public', 'app.js')).href;
await import(appURL);
/* mesma instância de state usada pelo app (mesmo módulo via URL idêntica) */
const { state: appState } = await import(pathToFileURL(path.join(root2, 'public', 'js', 'core.js')).href);

/* ==================== dirigir o fluxo real de envio ==================== */
const composer = getNode('composer');
const textarea = getNode('composer-textarea', 'textarea');
const sendBtn = getNode('composer-send');
const modeSelect = getNode('mode-select');

/* o usuário escolhe o modo Hive no select real do composer (o app guarda em
   state.mode e persiste); depois digita e submete pelo caminho real. */
modeSelect.value = 'hive';
modeSelect._ev?.change?.({ preventDefault() {}, target: { value: 'hive' } });

textarea.value = 'Summarize the orchestration capabilities of this repository in 3 short bullets.';
composer._ev?.submit?.({ preventDefault() {} });

// fallback: se não houve handler de submit, clique no botão send real
if (!composer._ev?.submit) sendBtn._ev?.click?.({ preventDefault() {} });

/* ==================== esperar a orquestração terminar ==================== */
const started = Date.now();
const TIMEOUT = 150000;
let pipelineDone = false;
while (Date.now() - started < TIMEOUT) {
  const pipelineHost = getNode('pipeline-host');
  const doneMatch = (pipelineHost._html || '').match(/Completed in ([\d.]+)s|Concluído em ([\d.]+)s/i);
  const chatHtml = getNode('chat')._html || '';
  const awaiting = chatHtml.includes('loader-dots') || chatHtml === '';
  if (doneMatch || (!awaiting && chatHtml.length > 200)) { pipelineDone = Boolean(doneMatch); break; }
  await new Promise((r) => setTimeout(r, 500));
}
const elapsed = ((Date.now() - started) / 1000).toFixed(1);

/* ==================== relatório observado ==================== */
console.log('\n========== RELATÓRIO — SESSÃO REAL NA UI RECONSTRUÍDA ==========\n');
console.log(`Tarefa enviada pelo composer real (state + payload): OK`);
console.log(`Tempo total observado até o resultado: ${elapsed}s`);
console.log(`Pipeline visto como concluído pela UI: ${pipelineDone ? 'sim' : 'não (timeout/estados intermediários mantidos)'}`);
console.log(`Eventos SSE processados pela interface: ${sseSeq.length}`);
console.log(`Fluxo de tipos de eventos: ${[...new Set(sseSeq)].join(' → ') || '(nenhum)'}`);
console.log(`Re-renderizações de chat observadas (innerHTML): ${obs.html.filter((h) => h.id === 'chat').length}`);
console.log(`Toggles de classes (estados visuais): ${obs.cls.length}`);
console.log(`focus() no composer: ${obs.focus.length}x`);
console.log('');

const chatNodes = obs.html.filter((h) => h.id === 'chat');
console.log('--- Chat: primeiras renders (cabeçalho do HTML) ---');
for (const h of chatNodes.slice(0, 6)) console.log(`  len=${h.len} :: ${h.head.replace(/\s+/g, ' ').slice(0, 100)}`);

const lastChat = chatNodes[chatNodes.length - 1];
if (lastChat) {
  console.log('\n--- Último estado do chat (2KB) ---');
  console.log(getNode('chat')._html.slice(0, 2000));
}

console.log('\n--- Pipeline (host) HTML final ---');
console.log(getNode('pipeline-host')._html || '(vazio)');

console.log('\n--- 25 últimos classList toggles ---');
for (const c of obs.cls.slice(-25)) console.log(`  [${c.id}] ${c.add ? 'add' : c.remove ? 'remove' : 'toggle'} ${c.add || c.remove || c.toggle}${c.to === false || c.to === true ? ' → ' + c.to : ''}`);

console.log('\n--- Detalhe dos primeiros eventos SSE ---');
for (const e of sseRaw.slice(0, 8)) console.log(`  ${e.type || '(?)'} ${JSON.stringify(e).slice(0, 150)}`);

process.exit(0);
