import assert from "node:assert/strict"
import { describe, test } from "node:test"

import type { RecentArtifact } from "./artifact-index"
import { foldArtifacts } from "./library"
import {
  applySuggestion,
  buildSearchCatalog,
  suggestQualifiers,
  type SearchCatalog,
} from "./library-suggest"

const NOW = Date.parse("2026-10-12T12:00:00.000Z")

function art(partial: Partial<RecentArtifact> & { project: string; slug: string }): RecentArtifact {
  return { title: partial.slug, artifactType: "report", modifiedAt: "2026-10-10T10:00:00.000Z", ...partial }
}

const catalog: SearchCatalog = {
  types: [{ value: "review", count: 4 }, { value: "report", count: 2 }],
  projects: [{ value: "var", count: 3 }, { value: "flue", count: 1 }],
  topics: [{ value: "agents", count: 5 }],
  states: [{ value: "open", count: 2 }, { value: "new", count: 1 }],
  comments: 2,
  dates: [
    { value: "today", label: "Today", count: 1, preset: true },
    { value: "week", label: "This week", count: 3, preset: true },
    { value: "30d", label: "Last 30 days", count: 6, preset: true },
    { value: ">7d", label: "Newer than 7 days", count: 4, preset: false },
    { value: ">30d", label: "Newer than 30 days", count: 6, preset: false },
    { value: "<7d", label: "Older than 7 days", count: 8, preset: false },
  ],
}

describe("qualifier suggestions", () => {
  test("a key prefix offers matching qualifiers", () => {
    const keys = suggestQualifiers("ty", 2, catalog).map((item) => item.insert)
    assert.deepEqual(keys, ["type:"])
    assert.deepEqual(suggestQualifiers("p", 1, catalog).map((item) => item.label), ["project:"])
    assert.equal(suggestQualifiers("note", 4, catalog).length, 0)
  })

  test("after the colon, values come from the index with counts", () => {
    const types = suggestQualifiers("type:", 5, catalog)
    assert.deepEqual(types.map((item) => [item.label, item.hint, item.insert]), [
      ["review", "4", "type:review"],
      ["report", "2", "type:report"],
    ])
    assert.deepEqual(suggestQualifiers("type:re", 7, catalog).map((item) => item.insert), ["type:review", "type:report"])
    assert.deepEqual(suggestQualifiers("type:rev", 8, catalog).map((item) => item.insert), ["type:review"])
    assert.deepEqual(suggestQualifiers("project:f", 9, catalog).map((item) => item.insert), ["project:flue"])
    assert.deepEqual(suggestQualifiers("has:", 4, catalog).map((item) => [item.insert, item.hint]), [["has:comments", "2"]])
    assert.deepEqual(suggestQualifiers("is:o", 4, catalog).map((item) => item.insert), ["is:open"])
  })

  test("date: offers presets, then relatives once a comparator is typed", () => {
    assert.deepEqual(suggestQualifiers("date:", 5, catalog).map((item) => item.label), ["Today", "This week", "Last 30 days"])
    assert.deepEqual(suggestQualifiers("updated:>", 9, catalog).map((item) => item.insert), ["updated:>7d", "updated:>30d"])
    assert.equal(suggestQualifiers("updated:>", 9, catalog)[0]?.hint, "4")
  })

  test("unknown qualifiers offer nothing", () => {
    assert.deepEqual(suggestQualifiers("created:", 8, catalog), [])
    assert.deepEqual(suggestQualifiers("tag:react", 9, catalog), [])
    assert.deepEqual(suggestQualifiers("type:poster", 11, catalog), [])
  })

  test("accepting a suggestion replaces the active token and places the caret", () => {
    const typeKey = suggestQualifiers("ty", 2, catalog)[0]!
    assert.deepEqual(applySuggestion("ty", 2, typeKey), { value: "type:", cursor: 5 })
    const review = suggestQualifiers("type:re extra", 7, catalog)[0]!
    assert.deepEqual(applySuggestion("type:re extra", 7, review), { value: "type:review extra", cursor: 12 })
    assert.deepEqual(applySuggestion("type:re", 7, review), { value: "type:review ", cursor: 12 })
  })

  test("counts follow the loaded rows and skip fields the index does not record", () => {
    const artifacts = [
      art({ project: "var", slug: "one", title: "One", artifactType: "review", topics: ["agents"], openThreads: 2, published: true }),
      art({ project: "var", slug: "two", title: "Two", artifactType: "report", modifiedAt: "2026-07-01T10:00:00.000Z" }),
      art({ project: "flue", slug: "test", title: "Test", openThreads: 1 }),
    ]
    const rows = foldArtifacts(artifacts)
    const built = buildSearchCatalog(rows, artifacts, NOW)
    assert.deepEqual(built.types, [{ value: "report", count: 1 }, { value: "review", count: 1 }])
    assert.equal(built.comments, 1)
    assert.equal(built.states.find((state) => state.value === "open")?.count, 1)
    assert.ok(built.states.some((state) => state.value === "published"))
    assert.equal(built.dates.find((date) => date.value === "30d")?.count, 1)
    assert.ok((built.dates.find((date) => date.value === "<30d")?.count ?? 0) >= 1)

    const workerShaped = artifacts.map((artifact) => ({
      project: artifact.project,
      slug: artifact.slug,
      title: artifact.title,
      artifactType: artifact.artifactType,
      topics: artifact.topics,
      modifiedAt: artifact.modifiedAt,
    }))
    const workerCatalog = buildSearchCatalog(foldArtifacts(workerShaped), workerShaped, NOW)
    assert.equal(workerCatalog.comments, undefined)
    assert.equal(workerCatalog.states.find((state) => state.value === "open"), undefined)
    assert.equal(workerCatalog.states.find((state) => state.value === "published"), undefined)
    assert.equal(suggestQualifiers("has", 3, workerCatalog).length, 0)
    assert.ok(suggestQualifiers("ty", 2, workerCatalog).some((item) => item.insert === "type:"))
  })
})
