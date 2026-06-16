#!/usr/bin/env bash
# One-shot installer for the visual-artifact skill + runtime.
# Run this from the visualizer repository root.
set -e

# Detect and update shell profile so ~/.pi/bin is on PATH.
configure_path() {
  local bin_dir="$1"
  local shell_name="$(basename "$SHELL")"
  local profile=""

  if [ "$shell_name" = "zsh" ]; then
    profile="$HOME/.zshrc"
  elif [ "$shell_name" = "bash" ]; then
    if [ -f "$HOME/.bash_profile" ]; then
      profile="$HOME/.bash_profile"
    elif [ -f "$HOME/.bashrc" ]; then
      profile="$HOME/.bashrc"
    else
      profile="$HOME/.profile"
    fi
  else
    profile="$HOME/.profile"
  fi

  if [[ ":$PATH:" == *":$bin_dir:"* ]]; then
    echo "[vaz-install] $bin_dir is already in PATH."
    return 0
  fi

  if [ -z "$profile" ] || [ ! -f "$profile" ]; then
    echo "[vaz-install] Could not find a shell profile. Add this line manually:"
    echo "  export PATH=\"$bin_dir:\$PATH\""
    return 0
  fi

  echo "[vaz-install] Adding $bin_dir to PATH in $profile..."
  cp "$profile" "$profile.vaz-backup.$(date +%s)"
  echo "" >> "$profile"
  echo "# Added by visual-artifact installer" >> "$profile"
  echo "export PATH=\"$bin_dir:\$PATH\"" >> "$profile"
  echo "[vaz-install] PATH updated. Run: source $profile"
}

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

# 6. Ensure ~/.pi/bin is in PATH
configure_path "$BIN_DIR"

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
