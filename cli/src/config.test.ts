import { describe, expect, test } from "bun:test"
import { homedir } from "node:os"
import { resolve } from "node:path"

import { defaultArtifactsDir, defaultSkillRoot, normalizeBaseUrl, resolveFsPath } from "./config.ts"

describe("strict config values", () => {
  test("rejects exact-empty and whitespace-only filesystem paths", () => {
    for (const value of ["", " ", "\t", "\n"]) {
      expect(() => resolveFsPath(value, () => "/fallback")).toThrow("must not be empty")
    }
  })

  test("rejects an explicitly empty base URL", () => {
    expect(normalizeBaseUrl(undefined)).toBeUndefined()
    expect(() => normalizeBaseUrl("")).toThrow("base URL must not be empty")
    expect(() => normalizeBaseUrl(" \t ")).toThrow("base URL must not be empty")
  })

  test("stores artifacts under the shared skill namespace", () => {
    const previous = process.env.VISUAL_ARTIFACT_SKILL_ROOT
    delete process.env.VISUAL_ARTIFACT_SKILL_ROOT
    try {
      const skillRoot = resolve(homedir(), ".agents", "skills", "visual-artifact")
      expect(defaultSkillRoot()).toBe(skillRoot)
      expect(defaultArtifactsDir()).toBe(resolve(skillRoot, "artifacts"))

      process.env.VISUAL_ARTIFACT_SKILL_ROOT = "/tmp/custom-visual-artifact-skill"
      expect(defaultArtifactsDir()).toBe("/tmp/custom-visual-artifact-skill/artifacts")
    } finally {
      if (previous === undefined) delete process.env.VISUAL_ARTIFACT_SKILL_ROOT
      else process.env.VISUAL_ARTIFACT_SKILL_ROOT = previous
    }
  })
})
