#!/usr/bin/env bash
# One-shot installer for the visual-artifact skill + runtime.
# Run this from the visualizer repository root.
set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
SKILL_SRC="$REPO_ROOT/pi-skill/visual-artifact"
SKILL_DST="$HOME/.pi/skills/visual-artifact"
EXTENSION_SRC="$REPO_ROOT/pi-extension/visual-artifact.ts"
EXTENSION_DST="$HOME/.pi/agent/extensions/visual-artifact.ts"
BIN_DIR="$HOME/.pi/bin"
VAZ_DIR="$HOME/.pi/tools/visualizer"

echo "[vaz-install] Installing visual-artifact skill + runtime..."
echo "[vaz-install] Source repo: $REPO_ROOT"

# 1. Install the skill globally (copy so edits to the source repo do not break installed skill)
echo "[vaz-install] Installing skill to $SKILL_DST..."
mkdir -p "$(dirname "$SKILL_DST")"
rm -rf "$SKILL_DST"
cp -R "$SKILL_SRC" "$SKILL_DST"

# 2. Install the Pi extension globally
echo "[vaz-install] Installing Pi extension to $EXTENSION_DST..."
mkdir -p "$(dirname "$EXTENSION_DST")"
cp "$EXTENSION_SRC" "$EXTENSION_DST"

# 3. Link the runtime to this repo (symlink makes local iteration easy)
echo "[vaz-install] Linking runtime: $VAZ_DIR -> $REPO_ROOT..."
if [ -L "$VAZ_DIR" ]; then
  rm "$VAZ_DIR"
elif [ -d "$VAZ_DIR" ]; then
  rm -rf "$VAZ_DIR"
fi
mkdir -p "$(dirname "$VAZ_DIR")"
ln -s "$REPO_ROOT" "$VAZ_DIR"

# 4. Install wrapper commands
echo "[vaz-install] Installing wrapper scripts to $BIN_DIR..."
mkdir -p "$BIN_DIR"
cp "$SKILL_DST/bin/"* "$BIN_DIR/"
chmod +x "$BIN_DIR"/vaz-*

# 5. Install runtime dependencies
echo "[vaz-install] Installing runtime dependencies..."
cd "$VAZ_DIR"
if [ ! -d "node_modules" ]; then
  pnpm install
else
  echo "[vaz-install] node_modules already present; skipping pnpm install"
fi

# 6. Optional: add ~/.pi/bin to PATH in shell profile
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  echo "[vaz-install] $BIN_DIR is not in your PATH."
  echo "[vaz-install] Add this line to your shell profile:"
  echo "  export PATH=\"$BIN_DIR:\$PATH\""
fi

echo ""
echo "[vaz-install] Done."
echo ""
echo "Run the health check:"
echo "  vaz-doctor"
echo ""
echo "Start the renderer:"
echo "  vaz-serve"
echo ""
echo "Generate an artifact from a repo:"
echo "  vaz-pipeline /path/to/repo"
