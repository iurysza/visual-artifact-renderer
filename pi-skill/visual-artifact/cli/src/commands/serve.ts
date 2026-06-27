import { resolve, join } from "node:path"
import { readdir, stat, readFile } from "node:fs/promises"
import { spawn } from "node:child_process"
import type { Server } from "bun"
import { loadConfig, localBaseUrl } from "../config.ts"
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

const ROUTE_SEGMENT_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const LIVE_ARTIFACT_SHELL = "/live-artifact"
const LIVE_PROJECT_SHELL = "/live-project"

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
  return urlPath
}

async function scanArtifacts(artifactsDir: string) {
  const projects: { name: string; artifactCount: number; lastModifiedAt: string }[] = []
  const allArtifacts: { slug: string; title?: string; description?: string; modifiedAt: string; project: string }[] = []

  try {
    const entries = await readdir(artifactsDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const projectDir = join(artifactsDir, entry.name)
      const files = await readdir(projectDir, { withFileTypes: true })
      const projectArtifacts: { slug: string; title?: string; description?: string; modifiedAt: string }[] = []

      for (const file of files) {
        if (!file.isFile() || !file.name.endsWith(".json")) continue

        const slug = file.name.replace(/\.json$/, "")
        if (!ROUTE_SEGMENT_RE.test(slug)) continue
        if (slug === entry.name) continue

        const filePath = join(projectDir, file.name)
        const stats = await stat(filePath)
        const meta = await readArtifactMeta(filePath)

        const artifact = {
          slug,
          title: meta.title,
          description: meta.description,
          modifiedAt: stats.mtime.toISOString(),
        }
        projectArtifacts.push(artifact)
        allArtifacts.push({ ...artifact, project: entry.name })
      }

      if (projectArtifacts.length === 0) continue

      projectArtifacts.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
      const lastModifiedAt = projectArtifacts[0].modifiedAt

      projects.push({
        name: entry.name,
        artifactCount: projectArtifacts.length,
        lastModifiedAt,
      })
    }
  } catch (error: any) {
    if (error.code !== "ENOENT") throw error
  }

  projects.sort((a, b) => new Date(b.lastModifiedAt).getTime() - new Date(a.lastModifiedAt).getTime())
  allArtifacts.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())

  return { projects, artifacts: allArtifacts }
}

async function readArtifactMeta(filePath: string): Promise<{ title?: string; description?: string }> {
  try {
    const raw = await readFile(filePath, "utf8")
    const parsed = JSON.parse(raw)
    return {
      title: typeof parsed.title === "string" && parsed.title.length > 0 ? parsed.title : undefined,
      description: typeof parsed.description === "string" && parsed.description.length > 0 ? parsed.description : undefined,
    }
  } catch {
    return {}
  }
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

  if (!(await dirExists(outDir))) {
    log.error(`Static export directory missing: ${outDir}`)
    log.error("Run the install step that copies the renderer assets, or set VISUAL_ARTIFACT_OUT_DIR.")
    return 1
  }

  if (!(await dirExists(artifactsDir))) {
    log.warn(`Artifacts directory missing: ${artifactsDir}`)
  }

  const server = Bun.serve({
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

      if (stripped.startsWith("/data/artifacts/")) {
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

async function serveData(reqPath: string, artifactsDir: string, dataPath: string): Promise<Response> {
  if (reqPath === `${dataPath}/index.json`) {
    const { projects, artifacts } = await scanArtifacts(artifactsDir)
    const body = JSON.stringify({ projects, recent: artifacts.slice(0, 3) }, null, 2)
    return new Response(body, { headers: { "Content-Type": "application/json; charset=utf-8" } })
  }

  const prefix = `${dataPath}/`
  if (reqPath.startsWith(prefix) && reqPath.endsWith("/index.json")) {
    const relative = reqPath.slice(prefix.length).replace(/\/index\.json$/, "")
    if (!ROUTE_SEGMENT_RE.test(relative)) {
      return new Response("Not found", { status: 404 })
    }
    const projectDir = resolve(artifactsDir, relative)
    if (!projectDir.startsWith(resolve(artifactsDir) + "/")) {
      return new Response("Not found", { status: 404 })
    }
    const artifacts = await listProjectArtifacts(projectDir)
    const body = JSON.stringify({ project: relative, artifacts }, null, 2)
    return new Response(body, { headers: { "Content-Type": "application/json; charset=utf-8" } })
  }

  const prefix2 = `${dataPath}/`
  if (reqPath.startsWith(prefix2)) {
    const relative = reqPath.slice(prefix2.length).replace(/^(\.\.\/)+/, "").replace(/^\.\.$/, "")
    const filePath = resolve(artifactsDir, relative)
    const resolvedArtifactsDir = resolve(artifactsDir)
    if (!filePath.startsWith(resolvedArtifactsDir + "/") && filePath !== resolvedArtifactsDir) {
      return new Response("Not found", { status: 404 })
    }
    if (await fileExists(filePath)) {
      const file = Bun.file(filePath)
      return new Response(file)
    }
  }

  return new Response("Artifact not found", { status: 404 })
}

async function listProjectArtifacts(projectDir: string) {
  const artifacts: { slug: string; title?: string; description?: string; modifiedAt: string }[] = []
  try {
    const files = await readdir(projectDir, { withFileTypes: true })
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith(".json")) continue
      const slug = file.name.replace(/\.json$/, "")
      if (!ROUTE_SEGMENT_RE.test(slug)) continue
      const filePath = join(projectDir, file.name)
      const stats = await stat(filePath)
      const meta = await readArtifactMeta(filePath)
      artifacts.push({ slug, title: meta.title, description: meta.description, modifiedAt: stats.mtime.toISOString() })
    }
  } catch (error: any) {
    if (error.code !== "ENOENT") throw error
  }
  artifacts.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
  return artifacts
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
  const [project, slug] = segments
  if (!ROUTE_SEGMENT_RE.test(project) || !ROUTE_SEGMENT_RE.test(slug)) return null
  if (["data", "_next", "live-artifact", "live-project"].includes(project)) return null
  return { project, slug }
}

function projectIndexRouteFromPath(reqPath: string): { project: string } | null {
  const segments = reqPath.split("/").filter(Boolean)
  if (segments.length !== 1) return null
  const [project] = segments
  if (!ROUTE_SEGMENT_RE.test(project)) return null
  if (["data", "_next", "live-artifact", "live-project"].includes(project)) return null
  return { project }
}

async function serveLiveArtifactShell(reqPath: string, artifactsDir: string, outDir: string): Promise<Response | null> {
  const route = artifactRouteFromPath(reqPath)
  if (!route) return null
  const jsonPath = resolve(artifactsDir, route.project, `${route.slug}.json`)
  if (!jsonPath.startsWith(resolve(artifactsDir) + "/")) return null
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
  if (!projectDir.startsWith(resolve(artifactsDir) + "/")) return null
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
