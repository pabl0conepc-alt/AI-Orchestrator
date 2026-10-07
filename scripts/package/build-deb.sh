#!/usr/bin/env bash
# Build a .deb package. Requires: dpkg-deb, fakeroot (Linux). Not needed for running from source.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERSION="$(node -p "require('$ROOT/package.json').version")"
PKG="ai-orchestrator"
ARCH="${ARCH:-amd64}"
BUILD="$ROOT/build/deb/${PKG}_${VERSION}_${ARCH}"

command -v dpkg-deb >/dev/null 2>&1 || { echo 'dpkg-deb é necessário (apt install dpkg-dev).'; exit 1; }

rm -rf "$BUILD"
mkdir -p "$BUILD/DEBIAN" \
         "$BUILD/opt/$PKG" \
         "$BUILD/usr/bin" \
         "$BUILD/lib/systemd/system"

# Application payload
cp -r "$ROOT/src" "$ROOT/public" "$ROOT/config" "$ROOT/prompts" "$ROOT/scripts" "$ROOT/package.json" "$BUILD/opt/$PKG/"

cat > "$BUILD/usr/bin/$PKG" <<EOF
#!/usr/bin/env bash
exec node /opt/$PKG/src/server.js "\$@"
EOF
chmod 0755 "$BUILD/usr/bin/$PKG"

cat > "$BUILD/lib/systemd/system/$PKG.service" <<EOF
[Unit]
Description=AI Orchestrator
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/$PKG
EnvironmentFile=-/etc/$PKG/env
ExecStart=/usr/bin/node /opt/$PKG/src/server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

cat > "$BUILD/DEBIAN/control" <<EOF
Package: $PKG
Version: $VERSION
Section: devel
Priority: optional
Architecture: $ARCH
Depends: nodejs (>= 20)
Maintainer: AI Orchestrator contributors
Description: Local-first programming AI platform with multi-agent orchestration.
EOF

cat > "$BUILD/DEBIAN/postinst" <<EOF
#!/usr/bin/env bash
mkdir -p /etc/$PKG
[ -f /etc/$PKG/env ] || cp /opt/$PKG/config/env.example /etc/$PKG/env
echo "Edit /etc/$PKG/env with your provider keys, then: systemctl enable --now $PKG"
EOF
chmod 0755 "$BUILD/DEBIAN/postinst"

fakeroot dpkg-deb --build "$BUILD" "$ROOT/build/${PKG}_${VERSION}_${ARCH}.deb" 2>/dev/null || dpkg-deb --build "$BUILD" "$ROOT/build/${PKG}_${VERSION}_${ARCH}.deb"

echo "✓ built build/${PKG}_${VERSION}_${ARCH}.deb"
