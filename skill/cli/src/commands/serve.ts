import { resolve, join } from "node:path"
import { spawn } from "node:child_process"
import type { Server } from "bun"
import { loadConfig, localBaseUrl } from "../config.ts"
import { artifactJsonPath, assetsDirPath, isInsideArtifactsDir, parseBundleRoute, parseProjectRoute } from "../lib/paths.ts"
import { scanArtifacts, listProjectArtifacts } from "../lib/scan.ts"
import { applyMutations, parseAnnotationMutationsPayload, readAnnotationsDocument, resolveLocalAuthor, writeAnnotationsDocument } from "../lib/annotations.ts"
import type { AnnotationMutations } from "../lib/annotations.ts"
import type { Logger } from "../logger.ts"
import { dirExists, fileExists } from "../util.ts"
import type { Config } from "../types.ts"

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".map": "application/json; charset=utf-8",
}

// Live-fallback shells: static HTML pages served when an artifact exists on disk
// but was created after the last `pnpm build`. The route folders live at
// skill/app/src/app/shell-artifact and shell-project; do not delete them.
const LIVE_ARTIFACT_SHELL = "/shell-artifact"
const LIVE_PROJECT_SHELL = "/shell-project"

function mimeType(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase()
  return MIME_TYPES[ext] ?? "application/octet-stream"
}

function normalizeMountPath(value: string): string {
  value = value.trim()
  if (!value || value === "/") return ""
  if (!value.startsWith("/")) value = `/${value}`
  return value.replace(/\/+$/, "")
}

function stripMountPath(urlPath: string, mountPath: string): string | null {
  if (!mountPath) return urlPath
  if (urlPath === mountPath || urlPath.startsWith(`${mountPath}/`)) {
    return urlPath.slice(mountPath.length) || "/"
  }
  return null
}

export interface ServeOpts {
  port?: number
  host?: string
  open?: boolean
  noOpen?: boolean
  outDir?: string
  artifactsDir?: string
  mountPath?: string
  dataPath?: string
}

export async function serve(opts: ServeOpts, log: Logger): Promise<number> {
  const overrides: Partial<Config> = {}
  if (opts.port !== undefined) overrides.port = opts.port
  if (opts.host !== undefined) overrides.host = opts.host
  if (opts.outDir !== undefined) overrides.outDir = resolve(opts.outDir)
  if (opts.artifactsDir !== undefined) overrides.artifactsDir = resolve(opts.artifactsDir)
  if (opts.mountPath !== undefined) overrides.mountPath = opts.mountPath
  if (opts.dataPath !== undefined) overrides.dataPath = opts.dataPath
  if (opts.noOpen) overrides.open = false
  if (opts.open) overrides.open = true

  const config = loadConfig(overrides)
  const outDir = config.outDir
  const artifactsDir = config.artifactsDir
  const mountPath = normalizeMountPath(config.mountPath)
  const dataPath = normalizeMountPath(config.dataPath) || "/data/artifacts"
  const apiPath = "/api/annotations"

  if (!(await dirExists(outDir))) {
    log.error(`Static export directory missing: ${outDir}`)
    log.error("Build the renderer app with `pnpm build` in skill/app, or set VISUAL_ARTIFACT_OUT_DIR.")
    return 1
  }

  if (!(await dirExists(artifactsDir))) {
    log.warn(`Artifacts directory missing: ${artifactsDir}`)
  }

  Bun.serve({
    port: config.port,
    hostname: config.host,
    async fetch(req) {
      const url = new URL(req.url)
      const pathname = decodeURIComponent(url.pathname)

      if (mountPath && pathname === mountPath) {
        return new Response(null, { status: 302, headers: { Location: `${mountPath}/` } })
      }

      const stripped = stripMountPath(pathname, mountPath)
      if (stripped === null) {
        return new Response("Not found", { status: 404 })
      }

      if (stripped.startsWith(`${apiPath}/`) || stripped === apiPath) {
        return await serveApi(req, stripped, artifactsDir, apiPath)
      }

      if (stripped.startsWith(`${dataPath}/`)) {
        return await serveData(stripped, artifactsDir, dataPath)
      }

      const staticResponse = await serveStatic(stripped, outDir)
      if (staticResponse) return staticResponse

      const indexResponse = await serveDirectoryIndex(stripped, outDir)
      if (indexResponse) return indexResponse

      const liveArtifactResponse = await serveLiveArtifactShell(stripped, artifactsDir, outDir)
      if (liveArtifactResponse) return liveArtifactResponse

      const liveProjectResponse = await serveLiveProjectIndexShell(stripped, artifactsDir, outDir)
      if (liveProjectResponse) return liveProjectResponse

      return await serveFallback(outDir)
    },
  })

  const localUrl = localBaseUrl(config)
  log.success(`Visualizer server running at ${localUrl}`)
  log.log(`  outDir:      ${outDir}`)
  log.log(`  artifacts:   ${artifactsDir}`)

  if (config.open) {
    openBrowser(localUrl)
  }

  await new Promise(() => {
    // keep process alive
  })

  return 0
}

