import { ConfigValidationError, loadConfig, localBaseUrl } from "../config.ts"
import {
  commandLooksLikeVisualizerServer,
  getProcessCommand,
  processExists,
  readServerState,
  removeServerState,
  serverStatePath,
} from "../lib/server-lifecycle.ts"
import type { Logger, ResultData } from "../logger.ts"
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
  return loadConfig({ overrides })
}

async function serverIsRunning(url: string, fetchImpl: FetchImpl): Promise<boolean> {
  try {
    const response = await fetchImpl(url, { method: "HEAD" })
    return response.ok
  } catch {
    return false
  }
}

function emitResult(log: Logger, output: StatusOutput): void {
  log.result({
    command: "serve status",
    running: output.running,
    url: output.url,
    statePath: output.statePath,
    tracked: output.tracked,
    pid: output.pid,
    state: output.state,
    staleStateRemoved: output.staleStateRemoved,
    error: output.error,
  })
}

export async function serveStatus(log: Logger, opts: ServeStatusOpts = {}): Promise<number> {
  let config: Config
  try {
    config = targetConfig(opts)
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      log.error(error.message)
      return 2
    }
    log.error(error instanceof Error ? error.message : String(error), error)
    return 1
  }

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
      emitResult(log, { running, tracked: true, url: stateResult.state.url, statePath, pid, state: "valid" })
      return 0
    }

    if (!running && !pidExists) {
      await removeServerState(statePath)
      emitResult(log, {
        running,
        tracked: false,
        url,
        statePath,
        pid,
        state: "stale",
        staleStateRemoved: true,
      })
      return 1
    }

    emitResult(log, { running, tracked: false, url, statePath, pid, state: "stale" })
    return running ? 0 : 1
  }

  if (stateResult.reason === "corrupt") {
    if (!running) {
      await removeServerState(statePath)
      emitResult(log, {
        running,
        tracked: false,
        url,
        statePath,
        state: "corrupt",
        staleStateRemoved: true,
        error: stateResult.error,
      })
      return 1
    }

    emitResult(log, {
      running,
      tracked: false,
      url,
      statePath,
      state: "corrupt",
      error: stateResult.error,
    })
    return 0
  }

  emitResult(log, { running, tracked: false, url, statePath, state: "missing" })
  return running ? 0 : 1
}
