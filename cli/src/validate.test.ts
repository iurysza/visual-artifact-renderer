import { describe, expect, test } from "bun:test"
import { readdir, readFile, writeFile, mkdtemp, rm } from "node:fs/promises"
import { resolve, join, dirname } from "node:path"
import { tmpdir } from "node:os"

import {
  ArtifactResourceError,
  ArtifactValidationError,
  RAW_ARTIFACT_MAX_BYTES,
  VisualArtifactSpecSchema,
  parseRawArtifactJson,
  parseVisualArtifactSpec,
  preflightArtifactSpec,
} from "@agents/visual-artifact-annotations/contract"

import { validateSpec, ValidationError } from "./validate.ts"

const FIXTURES_DIR = resolve(import.meta.dir, "..", "..", "shared", "fixtures")
const SAVED_ARTIFACTS_DIR = resolve(import.meta.dir, "..", "..", "artifacts")
const CLI_MAIN = resolve(import.meta.dir, "main.ts")
const CLI_DIR = dirname(CLI_MAIN)

async function loadFixture(...parts: string[]): Promise<unknown> {
  const raw = await readFile(join(FIXTURES_DIR, ...parts), "utf8")
  return JSON.parse(raw)
}

async function findSavedJsonFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    const entryPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await findSavedJsonFiles(entryPath))
    } else if (
      entry.name.endsWith(".json") &&
      entry.name !== "annotations.json" &&
      entry.name !== "publish.json"
    ) {
      files.push(entryPath)
    }
  }
  return files
}

function specWith(node: unknown): unknown {
  return {
    slug: "validation-regression",
    title: "Validation Regression",
    nodes: [node],
  }
}

