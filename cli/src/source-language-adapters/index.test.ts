import { describe, expect, test } from "bun:test"

import { sourceLanguageForPath } from "./index.ts"

describe("source language adapters", () => {
  test("maps every supported extension to its ast-grep and fact languages", () => {
    const cases = [
      [".ts", "ts", "TypeScript", "typescript"],
      [".mts", "ts", "TypeScript", "typescript"],
      [".cts", "ts", "TypeScript", "typescript"],
      [".tsx", "tsx", "Tsx", "tsx"],
      [".js", "js", "JavaScript", "javascript"],
      [".mjs", "js", "JavaScript", "javascript"],
      [".cjs", "js", "JavaScript", "javascript"],
      [".jsx", "jsx", "Tsx", "jsx"],
      [".rb", "ruby", "Ruby", "ruby"],
    ] as const

    for (const [extension, cliLanguage, ruleLanguage, factsLanguage] of cases) {
      expect(sourceLanguageForPath(`source${extension}`)).toMatchObject({
        astGrepCliLanguage: cliLanguage,
        astGrepRuleLanguage: ruleLanguage,
        factsLanguage,
      })
    }
    expect(sourceLanguageForPath("source.py")).toBeUndefined()
  })
})
