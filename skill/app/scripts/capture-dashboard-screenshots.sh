#!/bin/bash
set -euo pipefail

# Capture mobile + desktop screenshots of representative Visualizer dashboards.
# Outputs PNGs next to the artifact JSON so they can be referenced as sidecar images.

PROJECT="visualizer"
OUT_DIR="${HOME}/.pi/artifacts/${PROJECT}"
BASE_URL="http://localhost:9999/artifacts"
PREFIX="${1:-dashboard-showcase-}"

mkdir -p "$OUT_DIR"

ARTIFACTS=(
  "revenue-dashboard"
  "components-gallery"
  "agent-stack-report"
  "visualizer-codebase-overview"
)

# Create one isolated unfocused window for the whole session.
echo "Opening isolated surf window..."
WINDOW_OUTPUT=$(surf window.new --unfocused "${BASE_URL}/${PROJECT}/revenue-dashboard/")
WINDOW_ID=$(echo "$WINDOW_OUTPUT" | grep -oE 'Window [0-9]+' | awk '{print $2}')
if [[ -z "$WINDOW_ID" ]]; then
  echo "Failed to create surf window: $WINDOW_OUTPUT"
  exit 1
fi
echo "Window ID: $WINDOW_ID"

# Clean up window on exit.
trap 'echo "Closing window $WINDOW_ID"; surf window.close "$WINDOW_ID" 2>/dev/null || true' EXIT

for slug in "${ARTIFACTS[@]}"; do
  url="${BASE_URL}/${PROJECT}/${slug}/"
  echo "Capturing $slug ..."

  # Desktop
  surf --window-id "$WINDOW_ID" emulate.viewport --width 1440 --height 900 >/dev/null
  surf --window-id "$WINDOW_ID" go "$url" >/dev/null
  surf --window-id "$WINDOW_ID" wait.network >/dev/null 2>&1 || true
  surf --window-id "$WINDOW_ID" wait 2 >/dev/null
  surf --window-id "$WINDOW_ID" screenshot --output "${OUT_DIR}/${PREFIX}${slug}-desktop.png" >/dev/null
  echo "  -> ${PREFIX}${slug}-desktop.png"

  # Mobile
  surf --window-id "$WINDOW_ID" emulate.viewport --width 390 --height 844 >/dev/null
  surf --window-id "$WINDOW_ID" go "$url" >/dev/null
  surf --window-id "$WINDOW_ID" wait.network >/dev/null 2>&1 || true
  surf --window-id "$WINDOW_ID" wait 2 >/dev/null
  surf --window-id "$WINDOW_ID" screenshot --output "${OUT_DIR}/${PREFIX}${slug}-mobile.png" >/dev/null
  echo "  -> ${PREFIX}${slug}-mobile.png"
done

echo "Done. Screenshots saved to $OUT_DIR"
