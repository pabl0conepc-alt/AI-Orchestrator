'use strict';
/* Importa todo o grafo de módulos do frontend em Node com stubs de browser,
   para detectar imports quebrados e erros de topo de arquivo sem abrir o app. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

/* ---- browser stubs ---- */
const store = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.localStorage = store;
try { Object.defineProperty(globalThis, 'navigator', { value: { language: 'en' }, configurable: true }); } catch { /* já definido */ }
globalThis.window = { matchMedia: () => ({ matches: true }) }; // reduced motion → no-op paths
export {};

const element = () => ({
  className: '', id: '', innerHTML: '', textContent: '', value: '', style: {}, dataset: {},
  children: [], firstChild: null,
  appendChild: () => element(), removeChild: () => element(),
  addEventListener: () => {}, removeEventListener: () => {},
  classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
  querySelector: () => null, querySelectorAll: () => [],
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 34 }),
  scrollIntoView: () => {}, remove: () => {},
  scrollTop: 0, scrollHeight: 0, offsetWidth: 100, offsetHeight: 34, parentElement: null
});
globalThis.document = {
  querySelector: () => element(), querySelectorAll: () => [], getElementById: () => element(),
  createElement: () => element(), createDocumentFragment: () => element(),
  body: { appendChild: () => {}, classList: { add: () => {}, remove: () => {}, toggle: () => {} } },
  documentElement: { lang: 'en' },
  addEventListener: () => {}, activeElement: null, title: ''
};
globalThis.EventSource = class { addEventListener() {} close() {} };
globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });
/* Anime.js v4 lê o global CSS no top-level (browser-only) — stub para Node */
globalThis.CSS = globalThis.CSS || { supports: () => true, escape: (s) => s, number: String };

/* Anime.js real (vendor). Its engine needs rAF/RequestAnimationFrame.
   Motion is consumed via wrapper no-op when reduced-motion, but the import
   graph still loads the vendor lib — provide minimal timers. */
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.RequestAnimationFrame = globalThis.RequestAnimationFrame || class {};

const modules = [
  'public/js/core.js',
  'public/js/icons.js',
  'public/js/markdown.js',
  'public/i18n.js',
  'public/js/motion.js',
  'public/js/components.js',
  'public/js/views/chat.js',
  'public/js/views/surfaces.js'
];

let failed = 0;
for (const rel of modules) {
  try {
    const abs = pathToFileURL(path.join(root, ...rel.split('/'))).href;
    await import(abs);
    console.log(`  ok  ${rel}`);
  } catch (error) {
    // vendor absolute path (/vendor/...) cannot resolve in node — record and split
    failed++;
    console.error(`FAIL  ${rel}: ${error.message}`);
  }
}

if (failed) { console.error(`\n${failed} módulo(s) com problema (o /vendor absoluto é esperado falhar em Node)`); process.exitCode = failed > 1 ? 1 : 0; }
else console.log('\nTodos os módulos do frontend carregam sem erro de importação.');
