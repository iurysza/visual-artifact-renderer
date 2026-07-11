import { execSync, spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { ConfigValidationError, loadConfig } from "../config.ts"
import type { Logger, ResultData } from "../logger.ts"

function commandExists(cmd: string): boolean {
  try {
    execSync(`command -v ${cmd}`, { stdio: "ignore", timeout: 3000 })
    return true
  } catch {
    return false
  }
}

function isProjectRoot(path: string): boolean {
  return (
    existsSync(resolve(path, "app")) &&
    existsSync(resolve(path, "cli")) &&
    existsSync(resolve(path, "shared")) &&
    existsSync(resolve(path, "skill", "SKILL.md"))
  )
}

function findProjectRootFromScript(): string | null {
  // Search upward from cwd and from this script's location for the development
  // source tree. The runtime packages (app, cli, shared) live at the repo root;
  // skill metadata lives under `skill/`.
  const startingPoints = [process.cwd(), dirname(fileURLToPath(import.meta.url))]
  for (const start of startingPoints) {
    let dir = start
    for (let i = 0; i < 6; i++) {
      if (isProjectRoot(dir)) return dir
      const parent = resolve(dir, "..")
      if (parent === dir) break
      dir = parent
    }
  }
  return null
}

function run(log: Logger, cmd: string, args: string[], cwd: string): number {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: "pipe",
    env: process.env,
    encoding: "utf8",
  })
  if (typeof result.stdout === "string") log.rawDiagnostic(result.stdout)
  if (typeof result.stderr === "string") log.rawDiagnostic(result.stderr)
  return result.status ?? 1
}

export async function bootstrap(opts: { dryRun?: boolean }, log: Logger): Promise<number> {
  try {
    loadConfig()
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      log.error(error.message)
      return 2
    }
    log.error(error instanceof Error ? error.message : String(error), error)
    return 1
  }

  // Bootstrap must build from the development source tree, not from the
  // installed skill target which only contains SKILL.md + artifacts/.
  const projectRoot = findProjectRootFromScript()
  if (!projectRoot) {
    log.error("Could not find visual-artifact development source (app/ + cli/ + shared/ + skill/SKILL.md). Run this command from inside the visualizer repo.")
    return 1
  }

  const appDir = resolve(projectRoot, "app")
  const cliDir = resolve(projectRoot, "cli")
  const sharedDir = resolve(projectRoot, "shared")
  const outDir = resolve(appDir, "out")
  const distBinary = resolve(cliDir, "dist", "visual-artifact")
  const home = homedir()
  const binPath = resolve(home, ".local", "bin", "visual-artifact")

  const hasBun = commandExists("bun")
  const hasPnpm = commandExists("pnpm")
  const appOutExists = existsSync(outDir)
  const binaryExists = existsSync(distBinary)
  const installed = existsSync(binPath)

  if (opts.dryRun) {
    const checks = [
      { prerequisite: "bun", ok: hasBun, message: hasBun ? "found" : "bun not found in PATH" },
      { prerequisite: "pnpm", ok: hasPnpm, message: hasPnpm ? "found" : "pnpm not found in PATH" },
    ]
    const result: ResultData = {
      command: "bootstrap",
      dryRun: true,
      projectRoot,
      hasBun,
      hasPnpm,
      appOutExists,
      binaryExists,
      installed,
      checks,
      plan: [
        hasPnpm ? "pnpm install in app" : "skip: pnpm not found",
        hasPnpm ? "pnpm build in app" : "skip: pnpm not found",
        hasBun ? "bun install in shared" : "skip: bun not found",
        hasBun ? "bun install in cli" : "skip: bun not found",
        hasBun ? "bun run build in cli" : "skip: bun not found",
        hasBun ? "bun run install:binary in cli (CLI to ~/.local/bin and renderer to ~/.local/share/visual-artifact)" : "skip: bun not found",
      ],
    }
    log.result(result)
    return hasBun && hasPnpm ? 0 : 1
  }

  if (!hasBun) {
    log.error("bun is required to build the visual-artifact CLI")
    return 1
  }
  if (!hasPnpm) {
    log.error("pnpm is required to build the visual-artifact renderer")
    return 1
  }

  log.info(`Bootstrapping visual-artifact from ${projectRoot}`)

  let rc = run(log, "pnpm", ["install"], appDir)
  if (rc !== 0) {
    log.error("renderer dependency install failed")
    return 1
  }

  rc = run(log, "pnpm", ["build"], appDir)
  if (rc !== 0) {
    log.error("renderer build failed")
    return 1
  }

  rc = run(log, "bun", ["install"], sharedDir)
  if (rc !== 0) {
    log.error("shared dependency install failed")
    return 1
  }

  rc = run(log, "bun", ["install"], cliDir)
  if (rc !== 0) {
    log.error("CLI dependency install failed")
    return 1
  }

  rc = run(log, "bun", ["run", "build"], cliDir)
  if (rc !== 0) {
    log.error("CLI build failed")
    return 1
  }

  rc = run(log, "bun", ["run", "install:binary"], cliDir)
  if (rc !== 0) {
    log.error("CLI binary install failed")
    return 1
  }

  const result: ResultData = { command: "bootstrap", binaryPath: binPath }
  log.result(result)
  return 0
}
