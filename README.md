# AI Orchestrator

**A local-first programming AI platform.** Connect many AI providers and treat them as one
compute infrastructure: a Master Agent plans the work, a Hive Mind of specialized agents
implements it in parallel, and the platform edits files, runs tests, debugs autonomously and
reviews its own output — all from a single workspace.

- **Local-first & zero-dependency** — Node.js 20+ and the built-in `fetch`. No `npm install`.
- **Provider-agnostic** — 13 providers out of the box, any OpenAI-compatible API in one config entry.
- **Real engineering** — file I/O, git, an allowlisted terminal, test execution and an autonomous debug loop.
- **No fake features** — every status shown in the UI comes from a real backend event.
- **Multilingual UI** — English (default), Portuguese and Spanish.

## Quick start

```bash
git clone https://github.com/pabl0conepc-alt/AI-Orchestrator.git
cd AI-Orchestrator
cp config/env.example .env      # add only the provider keys you use
npm run doctor                  # environment + config + tests
npm start                       # http://127.0.0.1:3000
```

## Modes

| Mode | What it does |
|------|--------------|
| **Normal** | One provider/model answers. |
| **Fallback** | Primary model with automatic retries, backoff and circuit breaker. |
| **Auto** | Classifies the task and picks the best model (coding / reasoning / security…). |
| **Multi-Agent** | Several agents with distinct roles in parallel, synthesized by the Master. |
| **Hive Mind** | Master plans → agents collaborate in dependency order (independent tasks run in parallel) → review → synthesis. |
| **Super Mode** | Independent proposals from several models, cross-critique, disagreement detection and consensus. |
| **Build** | Hive oriented to software construction. |
| **Debug** | Autonomous loop: test → fix with tools → test, bounded by `MAX_DEBUG_ATTEMPTS`. |
| **Review** | Focused code review. |
| **Custom** | You choose the exact models (manual mode). |

## What is actually implemented

- **Master Agent** that plans via LLM (validated JSON: roles, dependencies, no cycles) with a
  heuristic fallback, assigns models by capability, and synthesizes the result resolving conflicts.
- **Hive Mind** with dependency-aware scheduling and genuine parallelism, plus a typed inter-agent
  message bus (`instruction`, `result`, `question`, `review`, `rejection`, …).
- **Model identity `provider:model`** everywhere (selection, fallback, memory, logs), with a
  capability matrix, deduplication and provider/family diversity, and a manual mode.
- **System Prompt Engine** — modular, versioned prompt sections composed from role, project, task,
  tools and security context.
- **Tool Registry** with schema, validation, permissions (READ/WRITE/EXECUTE/DELETE/NETWORK),
  timeout and logging: workspace-confined filesystem, ripgrep search, git, allowlisted terminal
  (no shell), project detection and test execution.
- **Project memory** — persists architecture, technologies, conventions, key files, decisions and
  known bugs, with intelligent context selection and compaction.
- **Autonomous debugging**, **real SSE streaming** (OpenAI/Gemini), **structured logging with secret
  redaction**, **metrics**, an **event timeline** and **persisted task memory**.
- **IDE-style workspace UI** — chat, live agent monitor, timeline, file explorer + editor, terminal,
  Git, Provider Manager, capability matrix, i18n.

## Project structure

```
src/
├── core/         logger, events (SSE), metrics, workspace, config, env
├── models/       provider:model identity, capability matrix, dedup/diversity, ranking
├── providers/    registry + health, transport, adapters with streaming
├── tools/        registry, permissions, filesystem, git, shell (allowlist), project
├── agents/       master, hive, super, worker, bus, roles
├── prompts/      modular versioned prompt engine
├── orchestrator/ engine (modes), policy, breaker, invoke, debugger
├── memory/       task memory + project intelligence
└── server.js     REST API + SSE + static files
public/           IDE-style SPA (HTML/CSS/JS) with i18n
config/           providers.json, models.json, env.example
prompts/          engineering system prompt base
tests/            node:test suite
docs/             architecture, security, installation, configuration, providers, development, packaging
scripts/          setup, doctor, validation, secret scan, packaging
```

## Verify

```bash
npm test               # automated suite
npm run build          # validates required files, JSON and JS syntax
npm run scan:secrets   # fails if a credential is committed
./scripts/doctor.sh    # full environment report
```

## Documentation

- [Installation](docs/INSTALLATION.md) · [Configuration](docs/CONFIGURATION.md) · [Providers](docs/PROVIDERS.md)
- [Architecture](docs/ARCHITECTURE.md) · [Security](docs/SECURITY.md) · [Development](docs/DEVELOPMENT.md)
- [Packaging](docs/PACKAGING.md) · [Roadmap](docs/ROADMAP.md) · [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md) · [Code of Conduct](CODE_OF_CONDUCT.md)

## Language

The interface ships in **English (default), Portuguese and Spanish**. Adding a language only
requires a new entry in `public/i18n.js`. Documentation is English-first.

## License

[MIT](LICENSE).
