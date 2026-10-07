#!/usr/bin/env bash
set -euo pipefail

printf '== AI Orchestrator Doctor ==\n'
printf 'Node:      '; node --version || true
printf 'npm:       '; npm --version || true
printf 'Git:       '; git --version || true
printf 'ripgrep:   '; rg --version | head -n1 || true
printf 'Python:    '; python3 --version || true

printf '\nValidação:\n'
node scripts/validate-project.mjs

printf '\nTestes:\n'
node --test

printf '\nProviders com chave configurada (somente nomes):\n'
if [ -f .env ]; then
  awk -F= '/^[A-Z0-9_]+=/ { if ($2 != "") print $1 "=configurado"; else print $1 "=vazio" }' .env
else
  echo '.env ausente — copie config/env.example para .env'
fi
