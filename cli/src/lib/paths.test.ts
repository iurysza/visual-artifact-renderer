import { describe, expect, test } from "bun:test"
import { resolve } from "node:path"
import {
  artifactJsonPath,
  annotationsJsonPath,
  assetsDirPath,
  bundleDirPath,
  isInsideArtifactsDir,
  isReservedRootSegment,
  parseBundleRoute,
  parseProjectRoute,
  ROOT_RESERVED_SEGMENTS,
} from "./paths.ts"

describe("isReservedRootSegment", () => {
  test("reserves the runtime namespace segments", () => {
    for (const segment of ROOT_RESERVED_SEGMENTS) {
      expect(isReservedRootSegment(segment)).toBe(true)
    }
  })

  test("does not reserve ordinary project names", () => {
    expect(isReservedRootSegment("demo")).toBe(false)
    expect(isReservedRootSegment("my-project")).toBe(false)
  })
})

describe("parseBundleRoute", () => {
  test("accepts valid kebab-case segments", () => {
    expect(parseBundleRoute("my-project", "my-artifact")).toEqual({ project: "my-project", slug: "my-artifact" })
  })

  test("rejects path traversal attempts", () => {
    expect(parseBundleRoute("my-project", "../secret")).toBeNull()
    expect(parseBundleRoute("my-project", "a/b")).toBeNull()
    expect(parseBundleRoute("../secret", "my-artifact")).toBeNull()
  })

  test("rejects empty or invalid segments", () => {
    expect(parseBundleRoute("", "my-artifact")).toBeNull()
    expect(parseBundleRoute("my-project", "")).toBeNull()
    expect(parseBundleRoute("MyProject", "my-artifact")).toBeNull()
    expect(parseBundleRoute("my_project", "my-artifact")).toBeNull()
  })

  test("rejects reserved root segments", () => {
    for (const segment of ROOT_RESERVED_SEGMENTS) {
      expect(parseBundleRoute(segment, "my-artifact")).toBeNull()
      expect(parseBundleRoute("my-project", segment)).toBeNull()
    }
  })
})

describe("parseProjectRoute", () => {
  test("accepts valid kebab-case project", () => {
    expect(parseProjectRoute("my-project")).toEqual({ project: "my-project" })
  })

  test("rejects invalid project", () => {
    expect(parseProjectRoute("../secret")).toBeNull()
    expect(parseProjectRoute("MyProject")).toBeNull()
  })

  test("rejects reserved root segments", () => {
    for (const segment of ROOT_RESERVED_SEGMENTS) {
      expect(parseProjectRoute(segment)).toBeNull()
    }
  })
})

describe("path helpers", () => {
  test("return bundle layout paths", () => {
    const dir = "/tmp/artifacts"
    expect(bundleDirPath(dir, "my-project", "my-artifact")).toBe(resolve("/tmp/artifacts/my-project/my-artifact"))
    expect(artifactJsonPath(dir, "my-project", "my-artifact")).toBe(
      resolve("/tmp/artifacts/my-project/my-artifact/artifact.json"),
    )
    expect(annotationsJsonPath(dir, "my-project", "my-artifact")).toBe(
      resolve("/tmp/artifacts/my-project/my-artifact/annotations.json"),
    )
    expect(assetsDirPath(dir, "my-project", "my-artifact")).toBe(
      resolve("/tmp/artifacts/my-project/my-artifact/assets"),
    )
  })

  test("artifact.json path does not use flat project/slug.json layout", () => {
    const path = artifactJsonPath("/tmp/artifacts", "project", "slug")
    expect(path).toEndWith("project/slug/artifact.json")
    expect(path.endsWith("slug.json")).toBe(false)
  })
})

describe("isInsideArtifactsDir", () => {
  test("allows paths inside artifacts dir", () => {
    expect(isInsideArtifactsDir("/tmp/artifacts/my-project", "/tmp/artifacts")).toBe(true)
  })

  test("rejects paths outside artifacts dir", () => {
    expect(isInsideArtifactsDir("/tmp/artifacts/../secret", "/tmp/artifacts")).toBe(false)
    expect(isInsideArtifactsDir("/tmp/artifacts2", "/tmp/artifacts")).toBe(false)
  })
})
