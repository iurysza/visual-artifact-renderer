import { describe, expect, test } from "bun:test"
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ANNOTATION_MUTATION_MAX_BYTES } from "../lib/annotation-body.ts"
import { createFixedWindowRateLimiter } from "../lib/fixed-window-rate-limiter.ts"
import { guardRemoteServeRequest, serveApi, serveExposure } from "./serve.ts"

const API_PATH = "/api/annotations"
const SHUTDOWN_PATH = "/api/shutdown"
const MUTATION_PATH = "/api/annotations/example-project/example-artifact"

const validAuthor = { name: "Iury Souza", email: "iury@example.com" }
const validThread = {
  id: "thr_123",
  anchor: {
    nodeId: "summary-card",
    nodePath: "nodes.1.children.0",
    nodeType: "stat-card",
  },
  status: "open" as const,
  createdAt: "2026-07-03T00:00:00.000Z",
  updatedAt: "2026-07-03T00:00:00.000Z",
  messages: [
    {
      id: "msg_123",
      author: validAuthor,
      body: "This wording is confusing.",
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z",
    },
  ],
}

function mutationWithBody(text: string): string {
  return JSON.stringify({
    type: "createThread",
    thread: {
      ...validThread,
      messages: [{ ...validThread.messages[0], body: text }],
    },
  })
}

function mutationAtByteLength(target: number): string {
  const minimum = mutationWithBody("x")
  const minimumBytes = Buffer.byteLength(minimum, "utf8")
  const extra = target - minimumBytes
  if (extra < 0) throw new Error(`target ${target} is below the minimum mutation of ${minimumBytes} bytes`)
  const payload = mutationWithBody("x".repeat(extra + 1))
  const size = Buffer.byteLength(payload, "utf8")
  if (size !== target) throw new Error(`expected ${target} bytes, got ${size}`)
  return payload
}

function byteStream(total: number, chunkSize: number): ReadableStream<Uint8Array> {
  const payload = new Uint8Array(total)
  let offset = 0
  return new ReadableStream({
    pull(controller) {
      if (offset >= payload.byteLength) {
        controller.close()
        return
      }
      const end = Math.min(offset + chunkSize, payload.byteLength)
      controller.enqueue(payload.subarray(offset, end))
      offset = end
    },
  })
}

async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "visualizer-serve-limits-"))
}

async function writeArtifact(dir: string): Promise<void> {
  const bundleDir = join(dir, "example-project", "example-artifact")
  await mkdir(bundleDir, { recursive: true })
  await writeFile(
    join(bundleDir, "artifact.json"),
    JSON.stringify({ slug: "example-artifact", title: "Example", nodes: [{ type: "text", props: { text: "x" } }] }),
    "utf8",
  )
}

