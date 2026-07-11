#!/bin/sh
set -eu

BIN="visual-artifact"
DEFAULT_MANIFEST_URL="https://github.com/iurysza/visual-artifact-renderer/releases/latest/download/latest.json"
MANIFEST_URL="${VISUAL_ARTIFACT_MANIFEST_URL:-$DEFAULT_MANIFEST_URL}"
INSTALL_DIR="${VISUAL_ARTIFACT_INSTALL_DIR:-$HOME/.local/bin}"
DATA_DIR="${VISUAL_ARTIFACT_DATA_DIR:-$HOME/.local/share/visual-artifact}"
SKILL_DIR="${VISUAL_ARTIFACT_SKILL_DIR:-$HOME/.agents/skills/visual-artifact}"
PI_AGENT_DIR="$HOME/.pi/agent"
EXTENSION_TARGET="$PI_AGENT_DIR/extensions/visual-artifact.ts"

log() { printf '[install] %s\n' "$*"; }
err() { printf '[install] error: %s\n' "$*" >&2; exit 1; }
warn() { printf '[install] warning: %s\n' "$*" >&2; }

RUNTIME_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --runtime-only) RUNTIME_ONLY=1 ;;
    *) err "unknown option: $arg" ;;
  esac
done

need() {
  command -v "$1" >/dev/null 2>&1 || err "$1 is required"
}

extract_url_from_manifest() {
  target="$1"
  manifest="$2"

  if command -v jq >/dev/null 2>&1; then
    printf '%s\n' "$manifest" | jq -r --arg t "$target" '.assets[$t] // empty'
    return
  fi

  printf '%s\n' "$manifest" | awk -v t="$target" '
    /^[[:space:]]*"assets"[[:space:]]*:/ { in_assets = 1; next }
    in_assets && /^[[:space:]]*}/ { exit }
    in_assets && index($0, "\"" t "\"") {
      sub(/^[[:space:]]*"[^"]*"[[:space:]]*:[[:space:]]*"/, "")
      sub(/".*$/, "")
      sub(/,$/, "")
      print
      exit
    }
  '
}

extract_version_from_manifest() {
  manifest="$1"

  if command -v jq >/dev/null 2>&1; then
    printf '%s\n' "$manifest" | jq -r '.version // empty'
    return
  fi

  printf '%s\n' "$manifest" | awk -F '"' '/^[[:space:]]*"version"[[:space:]]*:/ { print $4; exit }'
}