describe("validateSpec shared schema parity", () => {
  test("accepts valid minimal specs", () => {
    const result = validateSpec(specWith({ type: "text", props: { text: "Hi" } }))
    expect(result.slug).toBe("validation-regression")
  })

  test("rejects slugs longer than 80 chars", () => {
    const spec = specWith({ type: "text", props: { text: "Hi" } })
    ;(spec as Record<string, unknown>).slug = "a".repeat(81)

    expect(() => validateSpec(spec)).toThrow(ValidationError)
    expect(() => validateSpec(spec)).toThrow("slug")
  })

  test("rejects invalid stepper statuses", () => {
    expect(() =>
      validateSpec(
        specWith({
          type: "stepper",
          props: { items: [{ title: "Deploy", status: "todo" }] },
        }),
      ),
    ).toThrow(ValidationError)
  })

  test("accepts valid stepper statuses", () => {
    const result = validateSpec(
      specWith({
        type: "stepper",
        props: { items: [{ title: "Deploy", status: "pending" }] },
      }),
    )
    expect(result.slug).toBe("validation-regression")
  })

  test("rejects malformed nested object-array items", () => {
    expect(() =>
      validateSpec(
        specWith({
          type: "stepper",
          props: { items: [{ title: "Deploy", status: "pending", unexpected: "nope" }] },
        }),
      ),
    ).toThrow(/unexpected/)
  })

  test("rejects file-tree item types outside the enum", () => {
    expect(() =>
      validateSpec(
        specWith({
          type: "file-tree",
          props: { items: [{ name: "src", type: "folder" }] },
        }),
      ),
    ).toThrow(/file|directory/)
  })

  test("accepts valid minimal file-tree items", () => {
    const result = validateSpec(
      specWith({
        type: "file-tree",
        props: { items: [{ name: "README.md" }] },
      }),
    )
    expect(result.nodes).toHaveLength(1)
  })

  test("rejects flow diagrams with too few items", () => {
    expect(() =>
      validateSpec(
        specWith({
          type: "flow",
          props: { items: [{ title: "Only one" }] },
        }),
      ),
    ).toThrow(/>=2/)
  })

  test("rejects empty column arrays", () => {
    expect(() =>
      validateSpec(
        specWith({
          type: "table",
          props: { dataKey: "rows", columns: [] },
        }),
      ),
    ).toThrow(/>=1/)
  })

  test("rejects extra keys in column objects", () => {
    expect(() =>
      validateSpec(
        specWith({
          type: "table",
          props: { dataKey: "rows", columns: [{ key: "name", extra: "nope" }] },
        }),
      ),
    ).toThrow(ValidationError)
  })

  test("rejects extra keys in tab items", () => {
    expect(() =>
      validateSpec(
        specWith({
          type: "tabs",
          props: {
            items: [
              {
                value: "one",
                label: "One",
                nodes: [{ type: "text", props: { text: "Hi" } }],
                extra: "nope",
              },
            ],
          },
        }),
      ),
    ).toThrow(/extra/)
  })

  test("rejects file URLs in image src", () => {
    expect(() =>
      validateSpec(
        specWith({
          type: "image",
          props: { src: "file:///tmp/secret.png", alt: "Secret" },
        }),
      ),
    ).toThrow(/file:\/\//)
  })

  test("rejects file URLs in button href", () => {
    expect(() =>
      validateSpec(
        specWith({
          type: "button",
          props: { label: "Open", href: "file:///tmp/secret" },
        }),
      ),
    ).toThrow(/file|disallowed URL scheme/)
  })

  test("rejects javascript URLs in button href", () => {
    expect(() =>
      validateSpec(
        specWith({
          type: "button",
          props: { label: "Click", href: "javascript:alert(1)" },
        }),
      ),
    ).toThrow(/disallowed URL scheme/)
  })

  test("rejects whitespace-obfuscated javascript URLs in button href", () => {
    expect(() =>
      validateSpec(
        specWith({
          type: "button",
          props: { label: "Click", href: " \njava\tscript:alert(1)" },
        }),
      ),
    ).toThrow(/disallowed URL scheme/)
  })

  test("rejects data URLs in button href", () => {
    expect(() =>
      validateSpec(
        specWith({
          type: "button",
          props: { label: "Click", href: "data:text/html,<script>alert(1)</script>" },
        }),
      ),
    ).toThrow(/disallowed URL scheme/)
  })

  test("accepts relative paths in button href", () => {
    const result = validateSpec(
      specWith({
        type: "button",
        props: { label: "Open", href: "./relative/path" },
      }),
    )
    expect(result.nodes[0].type).toBe("button")
  })

  test("accepts hash links in button href", () => {
    const result = validateSpec(
      specWith({
        type: "button",
        props: { label: "Open", href: "#section" },
      }),
    )
    expect(result.nodes[0].type).toBe("button")
  })

  test("accepts https URLs in button href", () => {
    const result = validateSpec(
      specWith({
        type: "button",
        props: { label: "Open", href: "https://example.com" },
      }),
    )
    expect(result.nodes[0].type).toBe("button")
  })

  test("accepts mailto URLs in button href", () => {
    const result = validateSpec(
      specWith({
        type: "button",
        props: { label: "Email", href: "mailto:test@example.com" },
      }),
    )
    expect(result.nodes[0].type).toBe("button")
  })

  test("rejects unknown schemes in button href", () => {
    expect(() =>
      validateSpec(
        specWith({
          type: "button",
          props: { label: "Open", href: "foo:bar" },
        }),
      ),
    ).toThrow(/disallowed URL scheme/)
  })

  test("requires array-backed data for every dataKey node", () => {
    expect(() =>
      validateSpec(
        specWith({
          type: "pie-chart",
          props: { dataKey: "shares", categoryKey: "name", valueKey: "value" },
        }),
      ),
    ).toThrow(/data\.shares must be an array/)
  })

  test("requires dataset rows to be objects", () => {
    expect(() =>
      validateSpec({
        slug: "invalid-rows",
        title: "Invalid rows",
        data: { shares: [1] },
        nodes: [
          {
            type: "pie-chart",
            props: { dataKey: "shares", categoryKey: "name", valueKey: "value" },
          },
        ],
      }),
    ).toThrow(/data\.shares\[0\] must be an object/)
  })

  test("rejects non-integer diagram heights", () => {
    expect(() =>
      validateSpec(
        specWith({
          type: "mermaid",
          props: { caption: "Flowchart", code: "flowchart LR\n  A --> B", height: 240.5 },
        }),
      ),
    ).toThrow(ValidationError)
  })
})

describe("audit regression fixtures", () => {
  test("unknown root property fails with path", async () => {
    const spec = await loadFixture("invalid", "unknown-root.json")
    const result = VisualArtifactSpecSchema.safeParse(spec)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes("unexpectedRoot"))).toBe(true)
    }
  })

  test("numeric metadata.id fails with path", async () => {
    const spec = await loadFixture("invalid", "metadata-id-number.json")
    const result = VisualArtifactSpecSchema.safeParse(spec)
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."))
      expect(paths.some((p) => p.includes("metadata.id"))).toBe(true)
    }
  })

  test("scalar gitStatus fails with path", async () => {
    const spec = await loadFixture("invalid", "gitstatus-scalar.json")
    const result = VisualArtifactSpecSchema.safeParse(spec)
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."))
      expect(paths.some((p) => p.includes("gitStatus"))).toBe(true)
    }
  })

  test("empty diff props fails with path", async () => {
    const spec = await loadFixture("invalid", "diff-empty.json")
    expect(() => parseVisualArtifactSpec(spec)).toThrow(ArtifactValidationError)
    expect(() => parseVisualArtifactSpec(spec)).toThrow(/diff/)
  })
})

