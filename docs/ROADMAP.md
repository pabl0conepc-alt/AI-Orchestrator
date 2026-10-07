# Roadmap — o que está pronto e o que falta

Esta versão entregou a **evolução arquitetural real** do núcleo. O restante está aqui de forma
explícita para não apresentar nada como pronto quando não está.

## Implementado nesta versão

- Master Agent (planejamento real via LLM + heurístico), atribuição de modelos e síntese.
- Hive Mind com escalonamento por dependências e paralelismo genuíno.
- Barramento de mensagens tipado entre agentes + histórico.
- Identidade `provider:model` em seleção, fallback, memória e logs.
- Deduplicação, diversidade (provider/família/modelo) e modo manual.
- Matriz de capacidades e ranking (capacidade × confiabilidade × latência).
- Tool Registry com schema, permissões, timeout e logs; filesystem confinado, Git, terminal em
  allowlist, detecção de projeto e execução de testes.
- Debugger autônomo limitado.
- Streaming SSE real (OpenAI/Gemini) e eventos de atividade.
- Memória de tarefa persistente, métricas e logs com redaction.
- Frontend tipo IDE com monitor de agentes, timeline, arquivos, terminal, Git e Provider Manager.

## Pendente (próximas camadas)

- **Editor de código** com highlight/autocomplete (hoje é edição em textarea).
- **File watcher** para refletir mudanças externas automaticamente.
- **Consenso formal** multi-agente com votação e justificativas estruturadas (hoje: revisor + iteração).
- **Continuidade de sessão** entre reinícios do servidor (hoje: histórico no browser + runs em disco).
- **Empacotamento** `.deb`/AppImage/.apk/.exe (ver `PACKAGING.md`) — plano, não implementado.
- **Providers adicionais** e catálogo de modelos por provider com validação ao vivo.
- **Testes end-to-end dos adapters** com providers reais (requer chaves; coberto por mocks/contratos).
- **Autenticação HTTP** para uso em rede.

## Como adicionar um provider

1. Acrescente uma entrada em `config/providers.json` (transporte `openai-chat` na maioria dos casos).
2. Descreva o modelo em `config/models.json` (família e capacidades) se for uma família nova.
3. Defina a chave no `.env` (`envKey`). Nada mais é necessário.
