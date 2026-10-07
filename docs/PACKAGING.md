# Portabilidade e empacotamento

## Portabilidade (funciona hoje)

O projeto é **zero-dependência** e roda em qualquer pasta:

```bash
cd AI-Orchestrator
cp config/env.example .env
npm start
```

Requisitos: Node.js 20+ (usa `fetch` nativo). Configuração, histórico, projetos, ferramentas e
secrets permanecem locais. Nenhuma etapa de build é necessária.

## Empacotamento (plano — ainda não implementado)

Nada aqui é gerado por extensão falsa; cada alvo exige a tecnologia correta:

| Alvo | Tecnologia recomendada | Observação |
|------|------------------------|------------|
| Linux `.deb` | empacotar `node src/server.js` com um serviço systemd + `fpm`/`dpkg-deb` | incluir Node ou declarar dependência |
| Linux AppImage | `AppImage` com runtime Node embutido + `AppRun` | portátil, sem instalação |
| Windows `.exe` | **Node SEA** (`--experimental-sea-config`) ou `pkg` | empacota o runtime Node + scripts |
| Android `.apk` | app nativo (Kotlin/Flutter) que serve a UI e fala com o backend local | o servidor Node **não** roda direto no APK; é preciso uma camada de UI nativa ou WebView + runtime embarcado |

### Passos gerais para desktop (Linux/Windows)

1. Congelar o runtime: `node --experimental-sea-config sea-config.json` (gera um executável com o
   app embutido) — mantém `src/`, `public/`, `config/` e `prompts/` como recursos.
2. Empacotar recursos (`public/`, `config/`, `prompts/`) junto ao binário.
3. Gerar instaladores por plataforma (`.deb`/AppImage no Linux; instalador no Windows).

### Android

O fluxo recomendado é um cliente nativo (Kotlin/Flutter) ou WebView que consome a API REST/SSE do
orquestrador rodando em um host (máquina local ou servidor). Rodar o orquestrador completo dentro do
APK exigiria um runtime Node para Android embarcado, o que não é suportado oficialmente.

> Enquanto isso, o acesso pelo navegador (desktop ou celular na mesma rede) já entrega a experiência
> completa sem qualquer empacotamento.
