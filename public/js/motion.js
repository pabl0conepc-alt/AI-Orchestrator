'use strict';

/* ============================================================
   motion.js — thin, purposeful wrapper around Anime.js v4.
   Each export is a named interaction with a job: entrances,
   stagger, nav indicator, counter ticks, agent pulses.
   All of them no-op instantly under prefers-reduced-motion.
   ============================================================ */

import { animate, utils } from '../vendor/anime.esm.js';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Entrance for message rows / cards: opacity 0→1, y 6→0.
 * @param {Element|Element[]} targets
 * @param {{delay?: number, duration?: number}} [opts]
 */
export function entrance(targets, opts = {}) {
  if (reduced()) { utils.set(targets, { opacity: 1, translateY: 0 }); return Promise.resolve(); }
  const anim = animate(targets, {
    opacity: [{ from: 0, to: 1, duration: 240, ease: 'out(2)' }],
    translateY: [{ from: 6, to: 0, duration: opts.duration || 300, ease: 'out(2.4)' }]
  });
  if (opts.delay) anim.seek(opts.delay);
  return anim.finished;
}

/**
 * Staggered entrance for grids/lists rendered after a data refresh.
 * Small translateY(6) + opacity ramp, index-staggered. Idempotent
 * per element via data-entered.
 */
export function staggerInView(targets) {
  if (!targets || targets.length === 0) return Promise.resolve();
  const list = [...targets].filter((t) => {
    if (t.dataset.entered) return false;
    t.dataset.entered = '1';
    return true;
  });
  if (!list.length) return Promise.resolve();
  if (reduced()) { list.forEach((t) => { t.style.opacity = '1'; t.style.transform = 'none'; }); return Promise.resolve(); }
  utils.set(list, { opacity: 0, translateY: 6 });
  return animate(list, {
    opacity: { from: 0, to: 1, duration: 300, ease: 'out(2)' },
    translateY: [{ from: 6, to: 0, duration: 320, ease: 'out(2.4)' }],
    delay: utils.stagger(26)
  }).finished;
}

/**
 * Modal / command-menu choreography: overlay fade + panel rise.
 * @param {Element} overlay
 * @param {Element} panel
 * @returns {() => void} cleanup/inverse animation
 */
export function modalIn(overlay, panel) {
  if (reduced()) { utils.set(overlay, { opacity: 1 }); utils.set(panel, { opacity: 1, translateY: 0 }); return () => {}; }
  const o1 = animate(overlay, { opacity: { from: 0, to: 1, duration: 200, ease: 'out(2)' } });
  const p1 = animate(panel, { opacity: { from: 0, to: 1, duration: 260, ease: 'out(2)' } });
  const p2 = animate(panel, { translateY: [{ from: 10, to: 0, duration: 340, ease: 'out(3)' }] });
  const out = () => {
    if (reduced()) return Promise.resolve();
    const o = animate(overlay, { opacity: { to: 0, duration: 160, ease: 'out(2)' } });
    const pi = animate(panel, {
      opacity: { to: 0, duration: 170, ease: 'out(2)' },
      translateY: [{ to: 8, duration: 180, ease: 'out(2)' }]
    });
    return Promise.all([o.finished, pi.finished]);
  };
  void o1; void p1; void p2;
  return out;
}

/** Slides the sidebar active-indicator to the active nav item. */
export function moveNavIndicator(indicator, item) {
  if (!indicator || !item) return;
  const x = item.getBoundingClientRect().left - indicator.parentElement.getBoundingClientRect().left;
  const y = item.getBoundingClientRect().top - indicator.parentElement.getBoundingClientRect().top;
  utils.set(indicator, { opacity: 1 });
  if (reduced()) { utils.set(indicator, { x, y, height: item.offsetHeight, width: item.offsetWidth }); return; }
  animate(indicator, {
    x: { to: x, duration: 340, ease: 'out(3)' },
    y: { to: y, duration: 340, ease: 'out(3)' },
    width: { to: item.offsetWidth, duration: 340, ease: 'out(3)' },
    height: { to: item.offsetHeight, duration: 200, ease: 'out(3)' }
  });
}

/** Sliding dot/underline for the segmented toggle (CODE). */
export function pulse(node) {
  if (!node || reduced()) return;
  animate(node, { scale: [{ to: 1.35, duration: 120, ease: 'out(2)' }, { to: 1, duration: 260, ease: 'out(2.4)' }] });
}

/** Tick counter for HUD metrics like provider counts. */
export function tickNumber(node, value, format = (v) => String(Math.round(v))) {
  if (!node) return;
  const from = Number(node.dataset.v ?? 0) || 0;
  node.dataset.v = String(value);
  if (reduced() || from === value) { node.textContent = format(value); return; }
  animate(node, {
    v: { from, to: value, duration: 480, ease: 'out(2.6)' },
    onUpdate: (self) => { node.textContent = format(self.v); },
    modifier: undefined
  });
}

/** Wires tween targets for the orchestrator pipeline nodes. */
export function pipelineSteps(nodes) {
  if (reduced()) {
    nodes.forEach((n, i) => { n.style.transitionDelay = `${i * 40}ms`; });
    return {
      activate(i) {
        nodes.forEach((n, j) => {
          n.classList.toggle('active', j === i);
          n.classList.toggle('done', j < i);
        });
      },
      complete() { nodes.forEach((n) => { n.classList.add('done'); n.classList.remove('active'); }); },
      reset() { nodes.forEach((n) => n.classList.remove('active', 'done')); }
    };
  }
  const API = {
    activate(i) {
      nodes.forEach((n, j) => {
        n.classList.toggle('done', j < i);
        const isOn = j === i;
        n.classList.toggle('active', isOn);
        if (isOn && !n.dataset.pulsing) {
          n.dataset.pulsing = '1';
          animate(n, { scale: [{ to: 1.15, duration: 140, ease: 'out(2)' }, { to: 1, duration: 220, ease: 'out(2.4)' }] })
            .finished.then(() => { delete n.dataset.pulsing; });
        }
      });
    },
    complete() {
      nodes.forEach((n, j) => { n.classList.remove('active'); n.classList.add('done'); });
    },
    reset() {
      nodes.forEach((n) => { n.classList.remove('active', 'done'); delete n.dataset.pulsing; });
    }
  };
  return API;
}

/** Dry-run particles on the hive board (ambient nod). Called only when idle. */
export function breathe(node) {
  if (!node || reduced()) return;
  animate(node, {
    scale: [{ from: 0.98, to: 1, duration: 900, ease: 'out(2.4)' }],
    opacity: [{ from: 0.85, to: 1, duration: 900, ease: 'out(2)' }]
  });
}
