import { differenceInCalendarWeeks, format, startOfWeek } from "date-fns"

import { ARTIFACT_TYPES, type ArtifactType } from "@/lib/contract/artifact-schema"
import type { RecentArtifact } from "./artifact-index"
import { dateMatches, parseLibraryQuery, type LibraryQuery, type LibraryState } from "./library-query"

const DAY_MS = 86_400_000
export const NEW_WITHIN_DAYS = 7
const SAMPLE_PROJECT = "ui-v2-samples"

/** Why a folded artifact sits under another row. */
export type FoldKind = "version" | "copy"

export interface FoldedArtifact {
  artifact: RecentArtifact
  kind: FoldKind
  /** "v2" for versions, the project name for copies. */
  label: string
}

/** One catalogue row: the artifact to open plus everything folded under it. */
export interface LibraryRow {
  key: string
  artifact: RecentArtifact
  /** "v4" when the row is the newest of a version chain. */
  version?: string
  folded: FoldedArtifact[]
  /** Open threads on the row and everything folded under it. */
  openThreads: number
  fixture: boolean
}

export interface LibraryGroup {
  key: string
  label: string
  rows: LibraryRow[]
}

export type LibraryGrouping = "week" | "project" | "type"
export const LIBRARY_GROUPINGS: readonly LibraryGrouping[] = ["week", "project", "type"]

const VERSION_SLUG = /^(.*?)-v(\d+)$/
const FIXTURE_TOPICS = new Set(["smoke-test", "test-fixture", "renderer-test", "deploy-smoke", "isolation-test", "repro"])
const FIXTURE_TITLE = /^(hello|test\b.*|share test|reorg test|src resolve test|data uri image test)$|\bsmoke\b/i
const FIXTURE_PROJECTS = new Set(["tmp"])

/** Tests, smoke checks and demos. Legacy signals only, until `purpose` lands in the contract. */
export function isFixture(artifact: RecentArtifact): boolean {
  if (FIXTURE_PROJECTS.has(artifact.project)) return true
  if (artifact.topics?.some((topic) => FIXTURE_TOPICS.has(topic))) return true
  return FIXTURE_TITLE.test(artifact.title?.trim() ?? "")
}

export function isNew(artifact: RecentArtifact, now: number): boolean {
  return now - Date.parse(artifact.modifiedAt) < NEW_WITHIN_DAYS * DAY_MS
}

export function titleKey(artifact: RecentArtifact): string {
  return (artifact.title || artifact.slug).trim().toLocaleLowerCase().replace(/\s+/g, " ")
}

function versionOf(artifact: RecentArtifact): number {
  const match = VERSION_SLUG.exec(artifact.slug)
  return match ? Number(match[2]) : 1
}

function newestFirst(a: RecentArtifact, b: RecentArtifact): number {
  return b.modifiedAt.localeCompare(a.modifiedAt)
}

/**
 * Lower is more original. Sample copies and `after-` snapshots lose to the
 * artifact in its own project; ties go to the newest write.
 */
function copyRank(artifact: RecentArtifact): number {
  return (artifact.project === SAMPLE_PROJECT ? 2 : 0) + (artifact.slug.startsWith("after-") ? 1 : 0)
}

/**
 * Fold artifacts that share a title. Within one project, `-vN` slugs form a
 * version chain and the highest version leads. Across projects, the copy in its
 * own project leads and `ui-v2-samples` copies fold under it. Nothing is removed.
 */
