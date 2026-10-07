// Terse call-stack rows: a 2-column mark rail, then the call body.
//   "  **create()** @ cli/src/commands/create.ts:295"   depth 0
//   "~   validateSpec() -- note"                         depth 1, changed
import { SOURCE_REF_RE, type ChangeMark } from "../plan-primitives.js"
import type { TerseError } from "./common.js"

export type CallKind = "call" | "ui" | "net" | "cond" | "io" | "gap"

export type CallRowExcerpt = { code: string; language?: string; startLine?: number }

export type CallRowObject = {
  call: string
  depth: number
  mark?: ChangeMark
  at?: string
  note?: string
  kind?: CallKind
  id?: string
  excerpt?: CallRowExcerpt
}

export type CallRow = {
  call: string
  depth: number
  mark: ChangeMark
  at?: string
  note?: string
  kind: CallKind
  id?: string
  excerpt?: CallRowExcerpt
}

const RAIL_MARKS: Record<string, ChangeMark> = {
  "+": "added",
  "-": "removed",
  "~": "changed",
  "?": "proposed",
  " ": "context",
}

const NOTE_SEPARATORS = [" -- ", " — ", " // "]

export function inferCallKind(body: string): CallKind {
  const text = body.replace(/\*\*/g, "").trim()
  if (/^(…|\.\.\.)/.test(text)) return "gap"
  if (text.startsWith("<")) return "ui"
  if (/^(GET|POST|PUT|PATCH|DELETE|HEAD)\s/.test(text) || /\b(fetch|post|get|put|patch)\(/i.test(text)) return "net"
  if (/^(if|when|catch|else|switch|case)\b/.test(text)) return "cond"
  if (/^(write|read|set|save|select|insert|update|delete)/i.test(text)) return "io"
  return "call"
}

/** Splits "call @ path:1 -- note" into its parts. Location comes before the note. */
export function splitCallBody(body: string): { call: string; at?: string; note?: string } {
  let rest = body.trim()
  let note: string | undefined
  let cut = -1
  let sepLength = 0
  for (const separator of NOTE_SEPARATORS) {
    const position = rest.indexOf(separator)
    if (position !== -1 && (cut === -1 || position < cut)) {
      cut = position
      sepLength = separator.length
    }
  }
  if (cut !== -1) {
    note = rest.slice(cut + sepLength).trim() || undefined
    rest = rest.slice(0, cut).trim()
  }
  let at: string | undefined
  const atIndex = rest.lastIndexOf(" @ ")
  if (atIndex !== -1) {
    at = rest.slice(atIndex + 3).trim() || undefined
    rest = rest.slice(0, atIndex).trim()
  }
  return { call: rest, at, note }
}

type Measured =
  | { index: number; kind: "string"; mark: ChangeMark; column: number; body: string }
  | { index: number; kind: "object"; row: CallRowObject }

/**
 * Normalises terse and object rows to one shape. Depth for strings is
 * (bodyColumn - shallowestBodyColumn) / 2 over all string rows.
 */
export function normalizeCallStackRows(rows: readonly (string | CallRowObject)[]): {
  rows: CallRow[]
  errors: TerseError[]
} {
  const errors: TerseError[] = []
  const measured: (Measured | null)[] = rows.map((row, index) => {
    const line = index + 1
    if (typeof row !== "string") return { index, kind: "object", row }
    if (row.trim().length === 0) {
      errors.push({ index, line, message: `row ${line}: empty row — start a new entrypoint with a depth-0 row instead of a blank line` })
      return null
    }
    const railChar = row.charAt(0)
    const mark = RAIL_MARKS[railChar]
    if (mark === undefined) {
      errors.push({ index, line, message: `row ${line}: column 0 must be a mark (+ - ~ ?) or a space — the call starts at column 2` })
      return null
    }
    if (row.length < 2 || row.charAt(1) !== " ") {
      errors.push({ index, line, message: `row ${line}: column 1 must be a space — put the mark in column 0 and the call from column 2` })
      return null
    }
    const after = row.slice(2)
    const column = 2 + (after.length - after.trimStart().length)
    return { index, kind: "string", mark, column, body: row.slice(column) }
  })

  const stringColumns = measured.flatMap((m) => (m && m.kind === "string" ? [m.column] : []))
  const shallowest = stringColumns.length ? Math.min(...stringColumns) : 2

  const out: CallRow[] = []
  let previousDepth = -1
  for (const m of measured) {
    if (!m) continue
    const line = m.index + 1
    let row: CallRow
    if (m.kind === "object") {
      const { row: source } = m
      row = {
        call: source.call,
        depth: source.depth,
        mark: source.mark ?? "context",
        at: source.at,
        note: source.note,
        kind: source.kind ?? inferCallKind(source.call),
        id: source.id,
        excerpt: source.excerpt,
      }
    } else {
      const offset = m.column - shallowest
      if (offset % 2 !== 0) {
        errors.push({
          index: m.index,
          line,
          message: `row ${line}: indented ${offset / 2} levels but the row above is at ${Math.max(previousDepth, 0)} — indent by exactly 2 spaces per level`,
        })
        continue
      }
      const parts = splitCallBody(m.body)
      if (parts.at !== undefined && !SOURCE_REF_RE.test(parts.at)) {
        errors.push({ index: m.index, line, message: `row ${line}: couldn't parse location "${parts.at}" — expected @ path/file.ts:12 or path:12-30` })
      }
      row = {
        call: parts.call,
        depth: offset / 2,
        mark: m.mark,
        at: parts.at,
        note: parts.note,
        kind: inferCallKind(parts.call),
      }
    }
    if (out.length === 0 && row.depth !== 0) {
      errors.push({ index: m.index, line, message: `row ${line}: the first row must be at depth 0 (an entrypoint)` })
    } else if (row.depth > previousDepth + 1 && out.length > 0) {
      errors.push({
        index: m.index,
        line,
        message: `row ${line}: indented ${row.depth} levels but the row above is at ${previousDepth} — indent by exactly 2 spaces per level`,
      })
    }
    previousDepth = row.depth
    out.push(row)
  }

  return { rows: out, errors }
}

/** Number of entrypoints (depth-0 rows). */
export function countEntrypoints(rows: readonly CallRow[]): number {
  return rows.filter((row) => row.depth === 0).length
}
