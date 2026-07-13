import { existsSync, realpathSync } from "node:fs"
import { isIP } from "node:net"
import { homedir } from "node:os"
import { dirname, posix, resolve } from "node:path"
import { z } from "zod"

import { expandHome } from "./util.ts"
import type { Config } from "./types.ts"

// Static-preview server port. The Next.js dev server (pnpm dev) owns :9999
// with HMR for live iteration; the CLI static server uses :9998 so the two
// never collide. See AGENTS.md "Server roles".
export const DEFAULT_PORT = 9998
export const DEFAULT_HOST = "127.0.0.1"
export const DEFAULT_DATA_PATH = "/data/artifacts"

export { Config }
export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ConfigValidationError"
  }
}

function getEntryPath(): string {
  const arg0 = process.argv[0] ?? ""
  const arg1 = process.argv[1]
  // Compiled binaries report argv[0] as the literal string "bun" and the real
  // executable path in process.execPath.
  if (arg0 === "bun" || (arg1 && arg1.startsWith("/$bunfs/root/"))) {
    return process.execPath
  }
  if (arg1 && (arg1.endsWith(".ts") || arg1.endsWith(".js") || arg1.endsWith(".mjs"))) {
    return arg1
  }
  return arg0 || process.execPath
}

function isProjectRoot(path: string): boolean {
  // Development source tree: runtime packages at the root plus skill metadata.
  return (
    existsSync(resolve(path, "app")) &&
    existsSync(resolve(path, "cli")) &&
    existsSync(resolve(path, "shared")) &&
    existsSync(resolve(path, "skill", "SKILL.md"))
  )
}

export function findProjectRoot(): string | null {
  // Search upward from the binary/script path for a development source tree.
  try {
    const binaryPath = realpathSync(getEntryPath())
    let dir = dirname(binaryPath)
    for (let i = 0; i < 6; i++) {
      if (isProjectRoot(dir)) return dir
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  } catch {}

  // Also check cwd for source-tree development.
  for (const candidate of [process.cwd()]) {
    if (isProjectRoot(candidate)) return candidate
  }

  return null
}

export function defaultArtifactsDir(): string {
  const envDir = process.env.VISUAL_ARTIFACT_ARTIFACTS_DIR
  if (envDir === "") throw new ConfigValidationError("VISUAL_ARTIFACT_ARTIFACTS_DIR is empty")
  const projectRoot = findProjectRoot()
  if (projectRoot) return resolve(projectRoot, "artifacts")
  return resolve(homedir(), ".local", "share", "visual-artifact", "artifacts")
}

export function defaultOutDir(): string {
  const envDir = process.env.VISUAL_ARTIFACT_OUT_DIR
  if (envDir === "") throw new ConfigValidationError("VISUAL_ARTIFACT_OUT_DIR is empty")
  const dataDir = resolve(homedir(), ".local", "share", "visual-artifact", "app", "out")
  if (existsSync(dataDir)) return dataDir
  const projectRoot = findProjectRoot()
  if (projectRoot) return resolve(projectRoot, "app", "out")
  return dataDir
}

export function defaultContractPath(): string | undefined {
  const envPath = process.env.VISUAL_ARTIFACT_CONTRACT_PATH
  if (envPath === "") throw new ConfigValidationError("VISUAL_ARTIFACT_CONTRACT_PATH is empty")
  const projectRoot = findProjectRoot()
  if (projectRoot) {
    const contractPath = resolve(projectRoot, "cli", "assets", "contract.json")
    if (existsSync(contractPath)) return contractPath
  }
  // Installed CLI binaries bundle their own contract copy.
  return undefined
}

function hasControlChars(value: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /[\x00-\x1f\x7f]/.test(value)
}

function isValidHostname(value: string): boolean {
  // Hostnames: total <= 253, labels 1-63, alphanumeric/hyphen, no leading/trailing hyphen.
  if (value.length > 253) return false
  if (value.endsWith(".")) return false
  const labels = value.split(".")
  for (const label of labels) {
    if (!label || label.length > 63) return false
    if (label.startsWith("-") || label.endsWith("-")) return false
    if (!/^[a-zA-Z0-9-]+$/.test(label)) return false
  }
  return true
}

export function validateHost(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new ConfigValidationError("host must not be empty")
  if (hasControlChars(trimmed)) throw new ConfigValidationError("host contains control characters")

  // IPv6 bracket notation.
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1).trim()
    if (!inner) throw new ConfigValidationError("IPv6 host must not be empty")
    if (isIP(inner) === 6) return inner.toLowerCase()
    throw new ConfigValidationError(`IPv6 host is not valid: ${trimmed}`)
  }

  const ipVersion = isIP(trimmed)
  if (ipVersion === 4 || ipVersion === 6) return trimmed.toLowerCase()
  if (/^[0-9.]+$/.test(trimmed)) {
    throw new ConfigValidationError(`host is not a valid IP address: ${trimmed}`)
  }

  if (isValidHostname(trimmed)) return trimmed.toLowerCase()

  throw new ConfigValidationError(`host is not a valid IP address or hostname: ${trimmed}`)
}

export function normalizeBaseUrl(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  const trimmed = value.trim()
  if (!trimmed) throw new ConfigValidationError("base URL must not be empty")
  if (hasControlChars(trimmed)) {
    throw new ConfigValidationError("base URL contains control characters")
  }
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new ConfigValidationError(`base URL is not a valid URL: ${trimmed}`)
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ConfigValidationError(`base URL must use http or https: ${trimmed}`)
  }
  if (url.username || url.password) {
    throw new ConfigValidationError("base URL must not contain credentials")
  }
  if (url.search || url.hash) {
    throw new ConfigValidationError("base URL must not contain query or hash")
  }

  url.pathname = url.pathname.replace(/\/+$/, "") || "/"
  return url.toString().replace(/\/$/, "")
}