export function foldArtifacts(artifacts: RecentArtifact[]): LibraryRow[] {
  const byTitle = new Map<string, RecentArtifact[]>()
  for (const artifact of artifacts) {
    const key = titleKey(artifact)
    const list = byTitle.get(key)
    if (list) list.push(artifact)
    else byTitle.set(key, [artifact])
  }

  const rows: LibraryRow[] = []
  for (const members of byTitle.values()) {
    const chainProject = members.length > 1 && members.every((a) => a.project === members[0].project)
      && members.some((a) => VERSION_SLUG.test(a.slug))
    let lead: RecentArtifact
    let folded: FoldedArtifact[]
    let version: string | undefined
    if (chainProject) {
      const ordered = [...members].sort((a, b) => versionOf(b) - versionOf(a) || newestFirst(a, b))
      lead = ordered[0]
      version = `v${versionOf(lead)}`
      folded = ordered.slice(1).map((artifact) => ({ artifact, kind: "version" as const, label: `v${versionOf(artifact)}` }))
    } else {
      const ordered = [...members].sort((a, b) => copyRank(a) - copyRank(b) || newestFirst(a, b))
      lead = ordered[0]
      folded = ordered.slice(1).map((artifact) => ({ artifact, kind: "copy" as const, label: artifact.project }))
    }
    rows.push({
      key: `${lead.project}/${lead.slug}`,
      artifact: lead,
      version,
      folded,
      openThreads: members.reduce((sum, a) => sum + (a.openThreads ?? 0), 0),
      fixture: isFixture(lead),
    })
  }
  return rows.sort((a, b) => newestFirst(a.artifact, b.artifact))
}

function haystack(row: LibraryRow): string {
  const a = row.artifact
  return [a.title, a.description, a.project, a.slug, a.artifactType, ...(a.topics ?? []), ...row.folded.map((f) => f.artifact.project)]
    .filter(Boolean).join(" ").toLocaleLowerCase()
}

function hasState(row: LibraryRow, state: LibraryState, now: number): boolean {
  switch (state) {
    case "open": return row.openThreads > 0
    case "published": return row.artifact.published === true || row.folded.some((f) => f.artifact.published === true)
    case "new": return isNew(row.artifact, now)
    case "fixture": return row.fixture
  }
}

export interface MatchOptions {
  now: number
  /** Skip one facet so its own counts stay stable while it is selected. */
  ignore?: "type" | "project" | "state"
  /** Project pages list fixtures alongside real work. */
  includeFixtures?: boolean
}

function hasTopic(row: LibraryRow, topic: string): boolean {
  return (row.artifact.topics ?? []).some((value) => value.toLowerCase() === topic)
}

/**
 * Qualifiers of one key are OR, different keys are AND, terms are AND.
 * `date:` and `updated:` share one OR group because both read `modifiedAt`.
 * Fixtures stay out unless `is:fixture` is set or the reader typed a search term.
 */
export function rowMatches(row: LibraryRow, query: LibraryQuery, { now, ignore, includeFixtures }: MatchOptions): boolean {
  const a = row.artifact
  if (ignore !== "type" && query.types.length > 0 && !(a.artifactType && query.types.includes(a.artifactType))) return false
  if (ignore !== "project" && query.projects.length > 0
    && !query.projects.includes(a.project) && !row.folded.some((f) => query.projects.includes(f.artifact.project))) return false
  if (query.topics.length > 0 && !query.topics.some((topic) => hasTopic(row, topic))) return false
  if (query.dates.length > 0 && !query.dates.some((clause) => dateMatches(a.modifiedAt, clause, now))) return false
  if (query.has.length > 0 && !query.has.some((flag) => flag === "comments" && row.openThreads > 0)) return false
  if (ignore !== "state") {
    if (query.states.length > 0 && !query.states.some((state) => hasState(row, state, now))) return false
    if (!includeFixtures && row.fixture && !query.states.includes("fixture") && query.terms.length === 0) return false
  }
  if (query.terms.length > 0) {
    const text = haystack(row)
    if (!query.terms.every((term) => text.includes(term))) return false
  }
  return true
}

export function filterRows(rows: LibraryRow[], raw: string, now: number, options: { includeFixtures?: boolean } = {}): LibraryRow[] {
  const query = parseLibraryQuery(raw)
  return rows.filter((row) => rowMatches(row, query, { now, ...options }))
}

export interface Facet<T extends string> { value: T; count: number }

export interface LibraryFacets {
  types: Facet<ArtifactType>[]
  states: Facet<LibraryState>[]
  /** Rows matching every other facet, for the "All" line. */
  allTypes: number
}

export function libraryFacets(rows: LibraryRow[], raw: string, now: number): LibraryFacets {
  const query = parseLibraryQuery(raw)
  const typeBase = rows.filter((row) => rowMatches(row, query, { now, ignore: "type" }))
  const stateBase = rows.filter((row) => rowMatches(row, query, { now, ignore: "state" }))
  const types = ARTIFACT_TYPES
    .map((value) => ({ value, count: typeBase.filter((row) => row.artifact.artifactType === value).length }))
    .filter((facet) => facet.count > 0)
    .sort((a, b) => b.count - a.count)
  const states = (["open", "new", "published", "fixture"] as const).map((value) => ({
    value,
    count: stateBase.filter((row) => hasState(row, value, now)).length,
  }))
  return { types, states, allTypes: typeBase.length }
}

