import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { VisualArtifactSpecSchema } from "@/lib/contract/artifact-schema"
import {
  addComment,
  buildArtifactTarget,
  buildNodeTarget,
  copyAIColabMarkdown,
  createAIColabComment,
  deleteComment,
} from "./ai-colab-store"
import { formatArtifactForAI } from "./formatter"
import type { AIColabComment } from "./types"

const baseSpec = VisualArtifactSpecSchema.parse({
  slug: "ai-colab-demo",
  title: "AI Colab Demo",
  description: "How AI Colab comments render.",
  layout: { type: "default" },
  nodes: [
    {
      type: "text",
      props: { text: "First node", size: "lg" },
      metadata: { id: "first" },
    },
    {
      type: "text",
      props: { text: "Second node" },
      metadata: { id: "second" },
    },
  ],
})

describe("AI Colab store", () => {
  it("builds an artifact target", () => {
    const target = buildArtifactTarget()
    assert.equal(target.kind, "artifact")
  })

  it("builds a node target preserving identity", () => {
    const target = buildNodeTarget({
      nodeId: "first",
      nodePath: "nodes.0",
      nodeType: "text",
      textSnippet: "First node",
    })
    assert.equal(target.kind, "node")
    assert.equal(target.nodeId, "first")
    assert.equal(target.nodePath, "nodes.0")
    assert.equal(target.nodeType, "text")
    assert.equal(target.label, "First node")
  })

  it("creates a comment with id and timestamp", () => {
    const comment = createAIColabComment("hello", buildArtifactTarget())
    assert.equal(typeof comment.id, "string")
    assert.ok(comment.id.length > 0)
    assert.equal(comment.body, "hello")
    assert.equal(comment.target.kind, "artifact")
    assert.ok(comment.createdAt)
  })

  it("adds a comment to an empty list", () => {
    const comments = addComment([], "hello", buildArtifactTarget())
    assert.equal(comments.length, 1)
    assert.equal(comments[0].body, "hello")
  })

  it("ignores empty comment bodies", () => {
    const comments = addComment([], "   ", buildArtifactTarget())
    assert.equal(comments.length, 0)
  })

  it("trims comment bodies", () => {
    const comments = addComment([], "  hello  ", buildArtifactTarget())
    assert.equal(comments[0].body, "hello")
  })

  it("deletes a comment by id", () => {
    const a = createAIColabComment("a", buildArtifactTarget())
    const b = createAIColabComment("b", buildArtifactTarget())
    const comments = deleteComment([a, b], a.id)
    assert.equal(comments.length, 1)
    assert.equal(comments[0].id, b.id)
  })

  it("produces unique ids across many comments", () => {
    const comments = Array.from({ length: 50 }, (_, i) =>
      createAIColabComment(String(i), buildArtifactTarget())
    )
    const ids = new Set(comments.map((c) => c.id))
    assert.equal(ids.size, comments.length)
  })
})

describe("AI Colab formatter integration", () => {
  it("includes artifact-level comments", () => {
    const comments: AIColabComment[] = [
      {
        id: "1",
        target: buildArtifactTarget(),
        body: "Overall this looks great.",
      },
    ]
    const output = formatArtifactForAI(baseSpec, { comments })
    assert.ok(output.includes("Feedback on: \"AI Colab Demo\""))
    assert.ok(output.includes("Overall this looks great."))
  })

  it("includes node-level comments with the correct node range", () => {
    const comments: AIColabComment[] = [
      {
        id: "1",
        target: buildNodeTarget({
          nodeId: "first",
          nodePath: "nodes.0",
          nodeType: "text",
          textSnippet: "First node",
        }),
        body: "Make this more concise.",
      },
    ]
    const output = formatArtifactForAI(baseSpec, { comments })
    assert.ok(output.includes("Feedback on: \"First node\""))
    assert.ok(output.includes("Make this more concise."))
  })

  it("groups multiple comments on the same node", () => {
    const comments: AIColabComment[] = [
      {
        id: "1",
        target: buildNodeTarget({
          nodeId: "first",
          nodePath: "nodes.0",
          nodeType: "text",
        }),
        body: "First comment.",
      },
      {
        id: "2",
        target: buildNodeTarget({
          nodeId: "first",
          nodePath: "nodes.0",
          nodeType: "text",
        }),
        body: "Second comment.",
      },
    ]
    const output = formatArtifactForAI(baseSpec, { comments })
    assert.ok(output.includes("1."))
    assert.ok(output.includes("2."))
    assert.ok(output.includes("First comment."))
    assert.ok(output.includes("Second comment."))
  })

  it("surfaces orphaned node comments", () => {
    const comments: AIColabComment[] = [
      {
        id: "1",
        target: buildNodeTarget({
          nodeId: "missing",
          nodePath: "nodes.99",
          nodeType: "text",
        }),
        body: "This node no longer exists.",
      },
    ]
    const output = formatArtifactForAI(baseSpec, { comments })
    assert.ok(output.includes("(lines 1-1)"))
    assert.ok(output.includes("This node no longer exists."))
    assert.ok(output.includes("Feedback on: \"text\""))
  })

  it("returns an empty string when comments are empty", () => {
    const output = formatArtifactForAI(baseSpec, { comments: [] })
    assert.equal(output, "")
  })
})

describe("AI Colab copy handler", () => {
  it("copies formatted Markdown to the clipboard", async () => {
    const written: string[] = []
    const originalClipboard = globalThis.navigator?.clipboard

    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText: (text: string) => Promise.resolve(written.push(text)) },
      configurable: true,
    })

    const comments: AIColabComment[] = [
      { id: "1", target: buildArtifactTarget(), body: "Feedback" },
    ]
    const markdown = await copyAIColabMarkdown({
      spec: baseSpec,
      comments,
      filePath: "/artifacts/data/artifacts/demo/ai-colab-demo/artifact.json",
    })

    assert.equal(written.length, 1)
    assert.equal(written[0], markdown)
    assert.ok(markdown.includes("Feedback"))
    assert.ok(markdown.includes("/artifacts/data/artifacts/demo/ai-colab-demo/artifact.json"))

    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: originalClipboard,
      configurable: true,
    })
  })

  it("rejects when clipboard is unavailable", async () => {
    const originalClipboard = globalThis.navigator?.clipboard

    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: undefined,
      configurable: true,
    })

    await assert.rejects(copyAIColabMarkdown({ spec: baseSpec, comments: [] }), /Clipboard not available/)

    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: originalClipboard,
      configurable: true,
    })
  })

  it("copies an empty string when no comments exist", async () => {
    const written: string[] = []
    const originalClipboard = globalThis.navigator?.clipboard

    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText: (text: string) => Promise.resolve(written.push(text)) },
      configurable: true,
    })

    const markdown = await copyAIColabMarkdown({
      spec: baseSpec,
      comments: [],
      filePath: "/artifacts/data/artifacts/demo/ai-colab-demo/artifact.json",
    })

    assert.equal(written.length, 1)
    assert.equal(written[0], markdown)
    assert.equal(markdown, "")

    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: originalClipboard,
      configurable: true,
    })
  })
})
