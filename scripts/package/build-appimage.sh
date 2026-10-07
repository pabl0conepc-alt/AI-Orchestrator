#!/usr/bin/env bash
# Build an AppImage (portable Linux bundle). Requires: appimagetool (set APPIMAGETOOL to its path).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERSION="$(node -p "require('$ROOT/package.json').version")"
APPDIR="$ROOT/build/AI-Orchestrator.AppDir"
TOOL="${APPIMAGETOOL:-appimagetool}"

if [ -z "${APPIMAGETOOL:-}" ] && ! command -v appimagetool >/dev/null 2>&1; then
  echo 'appimagetool não encontrado. Baixe em https://github.com/AppImage/appimagetool e defina APPIMAGETOOL=/path/to/appimagetool.'
  exit 1
fi

rm -rf "$APPDIR"
mkdir -p "$APPDIR/usr/bin" "$APPDIR/usr/share/ai-orchestrator"

cp -r "$ROOT/src" "$ROOT/public" "$ROOT/config" "$ROOT/prompts" "$ROOT/package.json" "$APPDIR/usr/share/ai-orchestrator/"

# AppImage bundles the Node runtime: build a SEA binary first if available.
if [ -x "$ROOT/dist/ai-orchestrator" ]; then
  cp "$ROOT/dist/ai-orchestrator" "$APPDIR/usr/bin/ai-orchestrator"
else
  cat > "$APPDIR/usr/bin/ai-orchestrator" <<'EOF'
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")/../share/ai-orchestrator" && pwd)"
cd "$DIR"
exec node src/server.js "$@"
EOF
  chmod 0755 "$APPDIR/usr/bin/ai-orchestrator"
fi

cat > "$APPDIR/ai-orchestrator.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=AI Orchestrator
Comment=Local-first programming AI platform
Exec=ai-orchestrator
Icon=ai-orchestrator
Categories=Development;
Terminal=true
EOF

cat > "$APPDIR/AppRun" <<'EOF'
#!/usr/bin/env bash
HERE="$(dirname "$(readlink -f "$0")")"
exec "$HERE/usr/bin/ai-orchestrator" "$@"
EOF
chmod 0755 "$APPDIR/AppRun"

# Minimal icon (SVG is accepted by appimagetool).
cat > "$APPDIR/ai-orchestrator.svg" <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="24" fill="#0a0e17"/><text x="64" y="82" font-size="72" text-anchor="middle" fill="#5b8cff">◈</text></svg>
EOF

ARCH="${ARCH:-x86_64}" "$TOOL" "$APPDIR" "$ROOT/build/AI-Orchestrator-${VERSION}-${ARCH}.AppImage"

echo "✓ built build/AI-Orchestrator-${VERSION}-${ARCH}.AppImage"
