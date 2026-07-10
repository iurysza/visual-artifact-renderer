import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import {
  mkdtemp,
  mkdir,
  rm,
  writeFile,
  readFile,
  stat,
  symlink,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import {
  MAX_AGGREGATE_FILE_SOURCE_BYTES,
  MAX_FILE_SOURCE_BYTES,
  RAW_ARTIFACT_MAX_BYTES,
} from "@agents/visual-artifact-annotations/contract"

import { create } from "./create.ts"
import { makeLogger } from "./__test__/logger.ts"

const EMPTY_GLOBAL_OPTS = {
  json: false,
  plain: false,
  quiet: false,
  verbose: false,
  noColor: false,
  noInput: false,
}

function baseSpec(overrides: { slug?: string; items?: unknown[] } = {}) {
  return {
    slug: overrides.slug ?? "source-safety",
    title: "source safety",
    description: "x",
    nodes: [
      {
        type: "file-tree",
        props: {
          items: overrides.items ?? [],
        },
      },
    ],
  }
}

async function writeSpec(dir: string, spec: unknown): Promise<string> {
  const path = join(dir, "spec.json")
  await writeFile(path, JSON.stringify(spec), "utf8")
  return path
}

async function writeFakeCloudflareProfile(configDir: string): Promise<void> {
  const profileDir = join(configDir, "visual-artifact", "publish-profiles")
  await mkdir(profileDir, { recursive: true })
  await writeFile(
    join(profileDir, "cloudflare.json"),
    JSON.stringify(
      {
        version: 1,
        provider: "cloudflare",
        accountId: "test-account",
        bucketName: "test-bucket",
        workerName: "test-worker",
        baseUrl: "https://test-worker.test-subdomain.workers.dev",
        cloudBuildRouteStrategy: "zero-pages",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      null,
      2,
    ),
    "utf8",
  )
}

describe("create: source read containment", () => {
  let dir: string
  let oldCwd: string
  let oldArtifactsDir: string | undefined
  let oldXdgConfig: string | undefined
  let oldR2AccessKey: string | undefined
  let oldR2Secret: string | undefined

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "va-create-safety-"))
    oldCwd = process.cwd()
    oldArtifactsDir = process.env.VISUAL_ARTIFACT_ARTIFACTS_DIR
    oldXdgConfig = process.env.XDG_CONFIG_HOME
    oldR2AccessKey = process.env.VISUAL_ARTIFACT_CLOUDFLARE_R2_ACCESS_KEY_ID
    oldR2Secret = process.env.VISUAL_ARTIFACT_CLOUDFLARE_R2_SECRET_ACCESS_KEY
    process.chdir(dir)
    process.env.VISUAL_ARTIFACT_ARTIFACTS_DIR = join(dir, "artifacts")
    delete process.env.XDG_CONFIG_HOME
  })

  afterEach(async () => {
    process.chdir(oldCwd)
    if (oldArtifactsDir === undefined) delete process.env.VISUAL_ARTIFACT_ARTIFACTS_DIR
    else process.env.VISUAL_ARTIFACT_ARTIFACTS_DIR = oldArtifactsDir
    if (oldXdgConfig === undefined) delete process.env.XDG_CONFIG_HOME
    else process.env.XDG_CONFIG_HOME = oldXdgConfig
    if (oldR2AccessKey === undefined) delete process.env.VISUAL_ARTIFACT_CLOUDFLARE_R2_ACCESS_KEY_ID
    else process.env.VISUAL_ARTIFACT_CLOUDFLARE_R2_ACCESS_KEY_ID = oldR2AccessKey
    if (oldR2Secret === undefined) delete process.env.VISUAL_ARTIFACT_CLOUDFLARE_R2_SECRET_ACCESS_KEY
    else process.env.VISUAL_ARTIFACT_CLOUDFLARE_R2_SECRET_ACCESS_KEY = oldR2Secret
    await rm(dir, { recursive: true, force: true })
  })

  test("relative project file is inlined and src is stripped", async () => {
    const project = join(dir, "project")
    const srcDir = join(project, "src")
    await mkdir(srcDir, { recursive: true })
    const body = "export function Button() { return null }\n"
    await writeFile(join(srcDir, "button.tsx"), body, "utf8")

    const specPath = await writeSpec(
      dir,
      baseSpec({
        items: [{ name: "button.tsx", type: "file", src: "src/button.tsx", language: "tsx" }],
      }),
    )

    const log = makeLogger()
    const rc = await create(
      specPath,
      { ...EMPTY_GLOBAL_OPTS, project, serve: false },
      log as any,
    )
    expect(rc).toBe(0)

    const outLine = log._logs.find((l) => l.startsWith("output: "))
    expect(outLine).toBeDefined()
    const result = JSON.parse(outLine!.slice("output: ".length))
    expect(result.safety.diskSources.included).toBe(true)
    expect(result.safety.diskSources.count).toBe(1)
    expect(result.safety.diskSources.files[0].displayPath).toBe("src/button.tsx")

    const written = JSON.parse(await readFile(result.path, "utf8"))
    expect(written.nodes[0].props.items[0].content).toBe(body)
    expect(written.nodes[0].props.items[0].src).toBeUndefined()
  })

  test("resolves file-tree sources nested in tabs and accordions", async () => {
    const project = join(dir, "project")
    await mkdir(project, { recursive: true })
    await writeFile(join(project, "tab.txt"), "tab content", "utf8")
    await writeFile(join(project, "accordion.txt"), "accordion content", "utf8")
    const specPath = await writeSpec(dir, {
      slug: "nested-sources",
      title: "Nested sources",
      nodes: [
        {
          type: "tabs",
          props: {
            items: [
              {
                value: "one",
                label: "One",
                nodes: [
                  {
                    type: "file-tree",
                    props: { items: [{ name: "tab.txt", type: "file", src: "tab.txt" }] },
                  },
                ],
              },
            ],
          },
        },
        {
          type: "accordion",
          props: {
            items: [
              {
                title: "One",
                nodes: [
                  {
                    type: "file-tree",
                    props: {
                      items: [{ name: "accordion.txt", type: "file", src: "accordion.txt" }],
                    },
                  },
                ],
              },
            ],
          },
        },
      ],
    })

    const log = makeLogger()
    const rc = await create(specPath, { ...EMPTY_GLOBAL_OPTS, project, serve: false }, log as any)
    expect(rc).toBe(0)

    const outLine = log._logs.find((line) => line.startsWith("output: "))
    const result = JSON.parse(outLine!.slice("output: ".length))
    expect(result.safety.diskSources.count).toBe(2)
    const written = JSON.parse(await readFile(result.path, "utf8"))
    expect(written.nodes[0].props.items[0].nodes[0].props.items[0]).toEqual({
      name: "tab.txt",
      type: "file",
      content: "tab content",
    })
    expect(written.nodes[1].props.items[0].nodes[0].props.items[0]).toEqual({
      name: "accordion.txt",
      type: "file",
      content: "accordion content",
    })
  })

  test("rejects raw .. traversal even if target exists", async () => {
    const project = join(dir, "project")
    await mkdir(project, { recursive: true })
    await writeFile(join(dir, "outside.txt"), "secret", "utf8")

    const specPath = await writeSpec(
      dir,
      baseSpec({ items: [{ name: "outside.txt", type: "file", src: "../outside.txt" }] }),
    )

    const log = makeLogger()
    const rc = await create(
      specPath,
      { ...EMPTY_GLOBAL_OPTS, project, serve: false },
      log as any,
    )
    expect(rc).toBe(2)
    expect(log._logs.some((l) => l.includes(".. segment"))).toBe(true)
  })

  test("rejects project symlink that resolves outside project", async () => {
    const project = join(dir, "project")
    await mkdir(project, { recursive: true })
    await writeFile(join(dir, "outside.txt"), "secret", "utf8")
    await symlink(join(dir, "outside.txt"), join(project, "link.txt"))

    const specPath = await writeSpec(
      dir,
      baseSpec({ items: [{ name: "link.txt", type: "file", src: "link.txt" }] }),
    )

    const log = makeLogger()
    const rc = await create(
      specPath,
      { ...EMPTY_GLOBAL_OPTS, project, serve: false },
      log as any,
    )
    expect(rc).toBe(2)
    const errors = log._logs.filter((line) => line.startsWith("error: "))
    expect(errors.some((line) => line.includes("escapes project root"))).toBe(true)
    expect(errors.some((line) => line.includes(dir))).toBe(false)
  })

  test("rejects absolute project src without explicit grant", async () => {
    const project = join(dir, "project")
    const srcDir = join(project, "src")
    await mkdir(srcDir, { recursive: true })
    await writeFile(join(srcDir, "button.tsx"), "export {}", "utf8")

    const specPath = await writeSpec(
      dir,
      baseSpec({
        items: [
          {
            name: "button.tsx",
            type: "file",
            src: resolve(srcDir, "button.tsx"),
            language: "tsx",
          },
        ],
      }),
    )

    const log = makeLogger()
    const rc = await create(
      specPath,
      { ...EMPTY_GLOBAL_OPTS, project, serve: false },
      log as any,
    )
    expect(rc).toBe(2)
    expect(log._logs.some((l) => l.includes("absolute file-tree src is outside"))).toBe(true)
  })

  test("rejects outside absolute src without grant", async () => {
    const project = join(dir, "project")
    await mkdir(project, { recursive: true })
    const outside = join(dir, "outside")
    await mkdir(outside, { recursive: true })
    await writeFile(join(outside, "file.txt"), "secret", "utf8")

    const specPath = await writeSpec(
      dir,
      baseSpec({
        items: [{ name: "file.txt", type: "file", src: join(outside, "file.txt") }],
      }),
    )

    const log = makeLogger()
    const rc = await create(
      specPath,
      { ...EMPTY_GLOBAL_OPTS, project, serve: false },
      log as any,
    )
    expect(rc).toBe(2)
    expect(log._logs.some((l) => l.includes("absolute file-tree src is outside"))).toBe(true)
  })

  test("allows outside absolute src under repeated --allow-read", async () => {
    const project = join(dir, "project")
    await mkdir(project, { recursive: true })
    const allowedA = join(dir, "allowed-a")
    const allowedB = join(dir, "allowed-b")
    await mkdir(allowedA, { recursive: true })
    await mkdir(allowedB, { recursive: true })
    await writeFile(join(allowedA, "a.txt"), "alpha", "utf8")
    await writeFile(join(allowedB, "b.txt"), "beta", "utf8")

    const specPath = await writeSpec(
      dir,
      baseSpec({
        items: [
          { name: "a.txt", type: "file", src: join(allowedA, "a.txt") },
          { name: "b.txt", type: "file", src: join(allowedB, "b.txt") },
        ],
      }),
    )

    const log = makeLogger()
    const rc = await create(
      specPath,
      {
        ...EMPTY_GLOBAL_OPTS,
        project,
        serve: false,
        allowRead: [allowedA, allowedB],
      },
      log as any,
    )
    expect(rc).toBe(0)

    const outLine = log._logs.find((l) => l.startsWith("output: "))
    const result = JSON.parse(outLine!.slice("output: ".length))
    expect(result.safety.diskSources.count).toBe(2)
    expect(result.safety.diskSources.files.map((f: { displayPath: string }) => f.displayPath).sort()).toEqual([
      "a.txt",
      "b.txt",
    ])
  })

  test("canonicalizes symlinked allow root and rejects symlinked candidate escapes", async () => {
    const project = join(dir, "project")
    await mkdir(project, { recursive: true })
    const realAllowed = join(dir, "real-allowed")
    await mkdir(realAllowed, { recursive: true })
    await writeFile(join(realAllowed, "inside.txt"), "inside", "utf8")

    // Allow root is a symlink; candidate path under the symlink must canonicalize
    // to the real directory.
    const allowedLink = join(dir, "allowed-link")
    await symlink(realAllowed, allowedLink)

    const specPath = await writeSpec(
      dir,
      baseSpec({
        items: [{ name: "inside.txt", type: "file", src: join(allowedLink, "inside.txt") }],
      }),
    )

    const log = makeLogger()
    const rc = await create(
      specPath,
      { ...EMPTY_GLOBAL_OPTS, project, serve: false, allowRead: [allowedLink] },
      log as any,
    )
    expect(rc).toBe(0)

    // Candidate symlink inside project pointing outside must be rejected.
    await writeFile(join(dir, "outside.txt"), "secret", "utf8")
    const projectLink = join(project, "escape-link")
    await symlink(join(dir, "outside.txt"), projectLink)

    const specPath2 = await writeSpec(
      dir,
      baseSpec({ items: [{ name: "escape-link", type: "file", src: "escape-link" }] }),
    )
    const log2 = makeLogger()
    const rc2 = await create(
      specPath2,
      { ...EMPTY_GLOBAL_OPTS, project, serve: false },
      log2 as any,
    )
    expect(rc2).toBe(2)
    expect(log2._logs.some((l) => l.includes("escapes project root"))).toBe(true)
  })

  test("allows exactly 512 KiB sourced file", async () => {
    const project = join(dir, "project")
    await mkdir(project, { recursive: true })
    const body = "x".repeat(MAX_FILE_SOURCE_BYTES)
    await writeFile(join(project, "max.txt"), body, "utf8")

    const specPath = await writeSpec(
      dir,
      baseSpec({ items: [{ name: "max.txt", type: "file", src: "max.txt" }] }),
    )

    const log = makeLogger()
    const rc = await create(
      specPath,
      { ...EMPTY_GLOBAL_OPTS, project, serve: false },
      log as any,
    )
    expect(rc).toBe(0)
  })

  test("rejects 512 KiB + 1 sourced file", async () => {
    const project = join(dir, "project")
    await mkdir(project, { recursive: true })
    const body = "x".repeat(MAX_FILE_SOURCE_BYTES + 1)
    await writeFile(join(project, "too-big.txt"), body, "utf8")

    const specPath = await writeSpec(
      dir,
      baseSpec({ items: [{ name: "too-big.txt", type: "file", src: "too-big.txt" }] }),
    )

    const log = makeLogger()
    const rc = await create(
      specPath,
      { ...EMPTY_GLOBAL_OPTS, project, serve: false },
      log as any,
    )
    expect(rc).toBe(2)
    expect(log._logs.some((l) => l.includes("exceeds"))).toBe(true)
  })

  test("rejects aggregate sourced bytes over 1 MiB", async () => {
    const project = join(dir, "project")
    await mkdir(project, { recursive: true })
    const fileBytes = Math.floor(MAX_AGGREGATE_FILE_SOURCE_BYTES / 3) + 1024
    await writeFile(join(project, "a.txt"), "x".repeat(fileBytes), "utf8")
    await writeFile(join(project, "b.txt"), "x".repeat(fileBytes), "utf8")
    await writeFile(join(project, "c.txt"), "x".repeat(fileBytes), "utf8")

    const specPath = await writeSpec(
      dir,
      baseSpec({
        items: [
          { name: "a.txt", type: "file", src: "a.txt" },
          { name: "b.txt", type: "file", src: "b.txt" },
          { name: "c.txt", type: "file", src: "c.txt" },
        ],
      }),
    )

    const log = makeLogger()
    const rc = await create(
      specPath,
      { ...EMPTY_GLOBAL_OPTS, project, serve: false },
      log as any,
    )
    expect(rc).toBe(2)
    expect(log._logs.some((l) => l.includes("aggregate bytes would exceed"))).toBe(true)
  })

  test("rejects final serialized artifact over 2 MiB", async () => {
    const project = join(dir, "project")
    await mkdir(project, { recursive: true })
    await writeFile(join(project, "small.txt"), "x", "utf8")

    const spec = baseSpec({
      items: [
        { name: "big.txt", type: "file", content: "" },
        { name: "small.txt", type: "file", src: "small.txt" },
      ],
    })
    const baseSize = Buffer.byteLength(JSON.stringify(spec), "utf8")
    const contentBytes = RAW_ARTIFACT_MAX_BYTES - baseSize - 1
    ;(spec.nodes[0] as any).props.items[0].content = "x".repeat(contentBytes)
    const specPath = await writeSpec(dir, spec)

    const log = makeLogger()
    const rc = await create(
      specPath,
      { ...EMPTY_GLOBAL_OPTS, project, serve: false },
      log as any,
    )
    expect(rc).toBe(2)
    expect(log._logs.some((l) => l.includes("Final artifact exceeds"))).toBe(true)
  })

  test("explicit content wins over forbidden src without reading disk", async () => {
    const project = join(dir, "project")
    await mkdir(project, { recursive: true })

    const specPath = await writeSpec(
      dir,
      baseSpec({
        items: [
          {
            name: "ghost.txt",
            type: "file",
            src: "/etc/passwd",
            content: "safe content",
          },
        ],
      }),
    )

    const log = makeLogger()
    const rc = await create(
      specPath,
      { ...EMPTY_GLOBAL_OPTS, project, serve: false },
      log as any,
    )
    expect(rc).toBe(0)

    const outLine = log._logs.find((l) => l.startsWith("output: "))
    const result = JSON.parse(outLine!.slice("output: ".length))
    expect(result.safety.diskSources.included).toBe(false)

    const written = JSON.parse(await readFile(result.path, "utf8"))
    expect(written.nodes[0].props.items[0].content).toBe("safe content")
    expect(written.nodes[0].props.items[0].src).toBeUndefined()
  })

  test("dry-run runs same checks and writes nothing", async () => {
    const project = join(dir, "project")
    await mkdir(project, { recursive: true })
    await writeFile(join(dir, "outside.txt"), "secret", "utf8")

    const forbiddenSpec = await writeSpec(
      dir,
      baseSpec({ items: [{ name: "outside.txt", type: "file", src: "../outside.txt" }] }),
    )
    const log1 = makeLogger()
    const rc1 = await create(
      forbiddenSpec,
      { ...EMPTY_GLOBAL_OPTS, project, dryRun: true, serve: false },
      log1 as any,
    )
    expect(rc1).toBe(2)

    const allowedSpec = await writeSpec(
      dir,
      baseSpec({ items: [{ name: "local.txt", type: "file", src: "local.txt" }] }),
    )
    await writeFile(join(project, "local.txt"), "ok", "utf8")
    const log2 = makeLogger()
    const rc2 = await create(
      allowedSpec,
      { ...EMPTY_GLOBAL_OPTS, project, dryRun: true, serve: false },
      log2 as any,
    )
    expect(rc2).toBe(0)
    const outLine = log2._logs.find((l) => l.startsWith("output: "))
    const result = JSON.parse(outLine!.slice("output: ".length))
    expect(result.safety.diskSources.included).toBe(true)

    // Nothing was written to the artifacts directory.
    await expect(stat(join(dir, "artifacts"))).rejects.toBeDefined()
  })

  test("publishes with a warning when disk sources are included", async () => {
    const project = join(dir, "project")
    await mkdir(project, { recursive: true })
    await writeFile(join(project, "src.txt"), "source", "utf8")

    const configDir = join(dir, ".config")
    process.env.XDG_CONFIG_HOME = configDir
    await writeFakeCloudflareProfile(configDir)
    process.env.VISUAL_ARTIFACT_CLOUDFLARE_R2_ACCESS_KEY_ID = "test-key"
    process.env.VISUAL_ARTIFACT_CLOUDFLARE_R2_SECRET_ACCESS_KEY = "test-secret"

    const specPath = await writeSpec(
      dir,
      baseSpec({ items: [{ name: "src.txt", type: "file", src: "src.txt" }] }),
    )

    const log = makeLogger()
    const rc = await create(
      specPath,
      {
        ...EMPTY_GLOBAL_OPTS,
        project,
        serve: false,
        publish: "default",
      },
      log as any,
      {
        publishBundle: async () => ({
          ok: true,
          project: "source-safety",
          slug: "source-safety",
          url: "https://example.com/artifacts/source-safety/source-safety/",
          localUrl: "http://127.0.0.1:9998/artifacts/source-safety/source-safety/",
          remoteObjects: ["artifacts/source-safety/source-safety/artifact.json"],
        }),
      },
    )
    expect(rc).toBe(0)
    expect(log._logs.some((l) => l.includes("disk-sourced content"))).toBe(true)

    const outLine = log._logs.find((l) => l.startsWith("output: "))
    const result = JSON.parse(outLine!.slice("output: ".length))
    expect(result.safety.diskSources.included).toBe(true)
  })

  test("Pi-style invocation without --allow-read preserves required fields", async () => {
    const project = join(dir, "project")
    await mkdir(project, { recursive: true })
    await writeFile(join(project, "button.tsx"), "export {}", "utf8")

    const specPath = await writeSpec(
      dir,
      baseSpec({ items: [{ name: "button.tsx", type: "file", src: "button.tsx" }] }),
    )

    const log = makeLogger()
    const rc = await create(
      specPath,
      { ...EMPTY_GLOBAL_OPTS, project, serve: false, json: true },
      log as any,
    )
    expect(rc).toBe(0)

    const outLine = log._logs.find((l) => l.startsWith("output: "))
    const result = JSON.parse(outLine!.slice("output: ".length))
    expect(result.slug).toBe("source-safety")
    expect(result.projectName).toBeDefined()
    expect(result.projectPath).toBe(project)
    expect(result.path).toBeDefined()
    expect(result.url).toBeDefined()
    expect(result.localUrl).toBeDefined()
  })
})
