import { ConfigValidationError, loadConfig, localBaseUrl } from "../config.ts"
import {
  commandLooksLikeVisualizerServer,
  getProcessCommand,
  inspectPortListener,
  processExists,
  readServerState,
  recordedProcessStatus,
  removeServerState,
  serverStatePath,
} from "../lib/server-lifecycle.ts"
import type { ListenerLookupResult, ListenerProcess, ServerState } from "../lib/server-lifecycle.ts"
import type { Logger, ResultData } from "../logger.ts"
import type { Config } from "../types.ts"

type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export interface ServeStopOpts {
  port?: number
  host?: string
  force?: boolean
  fetchImpl?: FetchImpl
  sleep?: (ms: number) => Promise<void>
  processExists?: (pid: number) => boolean
  getProcessCommand?: (pid: number) => Promise<string | null>
  inspectListener?: (host: string, port: number) => Promise<ListenerLookupResult>
  killProcess?: (pid: number, signal: "SIGTERM") => void
}

type StopMethod = "shutdown" | "pid" | "listener" | "none" | "refused"

interface StopOutput {
  stopped: boolean
  method: StopMethod
  url: string
  statePath: string
  pid?: number
  reason?: string
  listener?: ListenerProcess
  staleStateRemoved?: boolean
  forced?: boolean
}

function targetConfig(opts: ServeStopOpts): Config {
  const overrides: Partial<Config> = {}
  if (opts.port !== undefined) overrides.port = opts.port
  if (opts.host !== undefined) overrides.host = opts.host
  return loadConfig({ overrides })
}

async function defaultSleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function serverIsRunning(url: string, fetchImpl: FetchImpl): Promise<boolean> {
  try {
    const response = await fetchImpl(url, { method: "HEAD" })
    return response.ok
  } catch {
    return false
  }
}

async function waitUntilStopped(
  url: string,
  fetchImpl: FetchImpl,
  sleep: (ms: number) => Promise<void>,
): Promise<boolean> {
  for (let i = 0; i < 30; i++) {
    if (!(await serverIsRunning(url, fetchImpl))) return true
    await sleep(150)
  }
  return false
}

async function tryShutdownEndpoint(state: ServerState, fetchImpl: FetchImpl): Promise<boolean> {
  try {
    const response = await fetchImpl(`${state.url}/api/shutdown`, {
      method: "POST",
      headers: { Authorization: `Bearer ${state.shutdownToken}` },
    })
    return response.ok
  } catch {
    return false
  }
}

function emitResult(log: Logger, output: StopOutput): void {
  log.result({
    command: "serve stop",
    stopped: output.stopped,
    method: output.method,
    url: output.url,
    statePath: output.statePath,
    pid: output.pid,
    reason: output.reason,
    staleStateRemoved: output.staleStateRemoved,
    forced: output.forced,
    listener: output.listener,
  })
}

