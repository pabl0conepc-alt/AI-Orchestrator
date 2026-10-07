// src/server.js
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadEnv } from './core/env.js';
await loadEnv();

import { logger } from './core/logger.js';
import { metrics } from './core/metrics.js';
import { emit, subscribe, history } from './core/events.js';
import { ROOT } from './core/config.js';
import { workspaceRoot, listTree, readTextFile, writeTextFile } from './core/workspace.js';
import { getProviders, getProvider, getHealth, resourceCatalog } from './providers/registry.js';
import { getCircuitState } from './orchestrator/breaker.js';
import { capabilityMatrix } from './models/matrix.js';
import { registerAllTools, listTools, runTool, permissionSummary } from './tools/index.js';
import { diagnostics, detectProject } from './tools/project.js';
import { chat, chatStream } from './orchestrator/engine.js';
import { listRuns, loadRun } from './memory/store.js';
import { loadProjectMemory, observeProject, recordDecision } from './memory/project.js';
import { listPromptModules, PROMPT_VERSION } from './prompts/engine.js';
import { roleList } from './agents/roles.js';

registerAllTools();

const publicRoot = path.join(ROOT, 'public');
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon'
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 3_000_000) throw Object.assign(new Error('Payload muito grande.'), { status: 413 });
  }
  try { return JSON.parse(body || '{}'); }
  catch { throw Object.assign(new Error('JSON inválido.'), { status: 400 }); }
}

async function sendStatic(res, urlPath) {
  const safe = urlPath === '/' ? '/index.html' : urlPath;
  const target = path.resolve(publicRoot, `.${safe}`);
  if (!target.startsWith(publicRoot + path.sep)) return false;
  try {
    const stat = await fs.stat(target);
    if (!stat.isFile()) return false;
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(await fs.readFile(target));
    return true;
  } catch { return false; }
}

function sseInit(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write(': connected\n\n');
}

