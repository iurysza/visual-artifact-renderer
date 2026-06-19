"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { artifactIndexPath, artifactPagePath, projectPagePath } from "@/lib/paths"
import { formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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
    const id = setInterval(load, 5000)
    return () => {
      cancelled = true
      clearInterval(id)
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
    <main className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-8 lg:py-16">
      <section className="mb-12 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="max-w-3xl font-serif text-4xl font-medium tracking-[-0.03em] text-foreground sm:text-5xl">
              Your visual workspace.
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
              Browse reports, dashboards, and explainers generated from your local artifacts.
            </p>
          </div>
          <Link
            href="/components"
            className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium text-card-foreground shadow-sm transition hover:border-clay hover:text-clay"
          >
            <span>View Components</span>
            <span className="font-mono text-xs">→</span>
          </Link>
        </div>
      </section>

      <section className="mb-12 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-serif text-3xl font-medium tracking-[-0.04em]">{projects.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Artifacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-serif text-3xl font-medium tracking-[-0.04em]">{totalArtifacts}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Last updated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-serif text-3xl font-medium tracking-[-0.04em]">
              {lastUpdated ? formatDate(new Date(lastUpdated)) : "—"}
            </p>
          </CardContent>
        </Card>
      </section>

      {recent.length > 0 && (
        <section className="mb-16">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-serif text-2xl font-medium tracking-[-0.02em]">Recent</h2>
            <Badge variant="secondary">Last {recent.length}</Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((artifact) => (
              <Link
                key={`${artifact.project}-${artifact.slug}`}
                href={artifactPagePath(artifact.project, artifact.slug)}
                className="group flex flex-col rounded-xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {artifact.project}
                </p>
                <h3 className="mt-2 font-serif text-xl font-medium tracking-[-0.02em]">{artifact.title}</h3>
                {artifact.description && (
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{artifact.description}</p>
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
        <h2 className="mb-6 font-serif text-2xl font-medium tracking-[-0.02em]">Projects</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <Link
              key={project.name}
              href={projectPagePath(project.name)}
              className="group flex items-center justify-between rounded-xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
            >
              <div>
                <h3 className="font-serif text-xl font-medium tracking-[-0.02em]">{project.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
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
