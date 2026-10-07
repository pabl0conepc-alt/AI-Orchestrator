import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = process.cwd();

// Padrões de credenciais conhecidas. Escaneia apenas arquivos versionados pelo Git
// (evita falsos positivos de `.env` local e de node_modules).
const PATTERNS = [
  { name: 'OpenAI-style key', re: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: 'Google API key', re: /\bAIza[A-Za-z0-9_-]{20,}\b/ },
  { name: 'AWS access key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
  { name: 'Private key block', re: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: 'Slack token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'Generic bearer', re: /\bBearer\s+[A-Za-z0-9._-]{30,}\b/ }
];

const IGNORE_EXT = new Set(['.zip', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.pdf', '.lock']);

let files = [];
try {
  const { stdout } = await execFileAsync('git', ['ls-files'], { cwd: root });
  files = stdout.split('\n').filter(Boolean);
} catch {
  console.error('Não foi possível listar os arquivos versionados (git indisponível).');
  process.exit(2);
}

const findings = [];

for (const rel of files) {
  if (IGNORE_EXT.has(path.extname(rel))) continue;
  if (path.basename(rel) === '.env' || path.basename(rel) === '.env.local') {
    findings.push({ file: rel, pattern: 'committed .env file', line: 0 });
    continue;
  }
  let text;
  try { text = await fs.readFile(path.join(root, rel), 'utf8'); } catch { continue; }
  const lines = text.split('\n');
  for (const { name, re } of PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) findings.push({ file: rel, pattern: name, line: i + 1 });
    }
  }
}

if (findings.length) {
  console.error(`\n✗ Secret scan failed: ${findings.length} potential secret(s) found.`);
  for (const f of findings) console.error(`  ${f.file}:${f.line}  ${f.pattern}`);
  process.exit(1);
}
console.log(`✓ Secret scan OK: no credentials detected in ${files.length} tracked file(s).`);
