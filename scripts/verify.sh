#!/usr/bin/env bash
# Repository verification gate.
# Runs shared, CLI, app, and worker checks with pinned runtimes.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

CLI_BIN="$ROOT/cli/dist/visual-artifact"

NODE_VERSION="22.22.3"
BUN_VERSION="1.1.34"
PNPM_VERSION="11.5.2"

fail() {
  echo "❌ $1" >&2
  exit 1
}

ok() {
  echo "✅ $1"
}

echo "=== Visual Artifact verification gate ==="
[[ "$(node --version)" == "v${NODE_VERSION}" ]] || fail "Node ${NODE_VERSION} required"
[[ "$(bun --version)" == "${BUN_VERSION}" ]] || fail "Bun ${BUN_VERSION} required"
[[ "$(pnpm --version)" == "${PNPM_VERSION}" ]] || fail "pnpm ${PNPM_VERSION} required"
ok "Runtime pins: Node ${NODE_VERSION}, Bun ${BUN_VERSION}, pnpm ${PNPM_VERSION}"

# ---------------------------------------------------------------------------
# Shared
# ---------------------------------------------------------------------------
echo ""
echo "--- shared: install + typecheck + build ---"
cd "$ROOT/shared"
bun install --frozen-lockfile
bun run typecheck
bun run build
ok "shared checks passed"

# ---------------------------------------------------------------------------
# Pi extension
# ---------------------------------------------------------------------------
echo ""
echo "--- Pi extension: boundary tests ---"
cd "$ROOT"
bun test pi-extension
ok "Pi extension checks passed"

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
echo ""
echo "--- CLI: install + test + typecheck + build ---"
cd "$ROOT/cli"
bun install --frozen-lockfile
bun test
bun run typecheck
bun run build
ok "CLI checks passed"

echo ""
echo "--- CLI: compiled binary smoke ---"
"$CLI_BIN" --version >/dev/null
"$CLI_BIN" contract --format summary >/dev/null
ok "compiled CLI smoke passed"

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
echo ""
echo "--- app: install ---"
cd "$ROOT/app"
pnpm install --frozen-lockfile
ok "app install passed"

echo ""
echo "--- app: test ---"
pnpm test
ok "app test passed"

echo ""
echo "--- app: lint ---"
pnpm lint
ok "app lint passed"

echo ""
echo "--- app: export contract ---"
pnpm export:contract
ok "contract exported"

echo ""
echo "--- app: contract diff gate ---"
git -C "$ROOT" diff --exit-code -- cli/assets/contract.json || fail "contract.json is out of sync; run pnpm export:contract in app/"
ok "contract diff gate passed"

echo ""
echo "--- app: verify artifacts ---"
pnpm verify:artifacts
ok "artifact verification passed"

echo ""
echo "--- app: build ---"
pnpm build
ok "app build passed"

echo ""
echo "--- app: current-route health smoke ---"
HEALTH_DIR="$(mktemp -d)"
ARTIFACTS_DIR="$HEALTH_DIR/artifacts"
STATE_DIR="$HEALTH_DIR/state"
HEALTH_PROJECT="health-project"
HEALTH_SLUG="health-check"
PROJECT_DIR="$HEALTH_DIR/$HEALTH_PROJECT"
SERVER_PID=""

cleanup_health() {
  if [[ -n "$SERVER_PID" ]]; then
    if kill -0 "$SERVER_PID" >/dev/null 2>&1; then
      kill -TERM "$SERVER_PID" >/dev/null 2>&1 || true
      for _ in $(seq 1 30); do
        if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then break; fi
        sleep 0.1
      done
      if kill -0 "$SERVER_PID" >/dev/null 2>&1; then
        kill -KILL "$SERVER_PID" >/dev/null 2>&1 || true
      fi
    fi
    wait "$SERVER_PID" >/dev/null 2>&1 || true
    SERVER_PID=""
  fi
  if [[ -n "$HEALTH_DIR" ]]; then
    rm -rf "$HEALTH_DIR"
    HEALTH_DIR=""
  fi
}
trap cleanup_health EXIT

HEALTH_PORT="$(node <<'NODE'
const net = require("node:net")
const server = net.createServer()
server.listen(0, "127.0.0.1", () => {
  console.log(server.address().port)
  server.close()
})
NODE
)"
mkdir -p "$ARTIFACTS_DIR" "$PROJECT_DIR" "$STATE_DIR"

VISUAL_ARTIFACT_ARTIFACTS_DIR="$ARTIFACTS_DIR" \
XDG_STATE_HOME="$STATE_DIR" \
  "$CLI_BIN" create --no-serve --project "$PROJECT_DIR" - <<EOF || fail "artifact creation failed"
{
  "slug": "$HEALTH_SLUG",
  "title": "Health Check Artifact",
  "nodes": [{ "type": "text", "props": { "text": "Hello from health check" } }]
}
EOF

cat > "$ARTIFACTS_DIR/$HEALTH_PROJECT/$HEALTH_SLUG/annotations.json" <<EOF || fail "annotation creation failed"
{
  "version": 1,
  "project": "$HEALTH_PROJECT",
  "slug": "$HEALTH_SLUG",
  "threads": []
}
EOF

VISUAL_ARTIFACT_ARTIFACTS_DIR="$ARTIFACTS_DIR" \
VISUAL_ARTIFACT_OUT_DIR="$ROOT/app/out" \
XDG_STATE_HOME="$STATE_DIR" \
  "$CLI_BIN" serve --no-open --host 127.0.0.1 --port "$HEALTH_PORT" \
  >"$HEALTH_DIR/server.log" 2>&1 &
SERVER_PID=$!

HEALTH_READY=0
for _ in $(seq 1 50); do
  if curl -fsS "http://127.0.0.1:${HEALTH_PORT}/artifacts/" >/dev/null 2>&1; then
    HEALTH_READY=1
    break
  fi
  if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    cat "$HEALTH_DIR/server.log" >&2
    fail "health server exited before becoming ready"
  fi
  sleep 0.2
done
if [[ "$HEALTH_READY" != "1" ]]; then
  cat "$HEALTH_DIR/server.log" >&2
  fail "health server did not become ready"
fi

BASE_URL="http://127.0.0.1:${HEALTH_PORT}/artifacts" \
ARTIFACT_PROJECT="$HEALTH_PROJECT" \
ARTIFACT_SLUG="$HEALTH_SLUG" \
  node "$ROOT/app/scripts/qa/health-check.mjs" || fail "health smoke failed"

cleanup_health
trap - EXIT
ok "health smoke passed"

# ---------------------------------------------------------------------------
# Worker
# ---------------------------------------------------------------------------
echo ""
echo "--- worker: install + test + typecheck ---"
cd "$ROOT/worker"
bun install --frozen-lockfile
bun test
bun run typecheck
ok "worker checks passed"

echo ""
echo "=== All verification checks passed ==="
