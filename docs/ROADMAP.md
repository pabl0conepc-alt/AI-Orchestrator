# Roadmap

Honest status of what is implemented and what remains. Nothing here is presented as done when it
is not.

## Shipped in 1.0

- Master Agent planning (LLM + heuristic), Hive Mind with dependency-aware parallel execution.
- Typed inter-agent message bus with history.
- Model identity `provider:model`, capability matrix, dedup and diversity, manual mode.
- Permissioned Tool Registry, workspace-confined filesystem, git tools, allowlisted terminal,
  project detection and test execution.
- Autonomous debug loop, real SSE streaming, structured logging with redaction, metrics,
  event timeline and persisted task memory.
- IDE-style workspace UI.

## Shipped in 1.1

- **Super Mode**: independent proposals, cross-critique, disagreement detection and consensus.
- **System Prompt Engine**: modular, versioned prompt sections composed by context.
- **Project memory**: architecture, technologies, conventions, key files, decisions and known bugs,
  with intelligent context selection and compaction.
- **Extended agent roles**: Planner, Performance, UI/UX, Docs, DevOps, Release.
- **Extended git tools**: change summary, commit suggestion, safe checkpoint (`git stash create`),
  rollback, branch switch.
- **i18n**: English (default), Portuguese and Spanish, with a language switcher.
- **Secret scanning** and CI (validation + scan + tests).
- **Public project files**: LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, issue/PR templates,
  installation/configuration/providers/development guides.
- **Packaging scripts**: Node SEA (Windows/cross-platform binary), `.deb`, AppImage.

## Next

- **Rich code editor**: syntax highlighting and completion (today the editor is a plain textarea).
- **File watcher** so external changes appear without a manual refresh.
- **Richer consensus**: explicit voting and structured justifications (today: review + one fix iteration).
- **Session continuity** across server restarts (history is in the browser, runs on disk).
- **Live provider/model validation** against the real APIs (requires keys).
- **HTTP authentication** for network-exposed deployments.
- **Android client**: a native/WebView client against the REST/SSE API (see `PACKAGING.md`).
