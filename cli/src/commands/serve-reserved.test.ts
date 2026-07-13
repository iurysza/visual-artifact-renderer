import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { createServer } from "node:net"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serve } from "./serve.ts"
import { readServerState, serverStatePath } from "../lib/server-lifecycle.ts"
import type { Config } from "../types.ts"
import { Logger } from "../logger.ts"

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      const port = address && typeof address === "object" ? address.port : 0
      server.close(() => resolve(port))
    })
    server.on("error", reject)
  })
}

function makeLogger() {
  let resolveUrl: (url: string) => void
  const urlPromise = new Promise<string>((resolve) => {
    resolveUrl = resolve
  })
  const logger = {
    url: null as string | null,
    waitForUrl: () => urlPromise,
    error: () => {},
    warn: () => {},
    log: () => {},
    info: () => {},
    success: () => {},
    result: (data: Record<string, unknown>) => {
      if (typeof data.url === "string") {
        logger.url = data.url
        resolveUrl(data.url)
      }
    },
    output: () => {},
    outputText: () => {},
    resultText: () => {},
    structured: () => false,
  }
  return logger
}

describe("serve reserved root segments", () => {
  let dir: string
  let outDir: string
  let artifactsDir: string
  let oldXdgStateHome: string | undefined
  let port: number
  let serverPromise: Promise<number> | null = null
  let logger: ReturnType<typeof makeLogger>

  beforeEach(async () => {
    oldXdgStateHome = process.env.XDG_STATE_HOME
    dir = await mkdtemp(join(tmpdir(), "va-serve-res-"))
    outDir = join(dir, "out")
    artifactsDir = join(dir, "artifacts")
    await mkdir(outDir, { recursive: true })
    await mkdir(join(outDir, "shell-artifact"), { recursive: true })
    await mkdir(join(outDir, "shell-project"), { recursive: true })
    await mkdir(join(artifactsDir, "demo", "hello"), { recursive: true })
    await writeFile(
      join(artifactsDir, "demo", "hello", "artifact.json"),
      JSON.stringify({ slug: "hello", title: "Hello", nodes: [] }),
      "utf8",
    )
    await writeFile(join(outDir, "index.html"), "<html></html>", "utf8")
    await writeFile(join(outDir, "shell-artifact", "index.html"), "<html></html>", "utf8")
    await writeFile(join(outDir, "shell-project", "index.html"), "<html></html>", "utf8")
    process.env.XDG_STATE_HOME = join(dir, "state")
    port = await getFreePort()
    logger = makeLogger()
  })

  afterEach(async () => {
    if (oldXdgStateHome === undefined) delete process.env.XDG_STATE_HOME
    else process.env.XDG_STATE_HOME = oldXdgStateHome
    await rm(dir, { recursive: true, force: true })
  })

  async function startServer(): Promise<{ url: string; stop: () => Promise<void> }> {
    serverPromise = serve(
      { port, host: "127.0.0.1", outDir, artifactsDir, noOpen: true },
      logger as unknown as Logger,
    )
    const url = await logger.waitForUrl()

    const config: Config = {
      artifactsDir,
      outDir,
      port,
      host: "127.0.0.1",
      dataPath: "/data/artifacts",
      open: false,
      allowRemote: false,
    }
    const stateResult = await readServerState(serverStatePath(config))
    if (!stateResult.ok) throw new Error(`server state missing: ${stateResult.reason}`)

    return {
      url,
      stop: async () => {
        const res = await fetch(`${url}/api/shutdown`, {
          method: "POST",
          headers: { Authorization: `Bearer ${stateResult.state.shutdownToken}` },
        })
        expect(res.status).toBe(200)
        await serverPromise
      },
    }
  }

  test("reserved root segments return 404 before shell fallbacks", async () => {
    const { url, stop } = await startServer()
    try {
      for (const path of [
        "/artifacts/",
        "/artifacts/demo/",
        "/artifacts/demo/hello/",
        "/data/foo/",
        "/api/foo/",
        "/shell-artifact/foo/",
      ]) {
        const res = await fetch(`${url}${path}`)
        expect(res.status).toBe(404)
      }
    } finally {
      await stop()
    }
  })

  test("valid project and artifact routes still serve shells", async () => {
    const { url, stop } = await startServer()
    try {
      const project = await fetch(`${url}/demo/`)
      expect(project.status).toBe(200)

      const artifact = await fetch(`${url}/demo/hello/`)
      expect(artifact.status).toBe(200)
    } finally {
      await stop()
    }
  })

  test("_next static assets are served before reserved-root guard", async () => {
    await mkdir(join(outDir, "_next", "static"), { recursive: true })
    await writeFile(join(outDir, "_next", "static", "chunk.js"), "console.log('ok')", "utf8")

    const { url, stop } = await startServer()
    try {
      const existing = await fetch(`${url}/_next/static/chunk.js`)
      expect(existing.status).toBe(200)
      expect(await existing.text()).toBe("console.log('ok')")
      expect(existing.headers.get("content-type")).toContain("javascript")

      const missing = await fetch(`${url}/_next/static/missing.js`)
      expect(missing.status).toBe(404)

      const nonStatic = await fetch(`${url}/_next/foo/`)
      expect(nonStatic.status).toBe(404)
    } finally {
      await stop()
    }
  })
})
