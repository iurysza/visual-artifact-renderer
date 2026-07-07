import { describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { listProjectArtifacts, scanArtifacts } from "./scan.ts"

async function makeTempDir(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix))
}

describe("listProjectArtifacts", () => {
  test("lists bundled artifacts and ignores flat json files", async () => {
    const dir = await makeTempDir("visualizer-scan-")
    try {
      await mkdir(join(dir, "my-project", "bundled-artifact"), { recursive: true })
      await writeFile(
        join(dir, "my-project", "bundled-artifact", "artifact.json"),
        JSON.stringify({ title: "Bundled", description: "desc" }),
        "utf8",
      )
      await writeFile(
        join(dir, "my-project", "ignored-artifact.json"),
        JSON.stringify({ title: "Ignored" }),
        "utf8",
      )

      const artifacts = await listProjectArtifacts(join(dir, "my-project"))
      expect(artifacts).toHaveLength(1)
      expect(artifacts[0].slug).toBe("bundled-artifact")
      expect(artifacts[0].title).toBe("Bundled")
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test("flat project/slug.json file is not part of the read path", async () => {
    const dir = await makeTempDir("visualizer-flat-")
    try {
      const projectDir = join(dir, "project")
      await mkdir(projectDir, { recursive: true })
      await writeFile(
        join(projectDir, "my-artifact.json"),
        JSON.stringify({ title: "Flat" }),
        "utf8",
      )
      const artifacts = await listProjectArtifacts(projectDir)
      expect(artifacts).toHaveLength(0)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe("scanArtifacts", () => {
  test("scans bundle directories across projects", async () => {
    const dir = await makeTempDir("visualizer-scan-")
    try {
      await mkdir(join(dir, "project-a", "artifact-one"), { recursive: true })
      await writeFile(
        join(dir, "project-a", "artifact-one", "artifact.json"),
        JSON.stringify({ title: "Artifact One" }),
        "utf8",
      )

      await mkdir(join(dir, "project-b", "artifact-two"), { recursive: true })
      await writeFile(
        join(dir, "project-b", "artifact-two", "artifact.json"),
        JSON.stringify({ title: "Artifact Two" }),
        "utf8",
      )

      const { projects, artifacts } = await scanArtifacts(dir)
      expect(projects).toHaveLength(2)
      expect(artifacts).toHaveLength(2)
      expect(artifacts.map((a) => a.slug).sort()).toEqual(["artifact-one", "artifact-two"])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
