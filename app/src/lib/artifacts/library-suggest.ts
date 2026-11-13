import type { RecentArtifact } from "./artifact-index"
import { isNew, type LibraryRow } from "./library"
import {
  activeToken,
  dateMatches,
  parseDateClause,
  type LibraryState,
} from "./library-query"

const VALUE_LIMIT = 8
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** One row in the search combobox. */
export interface QualifierSuggestion {
  /** Token written into the query. */
  readonly insert: string
  /** Text shown as the option name. */
  readonly label: string
  /** Count or short description, shown at the end of the row. */
  readonly hint?: string
  /** `key` leaves the caret after the colon. `value` finishes the token. */
  readonly caret: "key" | "value"
}

export interface CatalogEntry {
  readonly value: string
  readonly count: number
}

export interface DateSuggestionEntry {
  readonly value: string
  readonly label: string
  readonly count: number
  /** Shown before the reader has typed a date value. */
  readonly preset: boolean
}

/**
 * Values the loaded index can actually filter on. Qualifiers whose fields are
 * absent (`openThreads` on an older worker index, for example) are omitted.
 */
export interface SearchCatalog {
  readonly types: readonly CatalogEntry[]
  readonly projects: readonly CatalogEntry[]
  readonly topics: readonly CatalogEntry[]
  readonly states: readonly CatalogEntry[]
  /** Rows with open comments, when the index records thread counts. */
  readonly comments?: number
  readonly dates: readonly DateSuggestionEntry[]
}

const DATE_CHOICES: readonly { value: string; label: string; preset: boolean }[] = [
  { value: "today", label: "Today", preset: true },
  { value: "week", label: "This week", preset: true },
  { value: "30d", label: "Last 30 days", preset: true },
  { value: ">7d", label: "Newer than 7 days", preset: false },
  { value: ">30d", label: "Newer than 30 days", preset: false },
  { value: "<7d", label: "Older than 7 days", preset: false },
  { value: "<30d", label: "Older than 30 days", preset: false },
  { value: ">=7d", label: "Within 7 days", preset: false },
  { value: ">=30d", label: "Within 30 days", preset: false },
  { value: "<=7d", label: "At least 7 days ago", preset: false },
  { value: "<=30d", label: "At least 30 days ago", preset: false },
]

const STATE_ORDER: readonly LibraryState[] = ["open", "published", "new", "fixture"]

