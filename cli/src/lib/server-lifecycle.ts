import { execFile } from "node:child_process"
import { randomBytes, timingSafeEqual } from "node:crypto"
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { basename, dirname, resolve } from "node:path"
import { promisify } from "node:util"
import { z } from "zod"
import { localBaseUrl } from "../config.ts"
import type { Config } from "../types.ts"

const execFileAsync = promisify(execFile)

export const SERVER_STATE_VERSION = 1

export const ServerStateSchema = z.object({
  version: z.literal(SERVER_STATE_VERSION),
  pid: z.number().int().positive(),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  url: z.string().url(),
  startedAt: z.string().datetime(),
  executable: z.string().min(1),
  argv: z.array(z.string()),
  shutdownToken: z.string().min(24),
}).strict()

export type ServerState = z.infer<typeof ServerStateSchema>

export interface PublicServerState extends Omit<ServerState, "shutdownToken"> {
  shutdownToken: "<redacted>"
}

export type ServerStateReadResult =
  | { ok: true; path: string; state: ServerState }
  | { ok: false; path: string; reason: "missing" | "corrupt"; error?: string }

export interface ListenerProcess {
  pid: number
  commandName?: string
  command?: string
  address?: string
}

export type ListenerLookupResult =
  | { supported: true; processes: ListenerProcess[] }
  | { supported: false; processes: ListenerProcess[]; error: string }

function stateRootDir(): string {
  const xdgStateHome = process.env.XDG_STATE_HOME?.trim()
  const baseDir = xdgStateHome ? resolve(xdgStateHome) : resolve(homedir(), ".local", "state")
  return resolve(baseDir, "visual-artifact", "servers")
}

function normalizeStateSegment(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]/g, "_")
  return normalized || "host"
}

export function serverStatePath(target: Pick<Config, "host" | "port">): string {
  return resolve(stateRootDir(), `${normalizeStateSegment(target.host)}-${target.port}.json`)
}

export function generateShutdownToken(): string {
  return randomBytes(32).toString("base64url")
}

export function createServerState(config: Config, shutdownToken: string): ServerState {
  return {
    version: SERVER_STATE_VERSION,
    pid: process.pid,
    host: config.host,
    port: config.port,
    url: localBaseUrl(config),
    startedAt: new Date().toISOString(),
    executable: process.execPath,
    argv: process.argv.slice(),
    shutdownToken,
  }
}

export function publicServerState(state: ServerState): PublicServerState {
  return { ...state, shutdownToken: "<redacted>" }
}

