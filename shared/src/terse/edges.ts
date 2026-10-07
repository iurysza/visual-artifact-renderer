// Terse box-diagram edges: "[+|-|~ ]a (->|-->|..>|=>|==>) b [: label]", "<" before the operator for both directions.
import type { ChangeMark } from "../plan-primitives.js"
import { parseMarkPrefix, type TerseError } from "./common.js"

export type BoxEdge = {
  from: string
  to: string
  label?: string
  style?: "solid" | "dashed" | "bold"
  both?: boolean
  mark?: ChangeMark
}

const EDGE_RE = /^([A-Za-z0-9][\w.-]*)\s*(<?)(-->|\.\.>|==>|=>|->)\s*([A-Za-z0-9][\w.-]*)\s*(?::\s*(.*))?$/

export function parseBoxEdge(line: string): BoxEdge | null {
  const { mark, rest } = parseMarkPrefix(line.trim())
  const match = EDGE_RE.exec(rest)
  if (!match) return null
  const operator = match[3]
  const style = operator === "->" ? "solid" : operator === "-->" || operator === "..>" ? "dashed" : "bold"
  return {
    from: match[1],
    to: match[4],
    label: match[5]?.trim() || undefined,
    style,
    both: match[2] === "<" || undefined,
    mark: mark === "context" ? undefined : mark,
  }
}

export function normalizeBoxEdges(edges: readonly (string | BoxEdge)[]): { edges: BoxEdge[]; errors: TerseError[] } {
  const errors: TerseError[] = []
  const out: BoxEdge[] = []
  edges.forEach((edge, index) => {
    const line = index + 1
    if (typeof edge !== "string") {
      out.push(edge)
      return
    }
    const parsed = parseBoxEdge(edge)
    if (!parsed) {
      errors.push({ index, line, message: `edge ${line}: couldn't parse "${edge}" — expected "a -> b : label" (-> solid, --> dashed, => bold)` })
      return
    }
    out.push(parsed)
  })
  return { edges: out, errors }
}
