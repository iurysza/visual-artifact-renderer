import { ARTIFACT_DATA_SEGMENT, BASE_PATH } from "@/lib/paths"

const FILE_PROTOCOL_RE = /^file:\/\//i
const ABSOLUTE_URL_RE = /^(https?:)?\/\//i
const DATA_URI_RE = /^data:/i

/**
 * Resolve an image `src` value from an artifact spec into a servable URL.
 *
 * Rules:
 * - Absolute HTTP(S), protocol-relative, and data URIs are passed through unchanged.
 * - `file://` URLs are rejected (they are not portable across machines).
 * - Relative paths are resolved against the artifact's project directory
 *   served at `/artifacts/data/artifacts/<project>/`.
 */
export function resolveArtifactImageSrc(src: string, project: string): string {
  if (FILE_PROTOCOL_RE.test(src)) {
    throw new Error(`image src must not use file:// URLs: ${src}`)
  }

  if (ABSOLUTE_URL_RE.test(src) || DATA_URI_RE.test(src)) {
    return src
  }

  const normalized = src.replace(/^[\/]+/, "")
  return `${BASE_PATH}/${ARTIFACT_DATA_SEGMENT}/${project}/${normalized}`
}
