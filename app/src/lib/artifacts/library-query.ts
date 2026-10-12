import { addDays, startOfDay, startOfWeek } from "date-fns"

import { ARTIFACT_TYPES, type ArtifactType } from "@/lib/contract/artifact-schema"

/**
 * Library search query. The raw string is the single source of truth and lives
 * in the URL as `?q=`. Rail clicks edit operators inside it; free text stays.
 *
 * Grammar: whitespace-separated tokens. `key:value` is a qualifier when the key
 * is known and the value is legal; anything else, including unknown keys, is a
 * search term. Different qualifiers combine with AND. Repeated values of one
 * qualifier combine with OR. `date:` and `updated:` are the same qualifier:
 * both filter `modifiedAt`, the only timestamp the index records.
 */
export const LIBRARY_STATES = ["open", "published", "new", "fixture"] as const
export type LibraryState = (typeof LIBRARY_STATES)[number]

const DAY_MS = 86_400_000

/** A point on the modified-at timeline: N days before `now`, or a calendar day. */
export type DatePoint =
  | { readonly kind: "ago"; readonly days: number }
  | { readonly kind: "day"; readonly iso: string }

/**
 * One `date:` or `updated:` value. Resolved against `now` when matching so the
 * parser stays free of the clock.
 */
export type DateClause =
  | { readonly kind: "within"; readonly days: number }
  | { readonly kind: "after"; readonly point: DatePoint; readonly inclusive: boolean }
  | { readonly kind: "before"; readonly point: DatePoint; readonly inclusive: boolean }
  | { readonly kind: "between"; readonly start: DatePoint; readonly end: DatePoint }
  | { readonly kind: "today" }
  | { readonly kind: "week" }

export interface LibraryQuery {
  /** Lowercased free-text terms. Every term must match. */
  terms: string[]
  /** OR. */
  types: ArtifactType[]
  /** OR. */
  projects: string[]
  /** OR. */
  topics: string[]
  /** OR. */
  states: LibraryState[]
  /** OR. `comments` means the row has open annotation threads. */
  has: Array<"comments">
  /** OR. Each entry is one `date:` or `updated:` qualifier. */
  dates: DateClause[]
}

export type QueryOperator =
  | { key: "type"; value: ArtifactType }
  | { key: "project"; value: string }
  | { key: "topic"; value: string }
  | { key: "is"; value: LibraryState }
  | { key: "has"; value: "comments" }
  | { key: "date" | "updated"; value: string }

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const RELATIVE_DAYS = /^(\d{1,3})d$/
const COMPARISON = /^(>=|<=|>|<)(.+)$/

function tokens(raw: string): string[] {
  return raw.trim().split(/\s+/).filter(Boolean)
}

function isIsoDay(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function parsePoint(value: string): DatePoint | null {
  const relative = RELATIVE_DAYS.exec(value)
  if (relative) {
    const days = Number(relative[1])
    return days >= 1 ? { kind: "ago", days } : null
  }
  return isIsoDay(value) ? { kind: "day", iso: value } : null
}

/** Parse a date qualifier value, or null when it is not a legal date expression. */
export function parseDateClause(value: string): DateClause | null {
  const text = value.trim().toLowerCase()
  if (!text) return null
  if (text === "today") return { kind: "today" }
  if (text === "week") return { kind: "week" }
  const range = text.split("..")
  if (range.length === 2) {
    const start = parsePoint(range[0] ?? "")
    const end = parsePoint(range[1] ?? "")
    return start && end ? { kind: "between", start, end } : null
  }
  if (range.length > 2) return null
  const comparison = COMPARISON.exec(text)
  if (comparison) {
    const point = parsePoint(comparison[2] ?? "")
    if (!point) return null
    const op = comparison[1]
    if (op === ">" || op === ">=") return { kind: "after", point, inclusive: op === ">=" }
    return { kind: "before", point, inclusive: op === "<=" }
  }
  const within = RELATIVE_DAYS.exec(text)
  if (!within) return null
  const days = Number(within[1])
  return days >= 1 ? { kind: "within", days } : null
}

function calendarStart(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number)
  return startOfDay(new Date(year, month - 1, day)).getTime()
}

function nextDay(ms: number): number {
  return addDays(new Date(ms), 1).getTime()
}

/** `after` is the newer side of a point. Calendar `>` starts the next day. */
function isAfter(t: number, point: DatePoint, inclusive: boolean, now: number): boolean {
  if (point.kind === "ago") {
    const cutoff = now - point.days * DAY_MS
    return inclusive ? t >= cutoff : t > cutoff
  }
  const start = calendarStart(point.iso)
  return t >= (inclusive ? start : nextDay(start))
}

/** `before` is the older side of a point. Calendar `<=` runs through that day. */
function isBefore(t: number, point: DatePoint, inclusive: boolean, now: number): boolean {
  if (point.kind === "ago") {
    const cutoff = now - point.days * DAY_MS
    return inclusive ? t <= cutoff : t < cutoff
  }
  const start = calendarStart(point.iso)
  return t < (inclusive ? nextDay(start) : start)
}

/** True when `modifiedAt` falls in the clause. Invalid timestamps do not match. */
export function dateMatches(modifiedAt: string, clause: DateClause, now: number): boolean {
  const t = Date.parse(modifiedAt)
  if (Number.isNaN(t)) return false
  switch (clause.kind) {
    case "within":
      return now - t <= clause.days * DAY_MS
    case "today": {
      const start = startOfDay(new Date(now)).getTime()
      return t >= start && t < nextDay(start)
    }
    case "week": {
      const start = startOfWeek(new Date(now), { weekStartsOn: 1 }).getTime()
      return t >= start && t < addDays(new Date(start), 7).getTime()
    }
    case "after":
      return isAfter(t, clause.point, clause.inclusive, now)
    case "before":
      return isBefore(t, clause.point, clause.inclusive, now)
    case "between": {
      const forward = isAfter(t, clause.start, true, now) && isBefore(t, clause.end, true, now)
      const reverse = isAfter(t, clause.end, true, now) && isBefore(t, clause.start, true, now)
      return forward || reverse
    }
  }
}

