import Link from "next/link"

import { listProjects } from "@/lib/artifacts"
import { projectPagePath } from "@/lib/paths"

const steps = ["JSON spec", "Zod validate", "Render page"]

export default async function Home() {
  const projects = await listProjects()

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-6 py-20 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
      <section className="space-y-8">
        <div className="space-y-4">
          <p className="flex items-center gap-3 font-mono text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground before:h-px before:w-7 before:bg-[var(--clay)]">
            Visualizer
          </p>
          <h1 className="max-w-3xl font-serif text-5xl font-medium leading-[1.02] tracking-[-0.035em] text-foreground sm:text-6xl">
            Data-driven visual artifacts.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            Drop validated JSON into <code className="rounded-md border bg-muted px-1.5 py-0.5 text-sm text-foreground">~/.pi/artifacts/</code>. One route turns it into a polished report, plan, dashboard, or explainer.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step} className="rounded-xl border bg-card/80 p-4 shadow-sm">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--clay)]">0{index + 1}</p>
              <p className="mt-2 text-sm font-medium text-card-foreground">{step}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-card/90 p-4 shadow-[0_24px_70px_rgba(20,20,19,0.10)] backdrop-blur dark:shadow-black/25">
        <div className="rounded-xl border bg-muted/60 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Projects</p>
            <span className="rounded-full border bg-card px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              local
            </span>
          </div>

          <div className="grid gap-3">
            {projects.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No projects found in ~/.pi/artifacts/</p>
            ) : (
              projects.map((project) => (
                <Link
                  key={project.name}
                  href={projectPagePath(project.name)}
                  className="group rounded-xl border bg-card p-5 text-card-foreground transition hover:-translate-y-0.5 hover:border-primary hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-serif text-2xl font-medium tracking-[-0.02em]">{project.name}</h2>
                      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                        {project.artifactCount} artifact{project.artifactCount === 1 ? "" : "s"} • Last updated {project.lastModifiedAt.toLocaleDateString()}
                      </p>
                    </div>
                    <span className="mt-1 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-[var(--clay)]">→</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