async function stopPid(
  pid: number,
  url: string,
  method: "pid" | "listener",
  outputBase: Omit<StopOutput, "stopped" | "method">,
  opts: Required<Pick<ServeStopOpts, "fetchImpl" | "sleep" | "killProcess">>,
): Promise<StopOutput> {
  try {
    opts.killProcess(pid, "SIGTERM")
  } catch (error) {
    return {
      ...outputBase,
      pid,
      stopped: false,
      method: "refused",
      reason: `Could not terminate process ${pid}: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  const stopped = await waitUntilStopped(url, opts.fetchImpl, opts.sleep)
  return {
    ...outputBase,
    pid,
    stopped,
    method,
    reason: stopped ? undefined : `Process ${pid} was signaled but ${url} still responds`,
  }
}

export async function serveStop(opts: ServeStopOpts, log: Logger): Promise<number> {
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
  const sleep = opts.sleep ?? defaultSleep
  const exists = opts.processExists ?? processExists
  const command = opts.getProcessCommand ?? getProcessCommand
  const inspectListenerImpl = opts.inspectListener ?? ((host, port) => inspectPortListener(host, port, { command }))
  const killProcess = opts.killProcess ?? ((pid: number, signal: "SIGTERM") => process.kill(pid, signal))
  const base = { url, statePath }

  const stateResult = await readServerState(statePath)
  if (stateResult.ok) {
    const state = stateResult.state
    const stateBase = { url: state.url, statePath }
    if (await tryShutdownEndpoint(state, fetchImpl)) {
      const stopped = await waitUntilStopped(state.url, fetchImpl, sleep)
      if (stopped) await removeServerState(statePath)
      const output: StopOutput = {
        ...stateBase,
        pid: state.pid,
        stopped,
        method: "shutdown",
        staleStateRemoved: false,
        reason: stopped ? undefined : `Shutdown was accepted but ${state.url} still responds`,
      }
      emitResult(log, output)
      return stopped ? 0 : 1
    }

    const running = await serverIsRunning(state.url, fetchImpl)
    if (!running) {
      await removeServerState(statePath)
      const output: StopOutput = {
        ...stateBase,
        pid: state.pid,
        stopped: false,
        method: "none",
        reason: "Server is not running; removed stale state",
        staleStateRemoved: true,
      }
      emitResult(log, output)
      return 0
    }

    const processStatus = await recordedProcessStatus(state, { exists, command })
    if (processStatus.matches) {
      const output = await stopPid(state.pid, state.url, "pid", stateBase, { fetchImpl, sleep, killProcess })
      if (output.stopped) await removeServerState(statePath)
      emitResult(log, output)
      return output.stopped ? 0 : 1
    }

    const output: StopOutput = {
      ...base,
      pid: state.pid,
      stopped: false,
      method: "refused",
      reason: processStatus.exists
        ? `Recorded PID ${state.pid} does not look like a visual-artifact server (${processStatus.match.reason})`
        : "Tracked state exists, but graceful shutdown failed and the recorded process is gone while the URL still responds",
    }
    emitResult(log, output)
    return 1
  }

  const stateWasCorrupt = stateResult.reason === "corrupt"

  if (stateWasCorrupt && !(await serverIsRunning(url, fetchImpl))) {
    await removeServerState(statePath)
    const output: StopOutput = {
      ...base,
      stopped: false,
      method: "none",
      reason: "Server is not running; removed corrupt state",
      staleStateRemoved: true,
    }
    emitResult(log, output)
    return 0
  }

  if (!(await serverIsRunning(url, fetchImpl))) {
    const output: StopOutput = { ...base, stopped: false, method: "none", reason: "Server is not running" }
    emitResult(log, output)
    return 0
  }

  const listeners = await inspectListenerImpl(config.host, config.port)
  if (!listeners.supported) {
    const output: StopOutput = {
      ...base,
      stopped: false,
      method: "refused",
      reason: `Server is running but no state exists and listener inspection is unavailable: ${listeners.error}`,
    }
    emitResult(log, output)
    return 1
  }

  const matching = listeners.processes.filter((listener) => commandLooksLikeVisualizerServer(listener.command))
  const listener = matching[0] ?? listeners.processes[0]

  if (matching.length === 1 || (opts.force && listener)) {
    const selected = matching.length === 1 ? matching[0] : listener
    const output = await stopPid(selected.pid, url, "listener", { ...base, listener: selected, forced: matching.length !== 1 }, {
      fetchImpl,
      sleep,
      killProcess,
    })
    if (output.stopped && stateWasCorrupt) await removeServerState(statePath)
    emitResult(log, output)
    return output.stopped ? 0 : 1
  }

  const output: StopOutput = {
    ...base,
    stopped: false,
    method: "refused",
    listener,
    reason: matching.length > 1
      ? `Multiple visual-artifact-like processes listen on ${config.host}:${config.port}. Re-run with --force to terminate the first listener.`
      : listener
        ? `Process ${listener.pid} listens on ${config.host}:${config.port}, but it does not clearly match visual-artifact serve. Re-run with --force to terminate it.`
        : `Server responds at ${url}, but no listener process could be identified.`,
  }
  emitResult(log, output)
  return 1
}
