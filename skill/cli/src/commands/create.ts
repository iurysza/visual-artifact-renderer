import { resolve, isAbsolute } from "node:path"
import { writeFile, readFile } from "node:fs/promises"
import { spawn } from "node:child_process"
import { artifactBaseUrl, loadConfig, localBaseUrl } from "../config.ts"
import { artifactJsonPath, assetsDirPath, bundleDirPath } from "../lib/paths.ts"
import { loadContract } from "../contract.ts"
import type { Logger } from "../logger.ts"
import { validateSpec, ValidationError } from "../validate.ts"
import { validateMermaidNodes } from "../mermaid.ts"
import { deriveProjectName, ensureDir, readStdinOrFile } from "../util.ts"
import type { GlobalOpts } from "../types.ts"

interface CreateOpts extends GlobalOpts {
  project?: string
  contract?: string
  dryRun?: boolean
  serve?: boolean
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

async function ensureServer(log: Logger): Promise<void> {
  const config = loadConfig()
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
async function resolveFileTreeSources(spec: unknown, baseDir: string): Promise<void> {
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

  let contractPath: string | undefined
  try {
    contractPath = opts.contract
      ? resolve(opts.contract)
      : undefined
    const contract = await loadContract(contractPath)
    const spec = validateSpec(specJson, contract)

    // Validate Mermaid diagram content before writing. Structural validation
    // above only checks node shape; this runs the real `mermaid.parse()` so a
    // broken graph fails fast with a clear error instead of rendering blank.
    await validateMermaidNodes(spec)

    // Expand file-tree `src` paths into inline `content` before saving.
    const projectPath = opts.project ? resolve(opts.project) : resolve(process.cwd())
    await resolveFileTreeSources(specJson, projectPath)

    if (opts.dryRun) {
      log.output({ ok: true, slug: spec.slug, title: spec.title, message: "Spec is valid" })
      return 0
    }

    const config = loadConfig()
    const projectName = deriveProjectName(projectPath)
    const bundleDir = bundleDirPath(config.artifactsDir, projectName, spec.slug)
    const filePath = artifactJsonPath(config.artifactsDir, projectName, spec.slug)

    await ensureDir(bundleDir)
    await ensureDir(assetsDirPath(config.artifactsDir, projectName, spec.slug))
    await writeFile(filePath, `${JSON.stringify(spec, null, 2)}\n`, "utf8")

    if (opts.serve !== false) {
      await ensureServer(log)
    }

    const url = `${artifactBaseUrl(config)}/${projectName}/${spec.slug}/`

    if (opts.json) {
      log.output({
        ok: true,
        slug: spec.slug,
        projectName,
        projectPath,
        path: filePath,
        bundleDir,
        url,
      })
    } else if (opts.plain) {
      log.outputText(filePath)
    } else {
      log.success(`Created visual artifact ${spec.slug} in project ${projectName}`)
      log.log(`  bundle: ${bundleDir}`)
      log.log(`  path:   ${filePath}`)
      log.log(`  url:    ${url}`)
    }

    return 0
  } catch (error) {
    if (error instanceof ValidationError) {
      log.error(`Validation failed: ${error.message}`)
      return 2
    }
    log.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}
