/**
 * Single source of truth for visualizer URL/path construction.
 *
 * The app is served from the URL root. Page links are root-relative; runtime
 * artifact JSON fetches use the full public path. All other code should import
 * helpers from here instead of assembling paths by hand.
 */

export const BASE_PATH = ""

export const ARTIFACT_DATA_SEGMENT = "data/artifacts"

export const ANNOTATION_API_SEGMENT = "api/annotations"

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Root path segments reserved by the runtime. Project/slug names must not collide. */
export const ROOT_RESERVED_SEGMENTS = [
  "artifacts",
  "data",
  "api",
  "_next",
  "shell-artifact",
  "shell-project",
] as const

/** True when `segment` is reserved for a runtime namespace and cannot be a project or slug. */
export function isReservedRootSegment(segment: string): boolean {
  return (ROOT_RESERVED_SEGMENTS as readonly string[]).includes(segment)
}

export interface ArtifactRouteParams {
  project: string
  slug: string
}

/** Page path relative to the Next.js basePath, with trailing slash. */
export function artifactPagePath(project: string, slug: string): string {
  return `/${project}/${slug}/`
}

/** Project index page path relative to the Next.js basePath, with trailing slash. */
export function projectPagePath(project: string): string {
  return `/${project}/`
}

/** Join the base path and data segment for an absolute public artifact JSON path. */
function publicDataPath(segments: string[]): string {
  return `/${ARTIFACT_DATA_SEGMENT}/${segments.join("/")}`
}

/** Absolute public path to a bundled artifact JSON payload. */
export function artifactDataPath(project: string, slug: string): string {
  return publicDataPath([project, slug, "artifact.json"])
}

/** Absolute public path to a bundled annotation JSON payload. */
export function artifactAnnotationsPath(project: string, slug: string): string {
  return publicDataPath([project, slug, "annotations.json"])
}

/** Absolute public path to the live home index JSON. */
export function artifactIndexPath(): string {
  return publicDataPath(["index.json"])
}

/** Absolute public path to the live project index JSON. */
export function projectIndexPath(project: string): string {
  return publicDataPath([project, "index.json"])
}

/**
 * Resolve the deployment base path at runtime.
 *
 * The app is always served from root, so this returns an empty string. It is
 * kept for compatibility with existing callers.
 */
export function resolveBasePath(): string {
  return ""
}

/** Absolute public URL to the live home index JSON, resolved at runtime. */
export function artifactIndexUrl(): string {
  return `${resolveBasePath()}/${ARTIFACT_DATA_SEGMENT}/index.json`
}

/** Absolute public URL to the live project index JSON, resolved at runtime. */
export function projectIndexUrl(project: string): string {
  return `${resolveBasePath()}/${ARTIFACT_DATA_SEGMENT}/${project}/index.json`
}

/** Absolute public URL to a bundled artifact JSON payload, resolved at runtime. */
export function artifactDataUrl(project: string, slug: string): string {
  return `${resolveBasePath()}/${ARTIFACT_DATA_SEGMENT}/${project}/${slug}/artifact.json`
}

/** Absolute public URL to a bundled annotation JSON payload, resolved at runtime. */
export function artifactAnnotationsUrl(project: string, slug: string): string {
  return `${resolveBasePath()}/${ARTIFACT_DATA_SEGMENT}/${project}/${slug}/annotations.json`
}

/** Absolute public URL to the annotation mutations API, resolved at runtime. */
export function artifactAnnotationsApiUrl(project: string, slug: string): string {
  return `${resolveBasePath()}/${ANNOTATION_API_SEGMENT}/${project}/${slug}`
}

/** Absolute public URL to the local author endpoint, resolved at runtime. */
export function artifactAnnotationsAuthorUrl(): string {
  return `${resolveBasePath()}/${ANNOTATION_API_SEGMENT}/author`
}

/**
 * Extract artifact params from the current browser path.
 *
 * Used by the static server's live fallback shell: when a new artifact was
 * created after the last `pnpm build`, serve.mjs can serve a generic shell at
 * the canonical URL and the client resolves `<project>/<slug>` from the URL.
 */
export function artifactParamsFromPath(pathname: string): ArtifactRouteParams | null {
  const normalized = pathname.split("?")[0]?.split("#")[0] ?? pathname

  const segments = normalized.split("/").filter(Boolean).map(decodeURIComponent)
  if (segments.length !== 2) return null

  const [project, slug] = segments
  if (!SLUG_RE.test(project) || !SLUG_RE.test(slug)) return null
  if (isReservedRootSegment(project) || isReservedRootSegment(slug)) return null

  return { project, slug }
}

/**
 * Extract a project slug from the current browser path.
 *
 * Used by the static server's live project-index fallback shell: when a new
 * project was created after the last `pnpm build`, serve.mjs can serve a
 * generic shell at the canonical URL and the client resolves the project name
 * from the URL.
 */
export function projectParamsFromPath(pathname: string): { project: string } | null {
  const normalized = pathname.split("?")[0]?.split("#")[0] ?? pathname

  const segments = normalized.split("/").filter(Boolean).map(decodeURIComponent)
  if (segments.length !== 1) return null

  const [project] = segments
  if (!SLUG_RE.test(project)) return null
  if (isReservedRootSegment(project)) return null

  return { project }
}

/**
 * Full canonical public URL for an artifact page.
 *
 * `baseUrl` is the *root* of the deployment (e.g. `http://localhost:9999` or
 * `https://blog.example.com`).
 */
export function artifactPageUrl(project: string, slug: string, baseUrl?: string): string {
  const base = (baseUrl ?? "").replace(/\/+$/, "")
  return `${base}/${project}/${slug}/`
}
