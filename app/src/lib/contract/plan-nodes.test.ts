import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  ArtifactNodeSchema,
  countEntrypoints,
  normalizeBoxEdges,
  normalizeCallStackRows,
  normalizeMachineEvents,
  normalizeSequenceSteps,
  safeParseVisualArtifactSpec,
} from "@/lib/contract/artifact-manifest"

const GOLDEN_ROWS = [
  "  **create(specArg, options)** @ cli/src/commands/create.ts:295",
  "    validateSpec(specJson) @ cli/src/commands/create.ts:338",
  "    preflightArtifactSpec(specJson) @ cli/src/commands/create.ts:345",
  "    createSourceReadContext(...) @ cli/src/commands/create.ts:351",
  { call: "resolveDiskSources(specJson, ctx)", depth: 1, mark: "changed" as const, at: "cli/src/commands/create.ts:358", id: "walker" },
  "~     inlineSource(source, label) @ cli/src/commands/create.ts:150",
  "+       **sliceLines(content, start, end)** -- new, pure",
  "        readSourceFile(src, ctx, bytes) @ cli/src/lib/source-files.ts:126",
  "          resolveSourcePath(src, root, allow) @ cli/src/lib/source-files.ts:94",
  "            isInside(child, parent) @ cli/src/lib/source-files.ts:86",
  "+     visit: call-stack rows to excerpt.src @ cli/src/commands/create.ts:178 -- beside the file-tree branch",
]

function issues(node: unknown): string[] {
  const result = safeParseVisualArtifactSpec({ slug: "t", title: "t", nodes: [node] })
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe("call-stack terse rows", () => {
  it("normalises the demo rows (golden)", () => {
    const { rows, errors } = normalizeCallStackRows(GOLDEN_ROWS)
    assert.deepEqual(errors, [])
    assert.deepEqual(rows.map((row) => row.depth), [0, 1, 1, 1, 1, 2, 3, 3, 4, 5, 2])
    assert.deepEqual(rows.map((row) => row.mark), [
      "context", "context", "context", "context", "changed", "changed", "added", "context", "context", "context", "added",
    ])
    assert.equal(countEntrypoints(rows), 1)
    assert.equal(rows[6].call, "**sliceLines(content, start, end)**")
    assert.equal(rows[6].at, undefined)
    assert.equal(rows[6].note, "new, pure")
    assert.equal(rows[10].call, "visit: call-stack rows to excerpt.src")
    assert.equal(rows[10].at, "cli/src/commands/create.ts:178")
    assert.equal(rows[10].note, "beside the file-tree branch")
  })

  it("infers kinds", () => {
    const { rows } = normalizeCallStackRows(["  <Sidebar/>", "    GET /api/x", "    if (a) b()", "    …", "    save(row)"])
    assert.deepEqual(rows.map((row) => row.kind), ["ui", "net", "cond", "gap", "io"])
  })

  it("names the row in errors", () => {
    const odd = normalizeCallStackRows(["  a()", "     b()"])
    assert.match(odd.errors[0].message, /^row 2: indented/)
    const jump = normalizeCallStackRows(["  a()", "      b()"])
    assert.match(jump.errors[0].message, /^row 2: indented 2 levels but the row above is at 0/)
    const rail = normalizeCallStackRows(["  a()", "+b()"])
    assert.match(rail.errors[0].message, /^row 2: column 1 must be a space/)
    const blank = normalizeCallStackRows(["  a()", "   "])
    assert.match(blank.errors[0].message, /^row 2: empty row/)
  })

  it("rejects too many changed calls without a location", () => {
    const messages = issues({ type: "call-stack", props: { rows: ["  a()", "+   b()", "+   c()", "+   d()"] } })
    assert.ok(messages.some((m) => /3 changed calls have no location/.test(m)))
  })
})

describe("sequence steps", () => {
  it("parses every form", () => {
    const { steps, errors } = normalizeSequenceSteps([
      "a -> b : call",
      "b --> a : reply",
      "b ..> a",
      "+ a -x-> b : lost",
      "--- bad range ---",
      "--- tail",
      "note over a, b: both",
    ])
    assert.deepEqual(errors, [])
    assert.deepEqual(steps, [
      { kind: "message", from: "a", to: "b", text: "call", style: "call", mark: undefined },
      { kind: "message", from: "b", to: "a", text: "reply", style: "reply", mark: undefined },
      { kind: "message", from: "b", to: "a", text: "", style: "reply", mark: undefined },
      { kind: "message", from: "a", to: "b", text: "lost", style: "lost", mark: "added" },
      { kind: "divider", text: "bad range" },
      { kind: "divider", text: "tail" },
      { kind: "note", over: ["a", "b"], text: "both" },
    ])
  })

  it("reports the step line", () => {
    const { errors } = normalizeSequenceSteps(["a -> b", "a => b"])
    assert.match(errors[0].message, /^step 2: couldn't parse/)
  })

  it("flags thin lanes when there are 4+ participants", () => {
    const messages = issues({
      type: "sequence-diagram",
      props: {
        caption: "c",
        participants: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
        steps: ["a -> b", "b -> c", "c -> b", "a -> d"],
      },
    })
    assert.ok(messages.some((m) => /participant "d" appears in one message/.test(m)))
  })
})

describe("box edges and machine events", () => {
  it("parses edge styles", () => {
    const { edges, errors } = normalizeBoxEdges(["+ a -> b : x", "a --> b", "a => b", "a <-> b"])
    assert.deepEqual(errors, [])
    assert.deepEqual(edges.map((edge) => [edge.style, edge.mark, edge.both]), [
      ["solid", "added", undefined],
      ["dashed", undefined, undefined],
      ["bold", undefined, undefined],
      ["solid", undefined, true],
    ])
  })

  it("requires a dashed legend", () => {
    const messages = issues({
      type: "box-diagram",
      props: { nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }], edges: ["a --> b"], grid: ["| a | b |"] },
    })
    assert.ok(messages.some((m) => /set "dashed"/.test(m)))
  })

  it("suggests kebab-case event ids", () => {
    const { errors } = normalizeMachineEvents(["a -bad range-> b"])
    assert.match(errors[0].message, /use kebab-case \(bad-range\)/)
  })

  it("validates traces, reachability and screens", () => {
    const base = {
      initial: "a",
      states: [{ id: "a", screen: "s-a" }, { id: "b", final: true }, { id: "c", final: true }],
      events: ["a -go-> b"],
    }
    const messages = issues({
      type: "state-machine",
      props: { ...base, traces: [{ name: "t", events: ["go", "go"] }] },
      children: [{ type: "text", props: { text: "x" }, metadata: { id: "s-a" } }],
    })
    assert.ok(messages.some((m) => /state "c" is unreachable/.test(m)))
    assert.ok(messages.some((m) => /trace t: step 2 "go" is not a legal event from "b"/.test(m)))
    const missing = issues({ type: "state-machine", props: base })
    assert.ok(missing.some((m) => /screen "s-a" is not a direct child/.test(m)))
  })
})

