#!/usr/bin/env bash
# Bootstrap the visual-artifact runtime and wrappers.
# Use this when the skill is already installed but the runtime is missing.
set -e

VAZ_DIR="${VAZ_DIR:-$HOME/.pi/tools/visualizer}"
BIN_DIR="${HOME}/.pi/bin"
SKILL_DIR="${VAZ_SKILL_DIR:-$HOME/.pi/skills/visual-artifact}"
EXTENSION_DST="$HOME/.pi/agent/extensions/visual-artifact.ts"
REPO_URL="${VAZ_REPO_URL:-https://github.com/iurysouza/visualizer.git}"

echo "[vaz-bootstrap] Bootstrapping visual-artifact runtime..."

if [ ! -d "$VAZ_DIR" ]; then
  echo "[vaz-bootstrap] Cloning runtime to $VAZ_DIR..."
  git clone "$REPO_URL" "$VAZ_DIR"
else
  echo "[vaz-bootstrap] Runtime already exists at $VAZ_DIR"
fi

cd "$VAZ_DIR"

if [ ! -d "node_modules" ]; then
  echo "[vaz-bootstrap] Installing dependencies..."
  pnpm install
else
  echo "[vaz-bootstrap] Dependencies already installed"
fi

mkdir -p "$BIN_DIR"

echo "[vaz-bootstrap] Installing wrapper scripts..."
cp "$SKILL_DIR/bin/"* "$BIN_DIR/"
chmod +x "$BIN_DIR"/vaz-*

echo "[vaz-bootstrap] Installing Pi extension..."
mkdir -p "$(dirname "$EXTENSION_DST")"
cp "$VAZ_DIR/.pi/extensions/visual-artifact.ts" "$EXTENSION_DST"

echo "[vaz-bootstrap] Done."
echo ""
echo "Add this to your PATH if not already:"
echo "  export PATH=\"$BIN_DIR:\$PATH\""
echo ""
echo "Then run: vaz-doctor"
