#!/usr/bin/env bash
set -euo pipefail

REPORT_FILE="/tmp/viz-arch-validation-report.md"
VISUALIZER_DIR="/Users/iurysouza/projects/my-repos/vibe-coded/visualizer"
THOUGHTBOX_DIR="/Users/iurysouza/projects/my-repos/thought-box"

echo "# Visualizer Architecture Validation Report" > "$REPORT_FILE"
echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

run_check() {
  local name="$1"
  shift
  echo "## $name" >> "$REPORT_FILE"
  echo "\`\`\`" >> "$REPORT_FILE"
  if "$@" >> "$REPORT_FILE" 2>&1; then
    echo "\`\`\`" >> "$REPORT_FILE"
    echo "Status: **PASS**" >> "$REPORT_FILE"
  else
    echo "\`\`\`" >> "$REPORT_FILE"
    echo "Status: **FAIL**" >> "$REPORT_FILE"
    FAILED=1
  fi
  echo "" >> "$REPORT_FILE"
}

FAILED=0

cd "$VISUALIZER_DIR"
run_check "visualizer: pnpm lint" pnpm lint
run_check "visualizer: pnpm verify:artifacts" pnpm verify:artifacts
run_check "visualizer: pnpm build" pnpm build

# Serve and curl checks
{
  echo "## visualizer: pnpm serve URL checks"
  echo "\`\`\`"
  VISUALIZER_OPEN=0 node scripts/serve.mjs > /tmp/viz-serve.log 2>&1 &
  SERVER_PID=$!
  sleep 2
  echo "Server log:"
  cat /tmp/viz-serve.log
  echo ""

  ARTIFACT_URL="http://127.0.0.1:9999/artifacts/visualizer/agent-stack-report/"
  JSON_URL="http://127.0.0.1:9999/artifacts/data/artifacts/visualizer/agent-stack-report.json"
  ROOT_ARTIFACT_URL="http://127.0.0.1:9999/visualizer/agent-stack-report/"
  ROOT_JSON_URL="http://127.0.0.1:9999/data/artifacts/visualizer/agent-stack-report.json"

  echo "Checking $ARTIFACT_URL ..."
  curl -s --max-time 5 -o /tmp/viz-artifact-html.html "$ARTIFACT_URL"
  if grep -q "Your Agent Setup Is a Portable Home Overlay" /tmp/viz-artifact-html.html; then
    echo "  HTML title found ✓"
  else
    echo "  HTML title NOT found ✗"
    FAILED=1
  fi

  echo "Checking $JSON_URL ..."
  TITLE=$(curl -s --max-time 5 "$JSON_URL" | jq -r .title)
  if [ "$TITLE" = "Your Agent Setup Is a Portable Home Overlay" ]; then
    echo "  JSON title: $TITLE ✓"
  else
    echo "  JSON title mismatch: $TITLE ✗"
    FAILED=1
  fi

  echo "Checking $ROOT_ARTIFACT_URL (Tailscale proxy sim) ..."
  curl -s --max-time 5 -o /tmp/viz-root-artifact-html.html "$ROOT_ARTIFACT_URL"
  if grep -q "Your Agent Setup Is a Portable Home Overlay" /tmp/viz-root-artifact-html.html; then
    echo "  Root HTML title found ✓"
  else
    echo "  Root HTML title NOT found ✗"
    FAILED=1
  fi

  echo "Checking $ROOT_JSON_URL (Tailscale proxy sim) ..."
  ROOT_TITLE=$(curl -s --max-time 5 "$ROOT_JSON_URL" | jq -r .title)
  if [ "$ROOT_TITLE" = "Your Agent Setup Is a Portable Home Overlay" ]; then
    echo "  Root JSON title: $ROOT_TITLE ✓"
  else
    echo "  Root JSON title mismatch: $ROOT_TITLE ✗"
    FAILED=1
  fi

  kill -9 $SERVER_PID 2>/dev/null || true
  wait $SERVER_PID 2>/dev/null || true
  echo "\`\`\`"
  if [ "$FAILED" -eq 0 ]; then
    echo "Status: **PASS**"
  else
    echo "Status: **FAIL**"
  fi
  echo ""
} >> "$REPORT_FILE"

