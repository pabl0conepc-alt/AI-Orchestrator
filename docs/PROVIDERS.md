# Providers

Providers are defined in `config/providers.json`. Each entry declares how to talk to the API and
how the orchestrator should route to it.

## Fields

| Field | Meaning |
|-------|---------|
| `name` | Display name. |
| `envKey` | Environment variable holding the API key. |
| `transport` | Adapter: `openai-chat`, `gemini`, `opencode-responses`. |
| `baseUrl` | API base URL. |
| `defaultModel` | Model used when none is specified. |
| `models` | Models exposed as selectable `provider:model` resources. |
| `supportsStreaming` | Whether the adapter can stream tokens. |
| `freePool` | Used by ranking to prefer free resources. |
| `priority` | Tie-breaker ordering. |
| `capabilities` | `text`, `vision`, `tools`, `streaming`, `coding`. |

## Transports

- **`openai-chat`** — any OpenAI-compatible `/chat/completions` API (NVIDIA, Groq, Mistral, DeepSeek,
  OpenRouter, SambaNova, SiliconFlow, Chutes, MuleRouter, LLM7, Cerebras). Supports streaming.
- **`gemini`** — Google Generative Language API. The key is sent in the `x-goog-api-key` header
  (not the query string) and streaming uses `alt=sse`.
- **`opencode-responses`** — OpenCode Zen Responses API.

## Model identity

A model is always identified as `providerId:modelId`. The same model name on two providers is two
different resources — they are kept distinct everywhere (selection, fallback, memory, logs) and the
deduplication layer treats truly equivalent models as one only when needed for diversity.

## Preferred models per role

The Master picks a model per task using the capability matrix in `config/models.json`. For example,
`deepseek-reasoner` scores high for reasoning/security, `Qwen2.5-Coder` for implementation,
`gemini-*` for research/vision, and small fast models for lightweight tasks.

## Adding a provider

1. Add the entry to `config/providers.json`.
2. If it is a new model family, add a profile to `config/models.json`.
3. Set the key in `.env`.
4. Add a row to `docs/CONFIGURATION.md`.

No code change is needed for OpenAI-compatible APIs.

## Verifying a provider

```bash
npm start
# open the Providers view, or:
curl -s localhost:3000/api/providers | head
```

The Providers view shows connection status, transport, priority, latency and capabilities. Models
are listed at `/api/models`.
