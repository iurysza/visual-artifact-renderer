import { existsSync, realpathSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, resolve } from "node:path"
import type { Config } from "./types.ts"

// Static-preview server port. The Next.js dev server (pnpm dev) owns :9999
// with HMR for live iteration; the CLI static server uses :9998 so the two
// never collide. See AGENTS.md "Server roles".
export const DEFAULT_PORT = 9998
export const DEFAULT_HOST = "127.0.0.1"
export const DEFAULT_MOUNT_PATH = "/artifacts"
export const DEFAULT_DATA_PATH = "/data/artifacts"

function getEntryPath(): string {
  const arg0 = process.argv[0] ?? ""
  const arg1 = process.argv[1]
  // Compiled binaries report argv[0] as the literal string "bun" and the real
  // executable path in process.execPath. `bun run` reports the full bun path.
  if (arg0 === "bun" || (arg1 && arg1.startsWith("/$bunfs/root/"))) {
    return process.execPath
  }
  if (arg1 && (arg1.endsWith(".ts") || arg1.endsWith(".js") || arg1.endsWith(".mjs"))) {
    return arg1
  }
  return arg0 || process.execPath
}

function isSkillRoot(path: string): boolean {
  return (
    existsSync(resolve(path, "SKILL.md")) &&
    existsSync(resolve(path, "app")) &&
    existsSync(resolve(path, "cli")) &&
    existsSync(resolve(path, "artifact-contract.json"))
  )
}

export function findSkillRoot(): string | null {
  try {
    const binaryPath = realpathSync(getEntryPath())
    let dir = dirname(binaryPath)
    for (let i = 0; i < 5; i++) {
      if (isSkillRoot(dir)) return dir
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  } catch {}

  const home = homedir()
  const candidates = [
    process.env.VISUAL_ARTIFACT_SKILL_ROOT,
    resolve(home, ".agents", "skills", "visual-artifact"),
    resolve(home, ".pi", "skills", "visual-artifact"),
  ].filter((path): path is string => Boolean(path))

  for (const candidate of candidates) {
    try {
      if (isSkillRoot(candidate)) return realpathSync(candidate)
    } catch {}
  }

  return null
}

export function defaultArtifactsDir(): string {
  const skillRoot = findSkillRoot()
  if (skillRoot) return resolve(skillRoot, "artifacts")
  return resolve(homedir(), ".pi", "skills", "visual-artifact", "artifacts")
}

export function defaultOutDir(): string {
  const envDir = process.env.VISUAL_ARTIFACT_OUT_DIR
  if (envDir) return resolve(envDir)
  const dataDir = resolve(homedir(), ".local", "share", "visual-artifact", "app", "out")
  if (existsSync(dataDir)) return dataDir
  const skillRoot = findSkillRoot()
  if (skillRoot) return resolve(skillRoot, "app", "out")
  return dataDir
}

export function defaultContractPath(): string | undefined {
  const skillRoot = findSkillRoot()
  return skillRoot ? resolve(skillRoot, "artifact-contract.json") : undefined
}

export function expandHome(path: string): string {
  if (path.startsWith("~/")) {
    return resolve(homedir(), path.slice(2))
  }
  return resolve(path)
}

export function loadConfig(overrides: Partial<Config> = {}): Config {
  return {
    artifactsDir: expandHome(process.env.VISUAL_ARTIFACT_ARTIFACTS_DIR ?? defaultArtifactsDir()),
    outDir: expandHome(process.env.VISUAL_ARTIFACT_OUT_DIR ?? defaultOutDir()),
    port: parseInt(process.env.VISUAL_ARTIFACT_PORT ?? String(DEFAULT_PORT), 10),
    host: process.env.VISUAL_ARTIFACT_HOST ?? DEFAULT_HOST,
    mountPath: process.env.VISUAL_ARTIFACT_MOUNT_PATH ?? DEFAULT_MOUNT_PATH,
    dataPath: process.env.VISUAL_ARTIFACT_DATA_PATH ?? DEFAULT_DATA_PATH,
    open: (process.env.VISUAL_ARTIFACT_OPEN ?? "1") === "1",
    baseUrl: process.env.VISUAL_ARTIFACT_BASE_URL,
    ...overrides,
  }
}

export function localBaseUrl(config: Config): string {
  return `http://${config.host === "0.0.0.0" ? "127.0.0.1" : config.host}:${config.port}${config.mountPath}`
}

export function artifactBaseUrl(config: Config): string {
  const baseUrl = config.baseUrl?.trim()
  if (baseUrl) return baseUrl.replace(/\/+$/, "")
  return localBaseUrl(config)
}
