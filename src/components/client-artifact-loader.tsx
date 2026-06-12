"use client"

import { useEffect, useState } from "react"
import { VisualArtifactRenderer } from "@/components/visual-artifact-renderer"
import type { VisualArtifactSpec } from "@/lib/artifact-schema"

export function ClientArtifactLoader({ project, slug, initialSpec }: { project: string; slug: string; initialSpec?: VisualArtifactSpec }) {
  const [spec, setSpec] = useState<VisualArtifactSpec | null>(initialSpec || null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Always fetch latest from server so updates apply without rebuilding
    fetch(`/artifacts/data/artifacts/${project}/${slug}.json`)
      .then(res => {
        if (!res.ok) throw new Error("Artifact not found")
        return res.json()
      })
      .then(data => setSpec(data))
      .catch(err => {
        if (!initialSpec) {
          setError(err.message)
        }
      })
  }, [project, slug, initialSpec])

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
          <span className="h-2 w-2 animate-ping rounded-full bg-[var(--clay)]"></span>
          Loading artifact...
        </div>
      </main>
    )
  }

  return <VisualArtifactRenderer spec={spec} />
}
