import { resolve } from "node:path"
import { writeFile } from "node:fs/promises"
import { spawn } from "node:child_process"
import {
  RAW_ARTIFACT_MAX_BYTES,
  preflightArtifactSpec,
} from "@agents/visual-artifact-annotations/contract"

import { artifactBaseUrl, ConfigValidationError, loadConfig, localBaseUrl } from "../config.ts"
import { artifactJsonPath, assetsDirPath, bundleDirPath, publishJsonPath } from "../lib/paths.ts"
import { createSourceReadContext, readSourceFile, type DiskSourceFileMeta, type SourceReadContext } from "../lib/source-files.ts"
import { readServerState, serverStateMatchesConfig, serverStatePath } from "../lib/server-lifecycle.ts"
import type { Logger, ResultData } from "../logger.ts"
import { validateSpec, ValidationError } from "../validate.ts"
import { validateMermaidNodes } from "../mermaid.ts"
import { extractSourceFacts } from "../source-facts.ts"
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

interface DiskSourcesMeta {
  included: boolean
  count: number
  totalBytes: number
  files: DiskSourceFileMeta[]
}

/**
 * Walk a validated spec and expand supported `src` paths into inline `content`.
 * File-tree items and execution-trace sources share containment rules. File-tree
 * content may override src. Execution traces require src, re-extract ast-grep
 * facts, reject conflicts, then persist verified content without src. Relative
 * paths stay inside the project root; absolute paths require `--allow-read`.
 */
function firstDifference(expected: unknown, actual: unknown, path = "facts"): string | undefined {
  if (Object.is(expected, actual)) return undefined
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual) || expected.length !== actual.length) return path
    for (let index = 0; index < expected.length; index++) {
      const difference = firstDifference(expected[index], actual[index], `${path}[${index}]`)
      if (difference) return difference
    }
    return undefined
  }
  if (expected && actual && typeof expected === "object" && typeof actual === "object") {
    const expectedObject = expected as Record<string, unknown>
    const actualObject = actual as Record<string, unknown>
    const keys = new Set([...Object.keys(expectedObject), ...Object.keys(actualObject)])
    for (const key of [...keys].sort()) {
      const difference = firstDifference(expectedObject[key], actualObject[key], `${path}.${key}`)
      if (difference) return difference
    }
    return undefined
  }
  return path
}

async function resolveDiskSources(
  spec: unknown,
  context: SourceReadContext,
): Promise<DiskSourcesMeta> {
  const files: (DiskSourceFileMeta & { canonicalPath: string })[] = []
  let aggregateBytes = 0

  const inlineSource = async (
    source: Record<string, unknown>,
    label: string,
  ): Promise<void> => {
    if (typeof source.src !== "string") return

    if (source.content === undefined) {
      const { content, info, newAggregateBytes } = await readSourceFile(
        source.src,
        context,
        aggregateBytes,
      )
      source.content = content
      aggregateBytes = newAggregateBytes
      files.push(info)
      if (context.verbose) {
        context.log.debug(
          `${label} source: ${source.src} -> ${info.displayPath} (${info.bytes} bytes)`,
        )
      }
    }
    delete source.src
  }

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

          await inlineSource(itemObj, "file-tree")

          if (Array.isArray(itemObj.children)) await walkItems(itemObj.children)
        }
      }
      await walkItems(propsObj.items)
    }

    if (obj.type === "execution-trace" && obj.props && typeof obj.props === "object") {
      const propsObj = obj.props as Record<string, unknown>
      if (Array.isArray(propsObj.events)) {
        for (const event of propsObj.events) {
          if (!event || typeof event !== "object") continue
          const eventObject = event as Record<string, unknown>
          const source = eventObject.source
          if (!source || typeof source !== "object") continue
          const sourceObject = source as Record<string, unknown>
          const eventId = typeof eventObject.id === "string" ? eventObject.id : "unknown"
          if (typeof sourceObject.src !== "string") {
            throw new ValidationError(
              `execution trace event ${eventId} requires source.src so create can verify repository facts`,
            )
          }

          const suppliedFacts = sourceObject.facts as Record<string, unknown> & {
            span: { startLine: number; endLine: number }
          }
          const { content, info, newAggregateBytes } = await readSourceFile(
            sourceObject.src,
            context,
            aggregateBytes,
          )
          const extracted = extractSourceFacts({
            canonicalPath: info.canonicalPath,
            displayPath: info.displayPath,
            content,
            projectRoot: context.projectRoot,
            startLine: suppliedFacts.span.startLine,
            endLine: suppliedFacts.span.endLine,
          })
          if (extracted.resolution !== "resolved") {
            throw new ValidationError(
              `execution trace event ${eventId} source span is ambiguous; choose a span with one focus`,
            )
          }
          const identityKeys = [
            "span",
            "excerpt",
            "sourceHash",
            "language",
            "syntaxKind",
            "focus",
            "scope",
            "resolution",
          ] as const
          const difference = identityKeys
            .map((key) => firstDifference(suppliedFacts[key], extracted.facts[key], `facts.${key}`))
            .find(Boolean)
          if (difference) {
            throw new ValidationError(
              `execution trace event ${eventId} source facts conflict at ${difference}; rerun trace inspect`,
            )
          }

          sourceObject.content = content
          sourceObject.facts = extracted.facts
          delete sourceObject.src
          aggregateBytes = newAggregateBytes
          files.push(info)
          if (context.verbose) {
            context.log.debug(
              `execution-trace source: ${info.displayPath} (${info.bytes} bytes)`,
            )
          }
        }
      }
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

    // Expand supported `src` paths into inline `content` before saving.
    const projectPath = config.projectPath ?? resolve(process.cwd())
    const sourceContext = await createSourceReadContext(
      projectPath,
      opts.allowRead ?? [],
      log,
      opts.verbose,
    )
    const { projectRoot } = sourceContext
    const diskSources = await resolveDiskSources(specJson, sourceContext)
    const safety = { diskSources }

    // Final serialized artifact must fit inside the advertised raw limit, and
    // inlined content must still pass the shared schema.
    const serialized = `${JSON.stringify(specJson as Record<string, unknown>, null, 2)}\n`
    if (Buffer.byteLength(serialized, "utf8") > RAW_ARTIFACT_MAX_BYTES) {
      throw new ValidationError(
        `Final artifact exceeds ${RAW_ARTIFACT_MAX_BYTES} bytes after inlining disk sources`,
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
