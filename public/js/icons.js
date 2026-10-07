'use strict';

const W = (inner, cls = '') => `<svg class="${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const F = (inner, cls = '') => `<svg class="${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">${inner}</svg>`;

export const I = {
  /* ---- brand mark: concentric orchestrator orbits ---- */
  mark: `<svg class="brand-mark" xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="2.1" fill="currentColor"/>
    <circle class="orbit" cx="12" cy="12" r="7.5" stroke="currentColor" stroke-width="1.4" stroke-dasharray="46 1.2" opacity="0.85"/>
    <circle class="orbit2" cx="12" cy="12" r="10.5" stroke="currentColor" stroke-width="1" stroke-dasharray="10 6" opacity="0.45"/>
  </svg>`,

  /* generic 24px stroke glyph */
  chat: W('<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.2 0-2.3-.2-3.3-.7L3 21l1.7-6.2A8.5 8.5 0 1 1 21 11.5z"/>'),
  hive: W('<circle cx="12" cy="12" r="2.5"/><circle cx="4.5" cy="8" r="2"/><circle cx="19.5" cy="8" r="2"/><circle cx="4.5" cy="16" r="2"/><circle cx="19.5" cy="16" r="2"/><path d="M10.2 11L6.3 9.2M13.8 11l3.9-1.8M10.2 13l-3.9 1.8M13.8 13l3.9 1.8"/>'),
  files: W('<path d="M14 2H6.5A1.5 1.5 0 0 0 5 3.5v17A1.5 1.5 0 0 0 6.5 22h11a1.5 1.5 0 0 0 1.5-1.5V7z"/><path d="M14 2v5h5"/>'),
  terminal: W('<path d="M5 8l4.5 4L5 16"/><path d="M12.5 16H19"/>'),
  git: W('<circle cx="7" cy="5.5" r="2.2"/><circle cx="7" cy="18.5" r="2.2"/><circle cx="17.5" cy="9.5" r="2.2"/><path d="M7 7.7v8.6M9 6.5h4.3a3.2 3.2 0 0 1 3.2 3v0"/>'),
  providers: W('<path d="M4.5 17.5h15M6 6.5c0 3 2.7 4.5 6 4.5s6-1.5 6-4.5"/><path d="M6 18v2M18 18v2"/><path d="M8 17v-2.5M12 17v-3M16 17c0-2-.7-2.5-2-2.5"/>'),
  runs: W('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M7 3v4M17 3v4M7 11.5h4M7 15h7"/>'),
  settings: W('<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  menu: W('<path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17"/>'),
  send: W('<path d="M4.4 11.5L20 4.5 13 20l-2.2-6.8z"/><path d="M4.4 11.5h16"/>'),
  plus: W('<path d="M11 5v12M5 11h12"/><circle cx="12" cy="11" r="9.5" opacity="0.35"/>'),
  search: W('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
  check: W('<path d="M4 12.5l5.5 5.5L20 6.5"/>'),
  x: W('<path d="M6 6l12 12M18 6L6 18"/>'),
  chevronL: W('<path d="M4 4l5 5-5 5"/>'),
  chevronD: W('<path d="M5 9l7 7 7-7"/>'),
  copy: W('<rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 0 2-2h9a2 2 0 0 1 2 2v1" transform="translate(0 0.5)"/>'),
  refresh: W('<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>'),
  save: W('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>'),
  spark: W('<path d="M12 3l1.7 4.6a2 2 0 0 0 1.2 1.2L19.5 10.5 14.9 12.2a2 2 0 0 0-1.2 1.2L12 18l-1.7-4.6a2 2 0 0 0-1.2-1.2L4.5 10.5l4.6-1.7a2 2 0 0 0 1.2-1.2z" fill="currentColor" stroke="none"/><path d="M18.5 16.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" fill="currentColor" stroke="none"/>'),
  bolt: W('<path d="M13 2L4.5 14.5H11l-1 7.5 8.5-12.5H12z"/>'),
  clock: W('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6.5" opacity="0.25"/><path d="M12 7.5V12l3 2"/>'),
  paperclip: W('<path d="M21 11.5l-8.5 8.5a5 5 0 0 1-7-7l8.5-8.5a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3l7.5-7.5"/>'),
  voice: W('<path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4M8.5 21h7"/>'),
  file: W('<path d="M14 2H6.5A1.5 1.5 0 0 0 5 3.5v17A1.5 1.5 0 0 0 6.5 22h11a1.5 1.5 0 0 0 1.5-1.5V7z"/><path d="M14 2v5h5"/>'),
  fileCode: W('<path d="M14 2H6.5A1.5 1.5 0 0 0 5 3.5v17A1.5 1.5 0 0 0 6.5 22h11a1.5 1.5 0 0 0 1.5-1.5V7z"/><path d="M14 2v5h5"/><path d="M9.5 12.5L8 14l1.5 1.5M14.5 12.5L16 14l-1.5 1.5"/>'),
  jarvis: F('<circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="7.6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="40 2" opacity="0.8"/><circle cx="12" cy="12" r="10.4" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="5 7" opacity="0.4"/>')
};

export function icon(name, cls = '') {
  return I[name] || I.spark;
}

/* Gglyph used next to "Orchestrator" in messages/status. Visual states:
   idle = static · working = slow CSS orbit spin (see views.css). */
export function aiGlyph(state = 'idle') {
  return `<span class="ai-glyph ${state}">${I.jarvis}</span>`;
}
