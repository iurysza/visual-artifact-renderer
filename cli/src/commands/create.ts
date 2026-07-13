import { isAbsolute, relative, resolve, sep } from "node:path"
import { realpath, stat, writeFile } from "node:fs/promises"
import { spawn } from "node:child_process"
import {
  MAX_AGGREGATE_FILE_SOURCE_BYTES,
  MAX_FILE_SOURCE_BYTES,
  RAW_ARTIFACT_MAX_BYTES,
  preflightArtifactSpec,
} from "@agents/visual-artifact-annotations/contract"

import { artifactBaseUrl, ConfigValidationError, loadConfig, localBaseUrl } from "../config.ts"
import { artifactJsonPath, assetsDirPath, bundleDirPath, publishJsonPath } from "../lib/paths.ts"
import { readServerState, serverStateMatchesConfig, serverStatePath } from "../lib/server-lifecycle.ts"
import type { Logger, ResultData } from "../logger.ts"
import { validateSpec, ValidationError } from "../validate.ts"
import { validateMermaidNodes } from "../mermaid.ts"
import { deriveProjectName, ensureDir, readStdinOrFile } from "../util.ts"
import type { GlobalOpts } from "../types.ts"
import { readCloudflareProfile } from "../publish/profile.ts"
import { buildPublishMetadata, loadPublishContext, publishBundle, type PublishResult } from "../publish/cloudflare.ts"

interface CreateOpts extends GlobalOpts {
  project?: string
  dryRun?: boolean
  serve?: boolean
  publish?: string | boolean
  allowRead?: string[]
}

interface CreateDependencies {
  publishBundle: typeof publishBundle
}

const DEFAULT_CREATE_DEPENDENCIES: CreateDependencies = { publishBundle }

async function serverIsRunning(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD" })
    return response.ok
  } catch {
    return false
  }
}

function getServeCommand(): { command: string; args: string[] } {
  const arg0 = process.argv[0] ?? ""
  const scriptPath = process.argv[1]
  // Compiled binaries report argv[0] as the literal string "bun" and the real
  // executable path in process.execPath.
  if (arg0 === "bun") {
    return { command: process.execPath, args: ["serve", "--no-open"] }
  }
  if (scriptPath && (scriptPath.endsWith(".ts") || scriptPath.endsWith(".js"))) {
    return { command: arg0 || process.execPath, args: [scriptPath, "serve", "--no-open"] }
  }
  return { command: arg0 || process.execPath, args: ["serve", "--no-open"] }
}

async function ensureServer(log: Logger, config: ReturnType<typeof loadConfig>): Promise<void> {
  const url = localBaseUrl(config)
  if (await serverIsRunning(url)) {
    const stateResult = await readServerState(serverStatePath(config))
    if (stateResult.ok && serverStateMatchesConfig(stateResult.state, config)) {
      if (config.open) {
        log.log("Renderer already running")
      }
      return
    }

    const activeStore = stateResult.ok ? stateResult.state.artifactsDir : "unknown"
    throw new Error(
      `Renderer at ${url} uses artifact store ${activeStore}; expected ${config.artifactsDir}. ` +
        "Run `visual-artifact serve stop`, then retry.",
    )
  }

  const { command, args } = getServeCommand()
  log.log(`Starting renderer in the background: ${command} ${args.join(" ")}`)
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      VISUAL_ARTIFACT_ARTIFACTS_DIR: config.artifactsDir,
      VISUAL_ARTIFACT_OUT_DIR: config.outDir,
      VISUAL_ARTIFACT_PORT: String(config.port),
      VISUAL_ARTIFACT_HOST: config.host,
      VISUAL_ARTIFACT_DATA_PATH: config.dataPath,
      VISUAL_ARTIFACT_OPEN: "0",
      VISUAL_ARTIFACT_ALLOW_REMOTE: config.allowRemote ? "1" : "0",
    },
  })
  child.unref()

  // Wait a moment for the server to come up.
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 150))
    if (await serverIsRunning(url)) {
      log.log(`Renderer ready at ${url}`)
      return
    }
  }
  log.warn(`Renderer did not become ready at ${url} within 3 seconds`)
}

interface DiskSourceFileMeta {
  displayPath: string
  bytes: number
}

interface DiskSourcesMeta {
  included: boolean
  count: number
  totalBytes: number
  files: DiskSourceFileMeta[]
}

interface SourceReadContext {
  projectRoot: string
  allowRoots: string[]
  log: Logger
  verbose: boolean
}

