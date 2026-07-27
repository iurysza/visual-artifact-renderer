import { extname } from "node:path"

import { javascriptSourceLanguageAdapter } from "./javascript.ts"
import type { ResolvedSourceLanguage, SourceLanguageAdapter } from "./language-adapter.ts"
import { rubySourceLanguageAdapter } from "./ruby.ts"

const SOURCE_LANGUAGE_ADAPTERS: readonly SourceLanguageAdapter[] = [
  javascriptSourceLanguageAdapter,
  rubySourceLanguageAdapter,
]

export function sourceLanguageForPath(path: string): ResolvedSourceLanguage | undefined {
  const extension = extname(path).toLowerCase()
  for (const adapter of SOURCE_LANGUAGE_ADAPTERS) {
    for (const variant of adapter.variants) {
      if (!variant.extensions.includes(extension)) continue
      return {
        adapter,
        astGrepCliLanguage: variant.astGrepCliLanguage,
        astGrepRuleLanguage: variant.astGrepRuleLanguage,
        factsLanguage: variant.factsLanguage,
      }
    }
  }
  return undefined
}
