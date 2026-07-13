#!/bin/sh
set -eu

BIN="visual-artifact"
DEFAULT_MANIFEST_URL="https://github.com/iurysza/visual-artifact-renderer/releases/latest/download/latest.json"
MANIFEST_URL="${VISUAL_ARTIFACT_MANIFEST_URL:-$DEFAULT_MANIFEST_URL}"
INSTALL_DIR="${VISUAL_ARTIFACT_INSTALL_DIR:-$HOME/.local/bin}"
DATA_DIR="${VISUAL_ARTIFACT_DATA_DIR:-$HOME/.local/share/visual-artifact}"
ARTIFACTS_DIR="${VISUAL_ARTIFACT_ARTIFACTS_DIR:-$HOME/.agents/skills/visual-artifact/artifacts}"

log() { printf '[install] %s\n' "$*"; }
err() { printf '[install] error: %s\n' "$*" >&2; exit 1; }
warn() { printf '[install] warning: %s\n' "$*" >&2; }

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

  [ -f "$bin_src" ] || err "binary not found in archive: ${bin_src}"
  chmod +x "$bin_src"

  if [ -x "${INSTALL_DIR}/${BIN}" ]; then
    "${INSTALL_DIR}/${BIN}" --quiet --json serve stop >/dev/null \
      || err "could not stop the existing renderer; no artifacts or runtime files were changed"
  fi

  mkdir -p "$ARTIFACTS_DIR"

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

  # Write version stamp
  mkdir -p "$DATA_DIR"
  printf '%s\n' "${version:-latest}" > "${DATA_DIR}/VERSION"
  log "wrote version stamp to ${DATA_DIR}/VERSION"

  log "artifact store at ${ARTIFACTS_DIR}"

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
