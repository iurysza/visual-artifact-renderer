import { describe, expect, test } from "bun:test"
import { handleRequest } from "../src/routes.ts"
import type { Env } from "../src/routes.ts"
import { LOCAL_ANONYMOUS_AUTHOR } from "../src/annotations.ts"

function mockR2Bucket(
  objects: Map<string, { body: string; uploaded: Date }>,
  options: { alwaysConflict?: boolean } = {},
): R2Bucket {
  const versions = new Map(Array.from(objects.keys(), (key) => [key, 1]))

  const metadata = (key: string): R2Object | null => {
    const object = objects.get(key)
    if (!object) return null
    const etag = `"${key}-v${versions.get(key) ?? 1}"`
    return {
      key,
      version: String(versions.get(key) ?? 1),
      size: object.body.length,
      etag,
      httpEtag: etag,
      uploaded: object.uploaded,
      httpMetadata: { contentType: "application/json" },
      customMetadata: {},
      checksums: {},
      storageClass: "Standard",
      writeHttpMetadata: (headers: Headers) => headers.set("Content-Type", "application/json"),
    } as unknown as R2Object
  }

  return {
    list: async ({ prefix }: { prefix?: string } = {}) => {
      const matching = Array.from(objects.keys())
        .filter((key) => prefix === undefined || key.startsWith(prefix))
        .map((key) => metadata(key)!)
      return { objects: matching, truncated: false, cursor: undefined, delimitedPrefixes: [] }
    },
    head: async (key: string) => metadata(key),
    get: async (key: string) => {
      const object = objects.get(key)
      const objectMetadata = metadata(key)
      if (!object || !objectMetadata) return null
      return {
        ...objectMetadata,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(object.body))
            controller.close()
          },
        }),
        bodyUsed: false,
        arrayBuffer: async () => new TextEncoder().encode(object.body).buffer,
        bytes: async () => new TextEncoder().encode(object.body),
        text: async () => object.body,
        json: async () => JSON.parse(object.body),
        blob: async () => new Blob([object.body]),
      } as unknown as R2ObjectBody
    },
    put: async (
      key: string,
      value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob | null,
      putOptions?: R2PutOptions,
    ) => {
      if (options.alwaysConflict) return null
      const current = metadata(key)
      const onlyIf = putOptions?.onlyIf
      const condition = onlyIf instanceof Headers
        ? {
            etagMatches: onlyIf.get("if-match") ?? undefined,
            etagDoesNotMatch: onlyIf.get("if-none-match") ?? undefined,
          }
        : onlyIf
      if (condition?.etagMatches && current?.etag !== condition.etagMatches) return null
      if (condition?.etagDoesNotMatch === "*" && current) return null

      if (value === null) {
        objects.delete(key)
        versions.delete(key)
        return null
      }
      let body: string
      if (typeof value === "string") body = value
      else if (value instanceof Blob) body = await value.text()
      else if (ArrayBuffer.isView(value)) body = new TextDecoder().decode(value)
      else if (value instanceof ArrayBuffer) body = new TextDecoder().decode(value)
      else body = await new Response(value).text()

      objects.set(key, { body, uploaded: new Date() })
      versions.set(key, (versions.get(key) ?? 0) + 1)
      return metadata(key)
    },
  } as unknown as R2Bucket
}

function mockAssets(): Fetcher {
  return {
    fetch: async (request: Request) => {
      const url = new URL(request.url)
      return new Response(`asset:${url.pathname}`, { status: 200, headers: { "Content-Type": "text/html" } })
    },
  } as unknown as Fetcher
}

function envWithObjects(
  objects: Map<string, { body: string; uploaded: Date }>,
  options?: { alwaysConflict?: boolean },
): Env {
  return { BUCKET: mockR2Bucket(objects, options), ASSETS: mockAssets() }
}

function objectsWithArtifact(): Map<string, { body: string; uploaded: Date }> {
  return new Map([
    [
      "artifacts/demo/hello/artifact.json",
      { body: JSON.stringify({ slug: "hello", title: "Hello", nodes: [] }), uploaded: new Date() },
    ],
  ])
}

