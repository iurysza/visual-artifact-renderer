import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Config } from "../types.ts"
import {
  createServerState,
  generateShutdownToken,
  readServerState,
  serverStatePath,
  writeServerState,
} from "../lib/server-lifecycle.ts"
import { serveStatus } from "./serve-status.ts"
import { serveStop } from "./serve-stop.ts"

const config: Config = {
  artifactsDir: "/tmp/artifacts",
  outDir: "/tmp/out",
  port: 9998,
  host: "127.0.0.1",
  mountPath: "/artifacts",
  dataPath: "/data/artifacts",
  open: false,
}

function makeLogger() {
  const logs: string[] = []
  return {
    error: (m: string) => logs.push(`error: ${m}`),
    warn: (m: string) => logs.push(`warn: ${m}`),
    log: (m: string) => logs.push(`log: ${m}`),
    info: (m: string) => logs.push(`info: ${m}`),
    success: (m: string) => logs.push(`success: ${m}`),
    output: (o: unknown) => logs.push(`output: ${JSON.stringify(o)}`),
    outputText: (t: string) => logs.push(`text: ${t}`),
    _logs: logs,
  }
}

function lastOutput(log: ReturnType<typeof makeLogger>): Record<string, unknown> {
  const line = [...log._logs].reverse().find((entry: string) => entry.startsWith("output: "))
  expect(line).toBeDefined()
  return JSON.parse(line!.slice("output: ".length))
}

async function writeState(token = generateShutdownToken()) {
  const state = createServerState(config, token)
  await writeServerState(state, serverStatePath(config))
  return state
}

