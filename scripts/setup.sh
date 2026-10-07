#!/usr/bin/env bash
set -euo pipefail

command -v node >/dev/null 2>&1 || { echo 'Node.js 20+ é necessário.'; exit 1; }
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Node.js 20+ é necessário. Encontrado: $(node --version)"; exit 1
fi

if [ ! -f .env ] && [ -f config/env.example ]; then
  cp config/env.example .env
  echo 'Criado .env a partir de config/env.example. Preencha as chaves dos providers que você usa.'
fi

node scripts/validate-project.mjs
node --test

printf '\nAI Orchestrator pronto.\n'
printf 'Rode:   npm start\n'
printf 'Abra:   http://127.0.0.1:3000\n'
