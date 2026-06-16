"use client"

import type { ReactNode } from "react"

import type { ArtifactNode, VisualArtifactSpec } from "@/lib/artifact-schema"
import { componentRegistry, type ArtifactRenderContext } from "@/components/component-registry"
import { cn } from "@/lib/utils"

export function VisualArtifactRenderer({ spec }: { spec: VisualArtifactSpec }) {
  const context: ArtifactRenderContext = { data: spec.data }
  const datasetCount = Object.keys(spec.data ?? {}).length
  const nodeCount = countNodes(spec.nodes)
  const componentCount = collectNodeTypes(spec.nodes).size

  return (
    <main className="mx-auto w-full max-w-7xl space-y-10 px-5 py-10 sm:px-8 lg:py-14">
      <header className="overflow-hidden rounded-[1.35rem] border-[1.5px] bg-card/95 shadow-[0_18px_60px_rgba(20,20,19,0.08)] dark:shadow-black/25">
        <div className="border-b bg-muted/45 px-5 py-3 sm:px-7">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <HeroPill>{datasetCount} dataset{datasetCount === 1 ? "" : "s"}</HeroPill>
            <HeroPill>{nodeCount} nodes</HeroPill>
          </div>
        </div>

        <div className="grid gap-7 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_270px] lg:p-9">
          <div className="space-y-4">
            <p className="flex items-center gap-3 font-mono text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground before:h-px before:w-7 before:bg-[var(--clay)]">
              Visual Artifact
            </p>
            <h1 className="max-w-5xl font-serif text-4xl font-medium leading-[1.03] tracking-[-0.04em] text-foreground sm:text-6xl">
              {spec.title}
            </h1>
            {spec.description && <p className="max-w-3xl text-lg leading-8 text-muted-foreground">{spec.description}</p>}
          </div>

          <aside className="rounded-2xl border bg-background/45 p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Spec profile</p>
            <dl className="mt-4 grid grid-cols-3 gap-3 lg:grid-cols-1">
              <HeroStat label="Data" value={datasetCount} />
              <HeroStat label="Nodes" value={nodeCount} />
              <HeroStat label="Components" value={componentCount} />
            </dl>
          </aside>
        </div>
      </header>

      <div className={cn("space-y-9", spec.layout?.type === "grid" && gridClass(spec.layout.columns ?? 2))}>
        {renderNodes(spec.nodes, context)}
      </div>
    </main>
  )
}

function HeroPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border bg-card px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </span>
  )
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-serif text-3xl font-medium tracking-[-0.04em] text-foreground">{value}</dd>
    </div>
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

function countNodes(nodes: ArtifactNode[] | undefined): number {
  return nodes?.reduce((total, node) => {
    if ("children" in node) return total + 1 + countNodes(node.children)
    if (node.type === "tabs") return total + 1 + node.props.items.reduce((sum, item) => sum + countNodes(item.nodes), 0)
    if (node.type === "accordion") return total + 1 + node.props.items.reduce((sum, item) => sum + countNodes(item.nodes), 0)

    return total + 1
  }, 0) ?? 0
}

function collectNodeTypes(nodes: ArtifactNode[] | undefined, types = new Set<ArtifactNode["type"]>()) {
  nodes?.forEach((node) => {
    types.add(node.type)

    if ("children" in node) collectNodeTypes(node.children, types)
    if (node.type === "tabs") node.props.items.forEach((item) => collectNodeTypes(item.nodes, types))
    if (node.type === "accordion") node.props.items.forEach((item) => collectNodeTypes(item.nodes, types))
  })

  return types
}

function gridClass(columns: 1 | 2 | 3 | 4) {
  if (columns === 1) return "grid grid-cols-1 gap-4 space-y-0"
  if (columns === 3) return "grid gap-4 space-y-0 md:grid-cols-3"
  if (columns === 4) return "grid gap-4 space-y-0 md:grid-cols-2 xl:grid-cols-4"

  return "grid gap-4 space-y-0 md:grid-cols-2"
}
