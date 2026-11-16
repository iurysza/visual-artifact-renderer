"use client"

import { useCallback, useDeferredValue, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { SlidersHorizontalIcon } from "lucide-react"

import type { ArtifactIndex } from "@/lib/artifacts/artifact-index"
import { artifactIndexUrl } from "@/lib/artifacts/paths"
import {
  activityTicks,
  filterRows,
  foldArtifacts,
  groupProjects,
  groupRows,
  libraryFacets,
  nowStrip,
  projectActivity,
  isNew,
  type LibraryFacets,
  type LibraryGrouping,
  type LibraryRow,
  type ProjectGroup,
} from "@/lib/artifacts/library"
import {
  hasOperator,
  libraryParamsFromSearch,
  librarySearch,
  parseLibraryQuery,
  queryText,
  toggleOperator,
  withoutKey,
  type LibraryState,
} from "@/lib/artifacts/library-query"
import { buildSearchCatalog, suggestQualifiers } from "@/lib/artifacts/library-suggest"
import { replaceLocationSearch, useLocationSearch } from "@/lib/navigation/location-search"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CatalogueRow,
  SearchBox,
  artifactHref,
  plural,
  relativeDate,
  typeLabel,
  useLiveJson,
  useNow,
  useSlashFocus,
} from "@/components/library/library-parts"

const STATE_LABELS: Record<LibraryState, string> = {
  open: "Open comments",
  new: "New this week",
  published: "Published",
  fixture: "Fixtures and tests",
}
const GROUP_LABELS: Record<LibraryGrouping, string> = { week: "Week", project: "Project", type: "Type" }
const PROJECTS_SHOWN = 10
const PAGE = 60

function LibrarySkeleton() {
  return (
    <main className="lib mx-auto w-full max-w-[96rem] px-4 pb-16 sm:px-8">
      <span className="sr-only" role="status">Loading the library</span>
      <Skeleton className="mt-10 h-11 w-96 max-w-full" />
      <Skeleton className="mt-8 h-11 w-full" />
      <div className="mt-8 grid gap-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
    </main>
  )
}

export function ArtifactIndexLoader() {
  const state = useLiveJson<ArtifactIndex>(useMemo(() => artifactIndexUrl(), []))
  if (state.status === "loading") return <LibrarySkeleton />
  if (state.status === "failed") {
    return (
      <main className="lib mx-auto w-full max-w-[96rem] px-4 py-16 sm:px-8">
        <p className="lib-label">Library</p>
        <h1 className="mt-2 font-serif text-3xl text-ink">The library index did not load</h1>
        <p className="mt-3 text-ink-muted">{state.error}. Check that the server is running, then reload.</p>
      </main>
    )
  }
  return <Library index={state.data} />
}

