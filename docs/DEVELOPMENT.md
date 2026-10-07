# Development guide

## Commands

```bash
npm start              # run the server
npm run dev            # run with --watch
npm test               # node:test suite
npm run build          # validate required files, JSON and JS syntax
npm run scan:secrets   # fail if a credential is committed
npm run doctor         # environment + config + tests (scripts/doctor.sh)
```

## Code map

| Area | Path | Responsibility |
|------|------|----------------|
| HTTP/SSE | `src/server.js` | REST API, SSE streams, static files |
| Engine | `src/orchestrator/engine.js` | Modes: normal, fallback, auto, multi-agent, hive, super, build, debug, review, custom |
| Invocation | `src/orchestrator/invoke.js`, `breaker.js`, `policy.js` | Retry, circuit breaker, fallback policy, model resolution |
| Debugger | `src/orchestrator/debugger.js` | Autonomous test → fix → test loop |
| Agents | `src/agents/` | Master (planning), Hive (scheduling), Super (consensus), Worker (tool loop), Bus, Roles |
| Models | `src/models/` | Identity `provider:model`, capability matrix, ranking, dedup/diversity |
| Providers | `src/providers/` | Registry/health, transport, adapters with streaming |
| Tools | `src/tools/` | Registry, permissions, filesystem, git, shell, project |
| Prompts | `src/prompts/engine.js` | Modular, versioned prompt sections |
| Memory | `src/memory/` | Task runs and project intelligence |
| UI | `public/` | SPA shell + design system (see below) |

## Frontend architecture

```
public/
├── index.html       shell: sidebar, topbar, 8 views, composer, busy-bar
├── app.js           entry: boot, nav, SSE→agents, orchestration, HUD
├── i18n.js          ESM dictionary (en/pt/es)
├── styles.css       @import hub — order matters
├── styles/          tokens → base → components → layout → views → ait
├── js/
│   ├── core.js      $, $$, el, escapeHtml, state (localStorage), API client
│   ├── icons.js     inline SVG icon set + brand mark
│   ├── motion.js    Anime.js v4 wrapper (entrance, stagger, indicator, modal)
│   ├── markdown.js  escape-first markdown-lite renderer
│   ├── components.js toast, modal, command menu (⌘K)
│   └── views/       chat.js (chat+pipeline+composer), surfaces.js (hive, files,
│                    terminal, git, providers, runs, settings)
├── vendor/anime.esm.js   Anime.js v4.0.2 (MIT), served locally — no CDN
└── fonts/           Inter var, Newsreader var (+italic), self-hosted
```

- **Tokens only**: never write raw colors/spacing in views; use `--s-*`, `--r-*`, `--shadow-*`,
  `--t-*` from `styles/tokens.css`.
- **Motion**: CSS transitions for hover/focus (130–260ms), Anime.js for coordinated sequences.
  Every entry animation honors `prefers-reduced-motion` (tokens.css collapses durations).
- **New UI text** must use `public/i18n.js` keys — English is the source of truth.
- The server serves `public/` statically; no build step is required.

## Conventions

- ES modules, zero external dependencies.
- Errors carry an HTTP `status`; the server translates them.
- Every tool declares `permission`, `params` and `run`; validation is centralized in the registry.
- New UI text must use `public/i18n.js` keys (English is the source language).

## Testing

Add tests under `tests/`. They run with `node --test` and must not require network access or API
keys. Use `createServer()` from `src/server.js` for HTTP integration tests on an ephemeral port.

## Definition of done for a change

1. `npm test` passes.
2. `npm run build` passes.
3. `npm run scan:secrets` passes.
4. Docs updated (`CHANGELOG.md`, relevant `docs/*`).
