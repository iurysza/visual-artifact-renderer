// Shared helpers for the terse (string-row) grammars used by plan nodes.
// Pure functions: no zod, no I/O. Parsers return errors instead of throwing.

import { PLAN_ID_RE, type ChangeMark, type GridRow } from "../plan-primitives.js"

/**
 * One parse or check failure.
 * `index` is the 0-based position in the source array (the JSON path index).
 * `line` is the 1-based human line number, when the error belongs to one row.
 */
export type TerseError = { index: number; line?: number; message: string }

export type MarkPrefix = { mark: ChangeMark; rest: string }

const MARK_BY_PREFIX: Record<string, ChangeMark> = {
  "+": "added",
  "-": "removed",
  "~": "changed",
  "?": "proposed",
}

/**
 * Reads the shared mark prefix: `+` added, `-` removed, `~` changed, `?` proposed.
 * The mark character must be followed by whitespace or end the line, so `-x` or `~/path`
 * is plain text. Anything else is context. `rest` is the remainder with leading
 * whitespace removed; parsers that care about columns read the original line.
 */
export function parseMarkPrefix(line: string): MarkPrefix {
  const first = line.charAt(0)
  const mark = MARK_BY_PREFIX[first]
  if (mark !== undefined && (line.length === 1 || /\s/.test(line.charAt(1)))) {
    return { mark, rest: line.slice(1).trimStart() }
  }
  return { mark: "context", rest: line.trimStart() }
}

export type GridCells = (string | null)[][]

const EMPTY_CELL_TOKENS = new Set([".", "·", ""])

function toCell(raw: string | null): string | null {
  if (raw === null) return null
  const value = raw.trim()
  return EMPTY_CELL_TOKENS.has(value) ? null : value
}

/**
 * Normalises grid rows to a cell matrix. Accepts `"| a | b | . |"` strings or arrays.
 * `.`, `·` and the empty string are empty cells (null).
 */
export function parseGridRows(rows: readonly GridRow[]): { cells: GridCells; errors: TerseError[] } {
  const cells: GridCells = []
  const errors: TerseError[] = []

  rows.forEach((row, index) => {
    const line = index + 1
    let raw: (string | null)[]
    if (typeof row === "string") {
      const text = row.trim()
      if (!text.startsWith("|") || !text.endsWith("|") || text.length < 2) {
        errors.push({ index, line, message: `grid row ${line}: expected "| a | b | . |"` })
        cells.push([])
        return
      }
      raw = text.slice(1, -1).split("|")
    } else {
      raw = row
    }

    const parsed = raw.map(toCell)
    for (const cell of parsed) {
      if (cell !== null && !PLAN_ID_RE.test(cell)) {
        errors.push({ index, line, message: `grid row ${line}: "${cell}" is not a valid id` })
      }
    }
    cells.push(parsed)
  })

  return { cells, errors }
}

/**
 * Checks that every grid id is known and every known id sits in exactly one cell.
 * `label` names the item kind in messages, e.g. "state" or "node".
 * Whole-grid errors (missing cells) use index 0 and no line.
 */
export function checkGrid(
  cells: GridCells,
  knownIds: Iterable<string>,
  label: string,
): TerseError[] {
  const known = new Set(knownIds)
  const seen = new Set<string>()
  const errors: TerseError[] = []

  cells.forEach((row, index) => {
    const line = index + 1
    for (const cell of row) {
      if (cell === null) continue
      if (!known.has(cell)) {
        errors.push({ index, line, message: `grid row ${line}: unknown ${label} "${cell}"` })
        continue
      }
      if (seen.has(cell)) {
        errors.push({ index, line, message: `grid: "${cell}" appears twice` })
        continue
      }
      seen.add(cell)
    }
  })

  for (const id of known) {
    if (!seen.has(id)) {
      errors.push({ index: 0, message: `grid: ${label} "${id}" has no cell` })
    }
  }

  return errors
}
