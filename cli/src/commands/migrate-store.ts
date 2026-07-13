import { homedir } from "node:os"
import { resolve } from "node:path"

import { ConfigValidationError, loadConfig, localBaseUrl, resolveFsPath } from "../config.ts"
import { migrateArtifactStores } from "../lib/artifact-store-migration.ts"
import type { Logger, ResultData } from "../logger.ts"

export interface MigrateStoreOpts {
  from?: string[]
  to?: string
}

export async function migrateStore(opts: MigrateStoreOpts, log: Logger): Promise<number> {
  let config
  try {
    config = loadConfig({
      overrides: opts.to ? { artifactsDir: resolveFsPath(opts.to, () => "") } : undefined,
    })
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      log.error(error.message)
      return 2
    }
    throw error
  }

  try {
    const response = await fetch(localBaseUrl(config), { method: "HEAD" })
    if (response.ok) {
      log.error(`Renderer is running at ${localBaseUrl(config)}; stop it before migrating artifact stores`)
      return 1
    }
  } catch {
    // No renderer is listening; migration can proceed.
  }

  const sources = opts.from?.length
    ? opts.from.map((source) => resolveFsPath(source, () => ""))
    : [resolve(homedir(), ".local", "share", "visual-artifact", "artifacts")]
  const migration = await migrateArtifactStores({
    sources,
    target: config.artifactsDir,
    keepSource: true,
  })

  const result: ResultData = { command: "migrate-store", ...migration }
  log.result(result)
  return 0
}
