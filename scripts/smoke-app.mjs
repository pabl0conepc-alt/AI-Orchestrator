'use strict';
/* Wiki smoke: executa o boot do app.js com DOM esboçado — captura erros de runtime no boot. */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const store = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.localStorage = store;
try { Object.defineProperty(globalThis, 'navigator', { value: { language: 'en' }, configurable: true }); } catch { /* ok */ }
globalThis.window = { matchMedia: () => ({ matches: true }) };
globalThis.CSS = globalThis.CSS || { supports: () => true, escape: (s) => s, number: String };

const handlers = {};
const element = () => {
  const node = {
    className: '', id: '', innerHTML: '', textContent: '', value: '', style: {}, dataset: {},
    children: [], firstChild: null, appendChild: (c) => c, removeChild: (c) => c,
    addEventListener: (ev, fn) => { handlers[ev] = fn; },
    removeEventListener: () => {}, click: () => {}, focus: () => {}, blur: () => {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    querySelector: () => node, querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 34 }),
    scrollIntoView: () => {}, remove: () => {},
    scrollTop: 0, scrollHeight: 0, offsetWidth: 100, offsetHeight: 34, parentElement: null,
    closest: () => null, requestSubmit: () => {}
  };
  return node;
};
globalThis.document = {
  querySelector: () => element(), querySelectorAll: () => [], getElementById: () => element(),
  createElement: () => element(), createDocumentFragment: () => element(),
  body: { appendChild: () => {}, classList: { add: () => {}, remove: () => {}, toggle: () => {} } },
  documentElement: { lang: 'en' }, addEventListener: () => {}, activeElement: null, title: ''
};
globalThis.EventSource = class { addEventListener() {} close() {} };
globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
if (!globalThis.crypto?.randomUUID) { try { Object.defineProperty(globalThis, 'crypto', { value: { randomUUID: () => 'x'.repeat(36) }, configurable: true }); } catch { /* ok */ } }
const timers = [];
const realSetInterval = globalThis.setInterval.bind(globalThis);
globalThis.setInterval = (fn, ms) => { timers.push(1); return 0; };
const realClearInterval = globalThis.clearInterval.bind(globalThis);
globalThis.clearInterval = (id) => {};

const abs = pathToFileURL(path.join(root, 'public', 'app.js')).href;
setTimeout(() => { console.log('boot smoke: sem erro síncrono ou de promise inicial.'); process.exit(0); }, 400);

try {
  await import(abs);
} catch (error) {
  console.error('BOOT FAIL:', error.message);
  console.error(error.stack?.split('\n').slice(0, 6).join('\n'));
  process.exit(1);
}
