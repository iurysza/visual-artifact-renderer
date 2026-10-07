// Terse state-machine events: "[+|-|~ ]from -event-> to [: label]". The event token is a PlanId.
import { PLAN_ID_RE, type ChangeMark } from "../plan-primitives.js"
import { parseMarkPrefix, type TerseError } from "./common.js"

export type MachineEvent = { from: string; event: string; to: string; label?: string; mark?: ChangeMark }

const EVENT_RE = /^([A-Za-z0-9][\w.-]*)\s+-(.+?)->\s+([A-Za-z0-9][\w.-]*)\s*(?::\s*(.*))?$/

export function normalizeMachineEvents(events: readonly (string | MachineEvent)[]): {
  events: MachineEvent[]
  errors: TerseError[]
} {
  const errors: TerseError[] = []
  const out: MachineEvent[] = []
  events.forEach((event, index) => {
    const line = index + 1
    if (typeof event !== "string") {
      out.push(event)
      return
    }
    const { mark, rest } = parseMarkPrefix(event.trim())
    const match = EVENT_RE.exec(rest)
    if (!match) {
      errors.push({ index, line, message: `event ${line}: couldn't parse "${event}" — expected "from -event-> to : label"` })
      return
    }
    const token = match[2].trim()
    if (!PLAN_ID_RE.test(token)) {
      const kebab = token.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      errors.push({
        index,
        line,
        message: `event ${line}: "${token}" is not a valid event id — use kebab-case (${kebab}) and put the text after ":"`,
      })
      return
    }
    out.push({
      from: match[1],
      event: token,
      to: match[3],
      label: match[4]?.trim() || undefined,
      mark: mark === "context" ? undefined : mark,
    })
  })
  return { events: out, errors }
}
