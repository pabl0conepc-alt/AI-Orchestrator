# AI Orchestrator — Plataforma de IA para Programação

Workspace local onde vários provedores de IA funcionam como **uma única infraestrutura de computação**. Você conversa com uma interface só; por trás dela existe roteamento de modelos, fallback inteligente, **Hive Mind** multiagente, ferramentas de desenvolvimento reais e observabilidade.

> Local-first, zero dependências externas (Node.js 20+ com `fetch` nativo). Suas chaves ficam no `.env` local e nunca vão para o frontend.

## Instalação rápida

```bash
cp config/env.example .env      # preencha apenas as chaves que você usa
npm run doctor                  # valida ambiente, config e testes
npm start                       # abre em http://127.0.0.1:3000
```

Ou use o setup: `chmod +x scripts/*.sh && ./scripts/setup.sh`.

## Modos

| Modo | O que faz |
|------|-----------|
| **Normal** | Um provider/modelo responde. |
| **Fallback** | Principal + alternativas automáticas com retry/backoff e circuit breaker. |
| **Auto** | Classifica a tarefa e escolhe o melhor modelo (coding/reasoning/security…). |
| **Multi-Agent** | Vários agentes com papéis distintos em paralelo + síntese. |
| **Hive Mind** | Master planeja, divide a tarefa, agentes colaboram em paralelo, revisor aprova/rejeita, Master sintetiza. |
| **Build** | Hive orientado a construção de software. |
| **Debug** | Loop autônomo: testar → corrigir (com ferramentas) → testar de novo. |
| **Review** | Foco em revisão de código. |
| **Custom** | Você escolhe exatamente os modelos (modo manual). |

## O que está implementado de fato

- **Master Agent** que planeja via LLM (JSON estruturado), com plano heurístico de reserva — não é escolha aleatória.
- **Hive Mind** com escalonamento por dependências: tarefas independentes rodam em paralelo (`Promise.all`).
- **Barramento de mensagens** tipado entre agentes (`instruction`, `result`, `question`, `review`, `rejection`…) com histórico.
- **Identidade de modelo `provider:model`** em toda a seleção, fallback, memória e logs.
- **Deduplicação e diversidade** (provider / família / modelo) + **modo manual** que respeita a escolha do usuário.
- **Matriz de capacidades** (coding, reasoning, security, research, speed…) usada no ranking.
- **Tool Registry** com schema, validação, permissões (READ/WRITE/EXECUTE/DELETE/NETWORK), timeout e logs.
- **Ferramentas reais**: filesystem (dentro do workspace), busca com ripgrep, Git, terminal em allowlist sem shell, detecção de projeto e execução de testes.
- **Debugger autônomo** limitado por `MAX_DEBUG_ATTEMPTS`.
- **Streaming real** (SSE) nos modos de provider único, com tokens da OpenAI e Gemini.
- **Observabilidade**: timeline de eventos via SSE, métricas (latência, erros, retries), logs com redaction de segredos, memória de tarefa persistida em `data/`.
- **Frontend tipo IDE/laboratório**: chat, monitor de agentes ao vivo, timeline, explorador de arquivos com editor, terminal, Git, Provider Manager, execuções e configuração.

## Estrutura

```
src/
├── core/        logger, eventos (SSE), métricas, workspace, config, env
├── models/      identidade provider:model, matriz de capacidades, dedup/diversidade, ranking
├── providers/   registry + health, transporte, adapters (openai-chat, gemini, opencode) com streaming
├── tools/       registry, permissões, filesystem, git, shell (allowlist), projeto
├── agents/      master (planner), worker (loop de ferramentas), hive, bus, roles
├── orchestrator/ engine (modos), policy, breaker, invoke, debugger
├── memory/      memória de tarefa persistente
└── server.js    API REST + SSE + estáticos
public/          SPA (HTML/CSS/JS) estilo IDE
config/          providers.json, models.json, env.example
prompts/         system prompt de engenharia
tests/           suíte automatizada (node:test)
docs/            arquitetura, segurança, empacotamento, roadmap
```

## Verificar

```bash
npm test                # suíte completa
npm run build           # valida arquivos obrigatórios, JSON e sintaxe
./scripts/doctor.sh     # ambiente + config + testes
```

## Documentação

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arquitetura, Hive Mind, Master, contexto, ferramentas
- [`docs/SECURITY.md`](docs/SECURITY.md) — auditoria e modelo de permissões
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — o que falta para as camadas avançadas (empacotamento, editor)
- [`docs/PACKAGING.md`](docs/PACKAGING.md) — plano/portabilidade
