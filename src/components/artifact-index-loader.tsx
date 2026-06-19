"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { artifactIndexPath, artifactPagePath, projectPagePath } from "@/lib/paths"
import { formatDate } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface ProjectListing {
  name: string
  artifactCount: number
  lastModifiedAt: string
}

interface RecentArtifact {
  slug: string
  title: string
  description?: string
  modifiedAt: string
  project: string
}

interface ArtifactIndex {
  projects: ProjectListing[]
  recent: RecentArtifact[]
}

export function ArtifactIndexLoader() {
  const [index, setIndex] = useState<ArtifactIndex | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(artifactIndexPath())
        if (!res.ok) throw new Error(`Index not found (${res.status})`)
        const data = (await res.json()) as ArtifactIndex
        if (!cancelled) {
          setIndex(data)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      }
    }

    load()

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") load()
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [])

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen w-full items-center justify-center">
        <p className="text-muted-foreground">Error loading index: {error}</p>
      </main>
    )
  }

  if (!index) {
    return (
      <main className="mx-auto flex min-h-screen w-full items-center justify-center">
        <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          <span className="h-2 w-2 animate-ping rounded-full bg-clay" />
          Loading index...
        </div>
      </main>
    )
  }

  const { projects, recent } = index
  const totalArtifacts = projects.reduce((sum, p) => sum + p.artifactCount, 0)
  const lastUpdated = recent[0]?.modifiedAt ?? projects[0]?.lastModifiedAt

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-[-0.03em] text-foreground sm:text-4xl">
            Your visual workspace.
          </h1>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground">
            Browse reports, dashboards, and explainers generated from your local artifacts.
          </p>
        </div>
        <Link
          href="/components"
          className="inline-flex w-fit items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium text-card-foreground shadow-sm transition hover:border-clay hover:text-clay"
        >
          <span>View Components</span>
          <span className="font-mono text-xs">→</span>
        </Link>
      </header>

      <section className="mb-12 flex flex-wrap items-center gap-3 border-b pb-8">
        <Badge variant="secondary" className="font-mono text-[11px] uppercase tracking-[0.12em]">
          {projects.length} project{projects.length === 1 ? "" : "s"}
        </Badge>
        <Badge variant="secondary" className="font-mono text-[11px] uppercase tracking-[0.12em]">
          {totalArtifacts} artifact{totalArtifacts === 1 ? "" : "s"}
        </Badge>
        {lastUpdated && (
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Updated {formatDate(new Date(lastUpdated))}
          </span>
        )}
      </section>

      {recent.length > 0 && (
        <section className="mb-16">
          <h2 className="mb-5 font-serif text-xl font-medium tracking-[-0.02em]">Recent</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recent.map((artifact, i) => (
              <Link
                key={`${artifact.project}-${artifact.slug}`}
                href={artifactPagePath(artifact.project, artifact.slug)}
                className={cn(
                  "group flex flex-col rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md",
                  i === 0 && recent.length >= 2 && "lg:col-span-2 lg:min-h-[280px]"
                )}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {artifact.project}
                </p>
                <h3
                  className={cn(
                    "mt-2 font-serif font-medium tracking-[-0.02em]",
                    i === 0 ? "text-2xl" : "text-xl"
                  )}
                >
                  {artifact.title}
                </h3>
                {artifact.description && (
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {artifact.description}
                  </p>
                )}
                <p className="mt-auto pt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {formatDate(new Date(artifact.modifiedAt))}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-5 font-serif text-xl font-medium tracking-[-0.02em]">Projects</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {projects.map((project) => (
            <Link
              key={project.name}
              href={projectPagePath(project.name)}
              className="group flex items-center justify-between rounded-xl border bg-card p-4 transition hover:border-primary hover:bg-muted/30"
            >
              <div>
                <h3 className="font-serif text-lg font-medium tracking-[-0.02em]">{project.name}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {project.artifactCount} artifact{project.artifactCount === 1 ? "" : "s"}
                </p>
              </div>
              <span className="text-muted-foreground transition group-hover:translate-x-1 group-hover:text-clay">
                →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
