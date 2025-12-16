#!/bin/bash
set -e

cd "$(dirname "$0")"

NPM_VERSION="${NPM_VERSION:-11.7.0}"

echo "==> Preparing npm@${NPM_VERSION} for bundling..."

# Clean up previous build artifacts
rm -rf npm usr etc

# Download npm tarball (cached by version)
CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/nano-sandbox"
NPM_TARBALL="${CACHE_DIR}/npm-${NPM_VERSION}.tgz"

mkdir -p "$CACHE_DIR"

if [ -f "$NPM_TARBALL" ]; then
    echo "    Using cached npm@${NPM_VERSION}"
else
    echo "    Downloading npm@${NPM_VERSION}..."
    curl -sL "https://registry.npmjs.org/npm/-/npm-${NPM_VERSION}.tgz" -o "$NPM_TARBALL"
fi

tar -xzf "$NPM_TARBALL"
mv package npm

# Prune unnecessary files to reduce package size
echo "    Pruning unnecessary files..."
rm -rf npm/man npm/docs npm/test npm/changelogs
find npm -name "*.md" -type f -delete 2>/dev/null || true
find npm -name "LICENSE*" -type f -delete 2>/dev/null || true
find npm -name "CHANGELOG*" -type f -delete 2>/dev/null || true
find npm -name "*.txt" -type f -delete 2>/dev/null || true
find npm -name ".npmignore" -type f -delete 2>/dev/null || true
find npm -name ".eslint*" -type f -delete 2>/dev/null || true

# Create directory structure
echo "    Setting up filesystem structure..."
mkdir -p usr/lib/node_modules
mkdir -p usr/bin
mkdir -p etc

# Move npm to proper location
mv npm usr/lib/node_modules/npm

# Create bin symlinks (these will be shell scripts that invoke node)
cat > usr/bin/npm << 'EOF'
#!/usr/bin/env node
require('/usr/lib/node_modules/npm/lib/cli.js')(process)
EOF

cat > usr/bin/npx << 'EOF'
#!/usr/bin/env node
require('/usr/lib/node_modules/npm/lib/cli.js')(process, 'npx')
EOF

chmod +x usr/bin/npm usr/bin/npx

# Create default npmrc
cat > etc/npmrc << 'EOF'
; Default npm configuration
prefix=/usr/local
cache=/tmp/.npm
EOF

echo "    npm@${NPM_VERSION} prepared successfully"
echo ""

# Build Rust to WASM
echo "==> Building WASM module..."
cargo build --target wasm32-wasip1 --release

# Package into .webc
echo "==> Packaging .webc..."
rm -f ../assets/runtime.webc
wasmer package build -o ../assets/runtime.webc

echo ""
echo "==> Built runtime.webc with npm@${NPM_VERSION}"
