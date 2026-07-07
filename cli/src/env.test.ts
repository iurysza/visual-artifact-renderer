import { describe, expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { loadEnvFile } from "./env.ts"

describe("loadEnvFile", () => {
  test("loads optional .env without overriding existing vars", async () => {
    const dir = await mkdtemp(join(tmpdir(), "va-env-"))
    try {
      process.env.VISUAL_ARTIFACT_TEST_KEY = "existing"
      await writeFile(
        join(dir, ".env"),
        [
          "# comment",
          "VISUAL_ARTIFACT_TEST_KEY=from-file",
          "VISUAL_ARTIFACT_TEST_NEW=new-value",
          `VISUAL_ARTIFACT_TEST_QUOTED="quoted-value"`,
        ].join("\n"),
        "utf8",
      )

      await loadEnvFile(dir)

      expect(process.env.VISUAL_ARTIFACT_TEST_KEY).toBe("existing")
      expect(process.env.VISUAL_ARTIFACT_TEST_NEW).toBe("new-value")
      expect(process.env.VISUAL_ARTIFACT_TEST_QUOTED).toBe("quoted-value")

      delete process.env.VISUAL_ARTIFACT_TEST_KEY
      delete process.env.VISUAL_ARTIFACT_TEST_NEW
      delete process.env.VISUAL_ARTIFACT_TEST_QUOTED
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test("is silent when .env is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "va-env-missing-"))
    try {
      await expect(loadEnvFile(dir)).resolves.toBeUndefined()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
