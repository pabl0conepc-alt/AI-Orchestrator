# Packaging

These scripts produce **real** artifacts when the platform toolchain is present. They are not part
of the app's install/build commands and are never run by CI.

## Windows / cross-platform binary — `build-sea.mjs`

Uses Node's **Single Executable Application** (SEA) to bundle the server into one binary.

```bash
node scripts/package/build-sea.mjs      # run on the target OS
```

Requires Node 20+ and network access for `npx postject`. Produces `dist/ai-orchestrator(.exe)`.
Ship `config/` and `prompts/` next to the binary (it reads them at runtime).

> Node SEA cannot cross-compile: run it once per target OS. For a Windows installer, wrap the
> produced `.exe` with an installer generator such as Inno Setup or WiX.

## Linux `.deb` — `build-deb.sh`

```bash
bash scripts/package/build-deb.sh
```

Requires `dpkg-deb` and `fakeroot`. Produces `build/ai-orchestrator_<version>_<arch>.deb` with a
launcher in `/usr/bin`, the app in `/opt/ai-orchestrator` and a systemd unit. Declares
`nodejs (>= 20)` as a dependency.

## Linux AppImage — `build-appimage.sh`

```bash
APPIMAGETOOL=/path/to/appimagetool bash scripts/package/build-appimage.sh
```

Requires `appimagetool`. If `dist/ai-orchestrator` (from `build-sea.mjs`) exists it is bundled as the
runtime; otherwise the AppRun falls back to the system `node`.

## Android `.apk`

A `.apk` cannot run this Node.js server directly. The recommended approach is a **native client**
(Kotlin/Flutter) or a WebView wrapper that talks to the orchestrator's REST/SSE API running on a
host (your machine, a server, or a bundled runtime such as Termux). Treat the APK as a *client*;
the orchestration core stays on the host. This is a product decision, not a build-script gap.

## Why no ISO

AI Orchestrator is an application, not an operating system, so no ISO is produced.
