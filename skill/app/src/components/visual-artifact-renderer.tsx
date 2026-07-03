"use client"

import type { KeyboardEvent, MouseEvent, ReactNode } from "react"

import type { ArtifactNode, VisualArtifactSpec } from "@/lib/contract/artifact-schema"
import { componentRegistry } from "@/components/component-registry"
import type { ArtifactRenderContext, RenderNodes } from "@/components/artifact-types"
import { cn } from "@/lib/utils"
import { AnnotationProvider, useAnnotationContext } from "@/components/annotation-provider"
import { AnnotationToggle } from "@/components/annotation-toggle"
import { AnnotationPanel } from "@/components/annotation-panel"

export function VisualArtifactRenderer({
  spec,
  project,
  slug,
}: {
  spec: VisualArtifactSpec
  project: string
  slug: string
}) {
  return (
    <AnnotationProvider project={project} slug={slug}>
      <VisualArtifactRendererContent spec={spec} project={project} slug={slug} />
    </AnnotationProvider>
  )
}

function VisualArtifactRendererContent({
  spec,
  project,
  slug,
}: {
  spec: VisualArtifactSpec
  project: string
  slug: string
}) {
  const context: ArtifactRenderContext = { project, slug, data: spec.data }
  const datasetCount = Object.keys(spec.data ?? {}).length
  const nodeCount = countNodes(spec.nodes)
  const componentCount = collectNodeTypes(spec.nodes).size

  return (
    <main className="mx-auto w-full max-w-7xl space-y-10 px-5 py-10 sm:px-8 lg:py-14">
      <header className="overflow-hidden rounded-[var(--radius-2xl)] border-[1.5px] bg-card/95 shadow-[var(--shadow-card)]">
        <div className="border-b bg-muted/45 px-5 py-3 sm:px-7">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <HeroPill>
              {datasetCount} dataset{datasetCount === 1 ? "" : "s"}
            </HeroPill>
            <HeroPill>{nodeCount} nodes</HeroPill>
            <AnnotationToggle />
          </div>
        </div>

        <div className="grid gap-7 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_270px] lg:p-9">
          <div className="space-y-4">
            <p className="flex items-center gap-3 font-mono text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground before:h-px before:w-7 before:bg-clay">
              Visual Artifact
            </p>
            <h1 className="max-w-5xl break-words font-serif text-4xl font-medium leading-[1.03] tracking-[-0.04em] text-foreground sm:text-6xl">
              {spec.title}
            </h1>
            {spec.description && (
              <p className="max-w-3xl break-words text-lg leading-8 text-muted-foreground">{spec.description}</p>
            )}
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

      <AnnotationPanel />
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

function NodeBoundary({
  node,
  nodePath,
  children,
}: {
  node: ArtifactNode
  nodePath: string
  children: ReactNode
}) {
  const ctx = useAnnotationContext()
  const nodeId = node.metadata?.id
  const threadCount = ctx.getThreadCount(nodeId, nodePath)
  const isHovered = ctx.hoveredNode?.nodeId === nodeId && ctx.hoveredNode?.nodePath === nodePath
  const isSelected = ctx.selectedNode?.nodeId === nodeId && ctx.selectedNode?.nodePath === nodePath

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!ctx.isCommentMode) return
    event.preventDefault()
    event.stopPropagation()

    const nodeThreads = ctx.getThreadsForNode(nodeId, nodePath)
    if (nodeThreads.length > 0) {
      ctx.selectThread(nodeThreads[0]!.id)
    } else {
      ctx.setSelectedNode({ nodeId, nodePath, nodeType: node.type, textSnippet: nodeLabel(node) })
      ctx.setActiveThreadId(null)
      ctx.setDraftText("")
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!ctx.isCommentMode) return
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    ctx.setSelectedNode({ nodeId, nodePath })
  }

  function handleMouseEnter() {
    if (!ctx.isCommentMode) return
    ctx.setHoveredNode({ nodeId, nodePath })
  }

  function handleMouseLeave() {
    if (!ctx.isCommentMode) return
    ctx.setHoveredNode(null)
  }

  return (
    <div
      className={cn(
        "relative transition-shadow",
        ctx.isCommentMode && "cursor-pointer",
        ctx.isCommentMode && isHovered && !isSelected && "ring-2 ring-clay/50",
        isSelected && "ring-2 ring-clay"
      )}
      data-va-node-id={nodeId}
      data-va-node-path={nodePath}
      data-va-node-type={node.type}
      data-va-node-label={nodeLabel(node)}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      role={ctx.isCommentMode ? "button" : undefined}
      aria-label={ctx.isCommentMode ? `Select ${node.type} node` : undefined}
      aria-pressed={ctx.isCommentMode ? isSelected : undefined}
      tabIndex={ctx.isCommentMode ? 0 : undefined}
    >
      {children}
      {ctx.isCommentMode && threadCount > 0 && (
        <span className="absolute -right-1 -top-1 z-10 flex size-5 items-center justify-center rounded-full bg-clay text-[10px] font-medium text-white shadow-sm">
          {threadCount}
        </span>
      )}
    </div>
  )
}

function RenderNode({
  node,
  context,
  nodePath,
  renderNodes,
}: {
  node: ArtifactNode
  context: ArtifactRenderContext
  nodePath: string
  renderNodes: RenderNodes
}) {
  const Component = componentRegistry[node.type]
  const children =
    "children" in node && node.children ? renderNodes(node.children, context, `${nodePath}.children`) : undefined

  return <>{Component({ node, context, children, renderNodes, nodePath })}</>
}

function renderNodes(nodes: ArtifactNode[] | undefined, context: ArtifactRenderContext, prefix = "nodes"): ReactNode {
  return nodes?.map((node, index) => {
    const nodePath = `${prefix}.${index}`
    return (
      <NodeBoundary key={nodePath} node={node} nodePath={nodePath}>
        <RenderNode node={node} context={context} nodePath={nodePath} renderNodes={renderNodes} />
      </NodeBoundary>
    )
  })
}

function nodeLabel(node: ArtifactNode): string | undefined {
  const props = node.props as Record<string, unknown> | undefined
  if (!props) return undefined

  const raw = props.title ?? props.text ?? props.label ?? props.content
  if (typeof raw === "string" && raw.length > 0) {
    return raw.slice(0, 80)
  }

  return undefined
}

function countNodes(nodes: ArtifactNode[] | undefined): number {
  return (
    nodes?.reduce((total, node) => {
      if ("children" in node && node.children) return total + 1 + countNodes(node.children)
      if (node.type === "tabs")
        return total + 1 + node.props.items.reduce((sum, item) => sum + countNodes(item.nodes), 0)
      if (node.type === "accordion")
        return total + 1 + node.props.items.reduce((sum, item) => sum + countNodes(item.nodes), 0)

      return total + 1
    }, 0) ?? 0
  )
}

function collectNodeTypes(nodes: ArtifactNode[] | undefined, types = new Set<ArtifactNode["type"]>()) {
  nodes?.forEach((node) => {
    types.add(node.type)

    if ("children" in node && node.children) collectNodeTypes(node.children, types)
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
