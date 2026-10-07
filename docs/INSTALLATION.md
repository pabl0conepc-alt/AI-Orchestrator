# Installation

## Requirements

- **Node.js 20 or newer** (uses the built-in `fetch`; no build step, no `npm install` required).
- Git (for the Git tools).
- Optional: `ripgrep` (`rg`) for faster code search, `python3` for Python projects.

## From source

```bash
git clone https://github.com/pabl0conepc-alt/AI-Orchestrator.git
cd AI-Orchestrator
cp config/env.example .env      # then add the provider keys you use
npm run doctor                  # verifies the environment, config and tests
npm start                       # http://127.0.0.1:3000
```

Open <http://127.0.0.1:3000> and pick a mode in the top bar.

## Configuration

Copy the template and fill only the keys for the providers you have:

```bash
cp config/env.example .env
```

See [CONFIGURATION.md](CONFIGURATION.md) for every variable and [PROVIDERS.md](PROVIDERS.md) for
the provider catalog.

## Verify the installation

```bash
npm test               # automated suite
npm run build          # project validation
npm run scan:secrets   # no credentials committed
./scripts/doctor.sh    # full environment report
```

## Portable use

The project runs from any folder. Nothing is installed globally; configuration, history, projects
and secrets stay local. See [PACKAGING.md](PACKAGING.md) for desktop distribution options.
