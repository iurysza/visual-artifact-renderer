import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { VisualArtifactSpecSchema } from "@/lib/contract/artifact-schema"
import type { VisualArtifactSpec } from "@/lib/contract/artifact-schema"
import { formatArtifactForAI } from "./formatter"
import type { AIColabComment } from "./types"

const baseSpec = VisualArtifactSpecSchema.parse({
  slug: "formatter-demo",
  title: "Formatter Demo",
  description: "How VCF represents a simple artifact.",
  layout: { type: "default" },
  data: {
    checks: [
      { check: "A", status: "pass", evidence: "evidence-a" },
      { check: "B", status: "fail", evidence: "evidence-b" },
      { check: "C", status: "pass", evidence: "evidence-c" },
      { check: "D", status: "pass", evidence: "evidence-d" },
    ],
  },
  nodes: [
    {
      type: "text",
      props: { text: "The formatter converts JSON specs to compact Markdown.", size: "lg" },
      metadata: { id: "thesis" },
    },
    {
      type: "grid",
      props: { columns: 2 },
      children: [
        { type: "text", props: { text: "Child 0" }, metadata: { id: "child-0" } },
        {
          type: "card",
          children: [{ type: "text", props: { text: "Nested child 0" }, metadata: { id: "nested-0" } }],
        },
      ],
    },
    {
      type: "tabs",
      props: {
        defaultValue: "a",
        items: [
          {
            value: "a",
            label: "Tab A",
            nodes: [{ type: "text", props: { text: "Tab A node" }, metadata: { id: "tab-a" } }],
          },
          {
            value: "b",
            label: "Tab B",
            nodes: [{ type: "text", props: { text: "Tab B node" } }],
          },
        ],
      },
    },
    {
      type: "accordion",
      props: {
        items: [
          {
            title: "Item 1",
            nodes: [
              {
                type: "text",
                props: { text: "Accordion item 1 node" },
                metadata: { id: "acc-1" },
              },
            ],
          },
        ],
      },
    },
    {
      type: "code-block",
      props: {
        language: "ts",
        title: "Long code",
        code: Array.from({ length: 20 }, (_, i) => `line${i + 1}`).join("\n"),
      },
      metadata: { id: "long-code" },
    },
    {
      type: "svg-diagram",
      props: {
        title: "SVG",
        html: "<svg><rect width=\"100\" height=\"100\"></rect></svg>",
      },
      metadata: { id: "svg-1" },
    },
    {
      type: "table",
      props: { dataKey: "checks", columns: ["check", "status", "evidence"] },
      metadata: { id: "table-1" },
    },
  ],
}) satisfies VisualArtifactSpec

