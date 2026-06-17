/**
 * Single source of truth for visualizer URL/path construction.
 *
 * The app is mounted under `basePath: "/artifacts"` in Next.js. Page links
 * must be relative to that basePath (Next.js adds it automatically), while
 * runtime artifact JSON fetches need the full public path. All other code
 * should import helpers from here instead of assembling paths by hand.
 */

export const BASE_PATH = "/artifacts"

export const ARTIFACT_DATA_SEGMENT = "data/artifacts"

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

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
  return `${BASE_PATH}/${ARTIFACT_DATA_SEGMENT}/${segments.join("/")}`
}

/** Absolute public path to an artifact JSON payload. */
export function artifactDataPath(project: string, slug: string): string {
  return publicDataPath([project, `${slug}.json`])
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
 * On the server we return the constant. On the client we prefer the basePath
 * injected by Next.js, then fall back to inferring it from `window.location`.
 * This keeps the fetch URL correct whether the app is served by Next.js dev,
 * the static export server, or another host/proxy.
 */
export function resolveBasePath(): string {
  if (typeof window === "undefined") return BASE_PATH

  const nextData = (window as { __NEXT_DATA__?: { basePath?: string } }).__NEXT_DATA__
  if (nextData?.basePath) return nextData.basePath

  const match = window.location.pathname.match(/^(\/[^/]+)\//)
  return match ? match[1] : BASE_PATH
}

/** Absolute public path to an artifact JSON payload, resolved at runtime. */
export function artifactDataUrl(project: string, slug: string): string {
  return `${resolveBasePath()}/${ARTIFACT_DATA_SEGMENT}/${project}/${slug}.json`
}

/**
 * Extract artifact params from the current browser path.
 *
 * Used by the static server's live fallback shell: when a new artifact was
 * created after the last `pnpm build`, serve.mjs can serve a generic shell at
 * the canonical URL and the client resolves `<project>/<slug>` from the URL.
 */
export function artifactParamsFromPath(pathname: string): ArtifactRouteParams | null {
  let normalized = pathname.split("?")[0]?.split("#")[0] ?? pathname

  if (normalized === BASE_PATH || normalized.startsWith(`${BASE_PATH}/`)) {
    normalized = normalized.slice(BASE_PATH.length) || "/"
  }

  const segments = normalized.split("/").filter(Boolean).map(decodeURIComponent)
  if (segments.length !== 2) return null

  const [project, slug] = segments
  if (!SLUG_RE.test(project) || !SLUG_RE.test(slug)) return null
  if (project === "data" || project === "_next" || project === "live-artifact" || project === "live-project") return null

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
  let normalized = pathname.split("?")[0]?.split("#")[0] ?? pathname

  if (normalized === BASE_PATH || normalized.startsWith(`${BASE_PATH}/`)) {
    normalized = normalized.slice(BASE_PATH.length) || "/"
  }

  const segments = normalized.split("/").filter(Boolean).map(decodeURIComponent)
  if (segments.length !== 1) return null

  const [project] = segments
  if (!SLUG_RE.test(project)) return null
  if (project === "data" || project === "_next" || project === "live-artifact" || project === "live-project") return null

  return { project }
}

/**
 * Full canonical public URL for an artifact page.
 *
 * `baseUrl` is the *root* of the deployment (e.g. `http://localhost:9999` or
 * `https://blog.example.com`). The `/artifacts` basePath is always appended.
 */
export function artifactPageUrl(project: string, slug: string, baseUrl?: string): string {
  const base = (baseUrl ?? "").replace(/\/+$/, "")
  return `${base}${BASE_PATH}/${project}/${slug}/`
}
