import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { extractSourceFacts, parseSourceAnchor } from "./source-facts.ts"

const dirs: string[] = []
const rubyFixturePath = resolve(import.meta.dir, "../test-fixtures/source-facts/ruby-trace.rb")
const projectRoot = resolve(import.meta.dir, "../..")

async function sourceFile(name: string, content: string): Promise<{ dir: string; path: string }> {
  const dir = await mkdtemp(join(tmpdir(), "va-source-facts-"))
  dirs.push(dir)
  const path = join(dir, name)
  await writeFile(path, content, "utf8")
  return { dir, path }
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe("source facts", () => {
  test("parses ordered line anchors from the right", () => {
    expect(parseSourceAnchor("src/format.ts:74")).toEqual({ src: "src/format.ts", startLine: 74, endLine: 74 })
    expect(parseSourceAnchor("src/format.ts:67-74")).toEqual({ src: "src/format.ts", startLine: 67, endLine: 74 })
    expect(() => parseSourceAnchor("src/format.ts:74-67")).toThrow("invalid source anchor line range")
  })

  test("extracts the focused callee separately from its enclosing function", async () => {
    const content = [
      "export function formatFooter(windows: number[]) {",
      "  return windows.filter(Boolean)",
      "    .map((window) => formatFooterWindow(window))",
      "    .join(' ')",
      "}",
      "",
    ].join("\n")
    const { dir, path } = await sourceFile("format.ts", content)

    const result = extractSourceFacts({
      canonicalPath: path,
      displayPath: "src/format.ts",
      content,
      projectRoot: dir,
      startLine: 3,
      endLine: 3,
    })

    expect(result.resolution).toBe("resolved")
    if (result.resolution !== "resolved") throw new Error("expected resolved facts")
    expect(result.facts.focus).toEqual({
      kind: "call",
      text: "formatFooterWindow(window)",
      symbol: "formatFooterWindow",
    })
    expect(result.facts.scope?.symbol).toBe("formatFooter")
    expect(result.facts.span).toEqual({ file: "src/format.ts", startLine: 3, endLine: 3 })
    expect(result.facts.excerpt).toBe("    .map((window) => formatFooterWindow(window))")
    expect(result.facts.sourceHash).toMatch(/^[a-f0-9]{64}$/)
  })

  test("keeps the outer call when nested calls share one selected line", async () => {
    const content = "export function clampPercent(value: number) {\n  return Math.max(0, Math.min(100, value))\n}\n"
    const { dir, path } = await sourceFile("clamp.ts", content)

    const result = extractSourceFacts({
      canonicalPath: path,
      displayPath: "clamp.ts",
      content,
      projectRoot: dir,
      startLine: 2,
      endLine: 2,
    })

    expect(result.resolution).toBe("resolved")
    if (result.resolution !== "resolved") throw new Error("expected resolved facts")
    expect(result.facts.focus.symbol).toBe("Math.max")
    expect(result.facts.focus.text).toBe("Math.max(0, Math.min(100, value))")
  })

  test("returns sibling calls as explicit ambiguity", async () => {
    const content = "export function run() { foo(); bar() }\n"
    const { dir, path } = await sourceFile("ambiguous.ts", content)

    const result = extractSourceFacts({
      canonicalPath: path,
      displayPath: "ambiguous.ts",
      content,
      projectRoot: dir,
      startLine: 1,
      endLine: 1,
    })

    expect(result.resolution).toBe("ambiguous")
    if (result.resolution !== "ambiguous") throw new Error("expected ambiguous facts")
    expect(result.candidates.map((candidate) => candidate.focus.symbol)).toEqual(["foo", "bar"])
  })

  test("extracts Ruby calls and their enclosing methods", async () => {
    const content = await readFile(rubyFixturePath, "utf8")

    const result = extractSourceFacts({
      canonicalPath: rubyFixturePath,
      displayPath: "cli/test-fixtures/source-facts/ruby-trace.rb",
      content,
      projectRoot,
      startLine: 4,
      endLine: 4,
    })

    expect(result.resolution).toBe("resolved")
    if (result.resolution !== "resolved") throw new Error("expected resolved facts")
    expect(result.facts.language).toBe("ruby")
    expect(result.facts.syntaxKind).toBe("call")
    expect(result.facts.focus).toEqual({
      kind: "call",
      text: "validator.validate(order)",
      symbol: "validator.validate",
    })
    expect(result.facts.scope).toEqual({
      kind: "method",
      symbol: "call",
      startLine: 3,
      endLine: 7,
    })
  })

  test("extracts Ruby command calls without parentheses", async () => {
    const content = await readFile(rubyFixturePath, "utf8")
    const result = extractSourceFacts({
      canonicalPath: rubyFixturePath,
      displayPath: "ruby-trace.rb",
      content,
      projectRoot,
      startLine: 5,
      endLine: 5,
    })

    expect(result.resolution).toBe("resolved")
    if (result.resolution !== "resolved") throw new Error("expected resolved facts")
    expect(result.facts.focus).toEqual({
      kind: "call",
      text: "audit record: validated",
      symbol: "audit",
    })
  })

  test("omits an unprovable symbol for Ruby callable shorthand", async () => {
    const content = await readFile(rubyFixturePath, "utf8")
    const result = extractSourceFacts({
      canonicalPath: rubyFixturePath,
      displayPath: "ruby-trace.rb",
      content,
      projectRoot,
      startLine: 40,
      endLine: 40,
    })

    expect(result.resolution).toBe("resolved")
    if (result.resolution !== "resolved") throw new Error("expected resolved facts")
    expect(result.facts.focus).toEqual({
      kind: "call",
      text: "callback.(order)",
    })
  })

  test("extracts Ruby method declarations inside class scopes", async () => {
    const content = await readFile(rubyFixturePath, "utf8")
    const result = extractSourceFacts({
      canonicalPath: rubyFixturePath,
      displayPath: "ruby-trace.rb",
      content,
      projectRoot,
      startLine: 9,
      endLine: 11,
    })

    expect(result.resolution).toBe("resolved")
    if (result.resolution !== "resolved") throw new Error("expected resolved facts")
    expect(result.facts.syntaxKind).toBe("method")
    expect(result.facts.focus).toEqual({
      kind: "declaration",
      text: "def settled?\n      @status == :settled\n    end",
      symbol: "settled?",
    })
    expect(result.facts.scope).toEqual({
      kind: "module",
      symbol: "Processor",
      startLine: 2,
      endLine: 42,
    })
  })

  test("normalizes Ruby assignments, returns, branches, and loops", async () => {
    const content = await readFile(rubyFixturePath, "utf8")
    const cases = [
      { lines: [18, 18], syntaxKind: "assignment", focusKind: "assignment", symbol: "current" },
      { lines: [22, 22], syntaxKind: "return", focusKind: "return" },
      { lines: [26, 30], syntaxKind: "if", focusKind: "branch" },
      { lines: [34, 36], syntaxKind: "while", focusKind: "branch" },
    ] as const

    for (const testCase of cases) {
      const result = extractSourceFacts({
        canonicalPath: rubyFixturePath,
        displayPath: "ruby-trace.rb",
        content,
        projectRoot,
        startLine: testCase.lines[0],
        endLine: testCase.lines[1],
      })
      expect(result.resolution).toBe("resolved")
      if (result.resolution !== "resolved") throw new Error("expected resolved facts")
      expect(result.facts.syntaxKind).toBe(testCase.syntaxKind)
      expect(result.facts.focus.kind).toBe(testCase.focusKind)
      if ("symbol" in testCase) expect(result.facts.focus.symbol).toBe(testCase.symbol)
    }
  })

  test("returns sibling Ruby calls as explicit ambiguity", async () => {
    const content = await readFile(rubyFixturePath, "utf8")
    const result = extractSourceFacts({
      canonicalPath: rubyFixturePath,
      displayPath: "ruby-trace.rb",
      content,
      projectRoot,
      startLine: 14,
      endLine: 14,
    })

    expect(result.resolution).toBe("ambiguous")
    if (result.resolution !== "ambiguous") throw new Error("expected ambiguous facts")
    expect(result.candidates.map((candidate) => candidate.focus.symbol)).toEqual(["authorize", "capture"])
  })

  test("rejects unsupported source languages", async () => {
    const content = "def run():\n    return value\n"
    const { dir, path } = await sourceFile("main.py", content)
    expect(() => extractSourceFacts({
      canonicalPath: path,
      displayPath: "main.py",
      content,
      projectRoot: dir,
      startLine: 1,
      endLine: 1,
    })).toThrow("source language is unsupported")
  })
})