describe("formatArtifactForAI", () => {
  it("returns an empty string when there are no comments", () => {
    const output = formatArtifactForAI(baseSpec)
    assert.equal(output, "")
  })

  it("renders the artifact file path and title line range", () => {
    const comments: AIColabComment[] = [
      { id: "c1", target: { kind: "artifact" }, body: "Overall layout feels too busy." },
    ]
    const output = formatArtifactForAI(baseSpec, { comments, filePath: "/data/artifacts/demo/formatter-demo/artifact.json" })
    assert.match(output, /^Markdown Annotations\n\nFile:\n\/data\/artifacts\/demo\/formatter-demo\/artifact.json\n\nFile Feedback\n\nI've reviewed this file and have 1 piece of feedback:\n\n1\. \(lines 3-3\) Feedback on: "Formatter Demo"/)
    assert.match(output, /\n\| Overall layout feels too busy\.\n/)
    assert.match(output, /Please address the annotation feedback above\.$/)
  })

  it("renders node comments by path with the node object line range", () => {
    const comments: AIColabComment[] = [
      {
        id: "c1",
        target: { kind: "node", nodePath: "nodes.0" },
        body: "Make this thesis more concrete.",
      },
    ]
    const output = formatArtifactForAI(baseSpec, { comments })
    assert.match(output, /1\. \(lines 33-42\) Feedback on: "The formatter converts JSON specs to compact Markdown\."/)
    assert.match(output, /\n\| Make this thesis more concrete\.\n/)
  })

  it("resolves comments by node id to the current node range", () => {
    const comments: AIColabComment[] = [
      {
        id: "c1",
        target: { kind: "node", nodePath: "nodes.99", nodeId: "thesis" },
        body: "Comment matched by id.",
      },
    ]
    const output = formatArtifactForAI(baseSpec, { comments })
    assert.match(output, /1\. \(lines 33-42\) Feedback on: "The formatter converts JSON specs to compact Markdown\."/)
    assert.match(output, /\n\| Comment matched by id\.\n/)
  })

  it("uses the correct line ranges for nested children", () => {
    const comments: AIColabComment[] = [
      {
        id: "c1",
        target: { kind: "node", nodePath: "nodes.1.children.1.children.0" },
        body: "Nested child comment.",
      },
    ]
    const output = formatArtifactForAI(baseSpec, { comments })
    assert.match(output, /1\. \(lines 61-69\) Feedback on: "Nested child 0"/)
  })

  it("uses the correct line ranges for tabs", () => {
    const comments: AIColabComment[] = [
      {
        id: "c1",
        target: { kind: "node", nodePath: "nodes.2.props.items.0.nodes.0" },
        body: "Tab A comment.",
      },
      {
        id: "c2",
        target: { kind: "node", nodePath: "nodes.2.props.items.1.nodes.0" },
        body: "Tab B comment.",
      },
    ]
    const output = formatArtifactForAI(baseSpec, { comments })
    assert.match(output, /1\. \(lines 83-91\) Feedback on: "Tab A node"/)
    assert.match(output, /2\. \(lines 98-103\) Feedback on: "Tab B node"/)
  })

  it("uses the correct line ranges for accordion items", () => {
    const comments: AIColabComment[] = [
      {
        id: "c1",
        target: { kind: "node", nodePath: "nodes.3.props.items.0.nodes.0" },
        body: "Accordion item comment.",
      },
    ]
    const output = formatArtifactForAI(baseSpec, { comments })
    assert.match(output, /1\. \(lines 116-124\) Feedback on: "Accordion item 1 node"/)
  })

  it("prefixes every line of a multi-line comment body with |", () => {
    const comments: AIColabComment[] = [
      {
        id: "c1",
        target: { kind: "node", nodePath: "nodes.0" },
        body: "Line one.\nLine two.\nLine three.",
      },
    ]
    const output = formatArtifactForAI(baseSpec, { comments })
    assert.match(output, /\n\| Line one\.\n\| Line two\.\n\| Line three\.\n/)
  })

  it("prefixes blank lines inside a multi-line body with |", () => {
    const comments: AIColabComment[] = [
      {
        id: "c1",
        target: { kind: "node", nodePath: "nodes.0" },
        body: "Paragraph one.\n\nParagraph two.",
      },
    ]
    const output = formatArtifactForAI(baseSpec, { comments })
    assert.match(output, /\n\| Paragraph one\.\n\| \n\| Paragraph two\.\n/)
  })

  it("does not emit verbose package sections", () => {
    const comments: AIColabComment[] = [
      { id: "c1", target: { kind: "artifact" }, body: "Artifact comment." },
      {
        id: "c2",
        target: { kind: "node", nodePath: "nodes.6" },
        body: "Table comment.",
      },
    ]
    const output = formatArtifactForAI(baseSpec, { comments })
    assert.doesNotMatch(output, /# Visual Artifact Feedback Package/)
    assert.doesNotMatch(output, /## Datasets/)
    assert.doesNotMatch(output, /## Nodes/)
    assert.doesNotMatch(output, /@props:/)
    assert.doesNotMatch(output, /@data:/)
    assert.doesNotMatch(output, /\- \`checks\` —/)
  })

  it("surfaces orphaned node comments at the end with a fallback range", () => {
    const comments: AIColabComment[] = [
      {
        id: "c1",
        target: { kind: "node", nodePath: "nodes.99" },
        body: "This comment has no matching node.",
      },
    ]
    const output = formatArtifactForAI(baseSpec, { comments })
    assert.match(output, /1\. \(lines 1-1\) Feedback on: "nodes\.99"/)
    assert.match(output, /\| This comment has no matching node\./)
  })

  it("escapes double quotes inside the quoted target label", () => {
    const spec = VisualArtifactSpecSchema.parse({
      slug: "quote-demo",
      title: 'Has "quotes"',
      layout: { type: "default" },
      nodes: [
        { type: "text", props: { text: 'Also has "quotes"' }, metadata: { id: "text-1" } },
      ],
    }) satisfies VisualArtifactSpec
    const comments: AIColabComment[] = [
      { id: "c1", target: { kind: "artifact" }, body: "Artifact." },
      {
        id: "c2",
        target: { kind: "node", nodePath: "nodes.0" },
        body: "Node.",
      },
    ]
    const output = formatArtifactForAI(spec, { comments })
    assert.match(output, /Feedback on: "Has \\"quotes\\""/)
    assert.match(output, /Feedback on: "Also has \\"quotes\\""/)
  })

  it("uses singular 'piece' for one comment and plural for many", () => {
    const one = formatArtifactForAI(baseSpec, {
      comments: [{ id: "c1", target: { kind: "artifact" }, body: "A" }],
    })
    const two = formatArtifactForAI(baseSpec, {
      comments: [
        { id: "c1", target: { kind: "artifact" }, body: "A" },
        { id: "c2", target: { kind: "artifact" }, body: "B" },
      ],
    })
    assert.match(one, /have 1 piece of feedback/)
    assert.match(two, /have 2 pieces of feedback/)
  })
})