interface SourceReadResult {
  content: string
  info: DiskSourceFileMeta & { canonicalPath: string }
  newAggregateBytes: number
}

const SOURCE_LIMITS = {
  perFile: MAX_FILE_SOURCE_BYTES,
  aggregate: MAX_AGGREGATE_FILE_SOURCE_BYTES,
}

function hasDotDotSegment(p: string): boolean {
  return p.split(/[/\\]+/).filter(Boolean).includes("..")
}

function isInside(child: string, parent: string): boolean {
  const pathFromParent = relative(parent, child)
  return (
    pathFromParent === "" ||
    (pathFromParent !== ".." && !pathFromParent.startsWith(`..${sep}`) && !isAbsolute(pathFromParent))
  )
}

async function resolveSourcePath(
  src: string,
  projectRoot: string,
  allowRoots: string[],
): Promise<{ intendedRoot: string; canonicalPath: string }> {
  if (hasDotDotSegment(src)) {
    throw new ValidationError(`file-tree src contains a .. segment: ${src}`)
  }

  const isAbs = isAbsolute(src)
  const candidate = isAbs ? resolve(src) : resolve(projectRoot, src)
  let canonicalPath: string
  try {
    canonicalPath = await realpath(candidate)
  } catch {
    throw new ValidationError(`file-tree src could not be read: ${src}`)
  }

  // Absolute syntax is authority-bearing: it requires an explicit grant even
  // when the canonical target happens to be inside the project.
  const allowedRoots = isAbs ? allowRoots : [projectRoot]
  const intendedRoot = allowedRoots
    .filter((root) => isInside(canonicalPath, root))
    .sort((a, b) => b.length - a.length)[0]
  if (!intendedRoot) {
    const reason = isAbs
      ? "absolute file-tree src is outside authorized read roots"
      : "relative file-tree src escapes project root"
    throw new ValidationError(`${reason}: ${src}`)
  }

  return { intendedRoot, canonicalPath }
}

async function readSourceFile(
  src: string,
  context: SourceReadContext,
  aggregateBytes: number,
): Promise<SourceReadResult> {
  const { projectRoot, allowRoots, log, verbose } = context
  const { intendedRoot, canonicalPath } = await resolveSourcePath(src, projectRoot, allowRoots)

  let content: string
  try {
    // Read the canonical target, not the original symlink-bearing path checked
    // above. The bounded helper opens one regular-file handle.
    content = await readStdinOrFile(canonicalPath, SOURCE_LIMITS.perFile)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (verbose) log.debug(`file-tree source read failed at ${canonicalPath}: ${message}`)
    if (message.includes("larger than")) {
      throw new ValidationError(`file-tree src exceeds ${SOURCE_LIMITS.perFile} bytes: ${src}`)
    }
    if (message.includes("not a regular file")) {
      throw new ValidationError(`file-tree src is not a regular file: ${src}`)
    }
    throw new ValidationError(`file-tree src could not be read: ${src}`)
  }
  const bytes = Buffer.byteLength(content, "utf8")
  if (aggregateBytes + bytes > SOURCE_LIMITS.aggregate) {
    throw new ValidationError(
      `file-tree src aggregate bytes would exceed ${SOURCE_LIMITS.aggregate}: ${src} (${bytes} bytes; already ${aggregateBytes})`,
    )
  }

  if (verbose) {
    log.debug(`file-tree source canonical: ${canonicalPath}`)
  }

  const displayPath = relative(intendedRoot, canonicalPath)

  return {
    content,
    info: { displayPath: displayPath || src, canonicalPath, bytes },
    newAggregateBytes: aggregateBytes + bytes,
  }
}

/**
 * Walk a validated spec and expand file-tree `src` paths into inline `content`
 * by reading the referenced file. Explicit `content` wins; `src` is only
 * resolved when `content` is absent. Relative paths must canonicalize inside
 * the project root; absolute paths are denied unless they canonicalize inside
 * an explicit `--allow-read` root. Symlink escapes are rejected. After
 * resolution all create-time `src` fields are stripped from the spec so they
 * are never persisted or published.
 */
