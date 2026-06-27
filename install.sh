#!/usr/bin/env bash
# One-shot installer for the visual-artifact skill + runtime.
# Run this from the visualizer repository root.
set -e

check_path() {
  local bin_dir="$1"

  if [[ ":$PATH:" == *":$bin_dir:"* ]]; then
    echo "[vaz-install] $bin_dir is already in PATH."
  else
    echo "[vaz-install] $bin_dir is not in PATH for this shell."
    echo "[vaz-install] Use full paths like $bin_dir/vaz-doctor, or add it via your dotfiles."
  fi
}

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
SKILL_SRC="$REPO_ROOT/pi-skill/visual-artifact"
PI_SKILL_DST="$HOME/.pi/skills/visual-artifact"
OPENCODE_SKILL_DST="$HOME/.agents/skills/visual-artifact"
EXTENSION_SRC="$REPO_ROOT/pi-extension/visual-artifact.ts"
EXTENSION_DST="$HOME/.pi/agent/extensions/visual-artifact.ts"
BIN_DIR="$HOME/.pi/bin"
VAZ_DIR="$HOME/.pi/tools/visualizer"

echo "[vaz-install] Installing visual-artifact skill + runtime..."
echo "[vaz-install] Source repo: $REPO_ROOT"

# 1. Install the Pi skill globally (copy so edits to the source repo do not break installed skill)
echo "[vaz-install] Installing Pi skill to $PI_SKILL_DST..."
mkdir -p "$(dirname "$PI_SKILL_DST")"
rm -rf "$PI_SKILL_DST"
cp -R "$SKILL_SRC" "$PI_SKILL_DST"

# 2. Install the OpenCode skill as a symlink so updates are reflected immediately.
echo "[vaz-install] Installing OpenCode skill to $OPENCODE_SKILL_DST..."
mkdir -p "$(dirname "$OPENCODE_SKILL_DST")"
if [ -L "$OPENCODE_SKILL_DST" ]; then
  rm "$OPENCODE_SKILL_DST"
elif [ -e "$OPENCODE_SKILL_DST" ]; then
  rm -rf "$OPENCODE_SKILL_DST"
fi
ln -s "$SKILL_SRC" "$OPENCODE_SKILL_DST"

# 3. Install the Pi extension globally
echo "[vaz-install] Installing Pi extension to $EXTENSION_DST..."
mkdir -p "$(dirname "$EXTENSION_DST")"
cp "$EXTENSION_SRC" "$EXTENSION_DST"

# 4. Link the runtime to this repo (symlink makes local iteration easy)
echo "[vaz-install] Linking runtime: $VAZ_DIR -> $REPO_ROOT..."
if [ -L "$VAZ_DIR" ]; then
  rm "$VAZ_DIR"
elif [ -d "$VAZ_DIR" ]; then
  rm -rf "$VAZ_DIR"
fi
mkdir -p "$(dirname "$VAZ_DIR")"
ln -s "$REPO_ROOT" "$VAZ_DIR"

# 5. Install wrapper commands
echo "[vaz-install] Installing wrapper scripts to $BIN_DIR..."
mkdir -p "$BIN_DIR"
cp "$PI_SKILL_DST/bin/"* "$BIN_DIR/"
chmod +x "$BIN_DIR"/vaz-*

# 6. Install runtime dependencies
echo "[vaz-install] Installing runtime dependencies..."
cd "$VAZ_DIR"
if [ ! -d "node_modules" ]; then
  pnpm install
else
  echo "[vaz-install] node_modules already present; skipping pnpm install"
fi

# 7. Report PATH state without mutating shell config.
check_path "$BIN_DIR"

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
