# Segurança

## Modelo de permissões

Toda ferramenta declara uma permissão. `src/tools/permissions.js` controla por ambiente:

| Permissão | Padrão | Controla |
|-----------|--------|----------|
| READ | habilitada | listar/ler arquivos, git read-only, busca, diagnóstico |
| WRITE | habilitada | criar/sobrescrever arquivos, branch, commit |
| EXECUTE | habilitada | terminal, testes |
| DELETE | **desabilitada** | remover/mover arquivos, operações destrutivas |
| NETWORK | habilitada | chamadas a providers |

## Auditoria aplicada

**Injeção de comando / execução arbitrária**
- O terminal **não usa shell** (`execFile`, sem `sh -c`). Metacaracteres (`; | & \` $ > <`) são
  rejeitados antes da tokenização.
- Binários em **allowlist** (`node`, `npm`, `git`, `rg`, `python3`, …); `bash`/`sh` não são permitidos.
- Comandos destrutivos conhecidos (`rm`, `git push`, `git reset --hard`, `curl|sh`, …) exigem
  `confirm=true` além da permissão.

**Path traversal / arquivos fora do workspace**
- Toda operação de arquivo passa por `resolveInside()` (rejeita `..` e caminhos absolutos externos)
  e `assertNotSymlinkEscape()` (resolve symlinks e valida que permanecem na raiz).
- O servidor estático valida o prefixo do diretório público.

**Exposição de segredos**
- Chaves ficam no `.env` local e só são lidas pelo backend (`process.env`).
- O frontend nunca recebe chaves; `/api/providers` expõe apenas `configured: true/false`.
- `logger.redact()` mascara campos sensíveis e padrões de chave (`sk-…`, `AIza…`, `Bearer …`).
- Gemini usa a chave no header `x-goog-api-key` (não em query string) para não vazar em logs/proxies.

**SSRF / abuso**
- As URLs dos providers são fixas em `config/providers.json`; nenhuma ferramenta aceita URL arbitrária.
- `search_code` e `run_command` operam apenas dentro do workspace.

**Validação de entrada**
- Parâmetros de ferramenta são validados por schema; parâmetros desconhecidos são rejeitados.
- Payloads HTTP limitados a 3 MB; JSON inválido → HTTP 400.
- Planos do Master são validados (papéis, ids, dependências, ciclos) antes de executar.

## Operação segura

- O servidor escuta em `127.0.0.1` por padrão. Se `APP_HOST=0.0.0.0` (ou `PORT` definido), exponha
  somente em rede confiável: não há autenticação HTTP.
- Mantenha `TOOLS_ALLOW_DELETE=false` a menos que necessário.
- Nunca comite `.env` (já coberto no `.gitignore`).

## Riscos residuais

- Um provider de IA pode gerar comandos/escritas incorretos; por isso há **confirmação** para
  operações destrutivas e **confinamento** ao workspace.
- Modelos externos recebem o contexto enviado; trate conteúdo de repositório como não confiável.
- Não há isolamento por sandbox de processo (o terminal roda com os privilégios do usuário),
  apenas allowlist + confirmação.
