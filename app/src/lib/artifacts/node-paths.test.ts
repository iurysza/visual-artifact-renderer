import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { VisualArtifactSpecSchema } from "@/lib/contract/artifact-schema"
import { resolveNodePath } from "@/lib/artifacts/node-paths"
import type { VisualArtifactSpec } from "@/lib/contract/artifact-schema"

const specFixture = VisualArtifactSpecSchema.parse({
  slug: "anchor-test",
  title: "Anchor test",
  nodes: [
    { type: "text", props: { text: "Top level 0" }, metadata: { id: "root-0" } },
    {
      type: "grid",
      props: { columns: 2 },
      children: [
        { type: "text", props: { text: "Child 0" } },
        {
          type: "card",
          children: [{ type: "text", props: { text: "Nested child 0" } }],
        },
      ],
    },
    {
      type: "tabs",
      props: {
        items: [
          { value: "a", label: "Tab A", nodes: [{ type: "text", props: { text: "Tab A node" } }] },
          { value: "b", label: "Tab B", nodes: [{ type: "text", props: { text: "Tab B node" } }] },
        ],
      },
    },
    {
      type: "accordion",
      props: {
        items: [
          { title: "Item 1", nodes: [{ type: "text", props: { text: "Accordion item 1 node" } }] },
        ],
      },
    },
  ],
}) satisfies VisualArtifactSpec

describe("resolveNodePath", () => {
  it("resolves top-level nodes", () => {
    const node = resolveNodePath(specFixture, "nodes.0")
    assert.equal(node?.type, "text")
    assert.equal(node?.props.text, "Top level 0")
    assert.equal(node?.metadata?.id, "root-0")
  })

  it("resolves children of containers", () => {
    const first = resolveNodePath(specFixture, "nodes.1.children.0")
    assert.equal(first?.type, "text")
    assert.equal(first?.props.text, "Child 0")

    const nested = resolveNodePath(specFixture, "nodes.1.children.1.children.0")
    assert.equal(nested?.type, "text")
    assert.equal(nested?.props.text, "Nested child 0")
  })

  it("resolves nodes inside tabs", () => {
    const a = resolveNodePath(specFixture, "nodes.2.props.items.0.nodes.0")
    assert.equal(a?.type, "text")
    assert.equal(a?.props.text, "Tab A node")

    const b = resolveNodePath(specFixture, "nodes.2.props.items.1.nodes.0")
    assert.equal(b?.type, "text")
    assert.equal(b?.props.text, "Tab B node")
  })

  it("resolves nodes inside accordions", () => {
    const node = resolveNodePath(specFixture, "nodes.3.props.items.0.nodes.0")
    assert.equal(node?.type, "text")
    assert.equal(node?.props.text, "Accordion item 1 node")
  })

  it("returns undefined for unknown paths", () => {
    assert.equal(resolveNodePath(specFixture, "nodes.99"), undefined)
    assert.equal(resolveNodePath(specFixture, "nodes.1.children.99"), undefined)
    assert.equal(resolveNodePath(specFixture, "nodes.2.props.items.0.nodes.99"), undefined)
  })
})

describe("metadata schema", () => {
  it("accepts nodes without metadata", () => {
    const result = VisualArtifactSpecSchema.safeParse({
      slug: "no-metadata",
      title: "No metadata",
      nodes: [{ type: "text", props: { text: "Hello" } }],
    })
    assert.equal(result.success, true)
  })

  it("rejects empty metadata id", () => {
    const result = VisualArtifactSpecSchema.safeParse({
      slug: "empty-id",
      title: "Empty id",
      nodes: [{ type: "text", props: { text: "Hello" }, metadata: { id: "" } }],
    })
    assert.equal(result.success, false)
  })
})
