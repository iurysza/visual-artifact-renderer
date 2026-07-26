import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { VisualArtifactSpecSchema } from "@/lib/contract/artifact-schema"

const validBoundaryEvent = {
  id: "validate-spec",
  order: 0,
  phase: "validate",
  kind: "boundary",
  label: "Validate artifact JSON",
  boundary: {
    kind: "validation",
    from: { label: "Untrusted JSON", system: "runtime" },
    to: { label: "Renderer contract", system: "renderer" },
    operation: "VisualArtifactSpecSchema.safeParse",
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
  callStack: [
    {
      id: "safe-parse",
      fn: "VisualArtifactSpecSchema.safeParse",
      signature: "safeParse(data: unknown)",
      returnType: "SafeParseReturnType<VisualArtifactSpec>",
      active: true,
    },
  ],
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
  it("accepts typed boundary events with call-stack context", () => {
    const result = VisualArtifactSpecSchema.safeParse(traceSpec())
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
    const invalid = {
      ...validBoundaryEvent,
      inputs: [{ id: "data", name: "data", staticType: "unknown", provenance: "inferred" }],
    }
    const result = VisualArtifactSpecSchema.safeParse(traceSpec(invalid))
    assert.equal(result.success, false)
  })

  it("accepts create-time file-backed code context", () => {
    const result = VisualArtifactSpecSchema.safeParse(traceSpec({
      ...validBoundaryEvent,
      codeRef: { file: "src/validate.ts", line: 12 },
      code: { src: "src/validate.ts", language: "typescript" },
    }))
    assert.equal(result.success, true)
  })

  it("rejects code context without content or src", () => {
    const result = VisualArtifactSpecSchema.safeParse(traceSpec({
      ...validBoundaryEvent,
      code: { language: "typescript" },
    }))
    assert.equal(result.success, false)
  })

  it("rejects timing fields to prevent false precision", () => {
    const result = VisualArtifactSpecSchema.safeParse(traceSpec({
      ...validBoundaryEvent,
      durationMs: 1.2,
    }))
    assert.equal(result.success, false)
  })

  it("rejects duplicate event ids", () => {
    const result = VisualArtifactSpecSchema.safeParse(traceSpec(validBoundaryEvent, {
      events: [validBoundaryEvent, { ...validBoundaryEvent, order: 1 }],
    }))
    assert.equal(result.success, false)
  })

  it("requires initialEventId to reference a real event", () => {
    const result = VisualArtifactSpecSchema.safeParse(traceSpec(validBoundaryEvent, {
      initialEventId: "missing-event",
    }))
    assert.equal(result.success, false)
  })
})
