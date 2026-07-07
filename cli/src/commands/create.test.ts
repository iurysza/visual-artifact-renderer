import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtemp, mkdir, rm, writeFile, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { create } from "./create.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))
// cli/assets/contract.json relative to cli/src/commands/
const CONTRACT_PATH = resolve(__dirname, "../../../assets/contract.json")

// Minimal logger capturing output.
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

describe("create: file-tree src resolution", () => {
  let dir: string
  let oldCwd: string
  let oldArtifactsDir: string | undefined

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "va-create-src-"))
    oldCwd = process.cwd()
    oldArtifactsDir = process.env.VISUAL_ARTIFACT_ARTIFACTS_DIR
    process.chdir(dir)
    process.env.VISUAL_ARTIFACT_ARTIFACTS_DIR = join(dir, "artifacts")
  })

  afterEach(async () => {
    process.chdir(oldCwd)
    if (oldArtifactsDir === undefined) delete process.env.VISUAL_ARTIFACT_ARTIFACTS_DIR
    else process.env.VISUAL_ARTIFACT_ARTIFACTS_DIR = oldArtifactsDir
    await rm(dir, { recursive: true, force: true })
  })

  test("expands src into content at create time", async () => {
    const specPath = join(dir, "spec.json")
    const targetFile = join(dir, "src", "button.tsx")
    await mkdir(join(dir, "src"), { recursive: true })
    const fileBody = "export function Button() { return null }\n"
    await writeFile(targetFile, fileBody, "utf8")

    await writeFile(
      specPath,
      JSON.stringify({
        slug: "src-resolve-test",
        title: "src resolve test",
        description: "x",
        nodes: [
          {
            type: "file-tree",
            props: {
              items: [
                { name: "button.tsx", type: "file", src: "src/button.tsx", language: "tsx" },
              ],
            },
          },
        ],
      }),
      "utf8",
    )

    const log = makeLogger()
    const contractPath = CONTRACT_PATH
    const rc = await create(specPath, { dryRun: true, serve: false, contract: contractPath, json: false, plain: false, quiet: false, verbose: false, noColor: false, noInput: false }, log as any)
    expect(rc).toBe(0)
    // dryRun resolves src into content in-memory but does not write. Re-run
    // without dryRun to confirm the written artifact.json carries inlined content.
    log._logs.length = 0
    const rc2 = await create(specPath, { serve: false, contract: contractPath, json: true, plain: false, quiet: false, verbose: false, noColor: false, noInput: false }, log as any)
    expect(rc2).toBe(0)
    const outLine = log._logs.find((l) => l.startsWith("output: "))
    expect(outLine).toBeDefined()
    const writtenPath = JSON.parse(outLine!.slice("output: ".length)).path as string
    const out = JSON.parse(await readFile(writtenPath, "utf8"))
    const item = out.nodes[0].props.items[0]
    expect(item.content).toBe(fileBody)
    expect(item.src).toBe("src/button.tsx")
    expect(item.language).toBe("tsx")
  })

  test("explicit content wins over src", async () => {
    const specPath = join(dir, "spec.json")
    const targetFile = join(dir, "src", "button.tsx")
    await mkdir(join(dir, "src"), { recursive: true })
    await writeFile(targetFile, "REAL FILE CONTENT\n", "utf8")

    const spec = {
      slug: "src-content-wins",
      title: "content wins",
      description: "x",
      nodes: [
        {
          type: "file-tree",
          props: {
            items: [
              {
                name: "button.tsx",
                type: "file",
                src: "src/button.tsx",
                content: "EXPLICIT CONTENT",
              },
            ],
          },
        },
      ],
    }
    await writeFile(specPath, JSON.stringify(spec), "utf8")

    const log = makeLogger()
    const contractPath = CONTRACT_PATH
    const rc = await create(specPath, { dryRun: true, serve: false, contract: contractPath, json: false, plain: false, quiet: false, verbose: false, noColor: false, noInput: false }, log as any)
    expect(rc).toBe(0)
    // The in-memory spec keeps explicit content (resolver skips when content set).
    expect((spec.nodes[0] as any).props.items[0].content).toBe("EXPLICIT CONTENT")
  })

  test("hard-fails on unreadable src path", async () => {
    const specPath = join(dir, "spec.json")
    await writeFile(
      specPath,
      JSON.stringify({
        slug: "src-missing",
        title: "missing src",
        description: "x",
        nodes: [
          {
            type: "file-tree",
            props: {
              items: [
                { name: "ghost.tsx", type: "file", src: "does/not/exist.tsx" },
              ],
            },
          },
        ],
      }),
      "utf8",
    )

    const log = makeLogger()
    const contractPath = CONTRACT_PATH
    // Non-dryRun so the resolver runs and throws before write.
    const rc = await create(specPath, { serve: false, contract: contractPath, json: false, plain: false, quiet: false, verbose: false, noColor: false, noInput: false }, log as any)
    expect(rc).toBe(2)
    expect(log._logs.some((l) => l.includes("could not be read"))).toBe(true)
  })
})

describe("create: mermaid content validation", () => {
  let dir: string
  let oldCwd: string
  let oldArtifactsDir: string | undefined

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "va-create-mermaid-"))
    oldCwd = process.cwd()
    oldArtifactsDir = process.env.VISUAL_ARTIFACT_ARTIFACTS_DIR
    process.chdir(dir)
    process.env.VISUAL_ARTIFACT_ARTIFACTS_DIR = join(dir, "artifacts")
  })

  afterEach(async () => {
    process.chdir(oldCwd)
    if (oldArtifactsDir === undefined) delete process.env.VISUAL_ARTIFACT_ARTIFACTS_DIR
    else process.env.VISUAL_ARTIFACT_ARTIFACTS_DIR = oldArtifactsDir
    await rm(dir, { recursive: true, force: true })
  })

  test("rejects a broken mermaid graph before writing", async () => {
    const specPath = join(dir, "spec.json")
    await writeFile(
      specPath,
      JSON.stringify({
        slug: "broken-mermaid",
        title: "broken mermaid",
        description: "x",
        nodes: [
          { type: "mermaid", props: { code: "graph TD\n  A -- B" } },
        ],
      }),
      "utf8",
    )

    const log = makeLogger()
    const rc = await create(specPath, { dryRun: true, serve: false, contract: CONTRACT_PATH, json: false, plain: false, quiet: false, verbose: false, noColor: false, noInput: false }, log as any)
    expect(rc).toBe(2)
    expect(log._logs.some((l) => l.includes("Mermaid diagram at nodes[0]<mermaid> is invalid"))).toBe(true)
  })

  test("accepts a valid mermaid graph", async () => {
    const specPath = join(dir, "spec.json")
    await writeFile(
      specPath,
      JSON.stringify({
        slug: "valid-mermaid",
        title: "valid mermaid",
        description: "x",
        nodes: [
          { type: "mermaid", props: { code: "flowchart TD\n  A --> B" } },
        ],
      }),
      "utf8",
    )

    const log = makeLogger()
    const rc = await create(specPath, { dryRun: true, serve: false, contract: CONTRACT_PATH, json: false, plain: false, quiet: false, verbose: false, noColor: false, noInput: false }, log as any)
    expect(rc).toBe(0)
  })
})
