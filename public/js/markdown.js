'use strict';

/* Markdown-lite → HTML for Orchestrator replies. All user/model
   content is escaped before the small allow-listed transformations. */

import { escapeHtml } from './core.js';

export function formatMarkdown(text) {
  const escaped = escapeHtml(String(text));
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
      const lang = parts[i + 1] || 'code';
      const body = parts[i + 2].replace(/\n$/, '');
      out += `<div class="code-wrap"><div class="code-head"><span class="code-lang">${lang}</span>`
        + `<button class="code-copy" data-copy><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> copy</button></div>`
        + `<pre class="code-block"><code>${body}</code></pre></div>`;
    }
  }
  return out;
}