function counted(map: Map<string, number>): CatalogEntry[] {
  return [...map]
    .map(([value, count]) => ({ value, count }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1)
}

/**
 * Build suggestion counts from the rows the search will filter.
 * `includeFixtures` matches project pages, which list fixtures with the rest.
 */
export function buildSearchCatalog(
  rows: readonly LibraryRow[],
  artifacts: readonly RecentArtifact[],
  now: number,
  options: { includeFixtures?: boolean } = {},
): SearchCatalog {
  const visible = options.includeFixtures ? rows : rows.filter((row) => !row.fixture)
  const types = new Map<string, number>()
  const projects = new Map<string, number>()
  const topics = new Map<string, number>()
  for (const row of visible) {
    const artifact = row.artifact
    if (artifact.artifactType) bump(types, artifact.artifactType)
    if (KEBAB.test(artifact.project)) bump(projects, artifact.project)
    for (const folded of row.folded) if (KEBAB.test(folded.artifact.project)) bump(projects, folded.artifact.project)
    for (const topic of artifact.topics ?? []) {
      const value = topic.toLowerCase()
      if (KEBAB.test(value)) bump(topics, value)
    }
  }

  const supportsComments = artifacts.some((artifact) => typeof artifact.openThreads === "number")
  const states = new Map<string, number>()
  if (supportsComments) states.set("open", visible.filter((row) => row.openThreads > 0).length)
  if (artifacts.some((artifact) => typeof artifact.published === "boolean")) {
    states.set("published", visible.filter((row) => row.artifact.published === true || row.folded.some((folded) => folded.artifact.published === true)).length)
  }
  states.set("new", visible.filter((row) => isNew(row.artifact, now)).length)
  states.set("fixture", rows.filter((row) => row.fixture).length)

  const dates = DATE_CHOICES.map((choice) => {
    const clause = parseDateClause(choice.value)
    const count = clause ? visible.filter((row) => dateMatches(row.artifact.modifiedAt, clause, now)).length : 0
    return { ...choice, count }
  })

  const stateEntries = STATE_ORDER
    .map((value) => ({ value, count: states.get(value) ?? 0 }))
    .filter((entry) => entry.count > 0)

  return {
    types: counted(types),
    projects: counted(projects),
    topics: counted(topics),
    states: stateEntries,
    comments: supportsComments ? visible.filter((row) => row.openThreads > 0).length : undefined,
    dates,
  }
}

interface QualifierKey {
  key: string
  hint: string
  enabled: (catalog: SearchCatalog) => boolean
}

const QUALIFIER_KEYS: readonly QualifierKey[] = [
  { key: "type", hint: "Artifact type", enabled: (catalog) => catalog.types.length > 0 },
  { key: "project", hint: "Project", enabled: (catalog) => catalog.projects.length > 0 },
  { key: "topic", hint: "Topic", enabled: (catalog) => catalog.topics.length > 0 },
  { key: "date", hint: "Updated on", enabled: () => true },
  { key: "updated", hint: "Updated on", enabled: () => true },
  { key: "is", hint: "State", enabled: (catalog) => catalog.states.length > 0 },
  { key: "has", hint: "Includes", enabled: (catalog) => catalog.comments !== undefined },
]

function keySuggestions(prefix: string, catalog: SearchCatalog): QualifierSuggestion[] {
  return QUALIFIER_KEYS
    .filter((qualifier) => qualifier.enabled(catalog) && qualifier.key.startsWith(prefix))
    .map((qualifier) => ({
      insert: `${qualifier.key}:`,
      label: `${qualifier.key}:`,
      hint: qualifier.hint,
      caret: "key" as const,
    }))
}

function valueSuggestions(key: string, prefix: string, catalog: SearchCatalog): QualifierSuggestion[] {
  const fromEntries = (entries: readonly CatalogEntry[]) => entries
    .filter((entry) => entry.value.startsWith(prefix))
    .slice(0, VALUE_LIMIT)
    .map((entry) => ({
      insert: `${key}:${entry.value}`,
      label: entry.value,
      hint: String(entry.count),
      caret: "value" as const,
    }))

  if (key === "type") return fromEntries(catalog.types)
  if (key === "project") return fromEntries(catalog.projects)
  if (key === "topic") return fromEntries(catalog.topics)
  if (key === "is") return fromEntries(catalog.states)
  if (key === "has") {
    if (catalog.comments === undefined || !"comments".startsWith(prefix)) return []
    return [{ insert: "has:comments", label: "comments", hint: String(catalog.comments), caret: "value" }]
  }
  if (key === "date" || key === "updated") {
    return catalog.dates
      .filter((entry) => prefix.length === 0 ? entry.preset : entry.value.startsWith(prefix))
      .slice(0, VALUE_LIMIT)
      .map((entry) => ({
        insert: `${key}:${entry.value}`,
        label: entry.label,
        hint: String(entry.count),
        caret: "value" as const,
      }))
  }
  return []
}

/**
 * Suggestions for the token under the caret.
 * A key prefix such as `ty` offers `type:`. After the colon, values come from
 * the catalog. Unknown keys offer nothing and stay free text.
 */
export function suggestQualifiers(raw: string, cursor: number, catalog: SearchCatalog): QualifierSuggestion[] {
  const token = activeToken(raw, cursor)
  const typed = raw.slice(token.start, cursor).toLowerCase()
  const colon = typed.indexOf(":")
  if (colon === -1) return keySuggestions(typed, catalog)
  const key = typed.slice(0, colon)
  if (!QUALIFIER_KEYS.some((qualifier) => qualifier.key === key && qualifier.enabled(catalog))) return []
  return valueSuggestions(key, typed.slice(colon + 1), catalog)
}

/** Replace the active token with a suggestion and place the caret. */
export function applySuggestion(
  raw: string,
  cursor: number,
  suggestion: QualifierSuggestion,
): { value: string; cursor: number } {
  const token = activeToken(raw, cursor)
  const spacer = suggestion.caret === "value" && raw[token.end] !== " " ? " " : ""
  const insert = suggestion.insert + spacer
  const value = raw.slice(0, token.start) + insert + raw.slice(token.end)
  let next = token.start + insert.length
  if (!spacer && suggestion.caret === "value" && raw[token.end] === " ") next += 1
  return { value, cursor: next }
}
