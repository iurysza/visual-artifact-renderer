"use client"

import Link from "next/link"
import type { ReactNode } from "react"

import type { ArtifactNode, VisualArtifactSpec } from "@/lib/artifact-schema"
import { componentRegistry, type ArtifactRenderContext } from "@/components/component-registry"
import { cn } from "@/lib/utils"

export function VisualArtifactRenderer({ spec }: { spec: VisualArtifactSpec }) {
  const context: ArtifactRenderContext = { data: spec.data }
  const datasetCount = Object.keys(spec.data ?? {}).length

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-6 py-12 sm:px-8">
      <header className="rounded-2xl border bg-card/90 p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground transition hover:text-[var(--clay)]"
          >
            ← Index
          </Link>
          <span className="rounded-full border bg-muted px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {datasetCount} dataset{datasetCount === 1 ? "" : "s"}
          </span>
        </div>

        <div className="space-y-3">
          <p className="flex items-center gap-3 font-mono text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground before:h-px before:w-7 before:bg-[var(--clay)]">
            Visual Artifact
          </p>
          <h1 className="max-w-4xl font-serif text-4xl font-medium leading-[1.08] tracking-[-0.03em] text-foreground sm:text-5xl">
            {spec.title}
          </h1>
          {spec.description && <p className="max-w-3xl text-lg leading-8 text-muted-foreground">{spec.description}</p>}
        </div>
      </header>

      <div className={cn("space-y-6", spec.layout?.type === "grid" && gridClass(spec.layout.columns ?? 2))}>
        {renderNodes(spec.nodes, context)}
      </div>
    </main>
  )
}

function RenderNode({ node, context }: { node: ArtifactNode; context: ArtifactRenderContext }) {
  const Component = componentRegistry[node.type]
  const children = "children" in node ? renderNodes(node.children, context) : undefined

  return <>{Component({ node, context, children, renderNodes })}</>
}

function renderNodes(nodes: ArtifactNode[] | undefined, context: ArtifactRenderContext): ReactNode {
  return nodes?.map((node, index) => <RenderNode key={`${node.type}-${index}`} node={node} context={context} />)
}

function gridClass(columns: 1 | 2 | 3 | 4) {
  if (columns === 1) return "grid grid-cols-1 gap-4 space-y-0"
  if (columns === 3) return "grid gap-4 space-y-0 md:grid-cols-3"
  if (columns === 4) return "grid gap-4 space-y-0 md:grid-cols-2 xl:grid-cols-4"

  return "grid gap-4 space-y-0 md:grid-cols-2"
}