export function bearerTokenMatches(authHeader: string | null, expectedToken: string): boolean {
  const prefix = "Bearer "
  if (!authHeader?.startsWith(prefix)) return false
  const token = authHeader.slice(prefix.length)
  const actual = Buffer.from(token)
  const expected = Buffer.from(expectedToken)
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

function zodErrorMessage(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".") || "state"}: ${issue.message}`).join("; ")
}

export async function readServerState(path: string): Promise<ServerStateReadResult> {
  let raw: string
  try {
    raw = await readFile(path, "utf8")
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      return { ok: false, path, reason: "missing" }
    }
    return { ok: false, path, reason: "corrupt", error: error instanceof Error ? error.message : String(error) }
  }

  try {
    const parsed = ServerStateSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      return { ok: false, path, reason: "corrupt", error: zodErrorMessage(parsed.error) }
    }
    return { ok: true, path, state: parsed.data }
  } catch (error) {
    return { ok: false, path, reason: "corrupt", error: error instanceof Error ? error.message : String(error) }
  }
}

export async function writeServerState(state: ServerState, path = serverStatePath(state)): Promise<void> {
  const dir = dirname(path)
  await mkdir(dir, { recursive: true, mode: 0o700 })
  await chmod(dir, 0o700).catch(() => {})
  const tmpPath = `${path}.${process.pid}.${Date.now()}.tmp`
  try {
    await writeFile(tmpPath, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 })
    await chmod(tmpPath, 0o600).catch(() => {})
    await rename(tmpPath, path)
    await chmod(path, 0o600).catch(() => {})
  } catch (error) {
    await rm(tmpPath, { force: true }).catch(() => {})
    throw error
  }
}

export async function removeServerState(path: string): Promise<void> {
  await rm(path, { force: true })
}

export function processExists(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as { code?: string }).code === "EPERM"
  }
}

export async function getProcessCommand(pid: number): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("ps", ["-p", String(pid), "-o", "command="], {
      encoding: "utf8",
      timeout: 3000,
    })
    const command = String(stdout).trim()
    return command || null
  } catch {
    return null
  }
}

export type VisualizerProcessMatch =
  | { matches: true; reason: "installed-binary" | "dev-main" | "state-argv"; command: string }
  | { matches: false; reason: "missing-command" | "not-serve" | "not-visualizer"; command?: string }

function commandTokens(command: string): string[] {
  return command.trim().split(/\s+/).filter(Boolean)
}

function hasServeSubcommand(tokens: string[]): boolean {
  return tokens.includes("serve")
}

export function classifyVisualizerServerProcess(
  command: string | undefined | null,
  state?: ServerState,
): VisualizerProcessMatch {
  if (!command) return { matches: false, reason: "missing-command" }

  const tokens = commandTokens(command)
  if (!hasServeSubcommand(tokens)) return { matches: false, reason: "not-serve", command }

  const executable = tokens[0] ?? ""
  const executableName = basename(executable)
  if (executableName === "visual-artifact") {
    return { matches: true, reason: "installed-binary", command }
  }

  const hasDevMain = tokens.some((token) => token.endsWith("cli/src/main.ts"))
  if (executableName.startsWith("bun") && hasDevMain) {
    return { matches: true, reason: "dev-main", command }
  }

  const stateTokens = state ? state.argv : []
  const stateExecutableName = basename(stateTokens[0] ?? "")
  const stateHasDevMain = stateTokens.some((token) => token.endsWith("cli/src/main.ts"))
  if (stateExecutableName === "visual-artifact" && executableName === "visual-artifact") {
    return { matches: true, reason: "state-argv", command }
  }
  if (stateHasDevMain && hasDevMain) {
    return { matches: true, reason: "state-argv", command }
  }

  return { matches: false, reason: "not-visualizer", command }
}

export function commandLooksLikeVisualizerServer(command: string | undefined | null, state?: ServerState): boolean {
  return classifyVisualizerServerProcess(command, state).matches
}

export async function recordedProcessStatus(
  state: ServerState,
  deps: { exists?: (pid: number) => boolean; command?: (pid: number) => Promise<string | null> } = {},
): Promise<{ exists: boolean; command: string | null; matches: boolean; match: VisualizerProcessMatch }> {
  const exists = deps.exists ?? processExists
  const getCommand = deps.command ?? getProcessCommand
  if (!exists(state.pid)) {
    return { exists: false, command: null, matches: false, match: { matches: false, reason: "missing-command" } }
  }
  const command = await getCommand(state.pid)
  const match = classifyVisualizerServerProcess(command, state)
  return { exists: true, command, matches: match.matches, match }
}

export function listenerAddressMatchesHost(address: string | undefined, host: string, port: number): boolean {
  if (!address) return true
  const lower = address.toLowerCase()
  if (!lower.endsWith(`:${port}`)) return false
  if (lower.startsWith("*:")) return true
  if (lower.startsWith("0.0.0.0:")) return true
  if (lower.startsWith("[::]:")) return true
  if (host === "0.0.0.0") return true
  if (host === "127.0.0.1" && lower.startsWith("localhost:")) return true
  return lower.startsWith(`${host.toLowerCase()}:`) || lower.startsWith(`[${host.toLowerCase()}]:`)
}

export async function inspectPortListener(
  host: string,
  port: number,
  deps: { command?: (pid: number) => Promise<string | null> } = {},
): Promise<ListenerLookupResult> {
  const getCommand = deps.command ?? getProcessCommand
  let stdout: string
  try {
    const result = await execFileAsync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-F", "pcn"], {
      encoding: "utf8",
      timeout: 3000,
    })
    stdout = String(result.stdout)
  } catch (error) {
    const code = (error as { code?: string | number }).code
    if (code === 1) return { supported: true, processes: [] }
    return {
      supported: false,
      processes: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }

  const processes: ListenerProcess[] = []
  let current: ListenerProcess | null = null
  for (const line of stdout.split("\n")) {
    if (!line) continue
    const key = line[0]
    const value = line.slice(1)
    if (key === "p") {
      const pid = Number(value)
      if (Number.isInteger(pid) && pid > 0) {
        current = { pid }
        processes.push(current)
      } else {
        current = null
      }
      continue
    }
    if (!current) continue
    if (key === "c") current.commandName = value
    if (key === "n") current.address = value
  }

  const filtered = processes.filter((processInfo) => listenerAddressMatchesHost(processInfo.address, host, port))
  for (const processInfo of filtered) {
    processInfo.command = await getCommand(processInfo.pid) ?? processInfo.commandName
  }

  return { supported: true, processes: filtered }
}
