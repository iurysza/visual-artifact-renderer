import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { VisualArtifactSpecSchema } from "@/lib/contract/artifact-schema"

const content = "const parsed = validate(input)\nsetSpec(parsed.data)"
const sourceFacts = {
  span: { file: "src/validate.ts", startLine: 1, endLine: 1 },
  excerpt: "const parsed = validate(input)",
  sourceHash: "0".repeat(64),
  worktree: "dirty",
  language: "typescript",
  syntaxKind: "call_expression",
  focus: { kind: "call", text: "validate(input)", symbol: "validate" },
  scope: { kind: "function", symbol: "loadArtifact", startLine: 1, endLine: 2 },
  resolution: "resolved",
} as const

const validBoundaryEvent = {
  id: "validate-spec",
  order: 0,
  phase: "validate",
  kind: "boundary",
  label: "Validate artifact JSON",
  source: { content, facts: sourceFacts },
  boundary: {
    kind: "validation",
    from: { label: "Untrusted JSON", system: "runtime" },
    to: { label: "Renderer contract", system: "renderer" },
    outcome: "passed",
  },
  inputs: [
    {
      id: "data",
      name: "data",
      staticType: "unknown",
      runtimeType: "object",
      preview: { kind: "object", text: "{ slug, nodes }" },
      provenance: "inferred",
    },
  ],
  outputs: [
    {
      id: "spec",
      name: "spec",
      staticType: "VisualArtifactSpec",
      runtimeType: "object",
      preview: { kind: "object", text: "validated artifact spec" },
      provenance: "inferred",
    },
  ],
  transformation: {
    summary: "Unknown data becomes a validated renderer contract.",
    mappings: [{ from: "data", to: "spec", operation: "validate" }],
  },
  evidence: { origin: "inferred", confidence: "high" },
} as const

function traceSpec(
  event: unknown = validBoundaryEvent,
  props: Record<string, unknown> = {},
) {
  return {
    slug: "execution-trace-test",
    title: "Execution trace test",
    nodes: [
      {
        type: "execution-trace",
        props: {
          provenance: {
            mode: "inferred",
            method: "static-analysis",
            summary: "Types and control flow derived from reviewed source.",
            confidence: "high",
          },
          events: [event],
          ...props,
        },
      },
    ],
  }
}

describe("execution-trace schema", () => {
  it("accepts source-backed typed boundary events", () => {
    assert.equal(VisualArtifactSpecSchema.safeParse(traceSpec()).success, true)
  })

  it("accepts create-time source paths with inspected facts", () => {
    const result = VisualArtifactSpecSchema.safeParse(traceSpec({
      ...validBoundaryEvent,
      source: { src: "src/validate.ts", facts: sourceFacts },
    }))
    assert.equal(result.success, true)
  })

  it("requires boundary metadata for boundary events", () => {
    const result = VisualArtifactSpecSchema.safeParse(traceSpec({
      ...validBoundaryEvent,
      boundary: undefined,
    }))
    assert.equal(result.success, false)
  })

  it("rejects display strings that omit typed previews", () => {
    const result = VisualArtifactSpecSchema.safeParse(traceSpec({
      ...validBoundaryEvent,
      inputs: [{ id: "data", name: "data", staticType: "unknown", provenance: "inferred" }],
    }))
    assert.equal(result.success, false)
  })

  it("rejects legacy freeform source identity", () => {
    for (const legacy of [
      { codeRef: { file: "src/validate.ts", line: 1 } },
      { code: { content, language: "typescript" } },
      { callStack: [{ id: "validate", fn: "validate", active: true }] },
    ]) {
      const result = VisualArtifactSpecSchema.safeParse(traceSpec({
        ...validBoundaryEvent,
        ...legacy,
      }))
      assert.equal(result.success, false)
    }
  })

  it("requires exactly one source input", () => {
    for (const source of [
      { facts: sourceFacts },
      { src: "src/validate.ts", content, facts: sourceFacts },
    ]) {
      assert.equal(VisualArtifactSpecSchema.safeParse(traceSpec({
        ...validBoundaryEvent,
        source,
      })).success, false)
    }
  })

  it("rejects source excerpts that do not match persisted content", () => {
    const result = VisualArtifactSpecSchema.safeParse(traceSpec({
      ...validBoundaryEvent,
      source: {
        content,
        facts: { ...sourceFacts, excerpt: "validate(other)" },
      },
    }))
    assert.equal(result.success, false)
  })

  it("rejects freeform boundary operations", () => {
    const result = VisualArtifactSpecSchema.safeParse(traceSpec({
      ...validBoundaryEvent,
      boundary: { ...validBoundaryEvent.boundary, operation: "validate(input)" },
    }))
    assert.equal(result.success, false)
  })

  it("accepts minimal effect and error impacts", () => {
    const result = VisualArtifactSpecSchema.safeParse(traceSpec({
      ...validBoundaryEvent,
      impacts: [
        {
          kind: "effect",
          title: "Updates artifact state",
          description: "Stores the validated artifact for rendering.",
          codeRef: { file: "src/validate.ts", line: 2 },
        },
        {
          kind: "error",
          title: "Rejects invalid input",
          codeRef: { file: "src/validate.ts", line: 1 },
        },
      ],
    }))
    assert.equal(result.success, true)
  })

  it("rejects impact references to blank source lines", () => {
    const blankContent = "const parsed = validate(input)\n\nsetSpec(parsed.data)"
    const result = VisualArtifactSpecSchema.safeParse(traceSpec({
      ...validBoundaryEvent,
      impacts: [{
        kind: "error",
        title: "Rejects invalid input",
        codeRef: { file: "src/validate.ts", line: 2 },
      }],
      source: { content: blankContent, facts: sourceFacts },
    }))
    assert.equal(result.success, false)
  })

  it("accepts reusable source-derived type definitions", () => {
    const result = VisualArtifactSpecSchema.safeParse(traceSpec(validBoundaryEvent, {
      typeDefinitions: [
        {
          name: "VisualArtifactSpec",
          definition: "export type VisualArtifactSpec = z.infer<typeof VisualArtifactSpecSchema>",
          language: "typescript",
          file: "shared/src/artifact-schema.ts",
          line: 1490,
          provenance: "derived",
        },
      ],
    }))
    assert.equal(result.success, true)
  })

  it("rejects duplicate type definition names", () => {
    const definition = {
      name: "VisualArtifactSpec",
      definition: "export interface VisualArtifactSpec {}",
      provenance: "derived",
    }
    const result = VisualArtifactSpecSchema.safeParse(traceSpec(validBoundaryEvent, {
      typeDefinitions: [definition, definition],
    }))
    assert.equal(result.success, false)
  })

  it("rejects timing fields to prevent false precision", () => {
    assert.equal(VisualArtifactSpecSchema.safeParse(traceSpec({
      ...validBoundaryEvent,
      durationMs: 1.2,
    })).success, false)
  })

  it("rejects duplicate event ids", () => {
    const result = VisualArtifactSpecSchema.safeParse(traceSpec(validBoundaryEvent, {
      events: [validBoundaryEvent, { ...validBoundaryEvent, order: 1 }],
    }))
    assert.equal(result.success, false)
  })

  it("requires initialEventId to reference a real event", () => {
    assert.equal(VisualArtifactSpecSchema.safeParse(traceSpec(validBoundaryEvent, {
      initialEventId: "missing-event",
    })).success, false)
  })
})
