import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { makeLogger } from "./__test__/logger.ts"
import { traceInspect } from "./trace-inspect.ts"

const EMPTY_GLOBAL_OPTS = {
  json: true,
  plain: false,
  quiet: false,
  verbose: false,
  noColor: false,
  noInput: false,
}

const dirs: string[] = []

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function projectFile(content: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "va-trace-inspect-"))
  dirs.push(dir)
  await writeFile(join(dir, "trace.ts"), content, "utf8")
  return dir
}

describe("trace inspect", () => {
  test("preserves anchor order and emits source objects", async () => {
    const project = await projectFile([
      "export function run() {",
      "  first()",
      "  second()",
      "}",
      "",
    ].join("\n"))
    const log = makeLogger()

    const rc = await traceInspect({
      ...EMPTY_GLOBAL_OPTS,
      project,
      anchor: ["trace.ts:3", "trace.ts:2"],
    }, log as any)

    expect(rc).toBe(0)
    const output = JSON.parse(log._logs.find((line) => line.startsWith("output: "))!.slice(8))
    expect(output.sources.map((item: any) => item.source.facts.focus.symbol)).toEqual(["second", "first"])
    expect(output.sources[0].source.src).toBe("trace.ts")
  })

  test("returns sibling candidates instead of guessing", async () => {
    const project = await projectFile("export function run() { first(); second() }\n")
    const log = makeLogger()

    const rc = await traceInspect({
      ...EMPTY_GLOBAL_OPTS,
      project,
      anchor: ["trace.ts:1"],
    }, log as any)

    expect(rc).toBe(0)
    const output = JSON.parse(log._logs.find((line) => line.startsWith("output: "))!.slice(8))
    expect(output.ok).toBe(false)
    expect(output.sources[0].resolution).toBe("ambiguous")
    expect(output.sources[0].candidates.map((item: any) => item.focus.symbol)).toEqual(["first", "second"])
  })

  test("requires at least one anchor", async () => {
    const project = await projectFile("export const value = 1\n")
    const log = makeLogger()
    const rc = await traceInspect({ ...EMPTY_GLOBAL_OPTS, project }, log as any)
    expect(rc).toBe(2)
    expect(log._logs.join("\n")).toContain("requires at least one --anchor")
  })
})
