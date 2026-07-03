import { describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile, mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serveApi, serveData } from "./serve.ts"

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
})
