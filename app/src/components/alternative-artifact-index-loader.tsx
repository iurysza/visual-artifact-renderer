"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { SearchXIcon } from "lucide-react"

import {
  ALL_PROJECTS_SENTINEL as ALL_PROJECTS,
  ARTIFACT_TYPES,
  filterArtifacts,
  groupArtifactsByDay,
  type ArtifactIndex,
  type ArtifactType,
} from "@/lib/artifacts/alternative-index"
import { artifactIndexUrl, artifactPagePath } from "@/lib/artifacts/paths"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const ALL_TYPES = "all"

function typeLabel(type: ArtifactType): string {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

function AlternativeIndexSkeleton() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
      <div className="mt-10 grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <div className="hidden flex-col gap-3 lg:flex">
          {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-8 w-full" />)}
        </div>
        <div className="flex flex-col gap-6">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-20 w-full" />)}
        </div>
      </div>
    </main>
  )
}

export function AlternativeArtifactIndexLoader() {
  const [index, setIndex] = useState<ArtifactIndex | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [project, setProject] = useState(ALL_PROJECTS)
  const [artifactType, setArtifactType] = useState<ArtifactType | typeof ALL_TYPES>(ALL_TYPES)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const response = await fetch(artifactIndexUrl())
        if (!response.ok) throw new Error(`Index not found (${response.status})`)
        const data = (await response.json()) as ArtifactIndex
        if (!cancelled) {
          setIndex(data)
          setError(null)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError))
        }
      }
    }

    void load()
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void load()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [])

  const libraryArtifacts = useMemo(
    () => index?.artifacts ?? index?.recent ?? [],
    [index],
  )
  const filteredArtifacts = useMemo(
    () => filterArtifacts(libraryArtifacts, { query, project, artifactType }),
    [artifactType, libraryArtifacts, project, query],
  )
  const dayGroups = useMemo(() => groupArtifactsByDay(filteredArtifacts), [filteredArtifacts])
  const projectItems = useMemo(() => [
    { label: "All projects", value: ALL_PROJECTS },
    ...(index?.projects.map((item) => ({ label: item.name, value: item.name })) ?? []),
  ], [index])
  const hasFilters = query.trim().length > 0 || project !== ALL_PROJECTS || artifactType !== ALL_TYPES

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-6">
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Could not load artifacts</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </main>
    )
  }

  if (!index) return <AlternativeIndexSkeleton />

  function clearFilters() {
    setQuery("")
    setProject(ALL_PROJECTS)
    setArtifactType(ALL_TYPES)
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-12">
      <header className="flex flex-col gap-2 sm:gap-3">
        <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          VAR
        </p>
        <h1 className="font-serif text-2xl font-medium tracking-[-0.03em] sm:text-4xl">
          Artifact library
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          Find generated work by project, subject, or artifact type, ordered by when it changed.
        </p>
      </header>

      <Separator className="my-6 sm:my-8" />

      <div className="grid items-start gap-6 sm:gap-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
        <aside className="hidden lg:block" aria-label="Projects">
          <div className="flex items-center justify-between gap-3 px-2">
            <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Projects
            </h2>
            <span className="font-mono text-[11px] text-muted-foreground">{index.projects.length}</span>
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <Button
              variant={project === ALL_PROJECTS ? "secondary" : "ghost"}
              className="w-full justify-between"
              onClick={() => setProject(ALL_PROJECTS)}
            >
              <span>All projects</span>
              <span className="font-mono text-xs text-muted-foreground">{libraryArtifacts.length}</span>
            </Button>
            {index.projects.map((item) => (
              <Button
                key={item.name}
                variant={project === item.name ? "secondary" : "ghost"}
                className="w-full justify-between"
                onClick={() => setProject(item.name)}
              >
                <span className="truncate">{item.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{item.artifactCount}</span>
              </Button>
            ))}
          </div>
        </aside>

        <section className="min-w-0" aria-label="Artifacts">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search titles, descriptions, projects, topics…"
              aria-label="Search artifacts"
              className="h-9"
            />
            <Select items={projectItems} value={project} onValueChange={(value) => setProject(value ?? ALL_PROJECTS)}>
              <SelectTrigger className="h-9 w-full sm:w-52 lg:hidden" aria-label="Filter by project">
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectGroup>
                  <SelectItem value={ALL_PROJECTS}>All projects</SelectItem>
                  {index.projects.map((item) => (
                    <SelectItem key={item.name} value={item.name}>{item.name}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="mt-4 w-full pb-3">
            <ToggleGroup
              variant="outline"
              size="sm"
              value={[artifactType]}
              onValueChange={(values) => {
                const selected = values.at(-1)
                if (selected) setArtifactType(selected as ArtifactType | typeof ALL_TYPES)
              }}
              aria-label="Filter by artifact type"
            >
              <ToggleGroupItem value={ALL_TYPES}>All</ToggleGroupItem>
              {ARTIFACT_TYPES.map((type) => (
                <ToggleGroupItem key={type} value={type}>{typeLabel(type)}</ToggleGroupItem>
              ))}
            </ToggleGroup>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {dayGroups.length === 0 ? (
            <Empty className="mt-6 border">
              <EmptyHeader>
                <EmptyMedia variant="icon"><SearchXIcon /></EmptyMedia>
                <EmptyTitle>{libraryArtifacts.length === 0 ? "No artifacts yet" : "No matching artifacts"}</EmptyTitle>
                <EmptyDescription>
                  {libraryArtifacts.length === 0
                    ? "Create an artifact and it will appear here."
                    : "Try a different search, project, or type."}
                </EmptyDescription>
              </EmptyHeader>
              {hasFilters && (
                <EmptyContent>
                  <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
                </EmptyContent>
              )}
            </Empty>
          ) : (
            <div className="mt-4 flex flex-col gap-7 sm:mt-6 sm:gap-9">
              {dayGroups.map((group) => (
                <section key={group.key} aria-labelledby={`day-${group.key}`}>
                  <div className="border-b pb-2">
                    <h3 id={`day-${group.key}`} className="font-medium">{group.label}</h3>
                  </div>
                  <div className="divide-y">
                    {group.artifacts.map((artifact) => (
                      <Link
                        key={`${artifact.project}-${artifact.slug}`}
                        href={artifactPagePath(artifact.project, artifact.slug)}
                        className="group grid gap-2 py-3.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-3 sm:py-4 sm:-mx-3"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {artifact.artifactType && <Badge variant="secondary">{typeLabel(artifact.artifactType)}</Badge>}
                            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                              {artifact.project}
                            </span>
                            {artifact.topics?.slice(0, 2).map((topic) => (
                              <span key={topic} className="hidden text-xs text-muted-foreground sm:inline">{topic}</span>
                            ))}
                          </div>
                          <h4 className="mt-1.5 font-serif text-lg font-medium tracking-[-0.015em] group-hover:text-clay-dark">
                            {artifact.title}
                          </h4>
                          {artifact.description && (
                            <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                              {artifact.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 self-start font-mono text-[11px] text-muted-foreground sm:pt-1">
                          <time dateTime={artifact.modifiedAt}>{format(new Date(artifact.modifiedAt), "HH:mm")}</time>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
