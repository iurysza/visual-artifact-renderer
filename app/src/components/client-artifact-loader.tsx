"use client"

import { useEffect, useMemo, useState } from "react"
import { VisualArtifactRenderer } from "@/components/visual-artifact-renderer"
import { VisualArtifactSpecSchema, type VisualArtifactSpec } from "@/lib/contract/artifact-schema"
import { artifactDataUrl, artifactParamsFromPath, type ArtifactRouteParams } from "@/lib/artifacts/paths"

import { useAIColabContext } from "@/components/ai-colab/ai-colab-provider"

interface ClientArtifactLoaderProps {
  project?: string
  slug?: string
  initialSpec?: VisualArtifactSpec
}

export function ClientArtifactLoader({ project, slug, initialSpec }: ClientArtifactLoaderProps) {
  const params = useMemo<ArtifactRouteParams | null>(() => {
    if (project && slug) return { project, slug }
    if (typeof window === "undefined") return null
    return artifactParamsFromPath(window.location.pathname)
  }, [project, slug])
  const [spec, setSpec] = useState<VisualArtifactSpec | null>(initialSpec || null)
  const [error, setError] = useState<string | null>(null)
  const { setSpec: setAIColabSpec } = useAIColabContext()

  useEffect(() => {
    if (initialSpec) setAIColabSpec(initialSpec)
  }, [initialSpec, setAIColabSpec])

  useEffect(() => {
    if (!params) return

    // Always fetch latest from server so updates apply without rebuilding.
    // The URL is derived from the current deployment base path so it works
    // under Next.js dev, the static export server, and proxied mounts.
    const url = artifactDataUrl(params.project, params.slug)
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`Artifact not found (${res.status})`)
        return res.json()
      })
      .then(data => {
        const parsed = VisualArtifactSpecSchema.safeParse(data)
        if (!parsed.success) {
          throw new Error(`Invalid artifact: ${parsed.error.issues[0]?.message ?? "schema validation failed"}`)
        }
        setSpec(parsed.data)
        setAIColabSpec(parsed.data)
        setError(null)
      })
      .catch(err => {
        if (!initialSpec) {
          setError(err.message)
        } else {
          // In dev mode there is no handler for the artifact JSON endpoint,
          // so we keep using the statically embedded spec but warn loudly.
          console.warn(`[ClientArtifactLoader] Failed to refresh artifact from ${url}:`, err.message)
        }
      })
  }, [params, initialSpec, setAIColabSpec])

  if (!params && !spec) {
    // During SSR the shell doesn't know the URL yet; show a loading state so
    // the static export doesn't bake an error message into the HTML. On the
    // client, params are resolved from window.location and the fetch begins.
    return (
      <main className="mx-auto flex min-h-screen w-full items-center justify-center">
        <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          <span className="h-2 w-2 animate-ping rounded-full bg-clay"></span>
          Loading artifact...
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen w-full items-center justify-center">
        <p className="text-muted-foreground">Error: {error}</p>
      </main>
    )
  }

  if (!spec) {
    return (
      <main className="mx-auto flex min-h-screen w-full items-center justify-center">
        <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          <span className="h-2 w-2 animate-ping rounded-full bg-clay"></span>
          Loading artifact...
        </div>
      </main>
    )
  }

  return <VisualArtifactRenderer spec={spec} project={project ?? params!.project} slug={slug ?? params!.slug} />
}
