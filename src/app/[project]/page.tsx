import Link from "next/link"
import { notFound } from "next/navigation"

import { listArtifactsInProject } from "@/lib/artifacts"

import { listProjects } from "@/lib/artifacts"

export async function generateStaticParams() {
  const projects = await listProjects()
  return projects.map((p) => ({ project: p.name }))
}

export default async function ProjectArtifactsPage({
  params,
}: {
  params: Promise<{ project: string }>
}) {
  const { project } = await params
  const artifacts = await listArtifactsInProject(project)

  if (artifacts.length === 0) {
    notFound()
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-20 sm:px-8">
      <div className="mb-10 space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-mono text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground transition">
            ← Visualizer
          </Link>
          <span className="font-mono text-xs text-muted-foreground">/</span>
          <span className="font-mono text-xs font-medium uppercase tracking-[0.22em] text-foreground">
            {project}
          </span>
        </div>
        <h1 className="font-serif text-4xl font-medium tracking-[-0.02em] text-foreground">
          Artifacts
        </h1>
      </div>

      <div className="grid gap-4">
        {artifacts.map((artifact) => (
          <Link
            key={artifact.slug}
            href={`/${project}/${artifact.slug}`}
            className="group rounded-xl border bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-serif text-2xl font-medium tracking-[-0.02em]">{artifact.title}</h2>
                {artifact.description && (
                  <p className="mt-2 text-sm text-muted-foreground">{artifact.description}</p>
                )}
                <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground/70">
                  {artifact.modifiedAt.toLocaleDateString()} {artifact.modifiedAt.toLocaleTimeString()}
                </p>
              </div>
              <span className="mt-1 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-[var(--clay)]">→</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
