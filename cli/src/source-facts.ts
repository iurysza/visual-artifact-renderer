import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import { extname } from "node:path"

import type {
  ExecutionTraceSourceFacts,
  ExecutionTraceSourceFocus,
  ExecutionTraceSourceFocusKind,
  ExecutionTraceSourceScope,
} from "@agents/visual-artifact-annotations/contract"

import { ValidationError } from "./validate.ts"

export interface SourceAnchor {
  src: string
  startLine: number
  endLine: number
}

interface AstPosition {
  line: number
  column: number
}

interface AstRange {
  byteOffset: { start: number; end: number }
  start: AstPosition
  end: AstPosition
}

interface AstMatch {
  text: string
  range: AstRange
  language: string
  ruleId?: string
  metaVariables?: {
    single?: Record<string, { text?: string }>
  }
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

const RULE_KINDS = [
  ["function-declaration", "function_declaration"],
  ["method-definition", "method_definition"],
  ["arrow-function", "arrow_function"],
  ["function-expression", "function_expression"],
  ["variable-declarator", "variable_declarator"],
  ["return-statement", "return_statement"],
  ["assignment-expression", "assignment_expression"],
  ["if-statement", "if_statement"],
  ["switch-statement", "switch_statement"],
  ["for-statement", "for_statement"],
  ["for-in-statement", "for_in_statement"],
  ["while-statement", "while_statement"],
  ["do-statement", "do_statement"],
  ["ternary-expression", "ternary_expression"],
] as const

const FOCUS_RULES: Record<string, ExecutionTraceSourceFocusKind> = {
  "function-declaration": "declaration",
  "method-definition": "declaration",
  "return-statement": "return",
  "assignment-expression": "assignment",
  "variable-declarator": "assignment",
  "if-statement": "branch",
  "switch-statement": "branch",
  "for-statement": "branch",
  "for-in-statement": "branch",
  "while-statement": "branch",
  "do-statement": "branch",
  "ternary-expression": "branch",
}

function languageForPath(path: string): {
  cli: "ts" | "tsx" | "js" | "jsx"
  rule: "TypeScript" | "Tsx" | "JavaScript"
  fact: ExecutionTraceSourceFacts["language"]
} {
  switch (extname(path).toLowerCase()) {
    case ".ts":
    case ".mts":
    case ".cts":
      return { cli: "ts", rule: "TypeScript", fact: "typescript" }
    case ".tsx":
      return { cli: "tsx", rule: "Tsx", fact: "tsx" }
    case ".js":
    case ".mjs":
    case ".cjs":
      return { cli: "js", rule: "JavaScript", fact: "javascript" }
    case ".jsx":
      return { cli: "jsx", rule: "Tsx", fact: "jsx" }
    default:
      throw new ValidationError(`execution trace source language is unsupported: ${path}`)
  }
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

function inlineRules(language: string): string {
  return RULE_KINDS.map(([id, kind]) => [
    `id: ${id}`,
    `language: ${language}`,
    "rule:",
    `  kind: ${kind}`,
    "severity: hint",
    `message: ${id}`,
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

function scopeSymbol(ruleId: string, text: string): string | undefined {
  if (ruleId === "function-declaration" || ruleId === "function-expression") {
    return /\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)/.exec(text)?.[1]
  }
  if (ruleId === "variable-declarator" && text.includes("=>")) {
    return /^\s*([A-Za-z_$][\w$]*)\s*=/.exec(text)?.[1]
  }
  if (ruleId === "method-definition") {
    return /^(?:\s*(?:public|private|protected|static|async|abstract|override|readonly|get|set)\s+)*([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(/.exec(text)?.[1]
  }
  return undefined
}

function scopeKind(ruleId: string): ExecutionTraceSourceScope["kind"] | undefined {
  if (ruleId === "method-definition") return "method"
  if (ruleId === "function-declaration" || ruleId === "function-expression") return "function"
  if (ruleId === "arrow-function" || ruleId === "variable-declarator") return "callback"
  return undefined
}

function semanticNodes(callMatches: AstMatch[], scanMatches: AstMatch[]): SemanticNode[] {
  const calls = callMatches.map((match): SemanticNode => ({
    syntaxKind: "call_expression",
    focusKind: "call",
    text: match.text.trim(),
    symbol: normalizedSymbol(match.metaVariables?.single?.CALLEE?.text),
    range: match.range,
  }))
  const others = scanMatches.flatMap((match): SemanticNode[] => {
    const focusKind = match.ruleId ? FOCUS_RULES[match.ruleId] : undefined
    if (!focusKind) return []
    return [{
      syntaxKind: match.ruleId!,
      focusKind,
      text: match.text.trim(),
      symbol: match.ruleId ? scopeSymbol(match.ruleId, match.text) : undefined,
      range: match.range,
    }]
  })
  return [...calls, ...others]
}

function scopeNodes(matches: AstMatch[]): ScopeNode[] {
  return matches.flatMap((match): ScopeNode[] => {
    if (!match.ruleId) return []
    const kind = scopeKind(match.ruleId)
    if (!kind) return []
    if (match.ruleId === "variable-declarator" && !match.text.includes("=>")) return []
    return [{
      kind,
      text: match.text,
      symbol: scopeSymbol(match.ruleId, match.text),
      range: match.range,
    }]
  })
}

function sourceScope(focus: SemanticNode, matches: AstMatch[]): ExecutionTraceSourceScope | undefined {
  const enclosing = scopeNodes(matches)
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
  const language = languageForPath(input.canonicalPath)
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

  const callMatches = runAstGrep(
    ["run", "--pattern", "$CALLEE($$$ARGS)", "--lang", language.cli, "--json=compact", input.canonicalPath],
    input.projectRoot,
    `extracting calls from ${input.displayPath}`,
  )
  const scanMatches = runAstGrep(
    ["scan", "--inline-rules", inlineRules(language.rule), "--json=compact", input.canonicalPath],
    input.projectRoot,
    `extracting scopes from ${input.displayPath}`,
  )

  const contained = semanticNodes(callMatches, scanMatches)
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
  const scope = sourceScope(focusNode, scanMatches)
  const facts: ExecutionTraceSourceFacts = {
    span,
    excerpt,
    sourceHash: createHash("sha256").update(normalizedContent).digest("hex"),
    ...(git.revision ? { revision: git.revision } : {}),
    worktree: git.worktree,
    language: language.fact,
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
