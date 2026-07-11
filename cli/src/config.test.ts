import { describe, expect, test } from "bun:test"

import { normalizeBaseUrl, resolveFsPath } from "./config.ts"

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
})
