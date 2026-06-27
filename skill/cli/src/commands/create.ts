import { dirname, resolve } from "node:path"
import { writeFile } from "node:fs/promises"
import { spawn } from "node:child_process"
import { artifactBaseUrl, loadConfig, localBaseUrl } from "../config.ts"
import { loadContract } from "../contract.ts"
import type { Logger } from "../logger.ts"
import { validateSpec, ValidationError } from "../validate.ts"
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

    if (opts.dryRun) {
      log.output({ ok: true, slug: spec.slug, title: spec.title, message: "Spec is valid" })
      return 0
    }

    const config = loadConfig()
    const projectPath = opts.project ? resolve(opts.project) : resolve(process.cwd())
    const projectName = deriveProjectName(projectPath)
    const filePath = resolve(config.artifactsDir, projectName, `${spec.slug}.json`)

    await ensureDir(dirname(filePath))
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
        url,
      })
    } else if (opts.plain) {
      log.outputText(filePath)
    } else {
      log.success(`Created visual artifact ${spec.slug} in project ${projectName}`)
      log.log(`  path: ${filePath}`)
      log.log(`  url:  ${url}`)
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
