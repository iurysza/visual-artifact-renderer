import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"

import type {
  ExecutionTraceSourceFacts,
  ExecutionTraceSourceFocus,
  ExecutionTraceSourceFocusKind,
  ExecutionTraceSourceScope,
} from "@agents/visual-artifact-annotations/contract"

import { sourceLanguageForPath } from "./source-language-adapters/index.ts"
import type {
  AstMatch,
  AstRange,
  SourceLanguageAdapter,
  SourceNodeMapping,
} from "./source-language-adapters/language-adapter.ts"
import { ValidationError } from "./validate.ts"

export interface SourceAnchor {
  src: string
  startLine: number
  endLine: number
}

interface SemanticNode {
  syntaxKind: string
  focusKind: ExecutionTraceSourceFocusKind
  text: string
  symbol?: string
  range: AstRange
}

interface ScopeNode {
  kind: ExecutionTraceSourceScope["kind"]
  text: string
  symbol?: string
  range: AstRange
}

export interface SourceFactsCandidate {
  syntaxKind: string
  focus: ExecutionTraceSourceFocus
  startLine: number
  endLine: number
}

export type SourceFactsResult =
  | { resolution: "resolved"; facts: ExecutionTraceSourceFacts }
  | {
      resolution: "ambiguous"
      span: ExecutionTraceSourceFacts["span"]
      excerpt: string
      candidates: SourceFactsCandidate[]
    }

export interface ExtractSourceFactsInput {
  canonicalPath: string
  displayPath: string
  content: string
  projectRoot: string
  startLine: number
  endLine: number
}

