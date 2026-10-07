// scripts/package/build-sea.mjs
// Builds a single-file executable using the Node.js Single Executable Application (SEA) feature.
// Produces a native binary for the CURRENT platform. Run once per target OS (Windows .exe,
// Linux binary, macOS binary). Requires Node 20+ and network access for `npx postject`.

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dist = path.join(root, 'dist');
const isWin = process.platform === 'win32';
const outName = `ai-orchestrator${isWin ? '.exe' : ''}`;

async function run(cmd, args, opts = {}) {
  const { stdout, stderr } = await execFileAsync(cmd, args, { cwd: root, maxBuffer: 20_000_000, ...opts });
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
}

async function main() {
  await fs.mkdir(dist, { recursive: true });

  // The Single Executable can only embed a CommonJS entry; we ship a tiny launcher that
  // imports the ESM server module and starts it.
  const launcher = `require(${JSON.stringify(path.join(root, 'src', 'sea-launcher.cjs'))});`;
  await fs.writeFile(path.join(root, 'src', 'sea-launcher.cjs'), launcher, 'utf8');
  await fs.writeFile(path.join(root, 'sea-config.json'), JSON.stringify({
    main: 'src/sea-launcher.cjs',
    output: path.join(dist, 'sea-prep.blob'),
    disableExperimentalSEAWarning: true
  }, null, 2), 'utf8');

  console.log('→ generating SEA blob…');
  await run(process.execPath, ['--experimental-sea-config', 'sea-config.json']);

  console.log('→ copying node binary…');
  const target = path.join(dist, outName);
  await fs.copyFile(process.execPath, target);
  if (!isWin) await fs.chmod(target, 0o755);

  console.log('→ injecting blob with postject…');
  await run('npx', ['--yes', 'postject', target, 'NODE_SEA_BLOB', path.join(dist, 'sea-prep.blob'),
    '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2']);

  console.log(`\n✓ built ${target}`);
  console.log('Note: the app still reads config/ and prompts/ relative to its working directory.');
  console.log('Ship the project files next to the binary, or set WORKSPACE_ROOT accordingly.');
}

main().catch((error) => { console.error(error); process.exit(1); });