export function localBaseUrl(config: Config): string {
  let host = config.host
  if (host === "0.0.0.0" || host === "::") host = "127.0.0.1"
  const displayHost = host.includes(":") ? `[${host}]` : host
  return `http://${displayHost}:${config.port}`
}

export function artifactBaseUrl(config: Config): string {
  const baseUrl = config.baseUrl?.trim()
  if (baseUrl) return baseUrl
  return localBaseUrl(config)
}

function normalizeDataPath(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new ConfigValidationError("data path must not be empty")
  if (!trimmed.startsWith("/")) {
    throw new ConfigValidationError(`data path must be absolute: ${value}`)
  }
  if (hasControlChars(trimmed)) {
    throw new ConfigValidationError("data path contains control characters")
  }
  if (/[\\?#]/.test(trimmed)) {
    throw new ConfigValidationError(`data path contains invalid characters: ${value}`)
  }

  const normalized = posix.normalize(trimmed).replace(/\/+$/, "") || "/"
  if (normalized === "/") {
    throw new ConfigValidationError("data path must not be root (/)")
  }
  return normalized
}

export function resolveFsPath(value: string | undefined, fallback: () => string): string {
  if (value === undefined) return fallback()
  const trimmed = value.trim()
  if (!trimmed) throw new ConfigValidationError("filesystem path must not be empty")
  if (hasControlChars(trimmed)) {
    throw new ConfigValidationError("filesystem path contains control characters")
  }
  const expanded = expandHome(trimmed)
  // Compatibility: accept non-empty relative paths and resolve them from cwd.
  return resolve(expanded)
}

function parseStrictBoolean(
  value: string | undefined,
  defaultValue: boolean,
  name: string,
): boolean {
  if (value === undefined) return defaultValue
  if (value === "") throw new ConfigValidationError(`${name} must not be empty`)
  if (value === "1") return true
  if (value === "0") return false
  throw new ConfigValidationError(`${name} must be 0 or 1; got ${value}`)
}

export const ConfigSchema = z
  .object({
    artifactsDir: z.string().min(1),
    outDir: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    host: z.string().min(1),
    dataPath: z.string().min(1).regex(/^\//),
    open: z.boolean(),
    allowRemote: z.boolean(),
    baseUrl: z.string().optional(),
    contractPath: z.string().min(1).optional(),
    projectPath: z.string().min(1).optional(),
  })
  .strict()

export interface LoadConfigOptions {
  overrides?: Partial<Config>
}

function parsePort(value: number | string): number {
  if (typeof value === "string" && !/^\d+$/.test(value.trim())) {
    throw new ConfigValidationError(`port must be a decimal integer between 1 and 65535; got ${value}`)
  }
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigValidationError(`port must be an integer between 1 and 65535; got ${value}`)
  }
  return port
}

export function loadConfig(options: LoadConfigOptions = {}): Config {
  const overrides = options.overrides ?? {}

  const artifactsDir = resolveFsPath(
    overrides.artifactsDir ?? process.env.VISUAL_ARTIFACT_ARTIFACTS_DIR,
    defaultArtifactsDir,
  )
  const outDir = resolveFsPath(overrides.outDir ?? process.env.VISUAL_ARTIFACT_OUT_DIR, defaultOutDir)
  const portRaw = overrides.port ?? process.env.VISUAL_ARTIFACT_PORT ?? String(DEFAULT_PORT)
  const port = parsePort(portRaw)

  const host = validateHost(overrides.host ?? process.env.VISUAL_ARTIFACT_HOST ?? DEFAULT_HOST)
  const dataPath = normalizeDataPath(
    overrides.dataPath ?? process.env.VISUAL_ARTIFACT_DATA_PATH ?? DEFAULT_DATA_PATH,
  )
  const open = parseStrictBoolean(
    overrides.open !== undefined ? (overrides.open ? "1" : "0") : process.env.VISUAL_ARTIFACT_OPEN,
    true,
    "VISUAL_ARTIFACT_OPEN",
  )
  const allowRemote = parseStrictBoolean(
    overrides.allowRemote !== undefined
      ? overrides.allowRemote
        ? "1"
        : "0"
      : process.env.VISUAL_ARTIFACT_ALLOW_REMOTE,
    false,
    "VISUAL_ARTIFACT_ALLOW_REMOTE",
  )
  const baseUrl = normalizeBaseUrl(overrides.baseUrl ?? process.env.VISUAL_ARTIFACT_BASE_URL)
  const contractPathRaw = overrides.contractPath ?? process.env.VISUAL_ARTIFACT_CONTRACT_PATH ?? defaultContractPath()
  const contractPath = contractPathRaw !== undefined ? resolveFsPath(contractPathRaw, () => "") : undefined
  const projectPathRaw = overrides.projectPath ?? process.env.VISUAL_ARTIFACT_PROJECT_PATH
  const projectPath = projectPathRaw !== undefined ? resolveFsPath(projectPathRaw, () => "") : undefined

  const raw: Config = {
    artifactsDir,
    outDir,
    port,
    host,
    dataPath,
    open,
    allowRemote,
    baseUrl,
    contractPath,
    projectPath,
  }

  const parsed = ConfigSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new ConfigValidationError(`${issue?.path.join(".") ?? "config"}: ${issue?.message ?? "invalid"}`)
  }

  return parsed.data
}
