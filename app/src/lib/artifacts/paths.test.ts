import { describe, it } from "node:test"
import { strict as assert } from "node:assert"
import {
  artifactParamsFromPath,
  artifactDataPath,
  artifactPagePath,
  isReservedRootSegment,
  projectParamsFromPath,
  ROOT_RESERVED_SEGMENTS,
} from "./paths.ts"

describe("paths", () => {
  describe("isReservedRootSegment", () => {
    it("reserves the runtime namespace segments", () => {
      for (const segment of ROOT_RESERVED_SEGMENTS) {
        assert.equal(isReservedRootSegment(segment), true)
      }
    })

    it("does not reserve ordinary project names", () => {
      assert.equal(isReservedRootSegment("demo"), false)
      assert.equal(isReservedRootSegment("my-project"), false)
      assert.equal(isReservedRootSegment("visualizer"), false)
    })
  })

  describe("artifactParamsFromPath", () => {
    it("extracts project and slug from a root artifact path", () => {
      assert.deepEqual(artifactParamsFromPath("/demo/hello/"), { project: "demo", slug: "hello" })
    })

    it("rejects paths with reserved project segments", () => {
      assert.equal(artifactParamsFromPath("/artifacts/demo/"), null)
      assert.equal(artifactParamsFromPath("/data/demo/"), null)
      assert.equal(artifactParamsFromPath("/api/demo/"), null)
      assert.equal(artifactParamsFromPath("/shell-artifact/demo/"), null)
      assert.equal(artifactParamsFromPath("/shell-project/demo/"), null)
      assert.equal(artifactParamsFromPath("/_next/demo/"), null)
    })

    it("rejects paths with reserved slug segments", () => {
      assert.equal(artifactParamsFromPath("/demo/artifacts/"), null)
      assert.equal(artifactParamsFromPath("/demo/data/"), null)
      assert.equal(artifactParamsFromPath("/demo/api/"), null)
    })

    it("rejects non-kebab segments", () => {
      assert.equal(artifactParamsFromPath("/bad_project/hello/"), null)
      assert.equal(artifactParamsFromPath("/demo/bad_slug/"), null)
    })
  })

  describe("projectParamsFromPath", () => {
    it("extracts project from a root project path", () => {
      assert.deepEqual(projectParamsFromPath("/demo/"), { project: "demo" })
    })

    it("rejects reserved project segments", () => {
      assert.equal(projectParamsFromPath("/artifacts/"), null)
      assert.equal(projectParamsFromPath("/data/"), null)
      assert.equal(projectParamsFromPath("/api/"), null)
      assert.equal(projectParamsFromPath("/shell-artifact/"), null)
      assert.equal(projectParamsFromPath("/shell-project/"), null)
      assert.equal(projectParamsFromPath("/_next/"), null)
    })
  })

  describe("root URL helpers", () => {
    it("builds root artifact page paths", () => {
      assert.equal(artifactPagePath("demo", "hello"), "/demo/hello/")
    })

    it("builds root data paths", () => {
      assert.equal(artifactDataPath("demo", "hello"), "/data/artifacts/demo/hello/artifact.json")
    })
  })
})
