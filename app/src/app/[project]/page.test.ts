import { describe, it } from "node:test"
import { strict as assert } from "node:assert"
import ProjectArtifactsPage from "./page"

describe("[project] dynamic route", () => {
  it("returns 404 for reserved root segment project names", async () => {
    for (const project of ["artifacts", "data", "api", "_next", "shell-artifact", "shell-project"]) {
      await assert.rejects(
        () => ProjectArtifactsPage({ params: Promise.resolve({ project }) }),
        /NEXT_HTTP_ERROR_FALLBACK;404/,
        `expected notFound for project=${project}`,
      )
    }
  })
})
