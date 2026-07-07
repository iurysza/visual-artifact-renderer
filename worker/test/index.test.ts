import { describe, expect, test } from "bun:test"
import { handleRequest } from "../src/routes.ts"
import type { Env } from "../src/routes.ts"

function mockR2Bucket(objects: Map<string, { body: string; uploaded: Date }>): R2Bucket {
  return {
    list: async ({ prefix }: { prefix?: string } = {}) => {
      const matching = Array.from(objects.entries())
        .filter(([key]) => prefix === undefined || key.startsWith(prefix))
        .map(([key, { uploaded }]) => ({
          key,
          size: 0,
          etag: `"${key}"`,
          httpEtag: `"${key}"`,
          uploaded,
          httpMetadata: new Headers(),
          customMetadata: {},
          range: () => null,
          checksums: {},
          writeHttpMetadata: (headers: Headers) => {},
        }))
      return { objects: matching, truncated: false, cursor: undefined, delimitedPrefixes: [] }
    },
    get: async (key: string) => {
      const obj = objects.get(key)
      if (!obj) return null
      return {
        key,
        size: obj.body.length,
        etag: `"${key}"`,
        httpEtag: `"${key}"`,
        uploaded: obj.uploaded,
        httpMetadata: new Headers({ "Content-Type": "application/json" }),
        customMetadata: {},
        body: new TextEncoder().encode(obj.body),
        text: async () => obj.body,
        writeHttpMetadata: (headers: Headers) => headers.set("Content-Type", "application/json"),
      } as unknown as R2ObjectBody
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

function envWithObjects(objects: Map<string, { body: string; uploaded: Date }>): Env {
  return { BUCKET: mockR2Bucket(objects), ASSETS: mockAssets() }
}

describe("Worker routes", () => {
  test("serves artifact JSON from R2", async () => {
    const objects = new Map([["artifacts/demo/hello/artifact.json", { body: '{"title":"Hello"}', uploaded: new Date() }]])
    const env = envWithObjects(objects)
    const response = await handleRequest(new Request("https://example.com/artifacts/data/artifacts/demo/hello/artifact.json"), env, {} as ExecutionContext)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('{"title":"Hello"}')
  })

  test("synthesizes empty annotations.json when missing", async () => {
    const env = envWithObjects(new Map())
    const response = await handleRequest(new Request("https://example.com/artifacts/data/artifacts/demo/hello/annotations.json"), env, {} as ExecutionContext)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ version: 1, project: "demo", slug: "hello", threads: [] })
  })

  test("serves assets with slash hierarchy", async () => {
    const objects = new Map([
      ["artifacts/demo/hello/assets/diagrams/flow.svg", { body: "<svg/>", uploaded: new Date() }],
    ])
    const env = envWithObjects(objects)
    const response = await handleRequest(new Request("https://example.com/artifacts/data/artifacts/demo/hello/assets/diagrams/flow.svg"), env, {} as ExecutionContext)
    expect(response.status).toBe(200)
  })

  test("rejects path traversal in asset paths", async () => {
    const env = envWithObjects(new Map())
    const response = await handleRequest(new Request("https://example.com/artifacts/data/artifacts/demo/hello/assets/../secret.json"), env, {} as ExecutionContext)
    expect(response.status).toBe(404)
  })

  test("generates home index from R2 list", async () => {
    const objects = new Map([
      ["artifacts/demo/hello/artifact.json", { body: '{"title":"Hello"}', uploaded: new Date("2026-01-02T00:00:00Z") }],
      ["artifacts/demo/world/artifact.json", { body: '{"title":"World"}', uploaded: new Date("2026-01-01T00:00:00Z") }],
    ])
    const env = envWithObjects(objects)
    const response = await handleRequest(new Request("https://example.com/artifacts/data/artifacts/index.json"), env, {} as ExecutionContext)
    expect(response.status).toBe(200)
    const body = (await response.json()) as { projects: Array<{ name: string; artifactCount: number }> }
    expect(body.projects).toHaveLength(1)
    expect(body.projects[0].name).toBe("demo")
    expect(body.projects[0].artifactCount).toBe(2)
  })

  test("generates project index from R2 list", async () => {
    const objects = new Map([
      ["artifacts/demo/hello/artifact.json", { body: '{"title":"Hello"}', uploaded: new Date("2026-01-02T00:00:00Z") }],
    ])
    const env = envWithObjects(objects)
    const response = await handleRequest(new Request("https://example.com/artifacts/data/artifacts/demo/index.json"), env, {} as ExecutionContext)
    expect(response.status).toBe(200)
    const body = (await response.json()) as { project: string; artifacts: Array<{ slug: string; title: string }> }
    expect(body.project).toBe("demo")
    expect(body.artifacts[0].slug).toBe("hello")
    expect(body.artifacts[0].title).toBe("Hello")
  })

  test("returns 501 for annotation mutations", async () => {
    const env = envWithObjects(new Map())
    const response = await handleRequest(new Request("https://example.com/artifacts/api/annotations/demo/hello", { method: "POST" }), env, {} as ExecutionContext)
    expect(response.status).toBe(501)
  })

  test("serves shell page for artifact route", async () => {
    const env = envWithObjects(new Map())
    const response = await handleRequest(new Request("https://example.com/artifacts/demo/hello/"), env, {} as ExecutionContext)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("asset:/shell-artifact/")
  })

  test("serves shell page for project route", async () => {
    const env = envWithObjects(new Map())
    const response = await handleRequest(new Request("https://example.com/artifacts/demo/"), env, {} as ExecutionContext)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("asset:/shell-project/")
  })

  test("rejects invalid project/slug segments", async () => {
    const env = envWithObjects(new Map())
    const response = await handleRequest(new Request("https://example.com/artifacts/data/artifacts/bad_project/hello/artifact.json"), env, {} as ExecutionContext)
    expect(response.status).toBe(404)
  })
})
