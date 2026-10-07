# Contributing

Thanks for improving AI Orchestrator. This project is local-first, zero-dependency and
English-first.

## Development setup

```bash
git clone <your-fork>
cd AI-Orchestrator
cp config/env.example .env      # add only the provider keys you use
npm test                        # 55+ tests, node:test
npm run build                   # validates files, JSON and JS syntax
npm run scan:secrets            # ensures no credential is committed
npm start                       # http://127.0.0.1:3000
```

Requires Node.js 20+ (uses the built-in `fetch`). No `npm install` is required.

## Guidelines

- **Preserve working features.** Extend and refactor; do not rewrite for its own sake.
- **No fake features.** Never add a button that does nothing, simulate terminal output, or
  claim a test ran when it did not.
- **Keep zero dependencies unless there is a strong reason**, and discuss it in the issue first.
- **Add tests** for new logic under `tests/` (`node:test`).
- **Never commit secrets.** Use `config/env.example` for variable names only.
- **UI text must go through i18n** (`public/i18n.js`); English is the source language.

## Adding a provider

1. Add an entry to `config/providers.json` (usually `transport: "openai-chat"`).
2. Describe the model family in `config/models.json` if it is new.
3. Document any special handling in `docs/PROVIDERS.md`.

## Adding an agent role

1. Add the role to `src/agents/roles.js`.
2. Add a task profile for it in `src/models/selection.js` (`TASK_PROFILES`).

## Adding a language

Add the locale to `DICT` and to `SUPPORTED` in `public/i18n.js`. Nothing else is required.

## Pull requests

- Keep changes focused; one concern per PR.
- Update docs and `CHANGELOG.md` when behavior changes.
- Make sure `npm test`, `npm run build` and `npm run scan:secrets` pass.
