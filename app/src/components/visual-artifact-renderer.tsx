"use client"

import { useRef } from "react"
import type { KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from "react"

import type { ArtifactNode, VisualArtifactSpec } from "@/lib/contract/artifact-schema"
import { componentRegistry } from "@/components/component-registry"
import type { ArtifactRenderContext, RenderNodes } from "@/components/artifact-types"
import { cn } from "@/lib/utils"
import { useAnnotationContext, AnnotationPanel, NodePickHUD, type NodeIdentity } from "@/components/annotations"
import { useAIColabContext } from "@/components/ai-colab/ai-colab-provider"
import { AIColabPanel } from "@/components/ai-colab/ai-colab-panel"
import { AIColabHUD } from "@/components/ai-colab/ai-colab-hud"

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
  const ctx = useAnnotationContext()
  const aiColabCtx = useAIColabContext()

  return (
    <main
      data-comments-open={ctx.isCommentMode ? "true" : undefined}
      data-ai-colab-open={aiColabCtx.isAIColabMode ? "true" : undefined}
      className={cn(
        "mx-auto w-full max-w-7xl space-y-10 px-5 py-10 sm:px-8 lg:py-14",
        "transition-[padding] duration-[var(--va-annotation-panel)] ease-[var(--va-annotation-ease)]",
        "data-[comments-open=true]:md:pr-[calc(var(--va-annotation-panel-width)+var(--va-annotation-panel-gap))]",
        "data-[ai-colab-open=true]:md:pr-[calc(var(--va-annotation-panel-width)+var(--va-annotation-panel-gap))]",
      )}
    >
      <header className="overflow-hidden rounded-[var(--radius-2xl)] border-[1.5px] bg-card/95 shadow-[var(--shadow-card)] p-5 sm:p-7 lg:p-9">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
            <span className="flex items-center gap-3 before:h-px before:w-7 before:bg-clay">
              Visual Artifact
            </span>
            {spec.createdAt && (
              <>
                <span aria-hidden="true" className="text-muted-foreground/40">·</span>
                <time dateTime={spec.createdAt}>{formatCreatedAt(spec.createdAt)}</time>
              </>
            )}
          </div>
          <h1 className="max-w-5xl break-words font-serif text-4xl font-medium leading-[1.03] tracking-[-0.04em] text-foreground sm:text-6xl">
            {spec.title}
          </h1>
          {spec.description && (
            <p className="max-w-3xl break-words text-lg leading-8 text-muted-foreground">{spec.description}</p>
          )}
        </div>
      </header>

      <div className={cn("space-y-9", spec.layout?.type === "grid" && gridClass(spec.layout.columns ?? 2))}>
        {renderNodes(spec.nodes, context)}
      </div>

      <AnnotationPanel />
      <NodePickHUD />
      <AIColabPanel />
      <AIColabHUD />
    </main>
  )
}

function formatCreatedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
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
  const aiColabCtx = useAIColabContext()
  const nodeId = node.metadata?.id
  const threadCount = ctx.getThreadCount(nodeId, nodePath)
  const isCommentActive = ctx.isCommentMode
  const isAIColabActive = aiColabCtx.isAIColabMode || aiColabCtx.isPickingNode
  const isPickingNode = ctx.isPickingNode || aiColabCtx.isPickingNode
  const isHovered =
    (ctx.hoveredNode?.nodeId === nodeId && ctx.hoveredNode?.nodePath === nodePath) ||
    (ctx.previewNode?.nodeId === nodeId && ctx.previewNode?.nodePath === nodePath) ||
    (aiColabCtx.hoveredNode?.nodeId === nodeId && aiColabCtx.hoveredNode?.nodePath === nodePath)
  const isCandidate =
    (ctx.pickCandidateNode?.nodeId === nodeId && ctx.pickCandidateNode?.nodePath === nodePath) ||
    (aiColabCtx.pickCandidateNode?.nodeId === nodeId && aiColabCtx.pickCandidateNode?.nodePath === nodePath)
  const isSelected =
    (ctx.selectedNode?.nodeId === nodeId && ctx.selectedNode?.nodePath === nodePath) ||
    (ctx.highlightedNode?.nodeId === nodeId && ctx.highlightedNode?.nodePath === nodePath) ||
    (aiColabCtx.selectedNode?.nodeId === nodeId && aiColabCtx.selectedNode?.nodePath === nodePath) ||
    isCandidate
  const hasThread = threadCount > 0

  const annotationState = isSelected ? "selected" : isHovered ? "hovered" : hasThread ? "has-thread" : "idle"
  const isClickable = isCommentActive || ctx.isPickingNode || isAIColabActive

  // Local suppression flag used to prevent nested interactive activation after
  // we selected a node during pointer/key capture. Pointer/key capture sets
  // this flag; onClickCapture consumes it and prevents activation.
  const clickSuppressedRef = useRef(false)

  // Track pointer type and coordinates for touch tap detection to avoid
  // accidental selection during scrolling.
  const lastPointerTypeRef = useRef<string | null>(null)
  const lastPointerDownCoordsRef = useRef<{ x: number; y: number } | null>(null)
  const lastTouchCandidateRef = useRef<NodeIdentity | null>(null)

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

  function selectFoundNode(found: NodeIdentity) {
    if (aiColabCtx.isAIColabMode || aiColabCtx.isPickingNode) {
      aiColabCtx.selectNode(found)
    } else {
      ctx.selectNodeForComment(found)
    }
  }

  function setPickCandidate(found: NodeIdentity) {
    if (aiColabCtx.isPickingNode) {
      aiColabCtx.setPickCandidateNode(found)
    } else {
      ctx.setPickCandidateNode(found)
    }
  }

  function handlePointerDownCapture(event: PointerEvent<HTMLDivElement>) {
    if (!isPickingNode) return

    const found = findClosestVaNodeFromEventTarget(event.target)

    lastPointerTypeRef.current = (event as unknown as { pointerType?: string }).pointerType ?? null
    lastPointerDownCoordsRef.current = { x: event.clientX, y: event.clientY }

    // For touch, do not preventDefault on pointerdown so scrolling works.
    // Instead remember the candidate and let click capture confirm the tap.
    if (event.pointerType === "touch") {
      lastTouchCandidateRef.current = found
      return
    }

    if (!found) return

    // mark click suppressed so the later click event (which may happen after
    // we toggle picking state) doesn't activate nested interactive elements.
    clickSuppressedRef.current = true

    event.preventDefault()
    event.stopPropagation()

    selectFoundNode(found)
  }

  function handleKeyDownCapture(event: KeyboardEvent<HTMLDivElement>) {
    if (!isPickingNode) return
    if (event.key !== "Enter" && event.key !== " ") return

    const found = findClosestVaNodeFromEventTarget(event.target)
    if (!found) return

    // keyboard selection can synthesize a click; suppress it similarly.
    clickSuppressedRef.current = true

    event.preventDefault()
    event.stopPropagation()

    selectFoundNode(found)
  }

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    // Only intervene for explicit pick mode or when a prior capture set the
    // suppression flag. Otherwise, let nested interactive elements handle clicks.
    if (!ctx.isPickingNode && !aiColabCtx.isPickingNode && !clickSuppressedRef.current) return

    // If a prior capture already processed selection (pointer/key), consume
    // the suppression flag and fully stop the click so nested controls don't
    // activate. This also prevents duplicate selection since the capture phase
    // has already selected.
    if (clickSuppressedRef.current) {
      event.preventDefault()
      event.stopPropagation()
      clickSuppressedRef.current = false
      return
    }

    // If we're in pick mode but no prior capture handled it, select the
    // deepest VA node now in capture and suppress nested activation. This
    // handles click-only (mouse/assistive) activation which otherwise would
    // be prevented by the original preventDefault and lost in bubble phase.
    if (ctx.isPickingNode || aiColabCtx.isPickingNode) {
      const pointerType = lastPointerTypeRef.current

      // If the last pointer was touch, treat this click as a touch tap. Only
      // confirm selection if movement since pointerdown is small (i.e., a tap).
      if (pointerType === "touch") {
        const down = lastPointerDownCoordsRef.current
        const dx = down ? Math.abs((event as unknown as MouseEvent).clientX - down.x) : 0
        const dy = down ? Math.abs((event as unknown as MouseEvent).clientY - down.y) : 0
        const moved = Math.hypot(dx, dy) > 10

        // clear transient touch trackers
        lastPointerTypeRef.current = null
        lastPointerDownCoordsRef.current = null

        if (moved) {
          // likely a scroll; don't select. Swallow this click so nested
          // interactive elements don't activate after a moved touch.
          lastTouchCandidateRef.current = null
          event.preventDefault()
          event.stopPropagation()
          return
        }

        const found = findClosestVaNodeFromEventTarget(event.target) ?? lastTouchCandidateRef.current
        lastTouchCandidateRef.current = null

        if (found) {
          // for touch, set pick candidate instead of opening composer
          // don't set clickSuppressedRef here: we already prevented default and
          // stopped propagation for the current event, and persisting the
          // suppression causes the next tap to be swallowed.
          event.preventDefault()
          event.stopPropagation()
          setPickCandidate(found)
          return
        }

        // No VA node found; still prevent native activation to avoid unexpected navigation.
        event.preventDefault()
        return
      }

      const found = findClosestVaNodeFromEventTarget(event.target)
      if (found) {
        event.preventDefault()
        event.stopPropagation()
        selectFoundNode(found)
        return
      }

      // No VA node found; still prevent native activation to avoid unexpected navigation.
      event.preventDefault()
      return
    }
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!isClickable) return
    // If a capture handler already handled the event, don't run selection again.
    if ((event as unknown as { defaultPrevented?: boolean }).defaultPrevented) return

    const target = event.target as Element
    // In pick mode selection should win; otherwise preserve nested interactive guard.
    if (!ctx.isPickingNode && !aiColabCtx.isPickingNode && isInsideInteractive(target)) return

    const found = findClosestVaNodeFromEventTarget(event.target)
    if (!found) return

    event.preventDefault()
    event.stopPropagation()

    selectFoundNode(found)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!isClickable) return
    if (event.key !== "Enter" && event.key !== " ") return
    if ((event as unknown as { defaultPrevented?: boolean }).defaultPrevented) return

    const target = event.target as Element
    if (!ctx.isPickingNode && !aiColabCtx.isPickingNode && isInsideInteractive(target)) return

    const found = findClosestVaNodeFromEventTarget(event.target)
    if (!found) return

    event.preventDefault()

    selectFoundNode(found)
  }

  function handleMouseEnter() {
    if (!isClickable) return
    ctx.setHoveredNode({ nodeId, nodePath })
    aiColabCtx.setHoveredNode({ nodeId, nodePath })
  }

  function handleMouseLeave() {
    if (!isClickable) return
    ctx.setHoveredNode(null)
    aiColabCtx.setHoveredNode(null)
  }

  const ariaLabel = isPickingNode
    ? `Pick ${node.type} component`
    : isCommentActive
    ? `Comment on ${node.type} node`
    : aiColabCtx.isAIColabMode
    ? `Comment on ${node.type} for AI Colab`
    : undefined

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
      onClickCapture={handleClickCapture}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      onPointerDownCapture={handlePointerDownCapture}
      onKeyDownCapture={handleKeyDownCapture}
      tabIndex={isPickingNode ? 0 : undefined}
      role={isPickingNode ? "button" : undefined}
      aria-label={ariaLabel}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[var(--radius-2xl)] transition-all",
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
