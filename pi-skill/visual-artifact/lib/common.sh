#!/usr/bin/env bash
# Shared helpers for vaz-* wrapper scripts.
# These wrappers hide the visualizer runtime path from the agent.

export VAZ_DIR="${VAZ_DIR:-$HOME/.pi/tools/visualizer}"
export VAZ_SKILL_DIR="${VAZ_SKILL_DIR:-$HOME/.pi/skills/visual-artifact}"
export VAZ_BIN_DIR="${VAZ_BIN_DIR:-$HOME/.pi/bin}"
export VAZ_SERVER_URL="${VAZ_SERVER_URL:-http://localhost:9999}"
export VAZ_SERVER_LOG="${VAZ_SERVER_LOG:-/tmp/vaz-server.log}"

server_running() {
  curl -s --max-time 2 "$VAZ_SERVER_URL" >/dev/null 2>&1
}

ensure_runtime() {
  if [ ! -d "$VAZ_DIR" ]; then
    echo "{\"error\": \"runtime not found\", \"path\": \"$VAZ_DIR\", \"fix\": \"Run install.sh from the visualizer repo or run $VAZ_SKILL_DIR/bootstrap.sh\"}" >&2
    exit 1
  fi

  if [ ! -d "$VAZ_DIR/node_modules" ]; then
    echo "{\"error\": \"runtime dependencies missing\", \"path\": \"$VAZ_DIR\", \"fix\": \"cd $VAZ_DIR && pnpm install\"}" >&2
    exit 1
  fi
}

ensure_server() {
  if ! server_running; then
    echo "[vaz] Server not running at $VAZ_SERVER_URL. Starting..." >&2
    vaz-serve
  fi
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}
