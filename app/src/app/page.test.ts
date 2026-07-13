import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const pageSource = readFileSync(join(__dirname, "page.tsx"), "utf8")

describe("home page", () => {
  test("unconditionally renders the canonical artifact library", () => {
    assert.match(pageSource, /import\s+\{\s*ArtifactIndexLoader\s*\}\s+from\s+["']@\/components\/artifact-index-loader["']/)
    assert.match(pageSource, /return\s+<ArtifactIndexLoader\s*\/>/)
    assert.doesNotMatch(pageSource, /AlternativeArtifactIndexLoader/)
    assert.doesNotMatch(pageSource, /VISUAL_ARTIFACT_HOME_VARIANT/)
    assert.doesNotMatch(pageSource, /process\.env/)
  })
})
