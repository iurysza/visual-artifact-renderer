import assert from "node:assert/strict"
import { describe, test } from "node:test"

import { ALL_PROJECTS_SENTINEL, filterArtifacts, groupArtifactsByDay, type RecentArtifact } from "./alternative-index"

const artifacts: RecentArtifact[] = [
  {
    project: "visualizer",
    slug: "renderer-map",
    title: "Renderer map",
    description: "Adapter architecture",
    artifactType: "diagram",
    topics: ["react", "adapters"],
    modifiedAt: "2026-07-13T18:00:00.000Z",
  },
  {
    project: "agents",
    slug: "review-notes",
    title: "Review notes",
    artifactType: "review",
    topics: ["runtime"],
    modifiedAt: "2026-07-12T18:00:00.000Z",
  },
]

describe("alternative artifact index", () => {
  test("searches metadata while combining project and type filters", () => {
    assert.deepEqual(
      filterArtifacts(artifacts, {
        query: "adapter",
        project: "visualizer",
        artifactType: "diagram",
      }).map((artifact) => artifact.slug),
      ["renderer-map"],
    )

    assert.equal(
      filterArtifacts(artifacts, {
        query: "runtime",
        project: "visualizer",
        artifactType: "all",
      }).length,
      0,
    )
  })

  test("groups artifacts chronologically by local day", () => {
    const groups = groupArtifactsByDay([...artifacts].reverse())
    assert.equal(groups.length, 2)
    assert.equal(groups[0].artifacts[0].slug, "renderer-map")
    assert.equal(groups[1].artifacts[0].slug, "review-notes")
  })

  test("project sentinel shows all projects and does not collide with a project named all", () => {
    const withAllProject: RecentArtifact[] = [
      ...artifacts,
      {
        project: "all",
        slug: "all-project-entry",
        title: "All project entry",
        artifactType: "explainer",
        modifiedAt: "2026-07-11T18:00:00.000Z",
      },
    ]

    assert.deepEqual(
      filterArtifacts(withAllProject, {
        query: "",
        project: "all",
        artifactType: "all",
      }).map((artifact) => artifact.slug),
      ["all-project-entry"],
    )

    assert.equal(
      filterArtifacts(withAllProject, {
        query: "",
        project: ALL_PROJECTS_SENTINEL,
        artifactType: "all",
      }).length,
      3,
    )
  })
})