function parseAstMatches(stdout: string, operation: string): AstMatch[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(stdout || "[]")
  } catch (error) {
    throw new ValidationError(
      `ast-grep returned invalid JSON while ${operation}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (!Array.isArray(parsed)) {
    throw new ValidationError(`ast-grep returned a non-array while ${operation}`)
  }

  return parsed.map((value, index) => {
    if (!value || typeof value !== "object") {
      throw new ValidationError(`ast-grep returned an invalid match at index ${index}`)
    }
    const match = value as Record<string, unknown>
    const range = match.range as Record<string, unknown> | undefined
    const byteOffset = range?.byteOffset as Record<string, unknown> | undefined
    const start = range?.start as Record<string, unknown> | undefined
    const end = range?.end as Record<string, unknown> | undefined
    if (
      typeof match.text !== "string" ||
      typeof match.language !== "string" ||
      typeof byteOffset?.start !== "number" ||
      typeof byteOffset.end !== "number" ||
      typeof start?.line !== "number" ||
      typeof start.column !== "number" ||
      typeof end?.line !== "number" ||
      typeof end.column !== "number"
    ) {
      throw new ValidationError(`ast-grep returned an invalid range at index ${index}`)
    }
    return match as unknown as AstMatch
  })
}

function runAstGrep(args: string[], cwd: string, operation: string): AstMatch[] {
  const result = spawnSync("ast-grep", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  })
  const detail = String(result.stderr || "").trim()
  if (result.status === 1 && !detail && String(result.stdout).trim() === "[]") return []
  if (result.error) {
    const missing = (result.error as NodeJS.ErrnoException).code === "ENOENT"
    throw new ValidationError(
      missing
        ? "ast-grep 0.43+ is required for execution trace source extraction"
        : `ast-grep failed while ${operation}: ${result.error.message || detail || "unknown error"}`,
    )
  }
  if (result.status !== 0) {
    throw new ValidationError(`ast-grep failed while ${operation}: ${detail || "unknown error"}`)
  }
  return parseAstMatches(String(result.stdout), operation)
}

function inlineRules(language: string, mappings: readonly SourceNodeMapping[]): string {
  return mappings.map((mapping) => [
    `id: ${mapping.id}`,
    `language: ${language}`,
    "rule:",
    `  kind: ${mapping.astKind}`,
    "severity: hint",
    `message: ${mapping.id}`,
  ].join("\n")).join("\n---\n")
}

function inclusiveEndLine(range: AstRange): number {
  if (range.end.column === 0 && range.end.line > range.start.line) return range.end.line
  return range.end.line + 1
}

function containedByLines(range: AstRange, startLine: number, endLine: number): boolean {
  return range.start.line + 1 >= startLine && inclusiveEndLine(range) <= endLine
}

function rangeContains(outer: AstRange, inner: AstRange): boolean {
  return outer.byteOffset.start <= inner.byteOffset.start && outer.byteOffset.end >= inner.byteOffset.end
}

function sameRange(left: AstRange, right: AstRange): boolean {
  return left.byteOffset.start === right.byteOffset.start && left.byteOffset.end === right.byteOffset.end
}

function outermost(nodes: SemanticNode[]): SemanticNode[] {
  return nodes.filter((candidate) => !nodes.some((other) =>
    !sameRange(candidate.range, other.range) && rangeContains(other.range, candidate.range),
  ))
}

function normalizedSymbol(value: string | undefined): string | undefined {
  if (!value) return undefined
  const normalized = value.replace(/\s+/g, " ").trim()
  return normalized.length > 0 && normalized.length <= 500 ? normalized : undefined
}

function mappingForMatch(
  adapter: SourceLanguageAdapter,
  match: AstMatch,
): SourceNodeMapping | undefined {
  if (!match.ruleId) return undefined
  return adapter.nodes.find((mapping) => mapping.id === match.ruleId)
}

function semanticNodes(
  adapter: SourceLanguageAdapter,
  callMatches: AstMatch[],
  scanMatches: AstMatch[],
): SemanticNode[] {
  const calls = callMatches.map((match): SemanticNode => ({
    syntaxKind: adapter.calls.syntaxKind,
    focusKind: "call",
    text: match.text.trim(),
    symbol: normalizedSymbol(adapter.calls.extractSymbol(match)),
    range: match.range,
  }))
  const others = scanMatches.flatMap((match): SemanticNode[] => {
    const mapping = mappingForMatch(adapter, match)
    if (!mapping?.focusKind) return []
    return [{
      syntaxKind: mapping.syntaxKind,
      focusKind: mapping.focusKind,
      text: match.text.trim(),
      symbol: normalizedSymbol(mapping.extractSymbol?.(match)),
      range: match.range,
    }]
  })
  return [...calls, ...others]
}

function scopeNodes(adapter: SourceLanguageAdapter, matches: AstMatch[]): ScopeNode[] {
  return matches.flatMap((match): ScopeNode[] => {
    const mapping = mappingForMatch(adapter, match)
    if (!mapping?.scopeKind || mapping.includeAsScope?.(match) === false) return []
    return [{
      kind: mapping.scopeKind,
      text: match.text,
      symbol: normalizedSymbol(mapping.extractSymbol?.(match)),
      range: match.range,
    }]
  })
}

function sourceScope(
  adapter: SourceLanguageAdapter,
  focus: SemanticNode,
  matches: AstMatch[],
): ExecutionTraceSourceScope | undefined {
  const enclosing = scopeNodes(adapter, matches)
    .filter((scope) => !sameRange(scope.range, focus.range) && rangeContains(scope.range, focus.range))
    .sort((left, right) => {
      const namedDifference = Number(Boolean(right.symbol)) - Number(Boolean(left.symbol))
      if (namedDifference !== 0) return namedDifference
      return (left.range.byteOffset.end - left.range.byteOffset.start) -
        (right.range.byteOffset.end - right.range.byteOffset.start)
    })[0]
  if (!enclosing) return undefined
  return {
    kind: enclosing.kind,
    ...(enclosing.symbol ? { symbol: enclosing.symbol } : {}),
    startLine: enclosing.range.start.line + 1,
    endLine: inclusiveEndLine(enclosing.range),
  }
}

function gitMetadata(projectRoot: string, canonicalPath: string): {
  revision?: string
  worktree: ExecutionTraceSourceFacts["worktree"]
} {
  const revisionResult = spawnSync("git", ["-C", projectRoot, "rev-parse", "HEAD"], {
    encoding: "utf8",
  })
  if (revisionResult.status !== 0) return { worktree: "unknown" }

  const revision = String(revisionResult.stdout).trim()
  const statusResult = spawnSync("git", ["-C", projectRoot, "status", "--porcelain", "--", canonicalPath], {
    encoding: "utf8",
  })
  if (statusResult.status !== 0) return { revision, worktree: "unknown" }
  return {
    revision,
    worktree: String(statusResult.stdout).trim() ? "dirty" : "clean",
  }
}

export function parseSourceAnchor(value: string): SourceAnchor {
  const match = /^(.*):(\d+)(?:-(\d+))?$/.exec(value)
  if (!match || !match[1]) {
    throw new ValidationError(`invalid source anchor (expected file:start[-end]): ${value}`)
  }
  const startLine = Number(match[2])
  const endLine = match[3] ? Number(match[3]) : startLine
  if (!Number.isSafeInteger(startLine) || !Number.isSafeInteger(endLine) || startLine < 1 || endLine < startLine) {
    throw new ValidationError(`invalid source anchor line range: ${value}`)
  }
  return { src: match[1], startLine, endLine }
}

export function extractSourceFacts(input: ExtractSourceFactsInput): SourceFactsResult {
  const language = sourceLanguageForPath(input.canonicalPath)
  if (!language) {
    throw new ValidationError(`execution trace source language is unsupported: ${input.canonicalPath}`)
  }
  const normalizedContent = input.content.replace(/\r\n/g, "\n")
  const lines = normalizedContent.split("\n")
  if (input.endLine > lines.length) {
    throw new ValidationError(
      `execution trace source span ${input.startLine}-${input.endLine} exceeds ${input.displayPath} (${lines.length} lines)`,
    )
  }
  const excerpt = lines.slice(input.startLine - 1, input.endLine).join("\n")
  if (!excerpt.trim()) {
    throw new ValidationError(`execution trace source span is blank: ${input.displayPath}:${input.startLine}-${input.endLine}`)
  }

  const callQuery = language.adapter.calls.query
  const callMatches = runAstGrep(
    [
      "run",
      callQuery.type === "pattern" ? "--pattern" : "--kind",
      callQuery.value,
      "--lang",
      language.astGrepCliLanguage,
      "--json=compact",
      input.canonicalPath,
    ],
    input.projectRoot,
    `extracting calls from ${input.displayPath}`,
  )
  const scanMatches = runAstGrep(
    [
      "scan",
      "--inline-rules",
      inlineRules(language.astGrepRuleLanguage, language.adapter.nodes),
      "--json=compact",
      input.canonicalPath,
    ],
    input.projectRoot,
    `extracting scopes from ${input.displayPath}`,
  )

  const contained = semanticNodes(language.adapter, callMatches, scanMatches)
    .filter((node) => containedByLines(node.range, input.startLine, input.endLine))
  const containedCalls = contained.filter((node) => node.focusKind === "call")
  const candidates = outermost(containedCalls.length > 0 ? containedCalls : contained).sort(
    (left, right) => left.range.byteOffset.start - right.range.byteOffset.start,
  )
  const span = {
    file: input.displayPath,
    startLine: input.startLine,
    endLine: input.endLine,
  }

  if (candidates.length > 1) {
    return {
      resolution: "ambiguous",
      span,
      excerpt,
      candidates: candidates.map((candidate) => ({
        syntaxKind: candidate.syntaxKind,
        focus: {
          kind: candidate.focusKind,
          text: candidate.text,
          ...(candidate.symbol ? { symbol: candidate.symbol } : {}),
        },
        startLine: candidate.range.start.line + 1,
        endLine: inclusiveEndLine(candidate.range),
      })),
    }
  }

  const excerptStart = Buffer.byteLength(
    `${lines.slice(0, input.startLine - 1).join("\n")}${input.startLine > 1 ? "\n" : ""}`,
    "utf8",
  )
  const focusNode = candidates[0] ?? {
    syntaxKind: "source-span",
    focusKind: "expression" as const,
    text: excerpt.trim(),
    range: {
      byteOffset: { start: excerptStart, end: excerptStart + Buffer.byteLength(excerpt, "utf8") },
      start: { line: input.startLine - 1, column: 0 },
      end: { line: input.endLine - 1, column: lines[input.endLine - 1]?.length ?? 0 },
    },
  }
  const git = gitMetadata(input.projectRoot, input.canonicalPath)
  const scope = sourceScope(language.adapter, focusNode, scanMatches)
  const facts: ExecutionTraceSourceFacts = {
    span,
    excerpt,
    sourceHash: createHash("sha256").update(normalizedContent).digest("hex"),
    ...(git.revision ? { revision: git.revision } : {}),
    worktree: git.worktree,
    language: language.factsLanguage,
    syntaxKind: focusNode.syntaxKind,
    focus: {
      kind: focusNode.focusKind,
      text: focusNode.text,
      ...(focusNode.symbol ? { symbol: focusNode.symbol } : {}),
    },
    ...(scope ? { scope } : {}),
    resolution: "resolved",
  }
  return { resolution: "resolved", facts }
}

export function astGrepVersion(): string | undefined {
  const result = spawnSync("ast-grep", ["--version"], { encoding: "utf8" })
  if (result.status !== 0) return undefined
  return /ast-grep\s+([^\s]+)/.exec(String(result.stdout))?.[1]
}

export function astGrepVersionIsSupported(version: string | undefined): boolean {
  if (!version) return false
  const [major = 0, minor = 0] = version.split(".").map(Number)
  return major > 0 || minor >= 43
}
