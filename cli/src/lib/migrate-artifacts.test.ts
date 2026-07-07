import { describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { migrateFlatArtifacts } from "./migrate-artifacts.ts"

async function makeTempDir(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix))
}

describe("migrateFlatArtifacts", () => {
  test("dry run reports flat artifacts without moving them", async () => {
    const dir = await makeTempDir("visualizer-migrate-dry-")
    try {
      await mkdir(join(dir, "demo"), { recursive: true })
      await writeFile(join(dir, "demo", "hello-world.json"), JSON.stringify({ slug: "hello-world", title: "Hello" }), "utf8")

      const summary = await migrateFlatArtifacts({ artifactsDir: dir })

      expect(summary.apply).toBe(false)
      expect(summary.wouldMigrate).toBe(1)
      expect(summary.results[0].status).toBe("would-migrate")
      expect(await readFile(join(dir, "demo", "hello-world.json"), "utf8")).toContain("hello-world")
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test("moves flat artifacts into bundles and writes backups plus annotations", async () => {
    const dir = await makeTempDir("visualizer-migrate-apply-")
    try {
      await mkdir(join(dir, "demo"), { recursive: true })
      const artifact = { slug: "hello-world", title: "Hello" }
      await writeFile(join(dir, "demo", "hello-world.json"), `${JSON.stringify(artifact, null, 2)}\n`, "utf8")

      const backupDir = join(dir, ".migration-backup", "test")
      const summary = await migrateFlatArtifacts({ artifactsDir: dir, backupDir, apply: true })

      expect(summary.migrated).toBe(1)
      expect(summary.results[0].status).toBe("migrated")
      expect(await readFile(join(dir, "demo", "hello-world", "artifact.json"), "utf8")).toContain("hello-world")
      expect(await readFile(join(dir, "demo", "hello-world", "annotations.json"), "utf8")).toContain('"threads": []')
      expect(await readFile(join(backupDir, "demo", "hello-world.json"), "utf8")).toContain("hello-world")

      await expect(readFile(join(dir, "demo", "hello-world.json"), "utf8")).rejects.toThrow()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
