import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { readArtifactFileBounded } from "./read-artifact-file"

test("reads through one opened handle and enforces the byte cap", async () => {
  const dir = await mkdtemp(join(tmpdir(), "visual-artifact-read-"))
  const filePath = join(dir, "artifact.json")
  try {
    await writeFile(filePath, "12345", "utf8")
    assert.equal(await readArtifactFileBounded(filePath, 5), "12345")
    await assert.rejects(readArtifactFileBounded(filePath, 4), /larger than 4 bytes/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
