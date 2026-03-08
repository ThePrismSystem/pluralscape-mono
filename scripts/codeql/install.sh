#!/usr/bin/env bash
set -euo pipefail

if command -v codeql &>/dev/null; then
  echo "CodeQL CLI already installed: $(codeql --version 2>&1 | head -1)"
  exit 0
fi

INSTALL_DIR="/usr/local/lib/codeql"
BIN_LINK="/usr/local/bin/codeql"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

echo "Downloading CodeQL CLI..."
gh release download --repo github/codeql-cli-binaries --pattern "codeql-linux64.zip" --dir "$TMPDIR"

echo "Extracting..."
unzip -q "$TMPDIR/codeql-linux64.zip" -d "$TMPDIR"

echo "Installing to $INSTALL_DIR (requires sudo)..."
sudo rm -rf "$INSTALL_DIR"
sudo mv "$TMPDIR/codeql" "$INSTALL_DIR"
sudo ln -sf "$INSTALL_DIR/codeql" "$BIN_LINK"

echo "Downloading query packs..."
codeql pack download codeql/javascript-queries
codeql pack download codeql/actions-queries

echo "Done: $(codeql --version 2>&1 | head -1)"
