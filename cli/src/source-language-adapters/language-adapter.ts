import type {
  ExecutionTraceSourceFacts,
  ExecutionTraceSourceFocusKind,
  ExecutionTraceSourceScope,
} from "@agents/visual-artifact-annotations/contract"

export interface AstPosition {
  line: number
  column: number
}

export interface AstRange {
  byteOffset: { start: number; end: number }
  start: AstPosition
  end: AstPosition
}

export interface AstMatch {
  text: string
  range: AstRange
  language: string
  ruleId?: string
  metaVariables?: {
    single?: Record<string, { text?: string }>
  }
}

export interface SourceLanguageVariant {
  extensions: readonly string[]
  astGrepCliLanguage: string
  astGrepRuleLanguage: string
  factsLanguage: ExecutionTraceSourceFacts["language"]
}

export type AstGrepCallQuery =
  | { type: "pattern"; value: string }
  | { type: "kind"; value: string }

export interface SourceCallExtraction {
  query: AstGrepCallQuery
  syntaxKind: string
  extractSymbol: (match: AstMatch) => string | undefined
}

export interface SourceNodeMapping {
  id: string
  astKind: string
  syntaxKind: string
  focusKind?: ExecutionTraceSourceFocusKind
  scopeKind?: ExecutionTraceSourceScope["kind"]
  extractSymbol?: (match: AstMatch) => string | undefined
  includeAsScope?: (match: AstMatch) => boolean
}

export interface SourceLanguageAdapter {
  id: string
  variants: readonly SourceLanguageVariant[]
  calls: SourceCallExtraction
  nodes: readonly SourceNodeMapping[]
}

export interface ResolvedSourceLanguage {
  adapter: SourceLanguageAdapter
  astGrepCliLanguage: string
  astGrepRuleLanguage: string
  factsLanguage: ExecutionTraceSourceFacts["language"]
}