function mutationRequest(body: BodyInit, headers: Record<string, string> = {}): Request {
  return new Request(`http://127.0.0.1${MUTATION_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  })
}

describe("annotation mutation body limit", () => {
  test("rejects a declared body above the cap with JSON 413 and writes nothing", async () => {
    const dir = await makeTempDir()
    try {
      await writeArtifact(dir)
      const response = await serveApi(
        mutationRequest("{}", { "Content-Length": String(ANNOTATION_MUTATION_MAX_BYTES + 1) }),
        MUTATION_PATH,
        dir,
        API_PATH,
      )
      expect(response.status).toBe(413)
      expect(response.headers.get("content-type")).toContain("application/json")
      expect(await response.json()).toEqual({
        error: `Annotation mutation body exceeds ${ANNOTATION_MUTATION_MAX_BYTES} bytes`,
      })
      await expect(access(join(dir, "example-project", "example-artifact", "annotations.json"))).rejects.toThrow()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test("rejects a streamed body above the cap even when Content-Length is smaller or absent", async () => {
    const dir = await makeTempDir()
    try {
      await writeArtifact(dir)
      const undeclaredRequest = mutationRequest(byteStream(ANNOTATION_MUTATION_MAX_BYTES + 1, 16 * 1024))
      expect(undeclaredRequest.headers.get("content-length")).toBeNull()
      const undeclared = await serveApi(undeclaredRequest, MUTATION_PATH, dir, API_PATH)
      expect(undeclared.status).toBe(413)
      expect(await undeclared.json()).toEqual({
        error: `Annotation mutation body exceeds ${ANNOTATION_MUTATION_MAX_BYTES} bytes`,
      })

      const underDeclared = await serveApi(
        mutationRequest(byteStream(ANNOTATION_MUTATION_MAX_BYTES + 32, 8 * 1024), { "Content-Length": "10" }),
        MUTATION_PATH,
        dir,
        API_PATH,
      )
      expect(underDeclared.status).toBe(413)
      await expect(access(join(dir, "example-project", "example-artifact", "annotations.json"))).rejects.toThrow()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test("accepts a mutation body at exactly the cap", async () => {
    const dir = await makeTempDir()
    try {
      await writeArtifact(dir)
      const payload = mutationAtByteLength(ANNOTATION_MUTATION_MAX_BYTES)
      const response = await serveApi(mutationRequest(payload), MUTATION_PATH, dir, API_PATH)
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.threads).toHaveLength(1)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe("remote serve rate limit", () => {
  test("loopback mode does not limit mutation or shutdown requests", () => {
    for (const host of ["127.0.0.1", "localhost", "::1", "127.8.8.8"]) {
      expect(serveExposure({ allowRemote: false, host })).toBe("loopback")
    }

    const limiter = createFixedWindowRateLimiter({ maxRequests: 1, windowMs: 10_000, maxTrackedKeys: 4 })
    const exposure = serveExposure({ allowRemote: false, host: "127.0.0.1" })
    for (let attempt = 0; attempt < 5; attempt++) {
      for (const pathname of [MUTATION_PATH, SHUTDOWN_PATH]) {
        expect(guardRemoteServeRequest({
          exposure,
          method: "POST",
          pathname,
          apiPath: API_PATH,
          shutdownPath: SHUTDOWN_PATH,
          limiter,
          clientKey: "203.0.113.10",
          nowMs: attempt,
        })).toEqual({ action: "continue" })
      }
    }
    expect(limiter.trackedKeyCount()).toBe(0)
  })

  test("remote exposure limits mutation and shutdown and leaves static reads alone", async () => {
    expect(serveExposure({ allowRemote: true, host: "127.0.0.1" })).toBe("remote")
    expect(serveExposure({ allowRemote: false, host: "0.0.0.0" })).toBe("remote")

    const limiter = createFixedWindowRateLimiter({ maxRequests: 1, windowMs: 5_000, maxTrackedKeys: 4 })
    const base = {
      exposure: "remote" as const,
      apiPath: API_PATH,
      shutdownPath: SHUTDOWN_PATH,
      limiter,
      clientKey: "203.0.113.10",
    }

    expect(guardRemoteServeRequest({
      ...base,
      method: "POST",
      pathname: MUTATION_PATH,
      nowMs: 0,
    })).toEqual({ action: "continue" })

    const blocked = guardRemoteServeRequest({
      ...base,
      method: "POST",
      pathname: SHUTDOWN_PATH,
      nowMs: 1_000,
    })
    expect(blocked.action).toBe("respond")
    if (blocked.action !== "respond") return
    expect(blocked.response.status).toBe(429)
    expect(blocked.response.headers.get("retry-after")).toBe("4")
    expect(blocked.response.headers.get("content-type")).toContain("application/json")
    expect(await blocked.response.json()).toEqual({ error: "Too many requests" })

    expect(guardRemoteServeRequest({
      ...base,
      method: "GET",
      pathname: "/_next/static/app.js",
      nowMs: 1_000,
    })).toEqual({ action: "continue" })
    expect(guardRemoteServeRequest({
      ...base,
      method: "GET",
      pathname: "/api/annotations/author",
      nowMs: 1_000,
    })).toEqual({ action: "continue" })
    expect(limiter.trackedKeyCount()).toBe(1)
  })
})
