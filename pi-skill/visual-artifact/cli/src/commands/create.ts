import { dirname, resolve } from "node:path"
import { writeFile } from "node:fs/promises"
import { loadConfig, localBaseUrl } from "../config.ts"
import { loadContract } from "../contract.ts"
import type { Logger } from "../logger.ts"
import { validateSpec, ValidationError } from "../validate.ts"
import { deriveProjectName, ensureDir, readStdinOrFile } from "../util.ts"
import type { GlobalOpts } from "../types.ts"

interface CreateOpts extends GlobalOpts {
  project?: string
  contract?: string
  dryRun?: boolean
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

    const url = `${localBaseUrl(config)}/${projectName}/${spec.slug}/`

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
