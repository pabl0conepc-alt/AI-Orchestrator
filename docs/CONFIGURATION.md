# Configuration

All configuration lives in the local `.env` (never committed). Copy `config/env.example` and fill
only what you need. Values are read by the backend through `process.env`.

## Provider keys

| Variable | Provider |
|----------|----------|
| `NVIDIA_API_KEY` | NVIDIA NIM |
| `GOOGLE_AI_STUDIO_API_KEY` | Google AI Studio (Gemini) |
| `GROQ_API_KEY` | Groq |
| `MISTRAL_API_KEY` | Mistral |
| `DEEPSEEK_API_KEY` | DeepSeek |
| `OPENROUTER_API_KEY` | OpenRouter |
| `SAMBANOVA_API_KEY` | SambaNova |
| `SILICONFLOW_API_KEY` | SiliconFlow |
| `CHUTES_API_KEY` | Chutes |
| `MULEROUTER_API_KEY` | MuleRouter |
| `LLM7_API_KEY` | LLM7 |
| `CEREBRAS_API_KEY` | Cerebras |
| `OPENCODE_API_KEY` | OpenCode Zen |

A provider is only used when its key is present.

## Runtime

| Variable | Default | Meaning |
|----------|---------|---------|
| `APP_HOST` | `127.0.0.1` | Bind address. `0.0.0.0` exposes the server (no auth). |
| `APP_PORT` / `PORT` | `3000` | HTTP port. |
| `DEFAULT_PROVIDER` | `nvidia` | Provider used by Normal mode. |
| `PREFER_FREE_PROVIDERS` | `true` | Prefer free-pool providers during selection. |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error`, `quiet` or `silent`. |

## Orchestration

| Variable | Default | Meaning |
|----------|---------|---------|
| `MAX_RETRIES_PER_PROVIDER` | `2` | Attempts per provider before fallback. |
| `CIRCUIT_FAILURE_THRESHOLD` | `3` | Failures before pausing a provider. |
| `CIRCUIT_COOLDOWN_MS` | `30000` | Pause duration. |
| `MAX_CONTEXT_CHARS` | `90000` | Context budget before compaction. |
| `MAX_MULTI_AGENTS` | `5` | Agents in Multi-Agent mode. |
| `MAX_HIVE_AGENTS` | `7` | Max subtasks in Hive mode. |
| `MAX_SUPER_MODELS` | `4` | Models used in Super Mode. |
| `MAX_DEBUG_ATTEMPTS` | `3` | Debug loop iterations. |
| `REQUEST_TIMEOUT_MS` | `120000` | Per-request timeout. |

## Tools

| Variable | Default | Meaning |
|----------|---------|---------|
| `WORKSPACE_ROOT` | project root | Directory the tools operate in. |
| `TOOLS_ALLOW_READ` | `true` | Filesystem reads, git read-only, search. |
| `TOOLS_ALLOW_WRITE` | `true` | File writes, branch/commit. |
| `TOOLS_ALLOW_EXECUTE` | `true` | Terminal and tests. |
| `TOOLS_ALLOW_DELETE` | `false` | Delete/move files, destructive git. |
| `TOOLS_ALLOW_NETWORK` | `true` | Provider calls. |

## Models and prompts

- `config/providers.json` — providers, transports, base URLs, default models, priorities, capabilities.
- `config/models.json` — capability matrix by model family (coding, reasoning, security, research…).
- `prompts/coding-system.md` + `src/prompts/engine.js` — modular, versioned system prompt sections.
