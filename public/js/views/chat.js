'use strict';

/* ============================================================
   views/chat.js — chat list, orchestration pipeline, composer
   ============================================================ */

import { $, $$, el, escapeHtml, state, api, postJson, currentConv, persist } from '../core.js';
import { I, icon, aiGlyph } from '../icons.js';
import { entrance, staggerInView, pulse } from '../motion.js';
import { t, I18n } from '../../i18n.js';
import { toast } from '../components.js';

const MODE_KEYS = ['hive', 'build', 'multi-agent', 'super', 'debug', 'review', 'auto', 'fallback', 'custom'];
const STREAMModes = new Set(['normal', 'fallback', 'auto']);

/* ============ Message list ============ */
function msgHTML(message) {
  if (message.pending) {
    return `<div class="msg-head">${aiGlyph('working')}<span class="msg-author">${escapeHtml(t('chat.ai'))}</span>
      <span class="msg-meta">${escapeHtml(message.meta || t('meta.orchestrating'))}</span></div>
      <div class="msg-body"><span class="loader-dots"><i></i><i></i><i></i></span></div>`;
  }
  const who = message.role === 'user' ? t('chat.user') : t('chat.ai');
  const glyph = message.role === 'user' ? '' : aiGlyph('idle');
  const meta = message.meta ? `<span class="msg-meta">${escapeHtml(message.meta)}</span>` : '';
  const body = message.content
    ? (message.role === 'user' ? escapeHtml(message.content) : formatOut(message.content))
    : '';
  return `
    <div class="msg-head">${glyph}<span class="msg-author">${escapeHtml(who)}</span>${meta}</div>
    <div class="msg-body">${body}${message.streaming ? '<span class="stream-caret"></span>' : ''}</div>`;
}

function formatOut(content) {
  return window.__formatMarkdown ? window.__formatMarkdown(content) : escapeHtml(content);
}

/* ============ Pipeline ============ */
export function createPipeline() {
  let pipelineEl = null;

  function mount(container) {
    pipelineEl = el('div', 'pipeline', `
      <div class="pipeline-bar">
        <span class="loader-dots"><i></i><i></i><i></i></span>
        <span class="pb-label">${escapeHtml(t('meta.orchestrating'))}</span>
        <span class="pb-time"></span>
  <span class="pb-actions" style="margin-left:auto"><button class="code-copy" data-stop>${I.x}</button></span>
      </div>
      <div class="pipeline-steps"></div>
      <div class="pipe-status"></div>`);
    container.appendChild(pipelineEl);
    entrance(pipelineEl);
    return pipelineEl;
  }

  function steps(list) {
    const stepsBox = $('.pipeline-steps', pipelineEl);
    stepsBox.innerHTML = list.map((label, i) => `
      <div class="pipe-step" data-i="${i}">
        <span class="pipe-node"></span><span class="pipe-text">${escapeHtml(label)}</span>
      </div>`).join('<span class="pipe-link"></span>');
    return $$('.pipe-step', stepsBox);
  }

  function setStep(index, nodes, statusText) {
    nodes.forEach((n, j) => { n.classList.toggle('done', j < index); n.classList.toggle('active', j === index); });
    $('.pipe-status', pipelineEl).textContent = statusText || '';
  }
  function complete(nodes) { nodes.forEach((n) => { n.classList.remove('active'); n.classList.add('done'); }); }
  function fail() {
    const bar = $('.pipeline-bar', pipelineEl);
    bar.innerHTML = `<span style="color:var(--red)">${I.x}</span><span class="pb-label">${escapeHtml(t('pipe.status.error'))}</span>`;
    $('.pipe-status', pipelineEl).textContent = '';
  }
  function done(seconds) {
    const bar = $('.pipeline-bar', pipelineEl);
    bar.innerHTML = `<span style="color:var(--green)">${I.check}</span><span class="pb-label">${escapeHtml(I18n.t('pipe.status.done', { s: seconds }))}</span>
      <span class="pb-time"></span><span class="pb-actions" style="margin-left:auto"><button class="code-copy" data-stop>${I.x}</button></span>`;
  }

  return { mount, steps, setStep, complete, fail, done, node: () => pipelineEl, clear: () => { pipelineEl?.remove(); pipelineEl = I.x ? null : null; } };
}

