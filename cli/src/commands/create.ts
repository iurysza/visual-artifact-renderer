import { resolve, isAbsolute } from "node:path"
import { writeFile, readFile } from "node:fs/promises"
import { spawn } from "node:child_process"
import { RAW_ARTIFACT_MAX_BYTES, preflightArtifactSpec } from "@agents/visual-artifact-annotations/contract"

import { artifactBaseUrl, ConfigValidationError, loadConfig, localBaseUrl } from "../config.ts"
import { artifactJsonPath, assetsDirPath, bundleDirPath, publishJsonPath } from "../lib/paths.ts"
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
}

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
    if (config.open) {
      log.log("Renderer already running")
    }
    return
  }

  const { command, args } = getServeCommand()
  log.log(`Starting renderer in the background: ${command} ${args.join(" ")}`)
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
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

/**
 * Walk a validated spec and expand file-tree `src` paths into inline `content`
 * by reading the referenced file. Explicit `content` wins; `src` is only
 * resolved when `content` is absent. Relative paths resolve against cwd.
 * Throws on missing/unreadable files (hard fail).
 */
async function resolveFileTreeSources(spec: unknown, baseDir: string, log: Logger): Promise<void> {
  const visit = async (node: unknown): Promise<void> => {
    if (!node || typeof node !== "object") return
    const obj = node as Record<string, unknown>

    if (obj.type === "file-tree" && obj.props && typeof obj.props === "object") {
      const walkItems = async (items: unknown): Promise<void> => {
        if (!Array.isArray(items)) return
        for (const item of items) {
          if (!item || typeof item !== "object") continue
          const itemObj = item as Record<string, unknown>
          if (typeof itemObj.src === "string" && itemObj.content === undefined) {
            const filePath = isAbsolute(itemObj.src) ? itemObj.src : resolve(baseDir, itemObj.src)
            try {
              itemObj.content = await readFile(filePath, "utf8")
              log.debug(
                `file-tree source: ${itemObj.src} (${Buffer.byteLength(itemObj.content as string, "utf8")} bytes)`,
              )
            } catch (error) {
              const msg = error instanceof Error ? error.message : String(error)
              throw new ValidationError(
                `file-tree src could not be read: ${itemObj.src} (${filePath}): ${msg}`,
              )
            }
          }
          if (Array.isArray(itemObj.children)) await walkItems(itemObj.children)
        }
      }
      const propsObj = obj.props as Record<string, unknown>
      await walkItems(propsObj.items)
    }

    // Recurse into container nodes.
    if (Array.isArray(obj.children)) {
      for (const child of obj.children) await visit(child)
    }
    // sections/cards/grids nest children under props too.
    if (obj.props && typeof obj.props === "object") {
      const propsObj = obj.props as Record<string, unknown>
      if (Array.isArray(propsObj.children)) {
        for (const child of propsObj.children) await visit(child)
      }
    }
  }

  if (spec && typeof spec === "object" && Array.isArray((spec as Record<string, unknown>).nodes)) {
    for (const node of (spec as Record<string, unknown>).nodes as unknown[]) await visit(node)
  }
}

export async function create(inputPath: string | undefined, opts: CreateOpts, log: Logger): Promise<number> {
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
    await resolveFileTreeSources(specJson, projectPath, log)

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
      publishProfileName = typeof opts.publish === "string" ? opts.publish.trim() || "default" : "default"
      const profile = await readCloudflareProfile(publishProfileName)
      if (!profile) {
        throw new Error(
          `No Cloudflare publish profile named "${publishProfileName}". Run \`visual-artifact setup cloudflare\` first.`,
        )
      }
      const context = await loadPublishContext(profile)
      publishResult = { ...(await publishBundle(context, projectName, finalSpec.slug, bundleDir)), localUrl }
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
