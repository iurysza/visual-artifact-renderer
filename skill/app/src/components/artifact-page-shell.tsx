"use client"

import { useMemo } from "react"

import { SiteHeader } from "@/components/site-header"
import { AnnotationProvider } from "@/components/annotation-provider"
import { ClientArtifactLoader } from "@/components/client-artifact-loader"
import { artifactParamsFromPath, type ArtifactRouteParams } from "@/lib/artifacts/paths"
import type { VisualArtifactSpec } from "@/lib/contract/artifact-schema"

import { AIColabProvider } from "@/components/ai-colab/ai-colab-provider"

export function ArtifactPageShell({
  project,
  slug,
  initialSpec,
}: {
  project: string
  slug: string
  initialSpec?: VisualArtifactSpec
}) {
  return (
    <AIColabProvider project={project} slug={slug}>
      <AnnotationProvider project={project} slug={slug}>
        <SiteHeader />
        <ClientArtifactLoader project={project} slug={slug} initialSpec={initialSpec} />
      </AnnotationProvider>
    </AIColabProvider>
  )
}

export function LiveArtifactPageShell() {
  const params = useMemo<ArtifactRouteParams | null>(() => {
    if (typeof window === "undefined") return null
    return artifactParamsFromPath(window.location.pathname)
  }, [])

  if (!params) {
    return (
      <main className="mx-auto flex min-h-screen w-full items-center justify-center">
        <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          <span className="h-2 w-2 animate-ping rounded-full bg-clay"></span>
          Loading artifact...
        </div>
      </main>
    )
  }

  return <ArtifactPageShell project={params.project} slug={params.slug} />
}
