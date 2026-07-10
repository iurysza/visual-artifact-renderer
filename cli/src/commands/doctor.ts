import { execSync } from "node:child_process"
import { homedir } from "node:os"
import { resolve } from "node:path"
import { ConfigValidationError, loadConfig, localBaseUrl } from "../config.ts"
import { loadContract } from "../contract.ts"
import type { Logger, ResultData } from "../logger.ts"
import { dirExists, fileExists } from "../util.ts"

export async function doctor(log: Logger): Promise<number> {
  let config
  try {
    config = loadConfig()
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      log.error(error.message)
      return 2
    }
    log.error(error instanceof Error ? error.message : String(error), error)
    return 1
  }

  const results: { check: string; ok: boolean; message?: string }[] = []
  let fail = false

  const outDirOk = await dirExists(config.outDir)
  results.push({ check: "out-dir", ok: outDirOk, message: outDirOk ? config.outDir : `missing: ${config.outDir}` })
  if (!outDirOk) fail = true

  const artifactsDirOk = await dirExists(config.artifactsDir)
  results.push({ check: "artifacts-dir", ok: artifactsDirOk, message: artifactsDirOk ? config.artifactsDir : `missing: ${config.artifactsDir}` })

  try {
    await loadContract(config.contractPath)
    results.push({ check: "contract", ok: true })
  } catch (error) {
    results.push({ check: "contract", ok: false, message: error instanceof Error ? error.message : String(error) })
    fail = true
  }

  const url = localBaseUrl(config)
  try {
    const response = await fetch(url, { method: "HEAD" })
    results.push({ check: "server", ok: response.ok, message: url })
  } catch {
    results.push({ check: "server", ok: false, message: `not running at ${url}` })
  }

  try {
    execSync("bun --version", { encoding: "utf8", timeout: 3000 })
    results.push({ check: "bun", ok: true })
  } catch {
    results.push({ check: "bun", ok: false, message: "bun not found in PATH" })
    fail = true
  }

  try {
    execSync("pnpm --version", { encoding: "utf8", timeout: 3000 })
    results.push({ check: "pnpm", ok: true })
  } catch {
    results.push({ check: "pnpm", ok: false, message: "pnpm not found in PATH" })
    fail = true
  }

  const binaryPath = resolve(homedir(), ".local", "bin", "visual-artifact")
  const binaryOk = await fileExists(binaryPath)
  results.push({ check: "binary", ok: binaryOk, message: binaryOk ? binaryPath : `missing: ${binaryPath}` })
  if (!binaryOk) fail = true

  const result: ResultData = { command: "doctor", ok: !fail, checks: results }
  log.result(result)
  return fail ? 1 : 0
}