describe("resource envelope", () => {
  test("31 top-level nodes fails", async () => {
    const spec = await loadFixture("invalid", "31-top-level.json")
    expect(() => parseVisualArtifactSpec(spec)).toThrow(ArtifactResourceError)
  })

  test("21 datasets fails", async () => {
    const spec = await loadFixture("invalid", "21-datasets.json")
    expect(() => parseVisualArtifactSpec(spec)).toThrow(ArtifactResourceError)
  })

  test("101 total nodes fails independently", async () => {
    const spec = await loadFixture("invalid", "101-nodes.json")
    expect((spec as { nodes: unknown[] }).nodes).toHaveLength(30)
    expect(() => parseVisualArtifactSpec(spec)).toThrow(ArtifactResourceError)
    expect(VisualArtifactSpecSchema.safeParse(spec).success).toBe(false)
  })

  test("node depth 9 fails without stack overflow", async () => {
    const spec = await loadFixture("invalid", "depth-9.json")
    expect(() => parseVisualArtifactSpec(spec)).toThrow(ArtifactResourceError)
  })

  test("501 file-tree items fails", async () => {
    const spec = await loadFixture("invalid", "file-tree-501.json")
    expect(() => parseVisualArtifactSpec(spec)).toThrow(ArtifactResourceError)
  })

  test("nested 501 file-tree items fails", async () => {
    const spec = await loadFixture("invalid", "file-tree-nested-501.json")
    expect(() => parseVisualArtifactSpec(spec)).toThrow(ArtifactResourceError)
  })

  test("501 items split across file-tree nodes fails the aggregate limit", async () => {
    const spec = await loadFixture("invalid", "file-tree-aggregate-501.json")
    expect(() => parseVisualArtifactSpec(spec)).toThrow(ArtifactResourceError)
  })

  test("file-tree depth 13 fails", async () => {
    const spec = await loadFixture("invalid", "file-tree-depth-13.json")
    expect(() => parseVisualArtifactSpec(spec)).toThrow(ArtifactResourceError)
  })

  test("valid max boundary passes", async () => {
    const spec = await loadFixture("valid", "max-boundary.json")
    const result = parseVisualArtifactSpec(spec)
    const preflight = preflightArtifactSpec(spec).result
    expect(result.nodes.length).toBe(30)
    expect(Object.keys(result.data ?? {})).toHaveLength(20)
    expect(preflight.totalNodes).toBe(100)
    expect(preflight.maxDepth).toBe(8)
    expect(preflight.fileTreeItems).toBe(500)
    expect(preflight.fileTreeMaxDepth).toBe(12)
  })

  test("representative compatibility fixture passes", async () => {
    const spec = await loadFixture("valid", "representative.json")
    const result = parseVisualArtifactSpec(spec)
    expect(result.nodes.length).toBeGreaterThan(0)
  })

  test("very deep input is rejected before recursive Zod parsing", () => {
    let node: Record<string, unknown> = { type: "text", props: { text: "leaf" } }
    for (let depth = 0; depth < 10_000; depth++) {
      node = { type: "card", children: [node] }
    }
    const result = VisualArtifactSpecSchema.safeParse({
      slug: "very-deep",
      title: "Very deep",
      nodes: [node],
    })
    expect(result.success).toBe(false)
  })

  test("raw JSON over 2 MiB fails before full parse", () => {
    const huge = {
      slug: "huge",
      title: "Huge",
      nodes: [{ type: "text", props: { text: "x".repeat(RAW_ARTIFACT_MAX_BYTES + 1000) } }],
    }
    const raw = JSON.stringify(huge)
    expect(() => parseRawArtifactJson(raw)).toThrow(/bytes/)
  })
})

describe("saved artifact compatibility", () => {
  test("all parseable saved artifact specs validate when present", async () => {
    const files = await findSavedJsonFiles(SAVED_ARTIFACTS_DIR)
    if (files.length === 0) {
      // Clean clones ignore the runtime artifacts/ directory. Fall back to the
      // tracked representative compatibility fixture so the gate still asserts
      // real-world structural shapes.
      const spec = await loadFixture("valid", "representative.json")
      const result = parseVisualArtifactSpec(spec)
      expect(result.nodes.length).toBeGreaterThan(0)
      return
    }

    let total = 0
    for (const filePath of files) {
      const raw = await readFile(filePath, "utf8")
      let parsed: unknown
      try {
        parsed = parseRawArtifactJson(raw)
      } catch {
        continue
      }
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !Array.isArray((parsed as Record<string, unknown>).nodes)
      ) {
        continue
      }
      total++
      expect(VisualArtifactSpecSchema.safeParse(parsed).success).toBe(true)
    }
    expect(total).toBeGreaterThanOrEqual(2)
  })
})

