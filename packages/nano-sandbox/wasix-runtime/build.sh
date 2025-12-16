#!/bin/bash
set -e

cd "$(dirname "$0")"

# Build Rust to WASM
echo "==> Building WASM module..."
cargo build --target wasm32-wasip1 --release

# Package into .webc
echo "==> Packaging .webc..."
rm -f ../assets/runtime.webc
wasmer package build -o ../assets/runtime.webc

echo ""
echo "==> Built runtime.webc"