export async function serveApi(req: Request, stripped: string, artifactsDir: string, apiPath: string): Promise<Response> {
  const reqPath = stripped

  if (reqPath === `${apiPath}/author` && req.method === "GET") {
    const author = await resolveLocalAuthor()
    return jsonResponse(JSON.stringify(author, null, 2))
  }

  const mutationMatch = matchMutationRoute(reqPath, apiPath)
  if (mutationMatch && req.method === "POST") {
    const route = parseBundleRoute(mutationMatch.project, mutationMatch.slug)
    if (!route) return badRequest("Invalid project or slug")
    const projectDir = resolve(artifactsDir, route.project)
    if (!isInsideArtifactsDir(projectDir, artifactsDir)) return badRequest("Invalid project or slug")

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return badRequest("Invalid JSON body")
    }

    let mutations: AnnotationMutations
    try {
      mutations = parseAnnotationMutationsPayload(body)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return badRequest(message)
    }

    try {
      const doc = await readAnnotationsDocument(artifactsDir, route)
      const updated = applyMutations(doc, mutations)
      await writeAnnotationsDocument(artifactsDir, route, updated)
      return jsonResponse(JSON.stringify(updated, null, 2))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return jsonResponse(JSON.stringify({ error: message }, null, 2), { status: 500 })
    }
  }

  return notFound()
}

export async function serveData(stripped: string, artifactsDir: string, dataPath: string): Promise<Response> {
  const reqPath = stripped

  if (reqPath === `${dataPath}/index.json`) {
    const { projects, artifacts } = await scanArtifacts(artifactsDir)
    const body = JSON.stringify({ projects, recent: artifacts.slice(0, 3) }, null, 2)
    return jsonResponse(body)
  }

  const projectIndexMatch = matchProjectIndex(reqPath, dataPath)
  if (projectIndexMatch) {
    const route = parseProjectRoute(projectIndexMatch.project)
    if (!route) return notFound()
    const projectDir = resolve(artifactsDir, route.project)
    if (!isInsideArtifactsDir(projectDir, artifactsDir)) return notFound()
    if (!(await dirExists(projectDir))) return notFound()
    const artifacts = await listProjectArtifacts(projectDir)
    const body = JSON.stringify({ project: route.project, artifacts }, null, 2)
    return jsonResponse(body)
  }

  const artifactDataMatch = matchArtifactData(reqPath, dataPath)
  if (artifactDataMatch) {
    const route = parseBundleRoute(artifactDataMatch.project, artifactDataMatch.slug)
    if (!route) return notFound()
    const filePath = artifactJsonPath(artifactsDir, route.project, route.slug)
    if (!isInsideArtifactsDir(filePath, artifactsDir)) return notFound()
    if (!(await fileExists(filePath))) return notFound()
    return new Response(Bun.file(filePath))
  }

  const annotationsMatch = matchAnnotations(reqPath, dataPath)
  if (annotationsMatch) {
    const route = parseBundleRoute(annotationsMatch.project, annotationsMatch.slug)
    if (!route) return notFound()
    const doc = await readAnnotationsDocument(artifactsDir, route)
    return jsonResponse(JSON.stringify(doc, null, 2))
  }

  const assetMatch = matchAsset(reqPath, dataPath)
  if (assetMatch) {
    const route = parseBundleRoute(assetMatch.project, assetMatch.slug)
    if (!route) return notFound()
    if (!isSafeAssetName(assetMatch.fileName)) return notFound()
    const filePath = resolve(assetsDirPath(artifactsDir, route.project, route.slug), assetMatch.fileName)
    if (!isInsideArtifactsDir(filePath, artifactsDir)) return notFound()
    if (!(await fileExists(filePath))) return notFound()
    return new Response(Bun.file(filePath))
  }

  return notFound()
}

function jsonResponse(body: string, init?: ResponseInit): Response {
  return new Response(body, { ...init, headers: { "Content-Type": "application/json; charset=utf-8" } })
}

function notFound(): Response {
  return new Response("Not found", { status: 404 })
}

