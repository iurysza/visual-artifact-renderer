import assert from "node:assert/strict"
import { describe, test } from "node:test"

import {
  ALL_PROJECTS_SENTINEL,
  ALL_TYPES_SENTINEL,
  artifactFilterSearch,
  artifactFiltersFromSearch,
  artifactTypesPresentIn,
  filterArtifacts,
  groupArtifactsByDay,
  homeFilterSearchFromSearch,
  homePathWithFilters,
  pathWithArtifactFilters,
  type RecentArtifact,
} from "./artifact-index"

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

describe("artifact index", () => {
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

  test("offers only artifact types present in the current project", () => {
    assert.deepEqual(artifactTypesPresentIn(artifacts), ["review", "diagram"])
    assert.deepEqual(
      artifactTypesPresentIn(filterArtifacts(artifacts, {
        query: "",
        project: "visualizer",
        artifactType: ALL_TYPES_SENTINEL,
      })),
      ["diagram"],
    )
  })

  test("round-trips filters through home and artifact URLs", () => {
    const filters = {
      query: "agent runtime",
      project: "agents",
      artifactType: "review" as const,
    }

    assert.equal(
      artifactFilterSearch(filters),
      "?q=agent+runtime&project=agents&type=review",
    )
    assert.equal(
      homePathWithFilters(filters),
      "/?q=agent+runtime&project=agents&type=review",
    )
    assert.equal(
      pathWithArtifactFilters("/agents/review-notes/", filters),
      "/agents/review-notes/?q=agent+runtime&project=agents&type=review",
    )
    assert.deepEqual(
      artifactFiltersFromSearch("?q=agent+runtime&project=agents&type=review"),
      filters,
    )
  })

  test("keeps only valid home filters from navigation query parameters", () => {
    assert.equal(
      homeFilterSearchFromSearch("?q=runtime&project=agents&type=review&panel=comments&thread=1"),
      "?q=runtime&project=agents&type=review",
    )
    assert.deepEqual(artifactFiltersFromSearch("?type=unknown"), {
      query: "",
      project: ALL_PROJECTS_SENTINEL,
      artifactType: ALL_TYPES_SENTINEL,
    })
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
