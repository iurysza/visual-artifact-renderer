import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  VisualArtifactSpecSchema,
  preflightArtifactSpec,
} from "@/lib/contract/artifact-schema"

const lessonSpec = {
  slug: "lesson-nodes",
  title: "Lesson nodes",
  nodes: [
    {
      type: "annotated-visual",
      props: {
        src: "diagram.png",
        alt: "A two-stage request path",
        aspect: "wide",
        markers: [
          { title: "Input", description: "The request enters here.", x: 12.5, y: 50 },
          { title: "Output", description: "The result leaves here.", x: 87.5, y: 50 },
        ],
      },
    },
    {
      type: "visual-sequence",
      props: {
        title: "Trace the request",
        items: [
          {
            title: "Validate",
            nodes: [{ type: "text", props: { text: "Parse the contract." } }],
          },
          {
            title: "Render",
            nodes: [{ type: "text", props: { text: "Choose an adapter." } }],
          },
        ],
      },
    },
    {
      type: "knowledge-check",
      props: {
        prompt: "Which layer owns styling?",
        choices: [
          { id: "agent", label: "Agent", feedback: "The agent only emits JSON." },
          { id: "renderer", label: "Renderer" },
        ],
        answerId: "renderer",
        explanation: "Trusted renderer components own styling.",
      },
    },
  ],
} as const

describe("lesson node contract", () => {
  it("accepts the three lesson nodes", () => {
    const result = VisualArtifactSpecSchema.safeParse(lessonSpec)
    assert.equal(result.success, true)
  })

  it("counts nodes nested inside visual-sequence frames", () => {
    const result = preflightArtifactSpec(lessonSpec)
    assert.equal(result.issues.length, 0)
    assert.equal(result.result.totalNodes, 5)
    assert.equal(result.result.maxDepth, 2)
  })

  it("rejects invalid annotated-visual sources and coordinates", () => {
    const result = VisualArtifactSpecSchema.safeParse({
      slug: "bad-annotation",
      title: "Bad annotation",
      nodes: [
        {
          type: "annotated-visual",
          props: {
            src: "file:///tmp/private.png",
            alt: "Private image",
            markers: [{ title: "Outside", description: "Invalid point.", x: 101, y: 50 }],
          },
        },
      ],
    })

    assert.equal(result.success, false)
  })

  it("requires unique choices and a matching answer id", () => {
    const result = VisualArtifactSpecSchema.safeParse({
      slug: "bad-check",
      title: "Bad check",
      nodes: [
        {
          type: "knowledge-check",
          props: {
            prompt: "Pick one",
            choices: [
              { id: "same", label: "One" },
              { id: "same", label: "Two" },
            ],
            answerId: "missing",
            explanation: "No valid answer exists.",
          },
        },
      ],
    })

    assert.equal(result.success, false)
  })
})
