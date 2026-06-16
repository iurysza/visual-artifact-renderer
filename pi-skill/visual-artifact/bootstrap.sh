#!/usr/bin/env bash
# Bootstrap the visual-artifact runtime and wrappers.
# Use this when the skill is already installed but the runtime is missing.
set -e

VAZ_DIR="${VAZ_DIR:-$HOME/.pi/tools/visualizer}"
BIN_DIR="${HOME}/.pi/bin"
SKILL_DIR="${VAZ_SKILL_DIR:-$HOME/.pi/skills/visual-artifact}"
EXTENSION_DST="$HOME/.pi/agent/extensions/visual-artifact.ts"
REPO_URL="${VAZ_REPO_URL:-https://github.com/iurysouza/visualizer.git}"

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
    echo "[vaz-bootstrap] $bin_dir is already in PATH."
    return 0
  fi

  if [ -z "$profile" ] || [ ! -f "$profile" ]; then
    echo "[vaz-bootstrap] Could not find a shell profile. Add this line manually:"
    echo "  export PATH=\"$bin_dir:\$PATH\""
    return 0
  fi

  echo "[vaz-bootstrap] Adding $bin_dir to PATH in $profile..."
  cp "$profile" "$profile.vaz-backup.$(date +%s)"
  echo "" >> "$profile"
  echo "# Added by visual-artifact bootstrap" >> "$profile"
  echo "export PATH=\"$bin_dir:\$PATH\"" >> "$profile"
  echo "[vaz-bootstrap] PATH updated. Run: source $profile"
}

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
cp "$VAZ_DIR/pi-extension/visual-artifact.ts" "$EXTENSION_DST"

configure_path "$BIN_DIR"

echo "[vaz-bootstrap] Done."
echo ""
echo "Then run: vaz-doctor"
