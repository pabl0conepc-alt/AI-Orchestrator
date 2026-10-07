# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] — Unreleased

### Added
- **Frontend redesign (complete)**: layered design system in `public/styles/*` (tokens → base →
  components → layout → views), warm editorial palette (`#FAF9F5` paper, terracotta accent,
  Newsreader serif + Inter + mono), 4-base spacing scale and tokenized radii/shadows/motion.
- **Anime.js v4** vendored locally (`public/vendor/anime.esm.js`, no npm dependency): entrance
  fades, stagger-in lists, sliding nav indicator, modal choreography, pipeline step pulses,
  numeric ticks. All motion respects `prefers-reduced-motion`.
- **Command menu (⌘K or /)**: navigate views, switch orchestration modes, start a new task.
- **Orchestration pipeline card**: Request → Plan → Agents → Processing → Result driven by real
  backend events, plus a busy-bar with a live agent count.
- **Fonts self-hosted** (`public/fonts/`): Inter var, Newsreader var + italic — no CDN calls.
- **Modular frontend** (`public/js/`): core, icons, motion, markdown, components and view modules;
  `public/app.js` and `public/i18n.js` remain the stable entries.
- **Super Mode**: independent solutions from multiple models, cross-critique and consensus synthesis.
- **System Prompt Engine** (`src/prompts/engine.js`): modular, versioned prompt sections composed by context.
- **Project memory** (`src/memory/project.js`): persists architecture, technologies, conventions, key files,
  decisions and known bugs, with intelligent context selection and compaction.
- **New agent roles**: Planner, Performance, UI/UX, Docs, DevOps, Release (plus Architect, Researcher,
  Security, Implementer, Tester, Debugger, Reviewer, Master).
- **Git tools**: change summary, commit suggestion, safe checkpoint (`git stash create`), rollback,
  branch switch (confirmation-gated).
- **i18n**: English (default), Portuguese and Spanish, with a language switcher and no hardcoded UI text.
- **Secret scanning** (`npm run scan:secrets`) and CI workflow.
- Public project files: LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, issue/PR templates,
  installation/configuration/provider/development guides.
- Packaging scripts for Windows (Node SEA) and Linux (`.deb`, AppImage) under `scripts/package/`.

### Changed
- Agent prompts now go through the System Prompt Engine instead of a single combined string.
- Provider calls use the modular prompt for chat modes as well.

## [1.0.0] — 2026-10-07

### Added
- Master Agent planning (LLM + heuristic), Hive Mind with dependency-aware parallel execution,
  typed inter-agent message bus, conflict detection and synthesis.
- Model identity `provider:model`, capability matrix, dedup and diversity selection, manual mode.
- Permissioned Tool Registry, workspace-confined filesystem, git tools, sandboxed terminal,
  project detection and test execution.
- Autonomous debug loop, real SSE streaming, structured logging with redaction, metrics,
  event timeline and persisted task memory.
- IDE-style workspace UI.