function weekLabel(date: Date, now: Date): string {
  const weeks = differenceInCalendarWeeks(now, date, { weekStartsOn: 1 })
  if (weeks === 0) return "This week"
  if (weeks === 1) return "Last week"
  const start = startOfWeek(date, { weekStartsOn: 1 })
  return start.getFullYear() === now.getFullYear()
    ? `Week of ${format(start, "d MMMM")}`
    : `Week of ${format(start, "d MMMM yyyy")}`
}

export function groupRows(rows: LibraryRow[], grouping: LibraryGrouping, now: number): LibraryGroup[] {
  const groups = new Map<string, LibraryGroup>()
  const today = new Date(now)
  for (const row of rows) {
    let key: string
    let label: string
    if (grouping === "week") {
      const date = new Date(row.artifact.modifiedAt)
      key = format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd")
      label = weekLabel(date, today)
    } else if (grouping === "project") {
      key = row.artifact.project
      label = row.artifact.project
    } else {
      key = row.artifact.artifactType ?? "untyped"
      label = row.artifact.artifactType ? row.artifact.artifactType[0].toUpperCase() + row.artifact.artifactType.slice(1) : "No type"
    }
    const group = groups.get(key)
    if (group) group.rows.push(row)
    else groups.set(key, { key, label, rows: [row] })
  }
  const list = [...groups.values()]
  if (grouping === "type") list.sort((a, b) => b.rows.length - a.rows.length)
  return list
}

export interface NowStrip {
  rows: LibraryRow[]
  recentCount: number
  openCount: number
}

/**
 * Up to `limit` rows: open comments first (they need a reply), then the newest
 * work of the last week. Fixtures never appear here.
 */
export function nowStrip(rows: LibraryRow[], now: number, limit = 6): NowStrip {
  const real = rows.filter((row) => !row.fixture)
  const open = real.filter((row) => row.openThreads > 0)
  const recent = real.filter((row) => isNew(row.artifact, now))
  const openPick = open.slice(0, Math.min(open.length, Math.ceil(limit / 2)))
  const picked = new Set(openPick.map((row) => row.key))
  const fill = recent.filter((row) => !picked.has(row.key)).slice(0, limit - openPick.length)
  const chosen = [...fill, ...openPick].sort((a, b) => newestFirst(a.artifact, b.artifact))
  return { rows: chosen, recentCount: recent.length, openCount: open.length }
}

/**
 * Project folders that belong to one repo. Interim: specs carry no repo yet.
 * Replace with `source.repo` from the planned meta.json sidecar.
 */
const PROJECT_REPOS: Record<string, string> = {
  "var": "visual-artifact-renderer",
  "visualizer": "visual-artifact-renderer",
  "visual-artifact-renderer": "visual-artifact-renderer",
  "va-create-src-dhmktu": "visual-artifact-renderer",
  "node-redesign": "visual-artifact-renderer",
  "node-redesign-proj": "visual-artifact-renderer",
  "ui-v2": "visual-artifact-renderer",
  "ui-v2-samples": "visual-artifact-renderer",
}

export function projectRepo(project: string): string | undefined {
  if (PROJECT_REPOS[project]) return PROJECT_REPOS[project]
  if (project.startsWith("review-pr-")) return "herdr-tab-smart-rename"
  return undefined
}

export interface ProjectActivity {
  name: string
  count: number
  lastModifiedAt: string
  /** Artifacts written in each of the last 12 weeks, oldest first. */
  weeks: number[]
}

export interface ProjectGroup {
  repo?: string
  projects: ProjectActivity[]
}