function sseSend(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const { pathname } = url;

  if (req.method === 'GET' && (pathname === '/api/health' || pathname === '/healthz')) {
    return sendJson(res, 200, { ok: true, time: new Date().toISOString(), version: '1.0.0', workspace: workspaceRoot() });
  }

  if (req.method === 'GET' && pathname === '/api/status') {
    const providers = await getProviders();
    return sendJson(res, 200, {
      providers,
      health: getHealth(),
      circuits: getCircuitState(),
      tools: await diagnostics(),
      metrics: metrics.snapshot(),
      version: '1.0.0'
    });
  }

  if (req.method === 'GET' && pathname === '/api/providers') return sendJson(res, 200, await getProviders());

  if (req.method === 'GET' && pathname.startsWith('/api/providers/')) {
    try { return sendJson(res, 200, await getProvider(pathname.split('/').pop())); }
    catch (error) { return sendJson(res, 404, { error: error.message }); }
  }

  if (req.method === 'GET' && pathname === '/api/models') {
    const catalog = await resourceCatalog({ configuredOnly: false });
    const configured = await resourceCatalog({ configuredOnly: true });
    const matrix = await capabilityMatrix(configured.length ? configured : catalog);
    return sendJson(res, 200, { catalog, configured: configured.map((c) => `${c.providerId}:${c.modelId}`), matrix });
  }

  if (req.method === 'GET' && pathname === '/api/tools') {
    return sendJson(res, 200, { tools: listTools(), permissions: permissionSummary() });
  }

  if (req.method === 'POST' && pathname === '/api/tools/run') {
    const body = await readJson(req);
    if (!body.tool) return sendJson(res, 400, { error: 'Ferramenta não informada.' });
    return sendJson(res, 200, await runTool(String(body.tool), body.params || {}));
  }

  if (req.method === 'GET' && pathname === '/api/project') {
    const project = await detectProject();
    try { await observeProject({ project, files: await listTree('.', { depth: 4 }) }); } catch { /* memória é best-effort */ }
    return sendJson(res, 200, project);
  }

  if (req.method === 'GET' && pathname === '/api/memory/project') return sendJson(res, 200, await loadProjectMemory());

  if (req.method === 'POST' && pathname === '/api/memory/project') {
    const body = await readJson(req);
    if (body.decision) await recordDecision(String(body.decision));
    const project = await detectProject();
    const memory = await observeProject({ project, files: await listTree('.', { depth: 4 }) });
    return sendJson(res, 200, memory);
  }

  if (req.method === 'GET' && pathname === '/api/prompts') {
    return sendJson(res, 200, { version: PROMPT_VERSION, modules: listPromptModules() });
  }

  if (req.method === 'GET' && pathname === '/api/roles') return sendJson(res, 200, { roles: roleList() });

  if (req.method === 'GET' && pathname === '/api/files') {
    const dir = url.searchParams.get('dir') || '.';
    const depth = Number(url.searchParams.get('depth') || 4);
    return sendJson(res, 200, { root: workspaceRoot(), dir, entries: await listTree(dir, { depth }) });
  }

  if (req.method === 'GET' && pathname === '/api/file') {
    const p = url.searchParams.get('path');
    if (!p) return sendJson(res, 400, { error: 'Parâmetro path obrigatório.' });
    return sendJson(res, 200, { path: p, content: await readTextFile(p) });
  }

  if (req.method === 'POST' && pathname === '/api/file') {
    const body = await readJson(req);
    if (!body.path) return sendJson(res, 400, { error: 'Parâmetro path obrigatório.' });
    return sendJson(res, 200, await writeTextFile(body.path, body.content ?? ''));
  }

  if (req.method === 'GET' && pathname === '/api/memory/runs') return sendJson(res, 200, { runs: await listRuns() });

  if (req.method === 'GET' && pathname.startsWith('/api/memory/runs/')) {
    const run = await loadRun(pathname.split('/').pop());
    return run ? sendJson(res, 200, run) : sendJson(res, 404, { error: 'Run não encontrada.' });
  }

  if (req.method === 'GET' && pathname === '/api/events/history') {
    const sinceId = Number(url.searchParams.get('sinceId') || 0);
    return sendJson(res, 200, { events: history(300, sinceId) });
  }

  if (req.method === 'GET' && pathname === '/api/events') {
    sseInit(res);
    for (const event of history(100)) sseSend(res, 'event', event);
    const unsubscribe = subscribe((event) => sseSend(res, 'event', event));
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);
    req.on('close', () => { clearInterval(heartbeat); unsubscribe(); });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/chat') {
    const body = await readJson(req);
    const result = await chat(body);
    return sendJson(res, 200, result);
  }

  if (req.method === 'POST' && pathname === '/api/chat/stream') {
    const body = await readJson(req);
    sseInit(res);
    try {
      const result = await chatStream(body, (delta) => sseSend(res, 'delta', { delta }));
      sseSend(res, 'done', result);
    } catch (error) {
      sseSend(res, 'error', { error: error.message, status: error.status || 500 });
    }
    return res.end();
  }

  if (req.method === 'GET') {
    if (await sendStatic(res, pathname)) return;
    if (await sendStatic(res, '/index.html')) return;
  }
  return sendJson(res, 404, { error: 'Not found' });
}

export function createServer() {
  return http.createServer((req, res) => {
    handle(req, res).catch((error) => {
      logger.error('http', error.message, { path: req.url, status: error.status });
      if (!res.headersSent) sendJson(res, Number(error.status) || 500, { error: error.message || 'Erro interno' });
      else res.end();
    });
  });
}

export function start() {
  const port = Number(process.env.PORT || process.env.APP_PORT || 3000);
  const host = process.env.APP_HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
  const server = createServer();
  server.listen(port, host, () => {
    const info = `AI Orchestrator: http://${host}:${port}`;
    logger.info('server', info);
    emit('server.ready', { host, port });
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) start();
