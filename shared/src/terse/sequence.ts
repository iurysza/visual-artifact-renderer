// Terse sequence steps.
//   "a -> b : text"   call      "a --> b : text" / "a ..> b"  reply
//   "a -x-> b : text" lost      "--- label" / "--- label ---"  divider
//   "note over a, b: text"
import type { ChangeMark } from "../plan-primitives.js"
import { parseMarkPrefix, type TerseError } from "./common.js"

export type SequenceMessage = {
  kind: "message"
  from: string
  to: string
  text: string
  style?: "call" | "reply" | "lost"
  mark?: ChangeMark
}
export type SequenceNote = { kind: "note"; over: string[]; text: string }
export type SequenceDivider = { kind: "divider"; text: string }
export type SequenceStep = SequenceMessage | SequenceNote | SequenceDivider

const MESSAGE_RE = /^([A-Za-z0-9][\w.-]*)\s*(-x->|-->|\.\.>|->)\s*([A-Za-z0-9][\w.-]*)\s*(?::\s*(.*))?$/
const NOTE_RE = /^note\s+over\s+([A-Za-z0-9][\w.-]*)(?:\s*,\s*([A-Za-z0-9][\w.-]*))?\s*:\s*(.+)$/i
const DIVIDER_RE = /^---\s*(.+?)\s*(?:---)?\s*$/

export function parseSequenceStep(line: string): SequenceStep | null {
  const trimmed = line.trim()
  const divider = DIVIDER_RE.exec(trimmed)
  if (divider && !trimmed.startsWith("--->")) {
    return { kind: "divider", text: divider[1].replace(/-+$/, "").trim() }
  }
  const note = NOTE_RE.exec(trimmed)
  if (note) {
    return { kind: "note", over: note[2] ? [note[1], note[2]] : [note[1]], text: note[3].trim() }
  }
  const { mark, rest } = parseMarkPrefix(trimmed)
  const message = MESSAGE_RE.exec(rest)
  if (!message) return null
  const operator = message[2]
  const style = operator === "-x->" ? "lost" : operator === "->" ? "call" : "reply"
  return {
    kind: "message",
    from: message[1],
    to: message[3],
    text: (message[4] ?? "").trim(),
    style,
    mark: mark === "context" ? undefined : mark,
  }
}

export function normalizeSequenceSteps(steps: readonly (string | SequenceStep)[]): {
  steps: SequenceStep[]
  errors: TerseError[]
} {
  const errors: TerseError[] = []
  const out: SequenceStep[] = []
  steps.forEach((step, index) => {
    const line = index + 1
    if (typeof step !== "string") {
      out.push(step)
      return
    }
    const parsed = parseSequenceStep(step)
    if (!parsed) {
      errors.push({
        index,
        line,
        message: `step ${line}: couldn't parse "${step}" — expected "a -> b : text", "a --> b", "a -x-> b", "note over a: text" or "--- label ---"`,
      })
      return
    }
    out.push(parsed)
  })
  return { steps: out, errors }
}
