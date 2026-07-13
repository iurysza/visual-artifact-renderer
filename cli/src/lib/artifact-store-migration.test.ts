import { describe, expect, test } from "bun:test"
import { mkdtemp, readFile, rm, symlink, writeFile, mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { ArtifactStoreConflictError, migrateArtifactStores } from "./artifact-store-migration.ts"

async function writeBundle(root: string, project: string, slug: string, title: string, annotation = "none") {
  const bundle = join(root, project, slug)
  await mkdir(join(bundle, "assets"), { recursive: true })
  await writeFile(join(bundle, "artifact.json"), JSON.stringify({ slug, title, nodes: [{ type: "text", props: { text: title } }] }))
  await writeFile(join(bundle, "annotations.json"), annotation)
  await writeFile(join(bundle, "assets", "note.txt"), title)
  return bundle
}

describe("artifact store migration", () => {
  test("merges stores, preserves sidecars, and removes migrated bundles", async () => {
    const dir = await mkdtemp(join(tmpdir(), "visual-artifact-store-"))
    try {
      const first = join(dir, "first")
      const second = join(dir, "second")
      const target = join(dir, "target")
      await writeBundle(first, "alpha", "one", "One", "thread-one")
      await writeBundle(second, "beta", "two", "Two", "thread-two")

      const result = await migrateArtifactStores({ sources: [first, second], target, keepSource: false })

      expect(result.migrated).toBe(2)
      expect(await readFile(join(target, "alpha", "one", "annotations.json"), "utf8")).toBe("thread-one")
      expect(await readFile(join(target, "beta", "two", "assets", "note.txt"), "utf8")).toBe("Two")
      expect(await Bun.file(join(first, "alpha", "one", "artifact.json")).exists()).toBe(false)
      expect(await Bun.file(join(second, "beta", "two", "artifact.json")).exists()).toBe(false)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test("deduplicates identical bundles without overwriting the target", async () => {
    const dir = await mkdtemp(join(tmpdir(), "visual-artifact-store-"))
    try {
      const source = join(dir, "source")
      const target = join(dir, "target")
      await writeBundle(source, "alpha", "one", "One")
      await writeBundle(target, "alpha", "one", "One")
      await rm(join(source, "alpha", "one", "assets"), { recursive: true })
      await rm(join(target, "alpha", "one", "assets", "note.txt"))

      const result = await migrateArtifactStores({ sources: [source], target, keepSource: false })

      expect(result.migrated).toBe(0)
      expect(result.deduplicated).toBe(1)
      expect(await Bun.file(join(source, "alpha", "one", "artifact.json")).exists()).toBe(false)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test("ignores a source that aliases the target through a symlink", async () => {
    const dir = await mkdtemp(join(tmpdir(), "visual-artifact-store-"))
    try {
      const target = join(dir, "target")
      const alias = join(dir, "alias")
      await writeBundle(target, "alpha", "one", "One")
      await symlink(target, alias)

      const result = await migrateArtifactStores({ sources: [alias], target })

      expect(result.sources).toEqual([])
      expect(await Bun.file(join(target, "alpha", "one", "artifact.json")).exists()).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test("rejects differing bundles before removing source data", async () => {
    const dir = await mkdtemp(join(tmpdir(), "visual-artifact-store-"))
    try {
      const source = join(dir, "source")
      const target = join(dir, "target")
      await writeBundle(source, "alpha", "one", "Source", "source-thread")
      await writeBundle(target, "alpha", "one", "Target", "target-thread")

      await expect(migrateArtifactStores({ sources: [source], target })).rejects.toBeInstanceOf(ArtifactStoreConflictError)
      expect(await Bun.file(join(source, "alpha", "one", "artifact.json")).exists()).toBe(true)
      expect(await readFile(join(target, "alpha", "one", "annotations.json"), "utf8")).toBe("target-thread")
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
