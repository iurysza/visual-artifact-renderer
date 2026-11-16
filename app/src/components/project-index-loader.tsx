"use client"

import { useCallback, useDeferredValue, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"

import type { ArtifactIndex, RecentArtifact } from "@/lib/artifacts/artifact-index"
import { artifactIndexUrl, projectIndexUrl, projectParamsFromPath } from "@/lib/artifacts/paths"
import {
  copiesElsewhere,
  filterRows,
  groupRows,
  projectRepo,
  projectRows,
  projectTopics,
  relatedProjects,
  type CountedName,
} from "@/lib/artifacts/library"
import {
  hasOperator,
  libraryParamsFromSearch,
  librarySearch,
  normaliseQuery,
  queryText,
  toggleOperator,
  type QueryOperator,
} from "@/lib/artifacts/library-query"
import { buildSearchCatalog, suggestQualifiers } from "@/lib/artifacts/library-suggest"
import { replaceLocationSearch, useLocationSearch } from "@/lib/navigation/location-search"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CatalogueRow,
  SearchBox,
  artifactHref,
  plural,
  typeLabel,
  useLiveJson,
  useNow,
  useSlashFocus,
} from "@/components/library/library-parts"

/** Project-scoped search lives beside the home query so the back link keeps working. */
const FIND_PARAM = "find"

interface ProjectIndex {
  project: string
  artifacts: Omit<RecentArtifact, "project">[]
}

function ProjectSkeleton() {
  return (
    <main className="lib mx-auto w-full max-w-[96rem] px-4 pb-16 sm:px-8">
      <span className="sr-only" role="status">Loading the project</span>
      <Skeleton className="mt-10 h-4 w-20" />
      <Skeleton className="mt-3 h-11 w-80 max-w-full" />
      <Skeleton className="mt-4 h-4 w-96 max-w-full" />
      <div className="mt-10 grid gap-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
    </main>
  )
}

export function ProjectIndexLoader({ project: projectProp }: { project?: string }) {
  const project = useMemo<string | null>(() => {
    if (projectProp) return projectProp
    if (typeof window === "undefined") return null
    return projectParamsFromPath(window.location.pathname)?.project ?? null
  }, [projectProp])
  const own = useLiveJson<ProjectIndex>(useMemo(() => (project ? projectIndexUrl(project) : null), [project]))
  // The full index adds copies elsewhere and related projects. The page works without it.
  const library = useLiveJson<ArtifactIndex>(useMemo(() => artifactIndexUrl(), []))

  if (!project || own.status === "loading") return <ProjectSkeleton />
  if (own.status === "failed") {
    return (
      <main className="lib mx-auto w-full max-w-[96rem] px-4 py-16 sm:px-8">
        <p className="lib-label">Project</p>
        <h1 className="mt-2 font-serif text-3xl text-ink">{project} did not load</h1>
        <p className="mt-3 text-ink-muted">
          {own.error}. Check the project name, or go back to the <Link className="lib-link" href="/">library</Link>.
        </p>
      </main>
    )
  }
  const others = library.status === "loaded" ? (library.data.artifacts ?? []).filter((a) => a.project !== project) : []
  return <ProjectLibrary project={project} artifacts={own.data.artifacts.map((a) => ({ ...a, project }))} others={others} />
}