function dateKey(clause: DateClause): string {
  return JSON.stringify(clause)
}

/** Parse one token as a qualifier, or null when it is a search term. */
export function parseOperator(token: string): QueryOperator | null {
  const colon = token.indexOf(":")
  if (colon <= 0) return null
  const key = token.slice(0, colon).toLowerCase()
  const value = token.slice(colon + 1).toLowerCase()
  if (!value) return null
  switch (key) {
    case "type":
      return (ARTIFACT_TYPES as readonly string[]).includes(value) ? { key, value: value as ArtifactType } : null
    case "project":
    case "topic":
      return KEBAB.test(value) ? { key, value } : null
    case "is":
      return (LIBRARY_STATES as readonly string[]).includes(value) ? { key, value: value as LibraryState } : null
    case "has":
      return value === "comments" ? { key, value } : null
    case "date":
    case "updated":
      return parseDateClause(value) ? { key, value } : null
    default:
      return null
  }
}

export function parseLibraryQuery(raw: string): LibraryQuery {
  const query: LibraryQuery = { terms: [], types: [], projects: [], topics: [], states: [], has: [], dates: [] }
  const add = <T,>(list: T[], value: T) => { if (!list.includes(value)) list.push(value) }
  for (const token of tokens(raw)) {
    const op = parseOperator(token)
    if (!op) { query.terms.push(token.toLowerCase()); continue }
    if (op.key === "type") add(query.types, op.value)
    else if (op.key === "project") add(query.projects, op.value)
    else if (op.key === "topic") add(query.topics, op.value)
    else if (op.key === "is") add(query.states, op.value)
    else if (op.key === "has") add(query.has, op.value)
    else {
      const clause = parseDateClause(op.value)
      if (clause && !query.dates.some((existing) => dateKey(existing) === dateKey(clause))) query.dates.push(clause)
    }
  }
  return query
}

export function operatorToken(op: QueryOperator): string {
  return `${op.key}:${op.value}`
}

/** Qualifiers in the order the reader typed them. */
export function queryOperators(raw: string): QueryOperator[] {
  return tokens(raw).map(parseOperator).filter((op): op is QueryOperator => op !== null)
}

export function hasOperator(raw: string, op: QueryOperator): boolean {
  const wanted = operatorToken(op)
  return queryOperators(raw).some((existing) => operatorToken(existing) === wanted)
}

/** Remove one qualifier, keeping every other token in place. */
export function withoutOperator(raw: string, op: QueryOperator): string {
  const wanted = operatorToken(op)
  return tokens(raw).filter((token) => {
    const parsed = parseOperator(token)
    return !parsed || operatorToken(parsed) !== wanted
  }).join(" ")
}

/** Remove every qualifier with this key, keeping terms and other qualifiers. */
export function withoutKey(raw: string, key: QueryOperator["key"]): string {
  return tokens(raw).filter((token) => parseOperator(token)?.key !== key).join(" ")
}

/**
 * Toggle a qualifier. With `exclusive`, selecting replaces every other qualifier
 * of the same key, which is how single-choice rail facets behave.
 */
export function toggleOperator(raw: string, op: QueryOperator, { exclusive = false } = {}): string {
  if (hasOperator(raw, op)) return withoutOperator(raw, op)
  const base = exclusive ? withoutKey(raw, op.key) : raw
  const operators = tokens(base).filter((token) => parseOperator(token))
  const terms = tokens(base).filter((token) => !parseOperator(token))
  return [...operators, operatorToken(op), ...terms].join(" ")
}

/** Free text without qualifiers, for "results for …" copy. */
export function queryText(raw: string): string {
  return tokens(raw).filter((token) => !parseOperator(token)).join(" ")
}

export function normaliseQuery(raw: string): string {
  return tokens(raw).join(" ")
}

/** The token the caret is inside, used by the suggestion list. */
export function activeToken(raw: string, cursor: number): { start: number; end: number; text: string } {
  const clamped = Math.max(0, Math.min(cursor, raw.length))
  let start = clamped
  while (start > 0 && !/\s/.test(raw[start - 1] ?? "")) start -= 1
  let end = clamped
  while (end < raw.length && !/\s/.test(raw[end] ?? "")) end += 1
  return { start, end, text: raw.slice(start, end) }
}

export const LIBRARY_GROUP_PARAM = "group"

export interface LibraryParams {
  q: string
  group?: string
}

/**
 * Read the library state from a URL search string. Older links used
 * `?project=` and `?type=`; they become qualifiers so they keep working.
 */
export function libraryParamsFromSearch(search: string): LibraryParams {
  const params = new URLSearchParams(search)
  const parts = [params.get("q") ?? ""]
  const project = params.get("project")
  const type = params.get("type")
  if (project && parseOperator(`project:${project}`)) parts.unshift(`project:${project}`)
  if (type && parseOperator(`type:${type}`)) parts.unshift(`type:${type}`)
  const group = params.get(LIBRARY_GROUP_PARAM) ?? undefined
  return { q: normaliseQuery(parts.join(" ")), group: group && /^(project|type)$/.test(group) ? group : undefined }
}

export function librarySearch({ q, group }: LibraryParams): string {
  const params = new URLSearchParams()
  const query = normaliseQuery(q)
  if (query) params.set("q", query)
  if (group) params.set(LIBRARY_GROUP_PARAM, group)
  const search = params.toString()
  return search ? `?${search}` : ""
}