function createThreadMutation(id: string, body = id) {
  return {
    type: "createThread",
    thread: {
      id,
      anchor: { nodePath: "nodes.0", nodeType: "text" },
      status: "open",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      messages: [
        {
          id: `msg-${id}`,
          author: LOCAL_ANONYMOUS_AUTHOR,
          body,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
    },
  }
}

describe("Worker routes", () => {
  test("serves artifact JSON from R2", async () => {
    const objects = new Map([["artifacts/demo/hello/artifact.json", { body: '{"title":"Hello"}', uploaded: new Date() }]])
    const env = envWithObjects(objects)
    const response = await handleRequest(new Request("https://example.com/data/artifacts/demo/hello/artifact.json"), env, {} as ExecutionContext)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('{"title":"Hello"}')
  })

  test("synthesizes empty annotations.json when missing for an existing artifact", async () => {
    const env = envWithObjects(objectsWithArtifact())
    const response = await handleRequest(new Request("https://example.com/data/artifacts/demo/hello/annotations.json"), env, {} as ExecutionContext)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ version: 1, project: "demo", slug: "hello", threads: [] })
  })

  test("serves assets with slash hierarchy", async () => {
    const objects = new Map([
      ["artifacts/demo/hello/assets/diagrams/flow.svg", { body: "<svg/>", uploaded: new Date() }],
    ])
    const env = envWithObjects(objects)
    const response = await handleRequest(new Request("https://example.com/data/artifacts/demo/hello/assets/diagrams/flow.svg"), env, {} as ExecutionContext)
    expect(response.status).toBe(200)
  })

  test("rejects path traversal in asset paths", async () => {
    const env = envWithObjects(new Map())
    const response = await handleRequest(new Request("https://example.com/data/artifacts/demo/hello/assets/../secret.json"), env, {} as ExecutionContext)
    expect(response.status).toBe(404)
  })

  test("generates home index from R2 list", async () => {
    const objects = new Map([
      ["artifacts/demo/hello/artifact.json", { body: '{"title":"Hello"}', uploaded: new Date("2026-01-02T00:00:00Z") }],
      ["artifacts/demo/world/artifact.json", { body: '{"title":"World"}', uploaded: new Date("2026-01-01T00:00:00Z") }],
    ])
    const env = envWithObjects(objects)
    const response = await handleRequest(new Request("https://example.com/data/artifacts/index.json"), env, {} as ExecutionContext)
    expect(response.status).toBe(200)
    const body = (await response.json()) as { projects: Array<{ name: string; artifactCount: number }>; recent: unknown[] }
    expect(body.projects).toHaveLength(1)
    expect(body.projects[0].name).toBe("demo")
    expect(body.projects[0].artifactCount).toBe(2)
    expect(body.recent).toHaveLength(2)
  })

  test("generates project index from R2 list", async () => {
    const objects = new Map([
      ["artifacts/demo/hello/artifact.json", { body: '{"title":"Hello"}', uploaded: new Date("2026-01-02T00:00:00Z") }],
    ])
    const env = envWithObjects(objects)
    const response = await handleRequest(new Request("https://example.com/data/artifacts/demo/index.json"), env, {} as ExecutionContext)
    expect(response.status).toBe(200)
    const body = (await response.json()) as { project: string; artifacts: Array<{ slug: string; title: string }> }
    expect(body.project).toBe("demo")
    expect(body.artifacts[0].slug).toBe("hello")
    expect(body.artifacts[0].title).toBe("Hello")
  })

  test("returns fallback author", async () => {
    const env = envWithObjects(new Map())
    const response = await handleRequest(new Request("https://example.com/api/annotations/author"), env, {} as ExecutionContext)
    expect(response.status).toBe(200)
    const body = (await response.json()) as { name: string; email: string }
    expect(body).toEqual(LOCAL_ANONYMOUS_AUTHOR)
  })

  test("persists annotation mutations", async () => {
    const env = envWithObjects(objectsWithArtifact())
    const mutation = {
      type: "createThread",
      thread: {
        id: "thread-1",
        anchor: { nodePath: "nodes.0", nodeType: "text" },
        status: "open",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        messages: [
          {
            id: "msg-1",
            author: LOCAL_ANONYMOUS_AUTHOR,
            body: "first comment",
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
          },
        ],
      },
    }
    const response = await handleRequest(
      new Request("https://example.com/api/annotations/demo/hello", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([mutation]),
      }),
      env,
      {} as ExecutionContext,
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { threads: Array<{ messages: Array<{ body: string }> }> }
    expect(body.threads).toHaveLength(1)
    expect(body.threads[0].messages[0].body).toBe("first comment")

    const saved = await env.BUCKET.get("artifacts/demo/hello/annotations.json")
    expect(saved).not.toBeNull()
  })

  test("rejects invalid annotation mutations", async () => {
    const env = envWithObjects(objectsWithArtifact())
    const response = await handleRequest(
      new Request("https://example.com/api/annotations/demo/hello", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ type: "unknown" }]),
      }),
      env,
      {} as ExecutionContext,
    )
    expect(response.status).toBe(400)
  })

  test("requires the artifact for annotation reads and writes", async () => {
    const objects = new Map<string, { body: string; uploaded: Date }>()
    const env = envWithObjects(objects)
    const read = await handleRequest(
      new Request("https://example.com/data/artifacts/demo/hello/annotations.json"),
      env,
      {} as ExecutionContext,
    )
    expect(read.status).toBe(404)

    const write = await handleRequest(
      new Request("https://example.com/api/annotations/demo/hello", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([createThreadMutation("missing")]),
      }),
      env,
      {} as ExecutionContext,
    )
    expect(write.status).toBe(404)
    expect(objects.has("artifacts/demo/hello/annotations.json")).toBe(false)
  })

  test("enforces mutation method, content type, and browser origin", async () => {
    const env = envWithObjects(objectsWithArtifact())
    const url = "https://example.com/api/annotations/demo/hello"

    const method = await handleRequest(new Request(url, { method: "PUT" }), env, {} as ExecutionContext)
    expect(method.status).toBe(405)
    expect(method.headers.get("allow")).toBe("POST")

    const contentType = await handleRequest(
      new Request(url, { method: "POST", headers: { "Content-Type": "text/plain" }, body: "[]" }),
      env,
      {} as ExecutionContext,
    )
    expect(contentType.status).toBe(415)

    const origin = await handleRequest(
      new Request(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://evil.example",
          "Sec-Fetch-Site": "cross-site",
        },
        body: JSON.stringify([createThreadMutation("evil")]),
      }),
      env,
      {} as ExecutionContext,
    )
    expect(origin.status).toBe(403)
    expect(origin.headers.get("access-control-allow-origin")).toBeNull()
  })

  test("allows same-origin browser writes", async () => {
    const env = envWithObjects(objectsWithArtifact())
    const response = await handleRequest(
      new Request("https://example.com/api/annotations/demo/hello", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Origin: "https://example.com",
          "Sec-Fetch-Site": "same-origin",
        },
        body: JSON.stringify([createThreadMutation("same-origin")]),
      }),
      env,
      {} as ExecutionContext,
    )
    expect(response.status).toBe(200)
  })

  test("retries simultaneous first writes so both mutations survive", async () => {
    const objects = objectsWithArtifact()
    const env = envWithObjects(objects)
    const request = (id: string) =>
      handleRequest(
        new Request("https://example.com/api/annotations/demo/hello", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([createThreadMutation(id)]),
        }),
        env,
        {} as ExecutionContext,
      )

    const responses = await Promise.all([request("first"), request("second")])
    expect(responses.map((response) => response.status)).toEqual([200, 200])
    const saved = JSON.parse(objects.get("artifacts/demo/hello/annotations.json")!.body) as {
      threads: Array<{ id: string }>
    }
    expect(saved.threads.map((thread) => thread.id).sort()).toEqual(["first", "second"])
  })

  test("returns 409 after conditional-write retries are exhausted", async () => {
    const objects = objectsWithArtifact()
    const env = envWithObjects(objects, { alwaysConflict: true })
    const response = await handleRequest(
      new Request("https://example.com/api/annotations/demo/hello", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([createThreadMutation("conflict")]),
      }),
      env,
      {} as ExecutionContext,
    )
    expect(response.status).toBe(409)
    expect(objects.has("artifacts/demo/hello/annotations.json")).toBe(false)
  })

  test("serves home shell at root", async () => {
    const env = envWithObjects(new Map())
    const response = await handleRequest(new Request("https://example.com/"), env, {} as ExecutionContext)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("asset:/index.html")
  })

  test("serves shell page for artifact route", async () => {
    const env = envWithObjects(new Map())
    const response = await handleRequest(new Request("https://example.com/demo/hello/"), env, {} as ExecutionContext)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("asset:/shell-artifact/")
  })

  test("serves shell page for project route", async () => {
    const env = envWithObjects(new Map())
    const response = await handleRequest(new Request("https://example.com/demo/"), env, {} as ExecutionContext)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("asset:/shell-project/")
  })

  test("serves static assets from root", async () => {
    const env = envWithObjects(new Map())
    const response = await handleRequest(new Request("https://example.com/_next/static/chunks/main.js"), env, {} as ExecutionContext)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("asset:/_next/static/chunks/main.js")
  })

  test("rejects invalid project/slug segments", async () => {
    const env = envWithObjects(new Map())
    const response = await handleRequest(new Request("https://example.com/data/artifacts/bad_project/hello/artifact.json"), env, {} as ExecutionContext)
    expect(response.status).toBe(404)
  })

  test("returns 404 for old /artifacts prefix", async () => {
    const env = envWithObjects(new Map())
    const response = await handleRequest(new Request("https://example.com/artifacts/demo/hello/"), env, {} as ExecutionContext)
    expect(response.status).toBe(404)
  })
})