/* ============ Chat render ============ */
let pipeline = null;

export function createChat({ onChange }) {
  pipeline = createPipeline();

  async function render() {
    const conv = currentConv();
    const empty = !conv || conv.messages.length === 0;
    const hero = $('#hero-orbit');
    if (empty) $('#hero-empty').style.display = '';
    else $('#hero-empty').style.display = 'none';

    const chatEl = $('#chat');
    chatEl.innerHTML = '';
    if (!empty) {
      for (const m of conv.messages) {
        const message = el('div', `msg msg-${m.role}`, msgHTML(m));
        chatEl.appendChild(message);
        entrance(message);
      }
      chatEl.scrollTop = chatEl.scrollHeight;
    }
    onChange?.();
  }

  function streamUpdate() {
    const conv = currentConv();
    const last = conv.messages[conv.messages.length - 1];
    if (!last) return;
    const lastMsg = $('#chat .msg:last-child .msg-body');
    if (lastMsg) {
      lastMsg.innerHTML = formatOut(last.content) + (last.streaming ? '<span class="stream-caret"></span>' : '');
      $('#chat').scrollTop = $('#chat').scrollHeight;
    }
  }

  return { createPipeline, render, streamUpdate, pipeline: () => pipeline };
}

/* ============ Composer ============ */
export function createComposer({ onSend, onModeChange }) {
  const textarea = $('#composer-textarea');
  const sendBtn = $('#composer-send');
  const composer = $('#composer');
  const modeSelect = $('#mode-select');
  const providerSelect = $('#provider-select');
  const modelInput = $('#model-input');
  const attachRow = $('#attach-row');

  function autosize() {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 220) + 'px';
    composer.classList.toggle('typing', textarea.value.length > 0);
  }

  textarea.addEventListener('focus', () => composer.classList.add('focused'));
  textarea.addEventListener('blur', () => composer.classList.remove('focused'));
  textarea.addEventListener('input', autosize);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); requestSend(); }
  });

  function requestSend() {
    const text = textarea.value.trim();
    if (!text || state.busy) return;
    textarea.value = '';
    autosize();
    onSend(text);
  }
  sendBtn.addEventListener('click', requestSend);

  function setBusy(busyFlag) {
    state.busy = busyFlag;
    sendBtn.disabled = busyFlag || !textarea.value.trim() ? busyFlag : !textarea.value.trim();
    sendBtn.classList.toggle('is-loading', busyFlag);
  }

  syncModeOptions();
  modeSelect.addEventListener('change', () => { state.mode = modeSelect.value; persist('ai-orch-mode', state.mode); onModeChange(state.mode); });

  function syncModeOptions() {
    const order = [...MODE_KEYS];
    modeSelect.innerHTML = order.map((k) => `<option value="${k}" ${state.mode === k ? 'selected' : ''}>${escapeHtml(I18n.t(`mode.${k}`))}</option>`).join('');
  }

  providerSelect.addEventListener('change', () => { state.providerId = providerSelect.value; });
  modelInput.addEventListener('change', () => { state.model = modelInput.value.trim(); });

  syncProviders();

  function syncProviders() {
    const configured = state.providers.filter((p) => p.configured);
    const options = ['<option value="">auto</option>']
      .concat(configured.map((p) => `<option value="${p.id}" ${state.providerId === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`));
    providerSelect.innerHTML = options.join('');
  }

  /* attachments */
  function renderAttach() {
    attachRow.innerHTML = state.attachments.map((f) => `
      <span class="chip chip-dismiss">${I.file}<span>${escapeHtml(f)}</span>
      <button class="chip-x" aria-label="remove">${I.x}</button></span>`).join('');
    $$('.chip-dismiss', attachRow).forEach((chip, i) => {
      chip.querySelector('.chip-x').addEventListener('click', (e) => {
        e.stopPropagation();
        state.attachments.splice(i, 1);
        renderAttach();
        toast(t('toast.fileRemoved'), 'info');
      });
    });
  }
  function addAttachment(path) {
    if (!state.attachments.includes(path)) state.attachments.push(path);
    renderAttach();
    toast(t('toast.fileAdded'), 'info');
  }

  return { requestSend, setBusy, syncProviders, addAttachment, renderAttach, syncModeOptions };
}
