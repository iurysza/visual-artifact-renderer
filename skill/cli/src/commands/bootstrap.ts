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
  const sharedDir = resolve(skillRoot, "shared")
  const outDir = resolve(appDir, "out")
  const distBinary = resolve(cliDir, "dist", "visual-artifact")
  const home = homedir()
  const binPath = resolve(home, ".local", "bin", "visual-artifact")
  const skillPath = resolve(home, ".agents", "skills", "visual-artifact")
  const piAgentDir = resolve(home, ".pi", "agent")
  const extensionPath = resolve(piAgentDir, "extensions", "visual-artifact.ts")

  const hasBun = commandExists("bun")
  const hasPnpm = commandExists("pnpm")
  const appOutExists = existsSync(outDir)
  const binaryExists = existsSync(distBinary)
  const installed = existsSync(binPath)
  const skillInstalled = existsSync(skillPath)
  const piDetected = existsSync(piAgentDir)
  const extensionInstalled = existsSync(extensionPath)

  if (opts.dryRun) {
    log.output({
      skillRoot,
      hasBun,
      hasPnpm,
      appOutExists,
      binaryExists,
      installed,
      skillInstalled,
      piDetected,
      extensionInstalled,
      plan: [
        hasPnpm ? "pnpm install in skill/app" : "skip: pnpm not found",
        hasPnpm ? "pnpm build in skill/app" : "skip: pnpm not found",
        hasBun ? "bun install in skill/cli" : "skip: bun not found",
        hasBun ? "bun run build in skill/cli" : "skip: bun not found",
        hasBun ? "bun run install:binary in skill/cli (CLI to ~/.local/bin, skill to ~/.agents/skills, Pi extension if Pi is installed)" : "skip: bun not found",
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

  rc = run("bun", ["install"], sharedDir)
  if (rc !== 0) {
    log.error("shared dependency install failed")
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

  log.success(`visual-artifact installed: ${binPath}`)
  if (existsSync(piAgentDir)) {
    log.info("Run `/reload` in Pi, or restart Pi, to load the extension.")
  }
  return 0
}