async function resolveFileTreeSources(
  spec: unknown,
  context: SourceReadContext,
): Promise<DiskSourcesMeta> {
  const files: (DiskSourceFileMeta & { canonicalPath: string })[] = []
  let aggregateBytes = 0

  const visit = async (node: unknown): Promise<void> => {
    if (!node || typeof node !== "object") return
    const obj = node as Record<string, unknown>

    if (obj.type === "file-tree" && obj.props && typeof obj.props === "object") {
      const propsObj = obj.props as Record<string, unknown>
      const walkItems = async (items: unknown): Promise<void> => {
        if (!Array.isArray(items)) return
        for (const item of items) {
          if (!item || typeof item !== "object") continue
          const itemObj = item as Record<string, unknown>

          if (typeof itemObj.src === "string") {
            if (itemObj.content === undefined) {
              const { content, info, newAggregateBytes } = await readSourceFile(
                itemObj.src,
                context,
                aggregateBytes,
              )
              itemObj.content = content
              aggregateBytes = newAggregateBytes
              files.push(info)
              if (context.verbose) {
                context.log.debug(
                  `file-tree source: ${itemObj.src} -> ${info.displayPath} (${info.bytes} bytes)`,
                )
              }
            }
            delete itemObj.src
          }

          if (Array.isArray(itemObj.children)) await walkItems(itemObj.children)
        }
      }
      await walkItems(propsObj.items)
    }

    if (Array.isArray(obj.children)) {
      for (const child of obj.children) await visit(child)
    }
    if (obj.props && typeof obj.props === "object") {
      const propsObj = obj.props as Record<string, unknown>
      // Kept for hostile legacy input; the strict schema rejects props.children.
      if (Array.isArray(propsObj.children)) {
        for (const child of propsObj.children) await visit(child)
      }
      if ((obj.type === "tabs" || obj.type === "accordion") && Array.isArray(propsObj.items)) {
        for (const item of propsObj.items) {
          if (item && typeof item === "object" && Array.isArray((item as Record<string, unknown>).nodes)) {
            for (const child of (item as Record<string, unknown>).nodes as unknown[]) await visit(child)
          }
        }
      }
    }
  }

  if (spec && typeof spec === "object" && Array.isArray((spec as Record<string, unknown>).nodes)) {
    for (const node of (spec as Record<string, unknown>).nodes as unknown[]) await visit(node)
  }

  return {
    included: files.length > 0,
    count: files.length,
    totalBytes: aggregateBytes,
    files: files.map((f) => ({ displayPath: f.displayPath, bytes: f.bytes })),
  }
}