describe("plan structure lints", () => {
  const exhibit = { type: "text", props: { text: "x" } }

  it("accepts a well-formed claim tree", () => {
    assert.deepEqual(
      issues({
        type: "claim-tree",
        children: [
          {
            type: "claim",
            props: { text: "One" },
            children: [
              exhibit,
              { type: "decision", props: { id: "d1", question: "Q?", options: [{ id: "a", label: "A", suggested: true }, { id: "b", label: "B" }] } },
              { type: "claim", props: { text: "One.one" }, children: [exhibit] },
            ],
          },
        ],
      }),
      [],
    )
  })

  it("rejects claims outside a tree and bad order", () => {
    assert.ok(issues({ type: "claim", props: { text: "x" }, children: [exhibit] }).some((m) => /must sit inside a claim-tree/.test(m)))
    assert.ok(
      issues({ type: "claim-tree", children: [{ type: "claim", props: { text: "x" }, children: [exhibit, exhibit] }] }).some((m) =>
        /put the exhibit first/.test(m),
      ),
    )
  })

  it("requires one suggested option", () => {
    const result = ArtifactNodeSchema.safeParse({
      type: "decision",
      props: { id: "d", question: "Q", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] },
    })
    assert.equal(result.success, false)
  })

  it("checks mockup pins, banned children and terminal wireframes", () => {
    const messages = issues({
      type: "mockup",
      props: { frame: "browser", pins: [{ target: "nope", text: "x" }] },
      children: [{ type: "wireframe", props: { element: "prompt", text: "ls" } }, { type: "decision", props: { id: "d", question: "Q", options: [{ id: "a", label: "A", suggested: true }, { id: "b", label: "B" }] } }],
    })
    assert.ok(messages.some((m) => /target "nope"/.test(m)))
    assert.ok(messages.some((m) => /cannot contain decision/.test(m)))
    assert.ok(messages.some((m) => /needs a mockup with frame "terminal"/.test(m)))
  })

  it("checks claim refs against call-stack row ids", () => {
    const messages = issues({
      type: "claim-tree",
      children: [{ type: "claim", props: { text: "x", ref: "missing" }, children: [exhibit] }],
    })
    assert.ok(messages.some((m) => /claim ref "missing"/.test(m)))
  })

  it("checks code-block annotations and file-tree notes", () => {
    assert.ok(
      issues({ type: "code-block", props: { code: "a\nb", startLine: 10, annotations: [{ line: 3, title: "x" }] } }).some((m) =>
        /line 3 is outside 10-11/.test(m),
      ),
    )
    assert.ok(
      issues({ type: "file-tree", props: { items: [{ name: "src", children: [{ name: "a.ts" }] }], notes: { "src/x.ts": "n" } } }).some((m) =>
        /file-tree note "src\/x.ts" matches no item/.test(m),
      ),
    )
    assert.deepEqual(issues({ type: "file-tree", props: { items: [{ name: "src", children: [{ name: "a.ts" }] }], notes: { "src/a.ts": "n" } } }), [])
  })
})