describe("serve stop/status lifecycle", () => {
  let dir: string
  let oldXdgStateHome: string | undefined
  let oldPort: string | undefined
  let oldHost: string | undefined
  let oldMountPath: string | undefined

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "visualizer-lifecycle-"))
    oldXdgStateHome = process.env.XDG_STATE_HOME
    oldPort = process.env.VISUAL_ARTIFACT_PORT
    oldHost = process.env.VISUAL_ARTIFACT_HOST
    oldMountPath = process.env.VISUAL_ARTIFACT_MOUNT_PATH
    process.env.XDG_STATE_HOME = dir
    process.env.VISUAL_ARTIFACT_PORT = String(config.port)
    process.env.VISUAL_ARTIFACT_HOST = config.host
    process.env.VISUAL_ARTIFACT_MOUNT_PATH = config.mountPath
  })

  afterEach(async () => {
    if (oldXdgStateHome === undefined) delete process.env.XDG_STATE_HOME
    else process.env.XDG_STATE_HOME = oldXdgStateHome
    if (oldPort === undefined) delete process.env.VISUAL_ARTIFACT_PORT
    else process.env.VISUAL_ARTIFACT_PORT = oldPort
    if (oldHost === undefined) delete process.env.VISUAL_ARTIFACT_HOST
    else process.env.VISUAL_ARTIFACT_HOST = oldHost
    if (oldMountPath === undefined) delete process.env.VISUAL_ARTIFACT_MOUNT_PATH
    else process.env.VISUAL_ARTIFACT_MOUNT_PATH = oldMountPath
    await rm(dir, { recursive: true, force: true })
  })

  test("serve stop uses tokenized shutdown and removes state", async () => {
    const token = generateShutdownToken()
    const state = await writeState(token)
    const requests: RequestInfo[] = []
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(input as RequestInfo)
      const url = String(input)
      if (url === `${state.url}/api/shutdown`) {
        expect(init?.headers).toEqual({ Authorization: `Bearer ${token}` })
        return new Response("{}", { status: 200 })
      }
      return new Response(null, { status: 404 })
    }

    const log = makeLogger()
    const rc = await serveStop({ fetchImpl, sleep: async () => {} }, log as any)
    expect(rc).toBe(0)
    expect(lastOutput(log).method).toBe("shutdown")
    expect(lastOutput(log).staleStateRemoved).toBe(false)
    expect((await readServerState(serverStatePath(config))).ok).toBe(false)
    expect(requests.map(String)).toContain(`${state.url}/api/shutdown`)
  })

  test("serve stop removes stale state without killing reused PID", async () => {
    await writeState()
    const killed: number[] = []
    const log = makeLogger()
    const rc = await serveStop({
      fetchImpl: async () => new Response(null, { status: 404 }),
      sleep: async () => {},
      processExists: () => true,
      getProcessCommand: async () => "/Users/me/.local/bin/visual-artifact serve --no-open",
      killProcess: (pid) => { killed.push(pid) },
    }, log as any)

    expect(rc).toBe(0)
    expect(killed).toEqual([])
    expect(lastOutput(log).method).toBe("none")
    expect(lastOutput(log).staleStateRemoved).toBe(true)
  })

  test("serve stop falls back to matching tracked PID only while URL responds", async () => {
    await writeState()
    const killed: number[] = []
    let headCalls = 0
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return new Response(null, { status: 404 })
      headCalls += 1
      return new Response(null, { status: headCalls === 1 ? 200 : 404 })
    }

    const log = makeLogger()
    const rc = await serveStop({
      fetchImpl,
      sleep: async () => {},
      processExists: () => true,
      getProcessCommand: async () => "/Users/me/.local/bin/visual-artifact serve --no-open",
      killProcess: (pid) => { killed.push(pid) },
    }, log as any)

    expect(rc).toBe(0)
    expect(killed).toHaveLength(1)
    expect(lastOutput(log).method).toBe("pid")
  })

  test("serve stop refuses foreign listener without force", async () => {
    const killed: number[] = []
    const log = makeLogger()
    const rc = await serveStop({
      fetchImpl: async () => new Response(null, { status: 200 }),
      sleep: async () => {},
      inspectListener: async () => ({ supported: true, processes: [{ pid: 42, command: "python -m http.server 9998" }] }),
      killProcess: (pid) => { killed.push(pid) },
    }, log as any)

    expect(rc).toBe(1)
    expect(killed).toEqual([])
    expect(lastOutput(log).method).toBe("refused")
  })

  test("serve stop can force an ambiguous listener", async () => {
    const killed: number[] = []
    let headCalls = 0
    const fetchImpl = async () => {
      headCalls += 1
      return new Response(null, { status: headCalls === 1 ? 200 : 404 })
    }
    const log = makeLogger()
    const rc = await serveStop({
      force: true,
      fetchImpl,
      sleep: async () => {},
      inspectListener: async () => ({ supported: true, processes: [{ pid: 42, command: "python -m http.server 9998" }] }),
      killProcess: (pid) => { killed.push(pid) },
    }, log as any)

    expect(rc).toBe(0)
    expect(killed).toEqual([42])
    expect(lastOutput(log).method).toBe("listener")
    expect(lastOutput(log).forced).toBe(true)
  })

  test("serve status reports tracked server only when state PID still matches", async () => {
    await writeState()
    const log = makeLogger()
    const rc = await serveStatus(log as any, {
      fetchImpl: async () => new Response(null, { status: 200 }),
      processExists: () => true,
      getProcessCommand: async () => "/Users/me/.local/bin/visual-artifact serve --no-open",
    })

    expect(rc).toBe(0)
    expect(lastOutput(log).running).toBe(true)
    expect(lastOutput(log).tracked).toBe(true)
  })

  test("serve status reports reachable stale state as untracked", async () => {
    await writeState()
    const log = makeLogger()
    const rc = await serveStatus(log as any, {
      fetchImpl: async () => new Response(null, { status: 200 }),
      processExists: () => false,
    })

    expect(rc).toBe(0)
    expect(lastOutput(log).running).toBe(true)
    expect(lastOutput(log).tracked).toBe(false)
    expect(lastOutput(log).state).toBe("stale")
  })
})
