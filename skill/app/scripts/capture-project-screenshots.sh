#!/bin/bash
set -euo pipefail

# Capture top + scrolled desktop screenshots of selected project artifacts.
# Outputs PNGs next to artifact JSON so they can be referenced as sidecar images.

BASE_URL="http://localhost:9999/artifacts"
PREFIX="${1:-project-showcase-}"

# List as "project/slug"
ARTIFACTS=(
  "agents/agent-operating-stack"
  "agents/distributed-agent-architecture-map"
  "agents/agents-repo-cheat-sheet"
  "dotfiles/pi-herdr-agent-stack"
  "dotfiles/setup"
)

# Create one isolated unfocused window.
echo "Opening isolated surf window..."
WINDOW_OUTPUT=$(surf window.new --unfocused "${BASE_URL}/")
WINDOW_ID=$(echo "$WINDOW_OUTPUT" | grep -oE 'Window [0-9]+' | awk '{print $2}')
if [[ -z "$WINDOW_ID" ]]; then
  echo "Failed to create surf window: $WINDOW_OUTPUT"
  exit 1
fi
echo "Window ID: $WINDOW_ID"

trap 'echo "Closing window $WINDOW_ID"; surf window.close "$WINDOW_ID" 2>/dev/null || true' EXIT

for artifact in "${ARTIFACTS[@]}"; do
  project="${artifact%%/*}"
  slug="${artifact#*/}"
  out_dir="${HOME}/.pi/artifacts/${project}"
  mkdir -p "$out_dir"
  url="${BASE_URL}/${artifact}/"
  echo "Capturing $artifact ..."

  surf --window-id "$WINDOW_ID" emulate.viewport --width 1440 --height 900 >/dev/null
  surf --window-id "$WINDOW_ID" go "$url" >/dev/null
  surf --window-id "$WINDOW_ID" wait.network >/dev/null 2>&1 || true
  surf --window-id "$WINDOW_ID" wait 3 >/dev/null

  # Top of page
  surf --window-id "$WINDOW_ID" scroll.top >/dev/null
  surf --window-id "$WINDOW_ID" wait 1 >/dev/null
  surf --window-id "$WINDOW_ID" screenshot --output "${out_dir}/${PREFIX}${slug}-top.png" >/dev/null
  echo "  -> ${PREFIX}${slug}-top.png"

  # Scrolled to bottom
  surf --window-id "$WINDOW_ID" scroll.bottom >/dev/null
  surf --window-id "$WINDOW_ID" wait 1 >/dev/null
  surf --window-id "$WINDOW_ID" screenshot --output "${out_dir}/${PREFIX}${slug}-bottom.png" >/dev/null
  echo "  -> ${PREFIX}${slug}-bottom.png"
done

echo "Done."
