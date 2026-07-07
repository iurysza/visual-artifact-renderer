import { describe, it } from "node:test"
import { strict as assert } from "node:assert"

import { getThreadCount, getThreadsForNode, nodeIdentityMatches } from "./annotation-helpers"
import type { AnnotationAnchor, AnnotationThread } from "@/lib/artifacts/annotations"

function makeThread(id: string, anchor: AnnotationAnchor): AnnotationThread {
  return {
    id,
    anchor,
    status: "open",
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z",
    messages: [
      {
        id: `msg-${id}`,
        author: { name: "Test", email: "test@example.com" },
        body: "Test",
        createdAt: "2026-07-03T00:00:00.000Z",
        updatedAt: "2026-07-03T00:00:00.000Z",
      },
    ],
  }
}

describe("nodeIdentityMatches", () => {
  it("matches by nodeId when both ids are present", () => {
    const anchor: AnnotationAnchor = { nodeId: "summary", nodePath: "nodes.0", nodeType: "text" }
    assert.equal(nodeIdentityMatches(anchor, "summary", "nodes.1"), true)
    assert.equal(nodeIdentityMatches(anchor, "other", "nodes.0"), false)
  })

  it("falls back to nodePath when anchor nodeId is missing", () => {
    const anchor: AnnotationAnchor = { nodePath: "nodes.0", nodeType: "text" }
    assert.equal(nodeIdentityMatches(anchor, undefined, "nodes.0"), true)
    assert.equal(nodeIdentityMatches(anchor, undefined, "nodes.1"), false)
  })

  it("falls back to nodePath when runtime nodeId is missing", () => {
    const anchor: AnnotationAnchor = { nodeId: "summary", nodePath: "nodes.0", nodeType: "text" }
    assert.equal(nodeIdentityMatches(anchor, undefined, "nodes.0"), true)
    assert.equal(nodeIdentityMatches(anchor, undefined, "nodes.1"), false)
  })
})

describe("thread grouping", () => {
  const threads = [
    makeThread("t1", { nodeId: "a", nodePath: "nodes.0", nodeType: "text" }),
    makeThread("t2", { nodePath: "nodes.1", nodeType: "card" }),
    makeThread("t3", { nodeId: "a", nodePath: "nodes.0", nodeType: "text" }),
  ]

  it("returns threads matching node identity", () => {
    assert.equal(getThreadCount(threads, "a", "nodes.0"), 2)
    const matching = getThreadsForNode(threads, "a", "nodes.0")
    assert.equal(matching.length, 2)
    assert.ok(matching.every((t) => t.id === "t1" || t.id === "t3"))
  })

  it("falls back to path when runtime nodeId is undefined", () => {
    assert.equal(getThreadCount(threads, undefined, "nodes.1"), 1)
    assert.equal(getThreadsForNode(threads, undefined, "nodes.1")[0]?.id, "t2")
  })
})
