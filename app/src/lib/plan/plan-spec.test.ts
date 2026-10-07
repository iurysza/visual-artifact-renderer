import { describe, it } from "node:test"
import { strict as assert } from "node:assert"

import type { ArtifactNode } from "@/lib/contract/artifact-schema"

import { formatDecisionsMarkdown } from "./format-decisions"
import { layoutGrid, pairOffsets, routeEdge } from "./grid-layout"
import { collectDecisions, indexClaims, needsOpenSet, suggestedAnswers } from "./plan-spec"

const decision = (id: string): ArtifactNode =>
  ({
    type: "decision",
    props: {
      id,
      question: `Pick ${id}?`,
      options: [
        { id: "a", label: "Option A", suggested: true },
        { id: "b", label: "Option B" },
      ],
    },
  }) as ArtifactNode

const claim = (text: string, children: ArtifactNode[] = []): ArtifactNode => ({ type: "claim", props: { text }, children }) as ArtifactNode

export const NEEDS_FIXTURE = {
  title: "Needs fixture",
  nodes: [
    {
      type: "claim-tree",
      props: { open: "needs" },
      children: [
        claim("One", [decision("first"), claim("One one")]),
        claim("Two", [claim("Two one", [decision("second")])]),
        claim("Three"),
      ],
    } as ArtifactNode,
  ],
}

describe("plan-spec", () => {
  it("numbers claims by position and counts descendant decisions", () => {
    const claims = indexClaims(NEEDS_FIXTURE)
    const labels = [...claims.values()].map((c) => `${c.label}:${c.decisionCount}`)
    assert.deepEqual(labels, ["1:1", "1.1:0", "2:1", "2.1:1", "3:0"])
    assert.equal(claims.get("nodes.0.children.1.children.0")?.anchor, "claim-2-1")
  })

  it("needsOpenSet returns claims 1, 2 and 2.1 (D10)", () => {
    const claims = indexClaims(NEEDS_FIXTURE)
    const labels = [...needsOpenSet(NEEDS_FIXTURE, claims)].map((path) => claims.get(path)?.label).sort()
    assert.deepEqual(labels, ["1", "2", "2.1"])
  })

  it("collects decisions in document order with their claim", () => {
    const decisions = collectDecisions(NEEDS_FIXTURE)
    assert.deepEqual(
      decisions.map((d) => [d.askId, d.claimLabel]),
      [
        ["first", "1"],
        ["second", "2.1"],
      ],
    )
  })

  it("formats decisions as Markdown data (golden)", () => {
    const decisions = collectDecisions(NEEDS_FIXTURE)
    const answers = suggestedAnswers(decisions)
    answers.second = { optionIds: ["b"], source: "reader" }
    assert.equal(
      formatDecisionsMarkdown("Needs fixture", decisions, answers),
      "## Decisions: Needs fixture\n- first (claim 1): Option A (suggested)\n- second (claim 2.1): Option B (changed from suggested: Option A)\n",
    )
  })
})

describe("grid-layout routes", () => {
  const { boxes } = layoutGrid([
    ["a", "b"],
    [null, "c"],
    ["d", null],
  ])
  const get = (id: string) => boxes.get(id)!

  it("routes same row horizontally, same column vertically, else an L", () => {
    assert.equal(routeEdge(get("a"), get("b")).kind, "row")
    assert.equal(routeEdge(get("b"), get("c")).kind, "column")
    const elbow = routeEdge(get("c"), get("d"))
    assert.equal(elbow.kind, "elbow")
    assert.equal(elbow.points.length, 3)
    assert.equal(routeEdge(get("a"), get("a")).kind, "loop")
    assert.equal(routeEdge(get("b"), get("a"), 0, { backUnder: true }).kind, "back")
  })

  it("separates two-way pairs by ±6px", () => {
    assert.deepEqual(
      pairOffsets([
        { from: "a", to: "b" },
        { from: "b", to: "a" },
        { from: "b", to: "c" },
      ]),
      [-6, 6, 0],
    )
  })
})