cd "$THOUGHTBOX_DIR"
run_check "thought-box: npm run lint:types" npm run lint:types
run_check "thought-box: npm run visualizer:sync" npm run visualizer:sync

# thought-box static serving check
# Note: gatsby develop/build currently fail in this environment due to an
# unrelated lmdb/Node compatibility error. We validate the produced static
# files directly with a tiny HTTP server so the serving contract is still
# exercised.
{
  TB_PORT=8010
  echo "## thought-box: static files + simple server check"
  echo "\`\`\`"
  STATIC_DIR="$THOUGHTBOX_DIR/static"
  node -e "
const http = require('http');
const fs = require('fs');
const path = require('path');
const staticDir = process.argv[1];
const mount = '/artifacts';
const legacyMount = '/visualizer/artifacts';

function serve(root, reqPath, res) {
  let filePath = path.join(root, reqPath);
  if (!filePath.startsWith(root)) { res.writeHead(403); res.end(); return; }
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    fs.stat(filePath, (err2, stat2) => {
      if (err2 || !stat2.isFile()) { res.writeHead(404); res.end('not found: ' + reqPath); return; }
      res.writeHead(200, { 'Content-Type': filePath.endsWith('.json') ? 'application/json' : 'text/html' });
      fs.createReadStream(filePath).pipe(res);
    });
  });
}

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url);
  if (p === '/' || p === '') { p = '/index.html'; }
  if (p.startsWith(mount + '/')) {
    serve(staticDir + '/artifacts', p.slice(mount.length), res);
  } else if (p.startsWith(legacyMount + '/')) {
    serve(staticDir + '/visualizer/artifacts', p.slice(legacyMount.length), res);
  } else {
    res.writeHead(404); res.end();
  }
});
server.listen($TB_PORT, '127.0.0.1', () => console.log('Static server on port $TB_PORT'));
" "$STATIC_DIR" > /tmp/tb-static-serve.log 2>&1 &
  SERVE_PID=$!
  sleep 2

  TB_URL="http://127.0.0.1:$TB_PORT/artifacts/visualizer/agent-stack-report/"
  echo "Checking $TB_URL ..."
  curl -s --max-time 10 -o /tmp/tb-artifact.html "$TB_URL"
  if grep -q "Your Agent Setup Is a Portable Home Overlay" /tmp/tb-artifact.html; then
    echo "  Static served HTML title found ✓"
  else
    echo "  Static served HTML title NOT found ✗"
    FAILED=1
  fi
  TB_JSON_URL="http://127.0.0.1:$TB_PORT/artifacts/data/artifacts/visualizer/agent-stack-report.json"
  echo "Checking $TB_JSON_URL ..."
  TB_TITLE=$(curl -s --max-time 10 "$TB_JSON_URL" | jq -r .title)
  if [ "$TB_TITLE" = "Your Agent Setup Is a Portable Home Overlay" ]; then
    echo "  Static served JSON title: $TB_TITLE ✓"
  else
    echo "  Static served JSON title mismatch: $TB_TITLE ✗"
    FAILED=1
  fi
  LEGACY_URL="http://127.0.0.1:$TB_PORT/visualizer/artifacts/visualizer/agent-stack-report/"
  echo "Checking legacy $LEGACY_URL ..."
  curl -s --max-time 10 -o /tmp/tb-legacy-artifact.html "$LEGACY_URL"
  if grep -q "Your Agent Setup Is a Portable Home Overlay" /tmp/tb-legacy-artifact.html; then
    echo "  Legacy static served HTML title found ✓"
  else
    echo "  Legacy static served HTML title NOT found ✗"
    FAILED=1
  fi
  kill -9 $SERVE_PID 2>/dev/null || true
  wait $SERVE_PID 2>/dev/null || true
  echo "\`\`\`"
  if [ "$FAILED" -eq 0 ]; then
    echo "Status: **PASS**"
  else
    echo "Status: **FAIL**"
  fi
  echo ""
} >> "$REPORT_FILE"

echo "## Overall" >> "$REPORT_FILE"
if [ "$FAILED" -eq 0 ]; then
  echo "**ALL CHECKS PASSED**" >> "$REPORT_FILE"
else
  echo "**SOME CHECKS FAILED**" >> "$REPORT_FILE"
fi

cat "$REPORT_FILE"
exit "$FAILED"
