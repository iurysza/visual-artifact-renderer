import { loadConfig, localBaseUrl } from "../config.ts"
import {
  commandLooksLikeVisualizerServer,
  getProcessCommand,
  processExists,
  readServerState,
  removeServerState,
  serverStatePath,
} from "../lib/server-lifecycle.ts"
import type { Logger } from "../logger.ts"
import type { Config } from "../types.ts"

type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export interface ServeStatusOpts {
  port?: number
  host?: string
  fetchImpl?: FetchImpl
  processExists?: (pid: number) => boolean
  getProcessCommand?: (pid: number) => Promise<string | null>
}

interface StatusOutput {
  running: boolean
  tracked: boolean
  url: string
  statePath: string
  pid?: number
  state: "valid" | "missing" | "corrupt" | "stale"
  staleStateRemoved?: boolean
  error?: string
}

function targetConfig(opts: ServeStatusOpts): Config {
  const overrides: Partial<Config> = {}
  if (opts.port !== undefined) overrides.port = opts.port
  if (opts.host !== undefined) overrides.host = opts.host
  return loadConfig(overrides)
}

async function serverIsRunning(url: string, fetchImpl: FetchImpl): Promise<boolean> {
  try {
    const response = await fetchImpl(url, { method: "HEAD" })
    return response.ok
  } catch {
    return false
  }
}

function writeStatusOutput(log: Logger, output: StatusOutput): void {
  const structured = (log as Logger & { structured?: () => boolean }).structured?.() ?? true
  if (structured) {
    log.output(output)
    return
  }
  if (output.running && output.tracked) {
    log.success(`Visualizer server running at ${output.url} (tracked pid ${output.pid})`)
    return
  }
  if (output.running) {
    log.info(`Visualizer server running at ${output.url} (untracked)`)
    return
  }
  log.info(`Visualizer server is not running at ${output.url}`)
}

export async function serveStatus(log: Logger, opts: ServeStatusOpts = {}): Promise<number> {
  const config = targetConfig(opts)
  const url = localBaseUrl(config)
  const statePath = serverStatePath(config)
  const fetchImpl = opts.fetchImpl ?? fetch
  const exists = opts.processExists ?? processExists
  const command = opts.getProcessCommand ?? getProcessCommand
  const running = await serverIsRunning(url, fetchImpl)
  const stateResult = await readServerState(statePath)

  if (stateResult.ok) {
    const pid = stateResult.state.pid
    const pidExists = exists(pid)
    const processCommand = pidExists ? await command(pid) : null
    const tracked = running && pidExists && commandLooksLikeVisualizerServer(processCommand, stateResult.state)
    if (tracked) {
      writeStatusOutput(log, { running, tracked: true, url: stateResult.state.url, statePath, pid, state: "valid" } satisfies StatusOutput)
      return 0
    }

    if (!running && !pidExists) {
      await removeServerState(statePath)
      writeStatusOutput(log, {
        running,
        tracked: false,
        url,
        statePath,
        pid,
        state: "stale",
        staleStateRemoved: true,
      } satisfies StatusOutput)
      return 1
    }

    writeStatusOutput(log, { running, tracked: false, url, statePath, pid, state: "stale" } satisfies StatusOutput)
    return running ? 0 : 1
  }

  if (stateResult.reason === "corrupt") {
    if (!running) {
      await removeServerState(statePath)
      writeStatusOutput(log, {
        running,
        tracked: false,
        url,
        statePath,
        state: "corrupt",
        staleStateRemoved: true,
        error: stateResult.error,
      } satisfies StatusOutput)
      return 1
    }

    writeStatusOutput(log, {
      running,
      tracked: false,
      url,
      statePath,
      state: "corrupt",
      error: stateResult.error,
    } satisfies StatusOutput)
    return 0
  }

  writeStatusOutput(log, { running, tracked: false, url, statePath, state: "missing" } satisfies StatusOutput)
  return running ? 0 : 1
}
