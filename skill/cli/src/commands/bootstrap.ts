import { execSync, spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { resolve } from "node:path"
import { findSkillRoot } from "../config.ts"
import type { Logger } from "../logger.ts"

function commandExists(cmd: string): boolean {
  try {
    execSync(`command -v ${cmd}`, { stdio: "ignore", timeout: 3000 })
    return true
  } catch {
    return false
  }
}

function run(cmd: string, args: string[], cwd: string): number {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    env: process.env,
  })
  return result.status ?? 1
}

export async function bootstrap(opts: { dryRun?: boolean }, log: Logger): Promise<number> {
  const skillRoot = findSkillRoot()
  if (!skillRoot) {
    log.error("Could not find skill root (SKILL.md). Run this command from inside the visual-artifact skill directory.")
    return 1
  }

  const appDir = resolve(skillRoot, "app")
  const cliDir = resolve(skillRoot, "cli")
  const outDir = resolve(appDir, "out")
  const distBinary = resolve(cliDir, "dist", "visual-artifact")
  const binLink = resolve(homedir(), ".pi", "bin", "visual-artifact")

  const hasBun = commandExists("bun")
  const hasPnpm = commandExists("pnpm")
  const appOutExists = existsSync(outDir)
  const binaryExists = existsSync(distBinary)
  const installed = existsSync(binLink)

  if (opts.dryRun) {
    log.output({
      skillRoot,
      hasBun,
      hasPnpm,
      appOutExists,
      binaryExists,
      installed,
      plan: [
        hasPnpm ? "pnpm install in skill/app" : "skip: pnpm not found",
        hasPnpm ? "pnpm build in skill/app" : "skip: pnpm not found",
        hasBun ? "bun install in skill/cli" : "skip: bun not found",
        hasBun ? "bun run build in skill/cli" : "skip: bun not found",
        hasBun ? "bun run install:binary in skill/cli" : "skip: bun not found",
      ],
    })
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

  log.info(`Bootstrapping visual-artifact from ${skillRoot}`)

  let rc = run("pnpm", ["install"], appDir)
  if (rc !== 0) {
    log.error("renderer dependency install failed")
    return rc
  }

  rc = run("pnpm", ["build"], appDir)
  if (rc !== 0) {
    log.error("renderer build failed")
    return rc
  }

  rc = run("bun", ["install"], cliDir)
  if (rc !== 0) {
    log.error("CLI dependency install failed")
    return rc
  }

  rc = run("bun", ["run", "build"], cliDir)
  if (rc !== 0) {
    log.error("CLI build failed")
    return rc
  }

  rc = run("bun", ["run", "install:binary"], cliDir)
  if (rc !== 0) {
    log.error("CLI binary install failed")
    return rc
  }

  log.success(`visual-artifact installed: ${binLink}`)
  return 0
}
