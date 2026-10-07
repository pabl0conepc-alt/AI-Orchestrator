# Arquitetura

## Princípios

1. **Local-first** — configuração, histórico, projetos, ferramentas e secrets ficam no máquina do usuário.
2. **Um recurso = `provider:model`** — o mesmo nome de modelo em providers diferentes são recursos distintos.
3. **Nada fingido** — o que a UI mostra como atividade corresponde a eventos reais emitidos pelo backend.
4. **Segurança por padrão** — permissões explícitas, allowlist de comandos, caminhos confinados ao workspace.

## Camadas

```
HTTP/SSE (src/server.js)
        │
Engine (src/orchestrator/engine.js) ── modos: normal, fallback, auto, multi-agent,
        │                                        hive, build, debug, review, custom
        ├─ Invoke (invoke.js)  → circuit breaker + retry/backoff + streaming
        │       └─ Providers (transport.js) → openai-chat | gemini | opencode
        ├─ Agents
        │       ├─ Master (master.js) → planeja (LLM/JSON), atribui modelos, sintetiza
        │       ├─ Worker (worker.js) → executa subtarefa + loop de ferramentas real
        │       ├─ Hive (hive.js)     → escalonamento por dependências + paralelismo
        │       └─ Bus (bus.js)       → protocolo de mensagens entre agentes
        ├─ Models (models/*) → identidade, matriz de capacidades, dedup/diversidade, ranking
        ├─ Tools (tools/*)   → registry, permissões, filesystem, git, shell, projeto
        └─ Memory (memory/store.js) → memória persistente da tarefa
```

## Hive Mind — execução real

1. **Master.plan** — o Master recebe o pedido + resumo do projeto e devolve um plano JSON
   (`tasks[]` com `role`, `instruction`, `dependsOn`). O plano é validado: ids únicos, papéis
   válidos, dependências existentes e sem ciclos. Sem modelo disponível, cai no plano heurístico.
2. **Master.assignModels** — para cada tarefa escolhe um recurso `provider:model` pelo perfil de
   capacidade do papel, evitando repetir provider/família (diversidade).
3. **Scheduler** (hive.js) — repete: pega todas as tarefas prontas (dependências concluídas) e roda
   em paralelo via `Promise.all`. Tarefas independentes **realmente** executam ao mesmo tempo.
4. **Bus** — cada agente publica `instruction`/`result`/`error`; dependentes recebem o digest da
   comunicação como contexto.
5. **Consenso** — se o revisor rejeitar (`reviewRejected`), uma iteração de correção do Debugger é
   acionada (limitada).
6. **Master.synthesize** — compara as análises, decide conflitos e entrega uma resposta única.

Cada etapa emite eventos SSE (`task.plan`, `agent.start`, `agent.done`, `message`, `tool.*`) que
alimentam os cards de agente e a timeline.

## Seleção de modelos

- `identity.js` — `provider:model`, normalização e chave de equivalência.
- `matrix.js` — vetor de capacidades por família/modelo (`config/models.json`) + ajustes por provider.
- `selection.js` — `scoreEntry` (capacidade × confiabilidade × latência), `dedupeEquivalent`
  (remove o mesmo modelo em providers diferentes) e `selectDiverse` (diversidade de provider,
  família e modelo; `manualKeys` respeita a escolha do usuário).
- Perfis por tipo de tarefa: architect, research, security, implement, debug, test, review, coordinate.

## Contexto em camadas

- **GLOBAL** — pedido original.
- **PROJECT** — raiz, ecossistemas, scripts e árvore de arquivos (parcial).
- **TASK** — instrução da subtarefa.
- **DEPENDÊNCIAS** — resultados das tarefas anteriores.
- **MENSAGENS** — digest da comunicação da equipe.
- **TOOL** — saídas de ferramentas injetadas no loop do agente.

O Master decide o que cada agente recebe; evitar mandar tudo para todos reduz tokens e confusão.

## Ferramentas (Tool Registry)

Cada ferramenta declara `description`, `permission`, `params` (schema simples) e `run`. O registry
valida parâmetros (rejeita desconhecidos), checa permissão, aplica timeout, loga e emite eventos.

Ferramentas disponíveis: `list_files`, `read_file`, `write_file`, `make_dir`, `search_code`,
`delete_file`, `move_file`, `git_status/diff/log/branches/show/stash_list/create_branch/commit`,
`project_analyze`, `diagnostics`, `run_tests`, `run_command`.

## Observabilidade

- `core/events.js` — barramento com ring buffer, consumido por `/api/events` (SSE).
- `core/metrics.js` — contadores e percentis de latência por dimensão.
- `core/logger.js` — log estruturado com redaction de segredos.
- `memory/store.js` — cada run persistida em `data/run-<id>.json` (arquivos alterados, testes, erros, decisões).
