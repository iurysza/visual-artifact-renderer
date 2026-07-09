import { describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile, mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serveApi, serveData, serveShutdownApi } from "./serve.ts"

async function makeTempDir(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix))
}

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

const validMutation = {
  type: "createThread" as const,
  thread: validThread,
}

describe("serveShutdownApi", () => {
  test("rejects missing authorization", async () => {
    let called = false
    const response = serveShutdownApi(
      new Request("http://localhost/api/shutdown", { method: "POST" }),
      "/api/shutdown",
      "/api/shutdown",
      "secret-token-secret-token-secret-token",
      () => { called = true },
    )
    expect(response.status).toBe(401)
    expect(called).toBe(false)
  })

  test("rejects wrong token", async () => {
    let called = false
    const response = serveShutdownApi(
      new Request("http://localhost/api/shutdown", { method: "POST", headers: { Authorization: "Bearer wrong-token" } }),
      "/api/shutdown",
      "/api/shutdown",
      "secret-token-secret-token-secret-token",
      () => { called = true },
    )
    expect(response.status).toBe(403)
    expect(called).toBe(false)
  })

  test("accepts matching token", async () => {
    let called = false
    const token = "secret-token-secret-token-secret-token"
    const response = serveShutdownApi(
      new Request("http://localhost/api/shutdown", { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
      "/api/shutdown",
      "/api/shutdown",
      token,
      () => { called = true },
    )
    expect(response.status).toBe(200)
    expect(called).toBe(true)
    expect(await response.text()).not.toContain(token)
  })

  test("rejects non-POST", async () => {
    let called = false
    const response = serveShutdownApi(
      new Request("http://localhost/api/shutdown", { method: "GET" }),
      "/api/shutdown",
      "/api/shutdown",
      "secret-token-secret-token-secret-token",
      () => { called = true },
    )
    expect(response.status).toBe(405)
    expect(called).toBe(false)
  })
})

describe("serveData annotations endpoint", () => {
  test("returns empty document when annotations.json is missing", async () => {
    const dir = await makeTempDir("visualizer-serve-data-")
    try {
      const response = await serveData("/data/artifacts/example-project/example-artifact/annotations.json", dir, "/data/artifacts")
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual({ version: 1, project: "example-project", slug: "example-artifact", threads: [] })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test("returns existing annotations.json", async () => {
    const dir = await makeTempDir("visualizer-serve-data-")
    try {
      const bundleDir = join(dir, "example-project", "example-artifact")
      await mkdir(bundleDir, { recursive: true })
      const doc = { version: 1, project: "example-project", slug: "example-artifact", threads: [validThread] }
      await writeFile(join(bundleDir, "annotations.json"), JSON.stringify(doc), "utf8")

      const response = await serveData("/data/artifacts/example-project/example-artifact/annotations.json", dir, "/data/artifacts")
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.threads).toHaveLength(1)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test("rejects path traversal in route segments", async () => {
    const dir = await makeTempDir("visualizer-serve-data-")
    try {
      const response = await serveData("/data/artifacts/../secret/artifact/annotations.json", dir, "/data/artifacts")
      expect(response.status).toBe(404)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe("serveApi annotations endpoint", () => {
  test("author endpoint returns an author", async () => {
    const dir = await makeTempDir("visualizer-serve-api-")
    try {
      const response = await serveApi(new Request("http://localhost/api/annotations/author"), "/api/annotations/author", dir, "/api/annotations")
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.name).toBeTruthy()
      expect(body.email).toBeTruthy()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test("POST mutation creates thread and writes annotations.json", async () => {
    const dir = await makeTempDir("visualizer-serve-api-")
    try {
      const req = new Request("http://localhost/api/annotations/example-project/example-artifact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validMutation),
      })
      const response = await serveApi(req, "/api/annotations/example-project/example-artifact", dir, "/api/annotations")
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.threads).toHaveLength(1)

      const read = await serveData("/data/artifacts/example-project/example-artifact/annotations.json", dir, "/data/artifacts")
      const readBody = await read.json()
      expect(readBody.threads).toHaveLength(1)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test("POST invalid mutation returns 400", async () => {
    const dir = await makeTempDir("visualizer-serve-api-")
    try {
      const req = new Request("http://localhost/api/annotations/example-project/example-artifact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "unknownMutation" }),
      })
      const response = await serveApi(req, "/api/annotations/example-project/example-artifact", dir, "/api/annotations")
      expect(response.status).toBe(400)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test("POST to invalid route returns 404", async () => {
    const dir = await makeTempDir("visualizer-serve-api-")
    try {
      const req = new Request("http://localhost/api/annotations/../secret/artifact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validMutation),
      })
      const response = await serveApi(req, "/api/annotations/../secret/artifact", dir, "/api/annotations")
      expect(response.status).toBe(404)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test("POST editMessage updates message body", async () => {
    const dir = await makeTempDir("visualizer-serve-api-")
    try {
      const createReq = new Request("http://localhost/api/annotations/example-project/example-artifact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validMutation),
      })
      await serveApi(createReq, "/api/annotations/example-project/example-artifact", dir, "/api/annotations")

      const editReq = new Request("http://localhost/api/annotations/example-project/example-artifact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "editMessage",
          threadId: validThread.id,
          messageId: validThread.messages[0].id,
          body: "Updated wording.",
          updatedAt: "2026-07-04T00:00:00.000Z",
        }),
      })
      const response = await serveApi(editReq, "/api/annotations/example-project/example-artifact", dir, "/api/annotations")
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.threads[0].messages[0].body).toBe("Updated wording.")
      expect(body.threads[0].messages[0].updatedAt).toBe("2026-07-04T00:00:00.000Z")
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test("POST deleteMessage removes message and deletes empty thread", async () => {
    const dir = await makeTempDir("visualizer-serve-api-")
    try {
      const createReq = new Request("http://localhost/api/annotations/example-project/example-artifact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validMutation),
      })
      await serveApi(createReq, "/api/annotations/example-project/example-artifact", dir, "/api/annotations")

      const deleteReq = new Request("http://localhost/api/annotations/example-project/example-artifact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "deleteMessage",
          threadId: validThread.id,
          messageId: validThread.messages[0].id,
        }),
      })
      const response = await serveApi(deleteReq, "/api/annotations/example-project/example-artifact", dir, "/api/annotations")
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.threads).toHaveLength(0)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