function badRequest(message: string): Response {
  return jsonResponse(JSON.stringify({ error: message }, null, 2), { status: 400 })
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function matchProjectIndex(reqPath: string, dataPath: string): { project: string } | null {
  const pattern = new RegExp(`^${escapeRegex(dataPath)}/([a-z0-9]+(?:-[a-z0-9]+)*)/index\\.json$`)
  const match = reqPath.match(pattern)
  if (!match) return null
  return { project: match[1] }
}

function matchArtifactData(reqPath: string, dataPath: string): { project: string; slug: string } | null {
  const pattern = new RegExp(
    `^${escapeRegex(dataPath)}/([a-z0-9]+(?:-[a-z0-9]+)*)/([a-z0-9]+(?:-[a-z0-9]+)*)/artifact\\.json$`,
  )
  const match = reqPath.match(pattern)
  if (!match) return null
  return { project: match[1], slug: match[2] }
}

function matchAnnotations(reqPath: string, dataPath: string): { project: string; slug: string } | null {
  const pattern = new RegExp(
    `^${escapeRegex(dataPath)}/([a-z0-9]+(?:-[a-z0-9]+)*)/([a-z0-9]+(?:-[a-z0-9]+)*)/annotations\\.json$`,
  )
  const match = reqPath.match(pattern)
  if (!match) return null
  return { project: match[1], slug: match[2] }
}

function matchAsset(reqPath: string, dataPath: string): { project: string; slug: string; fileName: string } | null {
  const pattern = new RegExp(
    `^${escapeRegex(dataPath)}/([a-z0-9]+(?:-[a-z0-9]+)*)/([a-z0-9]+(?:-[a-z0-9]+)*)/assets/(.+)$`,
  )
  const match = reqPath.match(pattern)
  if (!match) return null
  return { project: match[1], slug: match[2], fileName: match[3] }
}

function matchMutationRoute(reqPath: string, apiPath: string): { project: string; slug: string } | null {
  const pattern = new RegExp(
    `^${escapeRegex(apiPath)}/([a-z0-9]+(?:-[a-z0-9]+)*)/([a-z0-9]+(?:-[a-z0-9]+)*)$`,
  )
  const match = reqPath.match(pattern)
  if (!match) return null
  return { project: match[1], slug: match[2] }
}

function isSafeAssetName(fileName: string): boolean {
  if (fileName === "" || fileName === "." || fileName === "..") return false
  if (fileName.includes("/") || fileName.includes("\\")) return false
  if (fileName.includes("\0")) return false
  if (fileName.startsWith(".")) return false
  return true
}

async function serveStatic(reqPath: string, outDir: string): Promise<Response | null> {
  const safePath = reqPath.replace(/\.{2,}/g, "").replace(/^\/+/, "")
  if (!safePath) return null
  const filePath = join(outDir, safePath)
  if (await fileExists(filePath)) {
    const file = Bun.file(filePath)
    return new Response(file, { headers: { "Content-Type": mimeType(filePath) } })
  }
  return null
}

async function serveDirectoryIndex(reqPath: string, outDir: string): Promise<Response | null> {
  const safePath = reqPath.replace(/\.{2,}/g, "").replace(/^\/+/, "")
  const dirPath = join(outDir, safePath)
  if (await dirExists(dirPath)) {
    const indexPath = join(dirPath, "index.html")
    if (await fileExists(indexPath)) {
      const file = Bun.file(indexPath)
      return new Response(file, { headers: { "Content-Type": "text/html; charset=utf-8" } })
    }
  }
  return null
}

function artifactRouteFromPath(reqPath: string): { project: string; slug: string } | null {
  const segments = reqPath.split("/").filter(Boolean)
  if (segments.length !== 2) return null
  return parseBundleRoute(segments[0], segments[1])
}

function projectIndexRouteFromPath(reqPath: string): { project: string } | null {
  const segments = reqPath.split("/").filter(Boolean)
  if (segments.length !== 1) return null
  return parseProjectRoute(segments[0])
}

async function serveLiveArtifactShell(reqPath: string, artifactsDir: string, outDir: string): Promise<Response | null> {
  const route = artifactRouteFromPath(reqPath)
  if (!route) return null
  const jsonPath = artifactJsonPath(artifactsDir, route.project, route.slug)
  if (!isInsideArtifactsDir(jsonPath, artifactsDir)) return null
  if (!(await fileExists(jsonPath))) return null
  const shellPath = join(outDir, LIVE_ARTIFACT_SHELL, "index.html")
  if (!(await fileExists(shellPath))) return null
  const file = Bun.file(shellPath)
  return new Response(file, { headers: { "Content-Type": "text/html; charset=utf-8" } })
}

async function serveLiveProjectIndexShell(reqPath: string, artifactsDir: string, outDir: string): Promise<Response | null> {
  const route = projectIndexRouteFromPath(reqPath)
  if (!route) return null
  const projectDir = resolve(artifactsDir, route.project)
  if (!isInsideArtifactsDir(projectDir, artifactsDir)) return null
  if (!(await dirExists(projectDir))) return null
  const shellPath = join(outDir, LIVE_PROJECT_SHELL, "index.html")
  if (!(await fileExists(shellPath))) return null
  const file = Bun.file(shellPath)
  return new Response(file, { headers: { "Content-Type": "text/html; charset=utf-8" } })
}

async function serveFallback(outDir: string): Promise<Response> {
  const indexPath = join(outDir, "index.html")
  if (await fileExists(indexPath)) {
    const file = Bun.file(indexPath)
    return new Response(file, { headers: { "Content-Type": "text/html; charset=utf-8" } })
  }
  return new Response("Not found", { status: 404 })
}

function openBrowser(url: string): void {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open"
  const child = spawn(command, [url], { detached: true, stdio: "ignore" })
  child.unref()
}
