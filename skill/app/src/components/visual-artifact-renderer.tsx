"use client"

import type { KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from "react"

import type { ArtifactNode, VisualArtifactSpec } from "@/lib/contract/artifact-schema"
import { componentRegistry } from "@/components/component-registry"
import type { ArtifactRenderContext, RenderNodes } from "@/components/artifact-types"
import { cn } from "@/lib/utils"
import { useAnnotationContext } from "@/components/annotation-provider"
import { AnnotationPanel } from "@/components/annotation-panel"
import { NodePickHUD } from "@/components/node-pick-hud"

export function VisualArtifactRenderer({
  spec,
  project,
  slug,
}: {
  spec: VisualArtifactSpec
  project: string
  slug: string
}) {
  return <VisualArtifactRendererContent spec={spec} project={project} slug={slug} />
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
  const ctx = useAnnotationContext()

  return (
    <main
      data-comments-open={ctx.isCommentMode ? "true" : undefined}
      className={cn(
        "mx-auto w-full max-w-7xl space-y-10 px-5 py-10 sm:px-8 lg:py-14",
        "transition-[padding] duration-[var(--va-annotation-panel)] ease-[var(--va-annotation-ease)]",
        "data-[comments-open=true]:md:pr-[var(--va-annotation-panel-width)]",
      )}
    >
      <header className="overflow-hidden rounded-[var(--radius-2xl)] border-[1.5px] bg-card/95 shadow-[var(--shadow-card)]">
        <div className="border-b bg-muted/45 px-5 py-3 sm:px-7">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <HeroPill>
              {datasetCount} dataset{datasetCount === 1 ? "" : "s"}
            </HeroPill>
            <HeroPill>{nodeCount} nodes</HeroPill>
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
      <NodePickHUD />
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
  const isCommentActive = ctx.isCommentMode
  const isHovered =
    (ctx.hoveredNode?.nodeId === nodeId && ctx.hoveredNode?.nodePath === nodePath) ||
    (ctx.previewNode?.nodeId === nodeId && ctx.previewNode?.nodePath === nodePath)
  const isSelected =
    (ctx.selectedNode?.nodeId === nodeId && ctx.selectedNode?.nodePath === nodePath) ||
    (ctx.highlightedNode?.nodeId === nodeId && ctx.highlightedNode?.nodePath === nodePath)
  const hasThread = threadCount > 0

  const annotationState = isSelected ? "selected" : isHovered ? "hovered" : hasThread ? "has-thread" : "idle"
  const isClickable = isCommentActive || ctx.isPickingNode

  // Capture pointer events and key events during explicit pick mode so nested
  // interactive descendants don't steal activation. For ordinary comment mode
  // we preserve the nested interactive guard.
  function findClosestVaNodeFromEventTarget(target: EventTarget | null) {
    const el = target as Element | null
    if (!el) return null
    const anchor = el.closest('[data-va-node-path]') as Element | null
    if (!anchor) return null

    const foundNodeId = anchor.getAttribute("data-va-node-id") ?? undefined
    const foundNodePath = anchor.getAttribute("data-va-node-path") ?? undefined
    const foundNodeType = anchor.getAttribute("data-va-node-type") ?? undefined
    const foundNodeLabel = anchor.getAttribute("data-va-node-label") ?? undefined

    if (!foundNodePath) return null

    return {
      nodeId: foundNodeId,
      nodePath: foundNodePath,
      nodeType: foundNodeType,
      textSnippet: foundNodeLabel,
    }
  }

  function handlePointerDownCapture(event: PointerEvent<HTMLDivElement>) {
    if (!ctx.isPickingNode) return

    const found = findClosestVaNodeFromEventTarget(event.target)
    if (!found) return

    event.preventDefault()
    event.stopPropagation()

    ctx.selectNodeForComment(found)
  }

  function handleKeyDownCapture(event: KeyboardEvent<HTMLDivElement>) {
    if (!ctx.isPickingNode) return
    if (event.key !== "Enter" && event.key !== " ") return

    const found = findClosestVaNodeFromEventTarget(event.target)
    if (!found) return

    event.preventDefault()
    event.stopPropagation()

    ctx.selectNodeForComment(found)
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!isClickable) return
    // If a capture handler already handled the event, don't run selection again.
    if ((event as unknown as { defaultPrevented?: boolean }).defaultPrevented) return

    const target = event.target as Element
    // In pick mode selection should win; otherwise preserve nested interactive guard.
    if (!ctx.isPickingNode && isInsideInteractive(target)) return

    const found = findClosestVaNodeFromEventTarget(event.target)
    if (!found) return

    event.preventDefault()
    event.stopPropagation()

    ctx.selectNodeForComment(found)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!isClickable) return
    if (event.key !== "Enter" && event.key !== " ") return
    if ((event as unknown as { defaultPrevented?: boolean }).defaultPrevented) return

    const target = event.target as Element
    if (!ctx.isPickingNode && isInsideInteractive(target)) return

    const found = findClosestVaNodeFromEventTarget(event.target)
    if (!found) return

    event.preventDefault()

    ctx.selectNodeForComment(found)
  }

  function handleMouseEnter() {
    if (!isClickable) return
    ctx.setHoveredNode({ nodeId, nodePath })
  }

  function handleMouseLeave() {
    if (!isClickable) return
    ctx.setHoveredNode(null)
  }

  return (
    <div
      className={cn(
        "relative transition-shadow",
        isClickable && "cursor-pointer",
      )}
      data-va-node-id={nodeId}
      data-va-node-path={nodePath}
      data-va-node-type={node.type}
      data-va-node-label={nodeLabel(node)}
      data-annotation-state={annotationState}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      onPointerDownCapture={handlePointerDownCapture}
      onKeyDownCapture={handleKeyDownCapture}
      tabIndex={ctx.isPickingNode ? 0 : undefined}
      role={ctx.isPickingNode ? "button" : undefined}
      aria-label={
        ctx.isPickingNode ? `Pick ${node.type} component` : isCommentActive ? `Comment on ${node.type} node` : undefined
      }
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[var(--radius-xl)] transition-all",
          "duration-[var(--va-annotation-fast)] ease-[var(--va-annotation-ease-standard)]",
          annotationState === "idle" && "opacity-0",
          annotationState === "hovered" && "opacity-100 ring-2 ring-clay/60 bg-clay/[0.06] shadow-sm",
          annotationState === "selected" && "opacity-100 ring-2 ring-clay bg-clay/[0.08] shadow-md",
          annotationState === "has-thread" && "opacity-100 ring-1 ring-clay/30 bg-clay/[0.03]",
        )}
      />
      {children}
      {isCommentActive && hasThread && (
        <span className="va-badge-pop absolute right-2 top-2 z-10 flex size-5 items-center justify-center rounded-full bg-clay text-[10px] font-medium text-foreground shadow-sm">
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

function isInteractiveElement(element: Element | null): boolean {
  if (!element) return false
  const interactiveTags = ["A", "BUTTON", "INPUT", "TEXTAREA", "SELECT", "DETAILS", "SUMMARY"]
  if (interactiveTags.includes(element.tagName)) return true
  const role = element.getAttribute("role")
  if (role === "button" || role === "link" || role === "tab" || role === "menuitem") return true
  if (element.hasAttribute("tabindex") && element.getAttribute("tabindex") !== "-1") return true
  return false
}

function isInsideInteractive(target: Element): boolean {
  let current: Element | null = target
  while (current) {
    if (isInteractiveElement(current)) return true
    current = current.parentElement
  }
  return false
}
