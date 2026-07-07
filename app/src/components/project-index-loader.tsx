"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { projectIndexUrl, artifactPagePath, projectParamsFromPath } from "@/lib/artifacts/paths"
import { formatDateTime } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface ArtifactListing {
  slug: string
  title: string
  description?: string
  modifiedAt: string
}

interface ProjectIndex {
  project: string
  artifacts: ArtifactListing[]
}

export function ProjectIndexLoader({ project: projectProp }: { project?: string }) {
  const project = useMemo<string | null>(() => {
    if (projectProp) return projectProp
    if (typeof window === "undefined") return null
    return projectParamsFromPath(window.location.pathname)?.project ?? null
  }, [projectProp])

  const [index, setIndex] = useState<ProjectIndex | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!project) return
    const projectName = project
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(projectIndexUrl(projectName))
        if (!res.ok) throw new Error(`Project index not found (${res.status})`)
        const data = (await res.json()) as ProjectIndex
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
  }, [project])

  if (!project) {
    return (
      <main className="mx-auto flex min-h-screen w-full items-center justify-center">
        <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          <span className="h-2 w-2 animate-ping rounded-full bg-clay" />
          Loading project index...
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen w-full items-center justify-center">
        <p className="text-muted-foreground">Error loading project index: {error}</p>
      </main>
    )
  }

  if (!index) {
    return (
      <main className="mx-auto flex min-h-screen w-full items-center justify-center">
        <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          <span className="h-2 w-2 animate-ping rounded-full bg-clay" />
          Loading project index...
        </div>
      </main>
    )
  }

  const artifacts = index.artifacts

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12 sm:px-8 lg:py-16">
      <div className="mb-10 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Project
          </p>
          <h1 className="mt-2 font-serif text-4xl font-medium tracking-[-0.02em] text-foreground">
            {project}
          </h1>
        </div>
        <Badge variant="secondary">
          {artifacts.length} artifact{artifacts.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="grid gap-4">
        {artifacts.map((artifact) => (
          <Link
            key={artifact.slug}
            href={artifactPagePath(project, artifact.slug)}
            className="group rounded-xl border bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-serif text-2xl font-medium tracking-[-0.02em]">{artifact.title}</h2>
                {artifact.description && (
                  <p className="mt-2 text-sm text-muted-foreground">{artifact.description}</p>
                )}
                <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {formatDateTime(new Date(artifact.modifiedAt))}
                </p>
              </div>
              <span className="mt-1 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-clay">
                →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