main() {
  need curl
  need tar
  need uname

  OS="$(uname -s)"
  case "$OS" in
    Linux) os="linux" ;;
    Darwin) os="macos" ;;
    *) err "unsupported OS: $OS" ;;
  esac

  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64|amd64) arch="x86_64" ;;
    aarch64|arm64) arch="aarch64" ;;
    *) err "unsupported architecture: $ARCH" ;;
  esac

  target="${os}-${arch}"
  log "detected ${target}"

  log "fetching release manifest from ${MANIFEST_URL}..."
  manifest="$(curl -fsSL --retry 3 --connect-timeout 10 --max-time 20 "$MANIFEST_URL")" \
    || err "can't reach ${MANIFEST_URL}. Please try again later."

  url="$(extract_url_from_manifest "$target" "$manifest")"
  version="$(extract_version_from_manifest "$manifest")"

  if [ -z "$url" ]; then
    err "release manifest does not include an asset for ${target}"
  fi

  if [ -n "$version" ]; then
    log "downloading ${BIN} v${version} for ${target}..."
  else
    log "downloading ${BIN} for ${target}..."
  fi

  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT

  archive="${tmp}/${BIN}.tar.gz"
  if ! curl -fsSL --retry 3 --connect-timeout 10 --max-time 120 "$url" -o "$archive"; then
    err "download failed from ${url}"
  fi

  log "extracting archive..."
  tar -xzf "$archive" -C "$tmp"

  # The archive contains a single top-level directory like visual-artifact-<version>-<target>/
  pkg=""
  for d in "$tmp"/*/; do
    if [ -d "$d" ]; then
      pkg="$d"
      break
    fi
  done
  [ -n "$pkg" ] || err "could not find extracted package directory"

  bin_src="${pkg}visual-artifact"
  out_src="${pkg}out"
  skill_src="${pkg}skill"
  ext_src="${pkg}pi-extension/visual-artifact.ts"

  [ -f "$bin_src" ] || err "binary not found in archive: ${bin_src}"
  [ -d "$skill_src" ] || err "skill bundle not found in archive: ${skill_src}"

  # Install binary
  mkdir -p "$INSTALL_DIR"
  rm -f "${INSTALL_DIR}/${BIN}"
  cp "$bin_src" "${INSTALL_DIR}/${BIN}"
  chmod +x "${INSTALL_DIR}/${BIN}"
  log "installed binary to ${INSTALL_DIR}/${BIN}"

  # Install app static export
  if [ -d "$out_src" ]; then
    rm -rf "${DATA_DIR}/app/out"
    mkdir -p "$DATA_DIR/app"
    cp -R "$out_src" "${DATA_DIR}/app/out"
    log "installed app static export to ${DATA_DIR}/app/out"
  else
    warn "app static export missing from archive"
  fi

  if [ "$RUNTIME_ONLY" -eq 1 ]; then
    log "runtime-only install; skipped agent skill and Pi extension copies"
  else
    # Install skill bundle, preserving any existing artifacts/
    mkdir -p "$SKILL_DIR"
    for entry in "$SKILL_DIR"/* "$SKILL_DIR"/.[!.]* "$SKILL_DIR"/..?*; do
      [ -e "$entry" ] || continue
      name="${entry##*/}"
      [ "$name" = "artifacts" ] && continue
      rm -rf "$entry"
    done
    cp -R "${skill_src}/"* "$SKILL_DIR/" 2>/dev/null || true
    mkdir -p "${SKILL_DIR}/artifacts"
    log "installed skill bundle to ${SKILL_DIR}"

    # Legacy convenience install. Pi package users should pass --runtime-only.
    if [ -d "$PI_AGENT_DIR" ]; then
      if [ -f "$ext_src" ]; then
        mkdir -p "$PI_AGENT_DIR/extensions"
        rm -f "$EXTENSION_TARGET"
        cp "$ext_src" "$EXTENSION_TARGET"
        log "installed Pi extension to ${EXTENSION_TARGET}"

        # Try to register the extension in Pi settings.json, deduplicating by realpath.
        settings_file="$PI_AGENT_DIR/settings.json"
        if [ -f "$settings_file" ]; then
          registered=0
          if command -v python3 >/dev/null 2>&1; then
            if python3 - "$settings_file" "$EXTENSION_TARGET" <<'PY' 2>/dev/null; then
import json, os, sys
p, ext = sys.argv[1], sys.argv[2]
try:
    ext_rp = os.path.realpath(ext)
except OSError:
    ext_rp = ext
with open(p) as f:
    d = json.load(f)
extensions = d.get("extensions", [])
keep = [e for e in extensions if os.path.realpath(e) != ext_rp]
if ext not in keep:
    keep.append(ext)
    d["extensions"] = keep
    with open(p, "w") as f:
        json.dump(d, f, indent=2)
        f.write("\n")
    sys.exit(0)
sys.exit(1)
PY
              registered=1
            fi
          elif command -v jq >/dev/null 2>&1; then
            if ! jq -e --arg ext "$EXTENSION_TARGET" '.extensions // [] | index($ext)' "$settings_file" >/dev/null 2>&1; then
              jq --arg ext "$EXTENSION_TARGET" '.extensions = ((.extensions // []) + [$ext])' "$settings_file" > "${settings_file}.tmp" && mv "${settings_file}.tmp" "$settings_file"
              registered=1
            fi
          fi
          if [ "$registered" -eq 1 ]; then
            log "registered Pi extension in ${settings_file}"
          fi
        fi

        log "run /reload in Pi, or restart Pi, to load the extension."
      else
        warn "Pi extension missing from archive"
      fi
    else
      log "Pi not detected; skipped Pi extension."
    fi
  fi

  # Write version stamp
  mkdir -p "$DATA_DIR"
  printf '%s\n' "${version:-latest}" > "${DATA_DIR}/VERSION"
  log "wrote version stamp to ${DATA_DIR}/VERSION"

  # Check PATH
  case ":${PATH}:" in
    *":${INSTALL_DIR}:"*) ;;
    *)
      warn "${INSTALL_DIR} is not in your PATH"
      echo "add it to your shell config:"
      echo ""
      echo "  export PATH=\"${INSTALL_DIR}:\$PATH\""
      ;;
  esac

  log "done. run '${BIN} doctor' to verify."
}

main "$@"
