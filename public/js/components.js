'use strict';

/* ============================================================
   components.js — toast, modal, command menu (⌘K)
   ============================================================ */

import { $, el, $$, escapeHtml } from './core.js';
import { I } from './icons.js';
import { entrance, modalIn } from './motion.js';
import { I18n, t } from '../i18n.js';

/* ================= Toast ================= */
const toastStack = () => {
  let stack = $('#toast-stack');
  if (!stack) { stack = el('div', 'toast-stack'); stack.id = 'toast-stack'; document.body.appendChild(stack); }
  return stack;
};

export function toast(message, kind = 'success') {
  const icons = { success: I.check, error: I.x, info: I.spark };
  const node = el('div', `toast toast-${kind}`, `<span class="toast-ico">${icons[kind] || icons.info}</span><span>${escapeHtml(message)}</span>`);
  toastStack().appendChild(node);
  entrance(node);
  const finish = () => {
    node.style.opacity = '0';
    node.style.transform = 'translateY(4px)';
    node.style.transition = 'opacity .18s ease, transform .18s ease';
    setTimeout(() => node.remove(), 190);
  };
  setTimeout(finish, 3400);
  node.addEventListener('click', finish);
}

/* ================= Modal ================= */
const modalHost = () => {
  let host = $('#modal-host');
  if (!host) { host = el('div'); host.id = 'modal-host'; document.body.appendChild(host); }
  return host;
};

export function openModal({ title = '', bodyHTML = '' }) {
  const host = modalHost();
  host.replaceChildren();
  const overlay = el('div', 'overlay');
  const panel = el('div', 'modal', `
    <div class="modal-head"><h2 class="serif">${escapeHtml(title)}</h2>
      <button class="icon-btn" data-modal-close title="Close">${I.x}</button></div>
    <div class="modal-body">${bodyHTML}</div>`);
  host.append(overlay, panel);
  const closeAnim = modalIn(overlay, panel);
  const close = () => { closeAnim().then(() => host.replaceChildren()); };
  overlay.addEventListener('click', close);
  panel.querySelector('[data-modal-close]').addEventListener('click', close);
  return close;
}

export function closeModal() {
  const host = $('#modal-host');
  if (host) host.replaceChildren();
}

/* ================= Command menu (⌘K) ================= */
const MODE_KEYS = ['hive', 'build', 'multi-agent', 'super', 'debug', 'review', 'auto', 'fallback', 'custom'];

let net = null;                    // app bridge (set via bindNetwork)
let cmdkActive = false;
let cmdkItems = [];                // flat filtered list
let cmdkSelected = 0;

export function bindNetwork(network) { net = network; }

function cmdkSource() {
  const go = [
    { id: 'view-chat', label: t('nav.chat'), icon: 'chat', run: () => net.switchView('chat') },
    { id: 'view-hive', label: t('nav.hive'), icon: 'hive', run: () => net.switchView('hive') },
    { id: 'view-files', label: t('nav.files'), icon: 'files', run: () => net.switchView('files') },
    { id: 'view-terminal', label: t('nav.terminal'), icon: 'terminal', run: () => net.switchView('terminal') },
    { id: 'view-git', label: t('nav.git'), icon: 'git', run: () => net.switchView('git') },
    { id: 'view-providers', label: t('nav.providers'), icon: 'providers', run: () => net.switchView('providers') },
    { id: 'view-runs', label: t('nav.runs'), icon: 'runs', run: () => net.switchView('runs') },
    { id: 'view-settings', label: t('nav.settings'), icon: 'settings', run: () => net.switchView('settings') }
  ];
  const modes = MODE_KEYS.map((key) => ({
    id: `mode-${key}`,
    label: I18n.t(`mode.${key}`),
    hint: I18n.t(`hint.${key}`),
    icon: 'spark',
    run: () => net.setMode(key)
  }));
  const extra = (net.commandExtras ? net.commandExtras() : []).map((n, i) => ({ id: `x-${i}`, ...n }));
  return { go, modes, extra };
}

const itemHTML = (n) => `
  <div class="cmdk-item" data-id="${n.id}" data-icon="${n.icon}" role="option">
    <span class="cmdk-ico">${I[n.icon] || I.spark}</span>
    <span class="cmdk-label">${escapeHtml(n.label)}</span>
    ${n.hint ? `<span class="cmdk-hint ellipsis">${escapeHtml(n.hint)}</span>` : ''}
  </div>`;

