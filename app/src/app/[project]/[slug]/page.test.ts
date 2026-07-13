import { describe, it } from "node:test"
import { strict as assert } from "node:assert"
import ArtifactPage from "./page"

describe("[project]/[slug] dynamic route", () => {
  it("returns 404 when the project is a reserved root segment", async () => {
    for (const project of ["artifacts", "data", "api", "_next", "shell-artifact", "shell-project"]) {
      await assert.rejects(
        () => ArtifactPage({ params: Promise.resolve({ project, slug: "hello" }) }),
        /NEXT_HTTP_ERROR_FALLBACK;404/,
        `expected notFound for project=${project}`,
      )
    }
  })
})