export function projectActivity(artifacts: RecentArtifact[], now: number): ProjectActivity[] {
  const byProject = new Map<string, ProjectActivity>()
  for (const artifact of artifacts) {
    let entry = byProject.get(artifact.project)
    if (!entry) {
      entry = { name: artifact.project, count: 0, lastModifiedAt: artifact.modifiedAt, weeks: Array(12).fill(0) }
      byProject.set(artifact.project, entry)
    }
    entry.count += 1
    if (artifact.modifiedAt > entry.lastModifiedAt) entry.lastModifiedAt = artifact.modifiedAt
    const weeksAgo = differenceInCalendarWeeks(new Date(now), new Date(artifact.modifiedAt), { weekStartsOn: 1 })
    if (weeksAgo >= 0 && weeksAgo < 12) entry.weeks[11 - weeksAgo] += 1
  }
  return [...byProject.values()].sort((a, b) => b.lastModifiedAt.localeCompare(a.lastModifiedAt))
}

/** Repo groups in order of their latest activity; unmapped projects last. */
export function groupProjects(projects: ProjectActivity[]): ProjectGroup[] {
  const groups = new Map<string, ProjectGroup>()
  const other: ProjectGroup = { projects: [] }
  for (const project of projects) {
    const repo = projectRepo(project.name)
    if (!repo) { other.projects.push(project); continue }
    const group = groups.get(repo) ?? { repo, projects: [] }
    group.projects.push(project)
    groups.set(repo, group)
  }
  return [...groups.values(), other].filter((group) => group.projects.length > 0)
}

/**
 * Rows for one project page. Versions fold within the project; artifacts with
 * the same title in other projects fold under each row as copies, so the page
 * shows its own work first even when the original lives elsewhere.
 */
export function projectRows(all: RecentArtifact[], project: string): LibraryRow[] {
  const here = all.filter((a) => a.project === project)
  const elsewhere = new Map<string, RecentArtifact[]>()
  for (const a of all) {
    if (a.project === project) continue
    const key = titleKey(a)
    elsewhere.set(key, [...(elsewhere.get(key) ?? []), a])
  }
  return foldArtifacts(here).map((row) => {
    const copies = (elsewhere.get(titleKey(row.artifact)) ?? []).sort(newestFirst)
    if (copies.length === 0) return row
    return {
      ...row,
      folded: [...row.folded, ...copies.map((artifact) => ({ artifact, kind: "copy" as const, label: artifact.project }))],
    }
  })
}

export interface CountedName { name: string; count: number }

function counted(map: Map<string, number>): CountedName[] {
  return [...map].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/** Topics used in a project, most used first. */
export function projectTopics(artifacts: RecentArtifact[]): CountedName[] {
  const counts = new Map<string, number>()
  for (const a of artifacts) for (const topic of new Set(a.topics ?? [])) counts.set(topic, (counts.get(topic) ?? 0) + 1)
  return counted(counts)
}

/** Other projects ranked by how many distinct topics they share with this one. */
export function relatedProjects(all: RecentArtifact[], project: string): CountedName[] {
  const own = all.filter((a) => a.project === project)
  const mine = new Set(own.flatMap((a) => a.topics ?? []))
  const ownTitles = new Set(own.map(titleKey))
  const shared = new Map<string, Set<string>>()
  for (const a of all) {
    // Copies of this project's own work are not a relation; they show under "Copies elsewhere".
    if (a.project === project || ownTitles.has(titleKey(a))) continue
    for (const topic of a.topics ?? []) {
      if (!mine.has(topic)) continue
      const set = shared.get(a.project) ?? new Set<string>()
      set.add(topic)
      shared.set(a.project, set)
    }
  }
  return counted(new Map([...shared].map(([name, set]) => [name, set.size])))
}

/** Where this project's rows have copies, by project. */
export function copiesElsewhere(rows: LibraryRow[]): CountedName[] {
  const counts = new Map<string, number>()
  for (const row of rows) for (const f of row.folded) if (f.kind === "copy") counts.set(f.label, (counts.get(f.label) ?? 0) + 1)
  return counted(counts)
}

const TICKS = ["▁", "▂", "▃", "▅", "▇"]

/** A 12-week activity strip as text: one block per week, height by count. */
export function activityTicks(weeks: number[]): string {
  const max = Math.max(1, ...weeks)
  return weeks.map((n) => (n === 0 ? TICKS[0] : TICKS[Math.max(1, Math.round((n / max) * (TICKS.length - 1)))])).join("")
}
