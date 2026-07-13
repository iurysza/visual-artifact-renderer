import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import type { Config } from "../types.ts"
import {
  bearerTokenMatches,
  classifyVisualizerServerProcess,
  commandLooksLikeVisualizerServer,
  createServerState,
  generateShutdownToken,
  listenerAddressMatchesHost,
  publicServerState,
  readServerState,
  removeServerState,
  serverStateMatchesConfig,
  serverStatePath,
  writeServerState,
} from "./server-lifecycle.ts"

const config: Config = {
  artifactsDir: "/tmp/artifacts",
  outDir: "/tmp/out",
  port: 9998,
  host: "127.0.0.1",
  dataPath: "/data/artifacts",
  open: false,
  allowRemote: false,
}

describe("server lifecycle state", () => {
  let dir: string
  let oldXdgStateHome: string | undefined

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "visualizer-state-"))
    oldXdgStateHome = process.env.XDG_STATE_HOME
    process.env.XDG_STATE_HOME = dir
  })

  afterEach(async () => {
    if (oldXdgStateHome === undefined) delete process.env.XDG_STATE_HOME
    else process.env.XDG_STATE_HOME = oldXdgStateHome
    await rm(dir, { recursive: true, force: true })
  })

  test("keys state by host and port", () => {
    expect(serverStatePath(config)).toBe(join(dir, "visual-artifact", "servers", "127.0.0.1-9998.json"))
    expect(serverStatePath({ host: "0.0.0.0", port: 4444 })).toBe(join(dir, "visual-artifact", "servers", "0.0.0.0-4444.json"))
  })

  test("writes, reads, redacts, and removes state", async () => {
    const state = createServerState(config, generateShutdownToken())
    const path = serverStatePath(config)
    await writeServerState(state, path)

    const raw = await readFile(path, "utf8")
    expect(raw).toContain(state.shutdownToken)

    const read = await readServerState(path)
    expect(read.ok).toBe(true)
    if (read.ok) expect(read.state).toEqual(state)
    expect(publicServerState(state).shutdownToken).toBe("<redacted>")
    expect(serverStateMatchesConfig(state, config)).toBe(true)
    expect(serverStateMatchesConfig(state, { ...config, artifactsDir: "/tmp/other-artifacts" })).toBe(false)

    await removeServerState(path)
    expect(await readServerState(path)).toEqual({ ok: false, path, reason: "missing" })
  })

  test("matches artifact stores reached through symlink aliases", async () => {
    const store = join(dir, "store")
    const alias = join(dir, "store-alias")
    await mkdir(store)
    await symlink(store, alias)
    const state = createServerState({ ...config, artifactsDir: store }, generateShutdownToken())
    expect(serverStateMatchesConfig(state, { ...config, artifactsDir: alias })).toBe(true)
  })

  test("reports corrupt state", async () => {
    const path = serverStatePath(config)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, "not json", "utf8")
    const read = await readServerState(path)
    expect(read.ok).toBe(false)
    if (!read.ok) expect(read.reason).toBe("corrupt")
  })

  test("rejects invalid state shape with field-level error", async () => {
    const path = serverStatePath(config)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify({
      ...createServerState(config, generateShutdownToken()),
      port: 70000,
      extra: true,
    }), "utf8")
    const read = await readServerState(path)
    expect(read.ok).toBe(false)
    if (!read.ok) {
      expect(read.reason).toBe("corrupt")
      expect(read.error).toContain("port")
    }
  })

  test("matches bearer tokens without accepting missing or wrong tokens", () => {
    const token = generateShutdownToken()
    expect(bearerTokenMatches(`Bearer ${token}`, token)).toBe(true)
    expect(bearerTokenMatches(null, token)).toBe(false)
    expect(bearerTokenMatches("Bearer wrong", token)).toBe(false)
  })

  test("classifies installed and development visualizer serve commands", () => {
    expect(classifyVisualizerServerProcess("/Users/me/.local/bin/visual-artifact serve --no-open")).toEqual({
      matches: true,
      reason: "installed-binary",
      command: "/Users/me/.local/bin/visual-artifact serve --no-open",
    })
    expect(classifyVisualizerServerProcess("bun /repo/cli/src/main.ts serve --no-open")).toEqual({
      matches: true,
      reason: "dev-main",
      command: "bun /repo/cli/src/main.ts serve --no-open",
    })
    expect(classifyVisualizerServerProcess("python -m http.server 9998")).toEqual({
      matches: false,
      reason: "not-serve",
      command: "python -m http.server 9998",
    })
    expect(commandLooksLikeVisualizerServer("/Users/me/.local/bin/visual-artifact serve --no-open")).toBe(true)
  })

  test("matches listener addresses against target host and port", () => {
    expect(listenerAddressMatchesHost("127.0.0.1:9998", "127.0.0.1", 9998)).toBe(true)
    expect(listenerAddressMatchesHost("localhost:9998", "127.0.0.1", 9998)).toBe(true)
    expect(listenerAddressMatchesHost("*:9998", "127.0.0.1", 9998)).toBe(true)
    expect(listenerAddressMatchesHost("0.0.0.0:9998", "127.0.0.1", 9998)).toBe(true)
    expect(listenerAddressMatchesHost("[::]:9998", "127.0.0.1", 9998)).toBe(true)
    expect(listenerAddressMatchesHost("127.0.0.1:9999", "127.0.0.1", 9998)).toBe(false)
    expect(listenerAddressMatchesHost("192.168.1.4:9998", "127.0.0.1", 9998)).toBe(false)
  })
})