export async function create(
  inputPath: string | undefined,
  opts: CreateOpts,
  log: Logger,
  dependencies: CreateDependencies = DEFAULT_CREATE_DEPENDENCIES,
): Promise<number> {
  let config
  try {
    config = loadConfig({
      overrides: {
        ...(opts.project !== undefined ? { projectPath: opts.project } : {}),
        ...(opts.allowRemote !== undefined ? { allowRemote: opts.allowRemote } : {}),
      },
    })
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      log.error(error.message)
      return 2
    }
    log.error(error instanceof Error ? error.message : String(error), error)
    return 1
  }

  log.debug(`project path: ${config.projectPath ?? process.cwd()}`)
  log.debug(`artifacts directory: ${config.artifactsDir}`)

  let raw: string
  try {
    raw = await readStdinOrFile(inputPath)
  } catch (error) {
    log.error(error instanceof Error ? error.message : String(error))
    return 2
  }

  let specJson: unknown
  try {
    specJson = JSON.parse(raw)
  } catch (error) {
    log.error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`)
    return 2
  }

  try {
    const spec = validateSpec(specJson)

    // Validate Mermaid diagram content before writing. Structural validation
    // above only checks node shape; this runs the real `mermaid.parse()` so a
    // broken graph fails fast with a clear error instead of rendering blank.
    await validateMermaidNodes(spec)

    const { result: preflight } = preflightArtifactSpec(specJson)
    const totalNodes = preflight.totalNodes
    const datasetCount = spec.data ? Object.keys(spec.data).length : 0

    // Expand file-tree `src` paths into inline `content` before saving.
    const projectPath = config.projectPath ?? resolve(process.cwd())
    let projectRoot: string
    try {
      projectRoot = await realpath(projectPath)
    } catch {
      throw new ValidationError(`Project path could not be resolved: ${projectPath}`)
    }
    const projectStat = await stat(projectRoot).catch(() => undefined)
    if (!projectStat?.isDirectory()) {
      throw new ValidationError(`Project path is not a directory: ${projectRoot}`)
    }

    const allowRoots: string[] = []
    for (const raw of opts.allowRead ?? []) {
      if (hasDotDotSegment(raw)) {
        throw new ValidationError(`--allow-read path contains a .. segment: ${raw}`)
      }
      const resolved = resolve(raw)
      let real: string
      try {
        real = await realpath(resolved)
      } catch {
        throw new ValidationError(`--allow-read path could not be resolved: ${raw}`)
      }
      const rootStat = await stat(real).catch(() => undefined)
      if (!rootStat?.isDirectory()) {
        throw new ValidationError(`--allow-read path is not a directory: ${raw}`)
      }
      allowRoots.push(real)
    }

    if (opts.verbose) {
      log.debug(`project root (canonical): ${projectRoot}`)
      if (allowRoots.length > 0) {
        log.debug(`authorized read roots:${allowRoots.map((r) => `\n  - ${r}`).join("")}`)
      }
    }

    const diskSources = await resolveFileTreeSources(specJson, {
      projectRoot,
      allowRoots,
      log,
      verbose: opts.verbose,
    })
    const safety = { diskSources }

    // Final serialized artifact must fit inside the advertised raw limit, and
    // inlined content must still pass the shared schema.
    const serialized = `${JSON.stringify(specJson as Record<string, unknown>, null, 2)}\n`
    if (Buffer.byteLength(serialized, "utf8") > RAW_ARTIFACT_MAX_BYTES) {
      throw new ValidationError(
        `Final artifact exceeds ${RAW_ARTIFACT_MAX_BYTES} bytes after inlining file-tree sources`,
      )
    }
    const finalSpec = validateSpec(specJson)

    if (opts.dryRun) {
      const result: ResultData = {
        command: "create",
        ok: true,
        dryRun: true,
        slug: finalSpec.slug,
        title: finalSpec.title,
        totalNodes,
        datasetCount,
        safety,
      }
      log.result(result)
      return 0
    }

    const projectName = deriveProjectName(projectPath)
    const bundleDir = bundleDirPath(config.artifactsDir, projectName, finalSpec.slug)
    const filePath = artifactJsonPath(config.artifactsDir, projectName, finalSpec.slug)
    log.debug(`bundle directory: ${bundleDir}`)
    log.debug(`artifact path: ${filePath}`)

    await ensureDir(bundleDir)
    await ensureDir(assetsDirPath(config.artifactsDir, projectName, finalSpec.slug))
    await writeFile(filePath, serialized, "utf8")

    if (opts.serve !== false) {
      await ensureServer(log, config)
    }

    const localUrl = `${artifactBaseUrl(config)}/${projectName}/${finalSpec.slug}/`
    let publishResult: PublishResult | undefined
    let publishProfileName: string | undefined
    let publishMetadataPath: string | undefined

    if (opts.publish !== undefined && opts.publish !== false) {
      if (diskSources.included) {
        log.warn(
          "Publishing artifact that includes disk-sourced content. Review sources before sharing.",
        )
      }
      publishProfileName = typeof opts.publish === "string" ? opts.publish.trim() || "default" : "default"
      const profile = await readCloudflareProfile(publishProfileName)
      if (!profile) {
        throw new Error(
          `No Cloudflare publish profile named "${publishProfileName}". Run \`visual-artifact setup cloudflare\` first.`,
        )
      }
      const context = await loadPublishContext(profile)
      publishResult = {
        ...(await dependencies.publishBundle(context, projectName, finalSpec.slug, bundleDir)),
        localUrl,
      }
      publishMetadataPath = publishJsonPath(config.artifactsDir, projectName, finalSpec.slug)
      const metadata = buildPublishMetadata(context, publishResult, publishProfileName)
      await writeFile(publishMetadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8")
    }

    const url = publishResult?.url ?? localUrl

    const result: ResultData = {
      command: "create",
      ok: true,
      slug: finalSpec.slug,
      projectName,
      projectPath,
      path: filePath,
      bundleDir,
      url,
      localUrl,
      totalNodes,
      datasetCount,
      safety,
    }
    if (publishResult) {
      result.published = {
        provider: "cloudflare",
        profileName: publishProfileName,
        metadataPath: publishMetadataPath,
        remoteObjects: publishResult.remoteObjects,
        remoteUrl: publishResult.url,
      }
    }

    log.result(result)
    return 0
  } catch (error) {
    if (error instanceof ValidationError) {
      log.error(`Validation failed: ${error.message}`)
      return 2
    }
    log.error(error instanceof Error ? error.message : String(error), error)
    return 1
  }
}