function cmdkRender(listEl, query) {
  const { go, modes, extra } = cmdkSource();
  const q = (query || '').toLowerCase().trim();
  const match = (n) => !q || (n.label + ' ' + (n.hint || '')).toLowerCase().includes(q);
  const fGo = go.filter(match);
  const fMode = modes.filter(match);
  const fExtra = extra.filter(match);
  cmdkItems = [];

  const groups = [];
  if (fExtra.length) { groups.push(`<div class="cmdk-section meta-label">${escapeHtml(t('cmdk.section.task'))}</div>` + fExtra.map(itemHTML).join('')); cmdkItems.push(...fExtra); }
  if (fGo.length) { groups.push(`<div class="cmdk-section meta-label">${escapeHtml(t('cmdk.section.go'))}</div>` + fGo.map(itemHTML).join('')); cmdkItems.push(...fGo); }
  if (fMode.length) { groups.push(`<div class="cmdk-section meta-label">${escapeHtml(t('cmdk.section.mode'))}</div>` + fMode.map(itemHTML).join('')); cmdkItems.push(...fMode); }

  listEl.innerHTML = groups.join('') || `<div class="cmdk-empty">${escapeHtml(I18n.t('settings.none'))}</div>`;
  cmdkSelected = 0;
  cmdkHighlight(listEl);
  $$('.cmdk-item', listEl).forEach((node) => {
    node.addEventListener('mouseenter', () => { moveSelection(node); });
    node.addEventListener('click', () => cmdkRun(node.dataset.id, listEl));
  });
}

function moveSelection(node) {
  cmdkSelected = cmdkItems.findIndex((n) => n.id === node.dataset.id);
  cmdkHighlight();
}

function cmdkHighlight(listEl) {
  const items = $$('.cmdk-item', listEl);
  items.forEach((n) => n.classList.toggle('active', n.dataset.id === cmdkItems[cmdkSelected]?.id));
  const active = items.find((n) => n.classList.contains('active'));
  if (active) active.scrollIntoView({ block: 'nearest' });
}

function cmdkRun(id, listEl) {
  const target = cmdkItems.find((n) => n.id === id);
  const run = target ? target.run : (cmdkItems[0] ? cmdkItems[0].run : null);
  void listEl;
  closeCmdk();
  if (run) run();
}

export function openCmdk() {
  if (cmdkActive) return;
  cmdkActive = true;
  const overlay = el('div', 'overlay cmdk-overlay');
  const panel = el('div', 'cmdk', `
    <div class="cmdk-input"><span class="cmdk-glass">${I.search}</span>
      <input id="cmdk-query" placeholder="${escapeHtml(I18n.t('cmdk.placeholder'))}" autocomplete="off" spellcheck="false"/></div>
    <div class="cmdk-list" id="cmdk-list" role="listbox"></div>`);
  net.cmdkHost.appendChild(overlay);
  net.cmdkHost.appendChild(panel);

  const listEl = $('#cmdk-list', panel);
  const input = $('#cmdk-query', panel);
  const closeAnim = modalIn(overlay, panel);

  function close() {
    if (!cmdkActive) return;
    cmdkActive = false;
    closeAnim().then(() => hostClean());
    function hostClean() { overlay.remove(); panel.remove(); }
  }

  cmdkRender(listEl, '');
  input.focus();

  input.addEventListener('input', () => cmdkRender(listEl, input.value));
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); input.blur(); cmdkSelected = Math.min(cmdkSelected + 1, cmdkItems.length - 1); cmdkHighlight(listEl); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); cmdkSelected = Math.max(cmdkSelected - 1, 0); cmdkHighlight(listEl); }
    else if (e.key === 'Enter') { e.preventDefault(); const id = cmdkItems[cmdkSelected]?.id; runIf(id); }
    function runIf(id) { const item = cmdkItems.find((n) => n.id === id); close(); if (item) item.run(); }
  });

  overlay.addEventListener('click', close);
  net.cmdkClose = close;
}

export function closeCmdk() {
  if (net && net.cmdkClose) net.cmdkClose();
}
