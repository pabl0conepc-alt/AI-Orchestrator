# Security Policy

## Reporting a vulnerability

Please do not open a public issue for security problems. Report them privately to the maintainers
(for example via a GitHub security advisory) with a description, reproduction steps and impact.

## Supported versions

The latest release on the `main` branch is supported.

## Security model

AI Orchestrator is local-first. Its security posture is documented in detail in
[docs/SECURITY.md](docs/SECURITY.md) and summarized below.

- **No secrets in the frontend.** The UI only learns whether a provider is configured
  (`configured: true/false`); API keys stay in the local `.env` and are read by the backend only.
- **No secrets in logs.** `src/core/logger.js` redacts sensitive fields and key-like patterns.
- **No shell injection.** The terminal tool uses `execFile` (no shell), rejects shell
  metacharacters and only allows an explicit binary allowlist.
- **Workspace confinement.** Every filesystem operation resolves inside the workspace root and
  rejects path traversal and symlink escapes.
- **Explicit permissions.** Tools declare READ/WRITE/EXECUTE/DELETE/NETWORK; destructive
  operations are disabled by default and require confirmation.
- **Secret scanning.** `npm run scan:secrets` fails if a credential or a committed `.env` is found.

## Hardening checklist

- Keep `TOOLS_ALLOW_DELETE=false` unless you really need it.
- Do not expose the server on `0.0.0.0` without a trusted network: there is no HTTP authentication.
- Rotate any key that may have been committed; the scanner catches common formats but not all.
