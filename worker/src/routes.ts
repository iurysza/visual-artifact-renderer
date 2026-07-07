import { isSafeAssetPath, parseArtifactPath, parseProjectPath } from "./paths.ts"
import { buildHomeIndex, buildProjectIndex } from "./indexes.ts"

export interface Env {
  ASSETS: Fetcher
  BUCKET: R2Bucket
}

const DATA_SEGMENT = "data/artifacts"
const API_SEGMENT = "api/annotations"

const JSON_HEADERS = { "Content-Type": "application/json" }

export async function handleRequest(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url)
  const pathname = url.pathname

  // Data endpoints at root so the same renderer can be mounted locally under
  // `/artifacts` and on Workers.dev at root without path rewriting.
  if (pathname.startsWith(`/${DATA_SEGMENT}/`)) {
    return handleDataRequest(request.method, pathname.slice(`/${DATA_SEGMENT}/`.length), env)
  }

  // Annotation mutation endpoint (read-only in MVP)
  if (pathname.startsWith(`/${API_SEGMENT}/`)) {
    return handleApiRequest(request.method, pathname.slice(`/${API_SEGMENT}/`.length))
  }

  // Static assets and shell fallbacks are served from the Worker's root.
  return handlePageOrAssetRequest(request, env, pathname)
}

async function handleDataRequest(method: string, path: string, env: Env): Promise<Response> {
  if (method !== "GET") {
    return methodNotAllowed()
  }

  if (path === "index.json") {
    const index = await buildHomeIndex(env.BUCKET)
    return jsonResponse(index)
  }

  const segments = path.split("/").filter(Boolean)

  if (segments.length === 2 && segments[1] === "index.json") {
    const parsed = parseProjectPath([segments[0]])
    if (!parsed) return notFound()
    const index = await buildProjectIndex(env.BUCKET, parsed.project)
    return jsonResponse(index)
  }

  if (segments.length === 3 && segments[2] === "artifact.json") {
    const parsed = parseArtifactPath([segments[0], segments[1]])
    if (!parsed) return notFound()
    return getR2Object(env.BUCKET, `artifacts/${parsed.project}/${parsed.slug}/artifact.json`)
  }

  if (segments.length === 3 && segments[2] === "annotations.json") {
    const parsed = parseArtifactPath([segments[0], segments[1]])
    if (!parsed) return notFound()
    return getR2ObjectOrEmptyAnnotations(env.BUCKET, parsed.project, parsed.slug)
  }

  if (segments.length >= 4 && segments[2] === "assets") {
    const parsed = parseArtifactPath([segments[0], segments[1]])
    if (!parsed) return notFound()
    const assetRelative = segments.slice(3).join("/")
    if (!isSafeAssetPath(assetRelative)) return notFound()
    return getR2Object(env.BUCKET, `artifacts/${parsed.project}/${parsed.slug}/assets/${assetRelative}`)
  }

  return notFound()
}

async function handleApiRequest(method: string, path: string): Promise<Response> {
  const segments = path.split("/").filter(Boolean)
  if (segments.length !== 2) return notFound()

  const parsed = parseArtifactPath(segments)
  if (!parsed) return notFound()

  if (method === "POST") {
    return new Response(
      JSON.stringify({ error: "Remote annotation mutations are not implemented in this version." }),
      { status: 501, headers: JSON_HEADERS },
    )
  }

  return methodNotAllowed()
}

async function handlePageOrAssetRequest(request: Request, env: Env, pathname: string): Promise<Response> {
  const segments = pathname.split("/").filter(Boolean)

  // Root index
  if (segments.length === 0) {
    return env.ASSETS.fetch(newShellRequest(request, "/index.html"))
  }

  // Static assets served from the Worker's root. Next.js cloud builds use an
  // empty basePath, so asset links are already root-relative.
  if (segments[0].startsWith("_") || segments[0].includes(".") || segments[0] === "404") {
    return env.ASSETS.fetch(new Request(request.url, request))
  }

  // Project index shell
  if (segments.length === 1) {
    return env.ASSETS.fetch(newShellRequest(request, "/shell-project/"))
  }

  // Artifact page shell
  if (segments.length === 2) {
    return env.ASSETS.fetch(newShellRequest(request, "/shell-artifact/"))
  }

  // Deeper paths are not part of the URL contract
  return notFound()
}

function newShellRequest(request: Request, shellPath: string): Request {
  const url = new URL(request.url)
  const shellUrl = new URL(shellPath, `${url.protocol}//${url.host}`)
  return new Request(shellUrl, request)
}

async function getR2Object(bucket: R2Bucket, key: string): Promise<Response> {
  const object = await bucket.get(key)
  if (!object) return notFound()
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set("etag", object.httpEtag)
  return new Response(object.body, { headers })
}

async function getR2ObjectOrEmptyAnnotations(bucket: R2Bucket, project: string, slug: string): Promise<Response> {
  const key = `artifacts/${project}/${slug}/annotations.json`
  const object = await bucket.get(key)
  if (object) {
    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set("etag", object.httpEtag)
    return new Response(object.body, { headers })
  }
  return jsonResponse({ version: 1, project, slug, threads: [] })
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

function notFound(): Response {
  return new Response("Not Found", { status: 404 })
}

function methodNotAllowed(): Response {
  return new Response("Method Not Allowed", { status: 405 })
}