function Library({ index }: { index: ArtifactIndex }) {
  const now = useNow()
  const search = useLocationSearch()
  const params = useMemo(() => libraryParamsFromSearch(search), [search])
  const [draft, setDraft] = useState(params.q)
  const [lastUrlQ, setLastUrlQ] = useState(params.q)
  // Back/forward or a link changed the URL: follow it.
  if (params.q !== lastUrlQ) { setLastUrlQ(params.q); setDraft(params.q) }
  const q = useDeferredValue(draft)
  const grouping = (params.group ?? "week") as LibraryGrouping
  const inputRef = useRef<HTMLInputElement>(null)
  useSlashFocus(inputRef)
  const [limit, setLimit] = useState(PAGE)

  const setQuery = useCallback((next: string) => {
    setDraft(next)
    setLastUrlQ(next.trim().replace(/\s+/g, " "))
    setLimit(PAGE)
    replaceLocationSearch(librarySearch({ q: next, group: params.group }))
  }, [params.group])
  const setGrouping = (next: LibraryGrouping) =>
    replaceLocationSearch(librarySearch({ q: draft, group: next === "week" ? undefined : next }))

  const artifacts = useMemo(() => index.artifacts ?? index.recent ?? [], [index])
  const rows = useMemo(() => foldArtifacts(artifacts), [artifacts])
  const catalog = useMemo(() => buildSearchCatalog(rows, artifacts, now), [rows, artifacts, now])
  const suggest = useCallback((raw: string, caret: number) => suggestQualifiers(raw, caret, catalog), [catalog])
  const results = useMemo(() => filterRows(rows, q, now), [rows, q, now])
  const facets = useMemo(() => libraryFacets(rows, q, now), [rows, q, now])
  const groups = useMemo(() => groupRows(results.slice(0, limit), grouping, now), [results, limit, grouping, now])
  const strip = useMemo(() => nowStrip(rows, now), [rows, now])
  const projects = useMemo(() => groupProjects(projectActivity(artifacts, now)), [artifacts, now])

  const parsed = parseLibraryQuery(q)
  const filtering = q.trim().length > 0
  const text = queryText(q)
  const openTotal = artifacts.reduce((n, a) => n + (a.openThreads ?? 0), 0)
  const linkTo = artifactHref(librarySearch(params))

  const rail = (
    <FilterRail
      facets={facets}
      projects={projects}
      q={draft}
      onChange={setQuery}
      selectedProjects={parsed.projects}
    />
  )

  return (
    <main className="lib mx-auto w-full max-w-[96rem] px-4 pb-20 sm:px-8">
      <section className="flex flex-wrap items-end gap-x-6 gap-y-3 pt-10 pb-6 sm:pt-12">
        <div>
          <p className="lib-label">Library</p>
          <h1 className="mt-2 font-serif text-[2.125rem] leading-[1.05] tracking-[-0.01em] text-ink sm:text-[2.75rem]">
            Everything your agents explained
          </h1>
        </div>
        <p className="lib-num text-sm text-ink-muted sm:ml-auto">
          <b className="font-medium text-ink">{artifacts.length}</b> artifacts ·{" "}
          <b className="font-medium text-ink">{rows.length}</b> after folding copies ·{" "}
          <b className="font-medium text-ink">{strip.recentCount}</b> this week
          {openTotal > 0 && (
            <>
              {" · "}
              <button type="button" className="lib-link inline-flex items-baseline gap-1.5 text-ink" onClick={() => setQuery(toggleOperator(draft, { key: "is", value: "open" }))}>
                <span className="lib-dot" aria-hidden /><b className="font-medium">{openTotal}</b> open comments
              </button>
            </>
          )}
        </p>
      </section>

      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <SearchBox
            value={draft}
            onChange={setQuery}
            inputRef={inputRef}
            label="Search the library"
            placeholder="Search, or try is:open type:review"
            suggest={suggest}
          />
        </div>
        <Sheet>
          <SheetTrigger className="lib-search shrink-0 px-3 text-sm text-ink lg:hidden" aria-label="Filters">
            <SlidersHorizontalIcon className="size-4" aria-hidden />
            <span className="hidden min-[400px]:inline">Filters</span>
          </SheetTrigger>
          <SheetContent side="left" className="overflow-y-auto bg-background p-5">
            <SheetHeader className="p-0"><SheetTitle className="font-serif text-xl font-normal">Filters</SheetTitle></SheetHeader>
            {rail}
          </SheetContent>
        </Sheet>
      </div>

      {!filtering && strip.rows.length > 0 && <NowStrip strip={strip} now={now} linkTo={linkTo} onShowRecent={() => setQuery("updated:7d")} onShowOpen={() => setQuery("is:open")} />}

      <div className="mt-8 grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden lg:block" aria-label="Filters">{rail}</aside>

        <section aria-labelledby="lib-results-heading" className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pb-1 text-[0.8125rem] text-ink-muted">
            <h2 id="lib-results-heading" className="lib-num" aria-live="polite">
              <b className="font-medium text-ink">{results.length}</b>{" "}
              {results.length === 1 ? "result" : "results"}
              {text ? <> for “{text}”</> : filtering ? " matching the filters" : " · fixtures hidden"}
            </h2>
            {filtering && <button type="button" className="lib-link" onClick={() => setQuery("")}>Clear</button>}
            {parsed.projects.length === 1 && (
              <Link className="lib-link" href={`/${parsed.projects[0]}/${librarySearch({ q: withoutKey(draft, "project") })}`}>Open {parsed.projects[0]} →</Link>
            )}
            <span className="flex-1" />
            <span className="hidden sm:inline" id="lib-group-label">Group</span>
            <div className="lib-seg" role="group" aria-labelledby="lib-group-label">
              {(Object.keys(GROUP_LABELS) as LibraryGrouping[]).map((g) => (
                <button key={g} type="button" aria-pressed={grouping === g} onClick={() => setGrouping(g)}>{GROUP_LABELS[g]}</button>
              ))}
            </div>
          </div>

          {results.length === 0 ? (
            <div className="border-t border-rule-strong py-10">
              <p className="font-serif text-xl text-ink">Nothing matches {text ? `“${text}”` : "these filters"}</p>
              <p className="mt-2 text-sm text-ink-muted">
                Fixtures are hidden until you search or pick <code className="font-mono">is:fixture</code>.{" "}
                <button type="button" className="lib-link" onClick={() => setQuery("")}>Clear the search</button>
              </p>
            </div>
          ) : (
            <div key={`${q}|${grouping}`} className="lib-results">
              {groups.map((group) => (
                <section key={group.key} aria-label={group.label}>
                  <div className="lib-group">
                    <h2>{group.label}</h2>
                    <span className="lib-label lib-num">{plural(group.rows.length, "artifact")}</span>
                  </div>
                  <div className="lib-rows">
                    {group.rows.map((row) => <CatalogueRow key={row.key} row={row} now={now} href={linkTo} />)}
                  </div>
                </section>
              ))}
              {results.length > limit && (
                <div className="border-t border-rule pt-5">
                  <button type="button" className="lib-search h-10 px-4 text-sm text-ink" onClick={() => setLimit((n) => n + PAGE * 2)}>
                    Show {Math.min(PAGE * 2, results.length - limit)} more of {results.length - limit}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function NowStrip({ strip, now, linkTo, onShowRecent, onShowOpen }: {
  strip: ReturnType<typeof nowStrip>
  now: number
  linkTo: (project: string, slug: string) => string
  onShowRecent: () => void
  onShowOpen: () => void
}) {
  return (
    <section className="lib-now mt-8" aria-labelledby="lib-now-heading">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5">
        <h2 id="lib-now-heading" className="lib-label text-ink">Now</h2>
        <span className="text-[0.8125rem] text-ink-muted">last 7 days and open comments</span>
        <span className="flex-1" />
        {strip.openCount > 0 && <button type="button" className="lib-link text-[0.8125rem]" onClick={onShowOpen}>Open comments →</button>}
        <button type="button" className="lib-link text-[0.8125rem]" onClick={onShowRecent}>All {strip.recentCount} this week →</button>
      </div>
      <div className="lib-now-grid">
        {strip.rows.map((row) => <NowItem key={row.key} row={row} now={now} href={linkTo(row.artifact.project, row.artifact.slug)} />)}
      </div>
    </section>
  )
}

function NowItem({ row, now, href }: { row: LibraryRow; now: number; href: string }) {
  const a = row.artifact
  return (
    <Link href={href} className="lib-now-item">
      <span className="lib-label">{typeLabel(a.artifactType)}</span>
      {isNew(a, now) && <span className="lib-new"> · new</span>}
      <div className="t">{a.title || a.slug}</div>
      <div className="m">
        {row.openThreads > 0 ? (
          <>
            <span className="lib-dot" aria-hidden />
            <span>{row.openThreads} open{a.openExcerpt ? ` · “${a.openExcerpt}”` : ` · ${a.project}`}</span>
          </>
        ) : (
          <span>{a.project} · {relativeDate(a.modifiedAt, now)}{row.folded.length > 0 ? ` · +${plural(row.folded.length, "copy", "copies")}` : ""}</span>
        )}
      </div>
    </Link>
  )
}

function FilterRail({ facets, projects, q, onChange, selectedProjects }: {
  facets: LibraryFacets
  projects: ProjectGroup[]
  q: string
  onChange: (q: string) => void
  selectedProjects: string[]
}) {
  const [showAll, setShowAll] = useState(false)
  const anyType = !/(^|\s)type:/.test(q)
  let shown = 0
  return (
    <nav className="flex flex-col" aria-label="Library filters">
      <h3 className="lib-label mt-5 mb-2 lg:mt-1">Type</h3>
      <button type="button" className="lib-rail-f" aria-pressed={anyType} onClick={() => onChange(withoutKey(q, "type"))}>
        All<span className="c lib-num">{facets.allTypes}</span>
      </button>
      {facets.types.map((f) => (
        <button key={f.value} type="button" className="lib-rail-f" aria-pressed={hasOperator(q, { key: "type", value: f.value })}
          onClick={() => onChange(toggleOperator(q, { key: "type", value: f.value }, { exclusive: true }))}>
          {typeLabel(f.value)}<span className="c lib-num">{f.count}</span>
        </button>
      ))}

      <h3 className="lib-label mt-6 mb-2">State</h3>
      {facets.states.map((f) => (
        <button key={f.value} type="button" className="lib-rail-f" aria-pressed={hasOperator(q, { key: "is", value: f.value })}
          onClick={() => onChange(toggleOperator(q, { key: "is", value: f.value }))}>
          {f.value === "open" && <span className="lib-dot" aria-hidden />}
          {STATE_LABELS[f.value]}<span className="c lib-num">{f.count}</span>
        </button>
      ))}

      <h3 className="lib-label mt-6 mb-1">Projects · by activity</h3>
      <p className="mb-1 text-xs text-ink-muted">Bars show the last 12 weeks</p>
      {projects.map((group) => {
        const visible = group.projects.filter((p) => showAll || selectedProjects.includes(p.name) || shown++ < PROJECTS_SHOWN)
        if (visible.length === 0) return null
        return (
          <div key={group.repo ?? "other"} className="flex flex-col">
            <div className="pt-2.5 pb-0.5 text-xs text-ink-muted">{group.repo ?? "other projects"}</div>
            {visible.map((p) => (
              <button key={p.name} type="button" className="lib-rail-f" aria-pressed={selectedProjects.includes(p.name)}
                onClick={() => onChange(toggleOperator(q, { key: "project", value: p.name }, { exclusive: true }))}
                title={`${p.name}: ${p.count} artifacts`}>
                <span className="n">{p.name}</span>
                <span className="tick" aria-hidden>{activityTicks(p.weeks)}</span>
                <span className="c lib-num">{p.count}</span>
              </button>
            ))}
          </div>
        )
      })}
      {!showAll && projects.reduce((n, g) => n + g.projects.length, 0) > PROJECTS_SHOWN && (
        <button type="button" className="lib-link mt-2 self-start text-[0.8125rem]" onClick={() => setShowAll(true)}>
          Show all {projects.reduce((n, g) => n + g.projects.length, 0)} projects
        </button>
      )}
    </nav>
  )
}