describe("CLI subprocess validation", () => {
  async function runValidate(
    fixturePath: string = "-",
    input?: string,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const proc = Bun.spawn([process.execPath, CLI_MAIN, "validate", fixturePath], {
      cwd: CLI_DIR,
      stdin: input === undefined ? "ignore" : "pipe",
      stdout: "pipe",
      stderr: "pipe",
    })
    if (input !== undefined && proc.stdin) {
      proc.stdin.write(input)
      proc.stdin.end()
    }
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    return { exitCode, stdout, stderr }
  }

  test("unknown root property exits 2 with path", async () => {
    const { exitCode, stderr } = await runValidate(join(FIXTURES_DIR, "invalid", "unknown-root.json"))
    expect(exitCode).toBe(2)
    expect(stderr).toContain("unexpectedRoot")
  })

  test("numeric metadata.id exits 2 with bracket path", async () => {
    const { exitCode, stderr } = await runValidate(join(FIXTURES_DIR, "invalid", "metadata-id-number.json"))
    expect(exitCode).toBe(2)
    expect(stderr).toContain("nodes[0].metadata.id")
  })

  test("scalar gitStatus exits 2 with bracket path", async () => {
    const { exitCode, stderr } = await runValidate(join(FIXTURES_DIR, "invalid", "gitstatus-scalar.json"))
    expect(exitCode).toBe(2)
    expect(stderr).toContain("nodes[0].props.gitStatus")
  })

  test("empty diff exits 2 with bracket path", async () => {
    const { exitCode, stderr } = await runValidate(join(FIXTURES_DIR, "invalid", "diff-empty.json"))
    expect(exitCode).toBe(2)
    expect(stderr).toContain("nodes[0].props")
  })

  for (const [fixture, expected] of [
    ["31-top-level.json", "top-level"],
    ["21-datasets.json", "datasets"],
    ["101-nodes.json", "nodes"],
    ["depth-9.json", "deeper"],
    ["file-tree-501.json", "file-tree"],
    ["file-tree-depth-13.json", "file-tree"],
    ["file-tree-aggregate-501.json", "file-tree"],
  ] as const) {
    test(`${fixture} exits 2`, async () => {
      const { exitCode, stderr } = await runValidate(join(FIXTURES_DIR, "invalid", fixture))
      expect(exitCode).toBe(2)
      expect(stderr).toContain(expected)
    })
  }

  test("invalid Mermaid exits 2", async () => {
    const dir = await mkdtemp(join(tmpdir(), "va-mermaid-invalid-"))
    const filePath = join(dir, "invalid.json")
    await writeFile(filePath, JSON.stringify({
      slug: "invalid-mermaid",
      title: "Invalid Mermaid",
      nodes: [{ type: "mermaid", props: { caption: "Broken", code: "graph TD\n A -- B" } }],
    }))
    const { exitCode, stderr } = await runValidate(filePath)
    await rm(dir, { recursive: true, force: true })
    expect(exitCode).toBe(2)
    expect(stderr).toContain("Mermaid diagram")
  })

  test("rejects non-regular file input without blocking", async () => {
    const dir = await mkdtemp(join(tmpdir(), "va-fifo-"))
    const filePath = join(dir, "artifact.fifo")
    const created = Bun.spawnSync(["mkfifo", filePath])
    expect(created.exitCode).toBe(0)
    const { exitCode, stderr } = await runValidate(filePath)
    await rm(dir, { recursive: true, force: true })
    expect(exitCode).toBe(2)
    expect(stderr).toContain("not a regular file")
  })

  test("oversized file exits 2 before full read", async () => {
    const dir = await mkdtemp(join(tmpdir(), "va-oversized-"))
    const filePath = join(dir, "huge.json")
    await writeFile(filePath, "x".repeat(RAW_ARTIFACT_MAX_BYTES + 1), "utf8")
    const { exitCode, stderr } = await runValidate(filePath)
    await rm(dir, { recursive: true, force: true })
    expect(exitCode).toBe(2)
    expect(stderr).toContain("bytes")
  })

  test("oversized stdin exits 2 before full accumulation", async () => {
    const { exitCode, stderr } = await runValidate(
      "-",
      "x".repeat(RAW_ARTIFACT_MAX_BYTES + 1),
    )
    expect(exitCode).toBe(2)
    expect(stderr).toContain("stdin exceeds")
  })
})