function ProjectLibrary({ project, artifacts, others }: { project: string; artifacts: RecentArtifact[]; others: RecentArtifact[] }) {
  const now = useNow()
  const search = useLocationSearch()
  const home = useMemo(() => libraryParamsFromSearch(search), [search])
  const urlFind = useMemo(() => normaliseQuery(new URLSearchParams(search).get(FIND_PARAM) ?? ""), [search])
  const [draft, setDraft] = useState(urlFind)
  const [lastUrlFind, setLastUrlFind] = useState(urlFind)
  if (urlFind !== lastUrlFind) { setLastUrlFind(urlFind); setDraft(urlFind) }
  const q = useDeferredValue(draft)
  const inputRef = useRef<HTMLInputElement>(null)
  useSlashFocus(inputRef)

  const homeSearch = librarySearch(home)
  const setQuery = useCallback((next: string) => {
    setDraft(next)
    setLastUrlFind(normaliseQuery(next))
    const params = new URLSearchParams(homeSearch)
    if (normaliseQuery(next)) params.set(FIND_PARAM, normaliseQuery(next))
    const s = params.toString()
    replaceLocationSearch(s ? `?${s}` : "")
  }, [homeSearch])

  const all = useMemo(() => [...artifacts, ...others], [artifacts, others])
  const rows = useMemo(() => projectRows(all, project), [all, project])
  const catalog = useMemo(() => buildSearchCatalog(rows, artifacts, now, { includeFixtures: true }), [rows, artifacts, now])
  const suggest = useCallback((raw: string, caret: number) => suggestQualifiers(raw, caret, catalog), [catalog])
  const results = useMemo(() => filterRows(rows, q, now, { includeFixtures: true }), [rows, q, now])
  const groups = useMemo(() => groupRows(results, "week", now), [results, now])
  const topics = useMemo(() => projectTopics(artifacts), [artifacts])
  const related = useMemo(() => relatedProjects(all, project), [all, project])
  const copies = useMemo(() => copiesElsewhere(rows), [rows])
  const types = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of rows) { const t = row.artifact.artifactType; if (t) counts.set(t, (counts.get(t) ?? 0) + 1) }
    return [...counts].sort((a, b) => b[1] - a[1]) as [NonNullable<RecentArtifact["artifactType"]>, number][]
  }, [rows])

  const repo = projectRepo(project)
  const dates = artifacts.map((a) => a.modifiedAt).sort()
  const span = dates.length === 0 ? "" : formatSpan(dates[0], dates.at(-1)!)
  const open = artifacts.reduce((n, a) => n + (a.openThreads ?? 0), 0)
  const versionsFolded = rows.reduce((n, r) => n + r.folded.filter((f) => f.kind === "version").length, 0)
  const linkTo = artifactHref(homeSearch)
  const text = queryText(q)
  const filtering = q.trim().length > 0
  const toggle = (op: QueryOperator) => setQuery(toggleOperator(draft, op, { exclusive: op.key === "type" }))

  return (
    <main className="lib mx-auto w-full max-w-[96rem] px-4 pb-20 sm:px-8">
      <header className="border-b border-rule-strong pt-10 pb-6 sm:pt-12">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="lib-label">Project</p>
          {repo && <p className="text-[0.8125rem] text-ink-muted">in {repo}</p>}
        </div>
        <h1 className="mt-2 font-serif text-[2.125rem] leading-[1.05] tracking-[-0.01em] break-words text-ink sm:text-[2.75rem]">{project}</h1>
        <p className="lib-num mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted">
          <span>
            <b className="font-medium text-ink">{artifacts.length}</b> {artifacts.length === 1 ? "artifact" : "artifacts"}
            {versionsFolded > 0 && <> · {rows.length} after folding versions</>}
          </span>
          {span && <span>{span}</span>}
          {open > 0 && (
            <button type="button" className="lib-link inline-flex items-baseline gap-1.5 text-ink" onClick={() => toggle({ key: "is", value: "open" })}>
              <span className="lib-dot" aria-hidden /><b className="font-medium">{open}</b> open comments
            </button>
          )}
          <Link className="lib-link" href={`/${homeSearch}`}>
            ← Back to the library{home.q ? <> · “{home.q}”</> : null}
          </Link>
        </p>
        {types.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-1 gap-y-1" role="group" aria-label="Filter by type">
            {types.map(([type, count]) => (
              <button key={type} type="button" className="lib-legend" aria-pressed={hasOperator(draft, { key: "type", value: type })}
                onClick={() => toggle({ key: "type", value: type })}>
                <span className="lib-num">{count}</span> {typeLabel(type).toLowerCase()}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="mt-6 grid gap-10 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <section aria-labelledby="proj-results-heading" className="min-w-0">
          <SearchBox
            value={draft}
            onChange={setQuery}
            inputRef={inputRef}
            label={`Search ${project}`}
            placeholder="Search"
            locked={[{ key: "project", value: project }]}
            suggest={suggest}
          />
          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.8125rem] text-ink-muted">
            <h2 id="proj-results-heading" className="lib-num" aria-live="polite">
              <b className="font-medium text-ink">{results.length}</b> {results.length === 1 ? "result" : "results"}
              {text ? <> for “{text}”</> : filtering ? " matching the filters" : null}
            </h2>
            {filtering && <button type="button" className="lib-link" onClick={() => setQuery("")}>Clear</button>}
          </div>

          {results.length === 0 ? (
            <div className="mt-2 border-t border-rule-strong py-10">
              <p className="font-serif text-xl text-ink">Nothing in {project} matches {text ? `“${text}”` : "these filters"}</p>
              <p className="mt-2 text-sm text-ink-muted">
                <button type="button" className="lib-link" onClick={() => setQuery("")}>Clear the search</button>
                {" "}or <Link className="lib-link" href={`/?q=${encodeURIComponent(draft)}`}>search the whole library</Link>.
              </p>
            </div>
          ) : (
            <div key={q} className="lib-results">
              {groups.map((group) => (
                <section key={group.key} aria-label={group.label}>
                  <div className="lib-group">
                    <h2>{group.label}</h2>
                    <span className="lib-label lib-num">{plural(group.rows.length, "artifact")}</span>
                  </div>
                  <div className="lib-rows">
                    {group.rows.map((row) => <CatalogueRow key={row.key} row={row} now={now} href={linkTo} showProject={false} />)}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-8 xl:pt-1" aria-label="About this project">
          {topics.length > 0 && (
            <SideList title="Topics here" items={topics.slice(0, 8)} render={(t) => (
              <button type="button" className="lib-side-r w-full text-left" aria-pressed={hasOperator(draft, { key: "topic", value: t.name })}
                onClick={() => toggle({ key: "topic", value: t.name })}>
                <span className="min-w-0 truncate">{t.name}</span><span className="c lib-num">{t.count}</span>
              </button>
            )} />
          )}
          {related.length > 0 && (
            <SideList title="Related projects" items={related.slice(0, 5)} render={(p, i) => (
              <Link className="lib-side-r" href={`/${p.name}/${homeSearch}`}>
                <span className="min-w-0 truncate">{p.name}</span>
                <span className="c lib-num">{i === 0 ? plural(p.count, "shared topic") : p.count}</span>
              </Link>
            )} />
          )}
          {copies.length > 0 && (
            <SideList title="Copies elsewhere" items={copies} render={(p) => (
              <Link className="lib-side-r" href={`/${p.name}/${homeSearch}`}>
                <span className="min-w-0 truncate">{p.name}</span><span className="c lib-num">{p.count}</span>
              </Link>
            )} />
          )}
        </aside>
      </div>
    </main>
  )
}

function SideList({ title, items, render }: { title: string; items: CountedName[]; render: (item: CountedName, index: number) => React.ReactNode }) {
  return (
    <section>
      <h3 className="lib-label mb-2">{title}</h3>
      <ul>{items.map((item, i) => <li key={item.name}>{render(item, i)}</li>)}</ul>
    </section>
  )
}

function formatSpan(first: string, last: string): string {
  const a = new Date(first)
  const b = new Date(last)
  const day = (d: Date) => format(d, "d MMM yyyy")
  if (day(a) === day(b)) return day(b)
  if (a.getFullYear() === b.getFullYear()) return `${format(a, "d MMM")} to ${day(b)}`
  return `${day(a)} to ${day(b)}`
}
