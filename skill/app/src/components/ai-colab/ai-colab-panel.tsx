"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, ArrowLeft, Check, Copy, MessageSquare, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CommentCard } from "@/components/annotations/comment-card"
import type { CommentListItem } from "@/components/annotations/comment-list-item"
import { scrollToNode } from "@/components/annotations"
import { useAIColabContext } from "@/components/ai-colab/ai-colab-provider"
import { useAnchorPresence } from "@/hooks/use-anchor-presence"
import { cn } from "@/lib/utils"
import type { AIColabComment } from "@/lib/ai-colab/types"

export function AIColabPanel() {
  const ctx = useAIColabContext()

  return (
    <aside
      className={cn(
        "va-panel fixed right-0 top-14 z-30 flex h-[calc(100vh-3.5rem)] w-full flex-col border-l bg-card/95 shadow-sm backdrop-blur-sm md:w-[var(--va-annotation-panel-width)]",
        ctx.isAIColabMode && !ctx.isPickingNode
          ? "va-panel-open visible translate-x-0 opacity-100"
          : "invisible translate-x-5 opacity-0 pointer-events-none",
      )}
      data-state={ctx.isAIColabMode && !ctx.isPickingNode ? "open" : "closed"}
      aria-hidden={!(ctx.isAIColabMode && !ctx.isPickingNode)}
      inert={!(ctx.isAIColabMode && !ctx.isPickingNode)}
      role={ctx.isAIColabMode && !ctx.isPickingNode ? "complementary" : undefined}
      aria-label="AI Colab panel"
    >
      <AIColabPanelHeader />
      <AIColabPanelContent />
    </aside>
  )
}

function AIColabPanelHeader() {
  const ctx = useAIColabContext()

  if (ctx.panelView === "node" && ctx.selectedNode) {
    return <NodePanelHeader />
  }

  return (
    <>
      {/* Desktop list header */}
      <div className="hidden items-center justify-between border-b px-4 py-3 md:flex">
        <div className="flex items-center gap-2">
          <h3 className="font-serif text-base font-medium tracking-tight">AI Colab</h3>
          {ctx.comments.length > 0 && <Badge variant="secondary">{ctx.comments.length}</Badge>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <CopyMarkdownButton />
          {ctx.copyError && (
            <span className="text-xs text-destructive">{ctx.copyError}</span>
          )}
        </div>
      </div>

      {/* Mobile list header */}
      <div className="flex items-center justify-between border-b px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <h3 className="font-serif text-base font-medium tracking-tight">AI Colab</h3>
          {ctx.comments.length > 0 && <Badge variant="secondary">{ctx.comments.length}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <CopyMarkdownButton />
          {ctx.copyError && (
            <span className="text-xs text-destructive">{ctx.copyError}</span>
          )}
        </div>
      </div>
    </>
  )
}

function NodePanelHeader() {
  const ctx = useAIColabContext()
  const selectedNode = ctx.selectedNode
  const isPresent = useAnchorPresence(
    selectedNode?.nodeId,
    selectedNode?.nodePath ?? "",
  )

  if (!selectedNode) return null

  const nodeCommentCount = ctx.comments.filter(
    (c) => c.target.kind === "node" && c.target.nodePath === selectedNode.nodePath,
  ).length
  const snippet = selectedNode.textSnippet || selectedNode.nodeType || "Selected component"
  const nodeType = selectedNode.nodeType || "node"

  const changeButton = (
    <button
      type="button"
      onClick={() => ctx.startNodePick()}
      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
    >
      Change component
    </button>
  )

  return (
    <DetailPanelHeader
      title="New note"
      count={nodeCommentCount}
      snippet={snippet}
      nodeType={nodeType}
      isPresent={isPresent}
      onBack={ctx.goToList}
      backLabel="Back to comments"
      desktopActions={changeButton}
      mobileActions={changeButton}
    />
  )
}

function DetailPanelHeader({
  title,
  count,
  snippet,
  nodeType,
  isPresent,
  onBack,
  backLabel = "Back",
  desktopActions,
  mobileActions,
}: {
  title: string
  count?: number
  snippet: string
  nodeType: string
  isPresent: boolean
  onBack: () => void
  backLabel?: string
  desktopActions?: React.ReactNode
  mobileActions?: React.ReactNode
}) {
  return (
    <>
      {/* Desktop header */}
      <div className="hidden flex-col gap-2 border-b px-4 py-3 md:flex">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <BackButton onClick={onBack} label={backLabel} />
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-base font-medium tracking-tight">{title}</h3>
              {typeof count === "number" && <Badge variant="secondary">{count}</Badge>}
            </div>
          </div>
          {desktopActions && (
            <div className="flex shrink-0 items-center gap-2">{desktopActions}</div>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{snippet}</span>
          <span>{nodeType}</span>
          {!isPresent && (
            <span
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
              title="Anchor not found"
            >
              <AlertTriangle className="size-3" />
            </span>
          )}
        </div>
      </div>

      {/* Mobile header */}
      <div className="flex items-center justify-between border-b px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <BackButton onClick={onBack} label="Back" />
          <h3 className="font-serif text-base font-medium tracking-tight">{title}</h3>
          {typeof count === "number" && <Badge variant="secondary">{count}</Badge>}
        </div>
        {mobileActions && <div className="flex items-center gap-2">{mobileActions}</div>}
      </div>
    </>
  )
}

function AIColabPanelContent() {
  const ctx = useAIColabContext()

  if (ctx.panelView === "node" && ctx.selectedNode) {
    return <NodeCommentComposer />
  }

  return <CommentList />
}

function CommentList() {
  const ctx = useAIColabContext()
  const artifactItems = useMemo(
    () =>
      ctx.comments
        .filter((c) => c.target.kind === "artifact")
        .map(aiColabCommentToListItem),
    [ctx.comments]
  )
  const nodeItems = useMemo(
    () =>
      ctx.comments
        .filter((c) => c.target.kind === "node")
        .map(aiColabCommentToListItem),
    [ctx.comments]
  )

  function handleClick(item: CommentListItem) {
    if (item.target.kind === "node") {
      scrollToNode(item.target.nodeId, item.target.nodePath ?? "")
    } else if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 p-4">
          <ArtifactComposer />

          <div className="flex items-center justify-between">
            <h4 className="font-serif text-sm font-medium tracking-tight">Comments</h4>
            <Button
              size="sm"
              variant="outline"
              onClick={() => ctx.startNodePick()}
              aria-label="Start selecting a component"
              className="md:hidden"
            >
              <Plus data-icon="inline-start" />
              New comment
            </Button>
          </div>

          {ctx.comments.length === 0 && (
            <div className="rounded-xl border border-dashed p-5 text-center">
              <MessageSquare className="mx-auto size-6 text-muted-foreground/60" />
              <p className="mt-2 text-sm text-muted-foreground">No AI Colab notes yet.</p>
              <p className="text-xs text-muted-foreground">
                Add an artifact note above or select a component to comment on it.
              </p>
            </div>
          )}

          {artifactItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Artifact</p>
              {artifactItems.map((item) => (
                <CommentCard
                  key={item.id}
                  item={item}
                  onClick={() => handleClick(item)}
                  onDelete={() => ctx.deleteComment(item.id)}
                  ariaLabelPrefix="Comment"
                />
              ))}
            </div>
          )}

          {nodeItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Components</p>
              {nodeItems.map((item) => (
                <CommentCard
                  key={item.id}
                  item={item}
                  onClick={() => handleClick(item)}
                  onDelete={() => ctx.deleteComment(item.id)}
                  ariaLabelPrefix="Comment"
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function aiColabCommentToListItem(comment: AIColabComment): CommentListItem {
  const target = comment.target
  return {
    id: comment.id,
    target: {
      kind: target.kind,
      nodeId: target.kind === "node" ? target.nodeId : undefined,
      nodePath: target.kind === "node" ? target.nodePath : undefined,
      nodeType: target.kind === "node" ? target.nodeType : undefined,
      label:
        target.kind === "node"
          ? (target.label ?? target.nodeType ?? "component")
          : "Artifact",
    },
    body: comment.body,
    createdAt: comment.createdAt,
  }
}

function ArtifactComposer() {
  const ctx = useAIColabContext()
  const [localDraft, setLocalDraft] = useState("")
  const [posted, setPosted] = useState(false)
  const postedTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (postedTimeoutRef.current) {
        window.clearTimeout(postedTimeoutRef.current)
      }
    }
  }, [])

  function handlePost() {
    if (!localDraft.trim()) return
    ctx.addArtifactComment(localDraft)
    setLocalDraft("")
    setPosted(true)
    if (postedTimeoutRef.current) window.clearTimeout(postedTimeoutRef.current)
    postedTimeoutRef.current = window.setTimeout(() => setPosted(false), 1500)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault()
      handlePost()
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-3">
      <p className="text-xs font-medium text-muted-foreground">Comment on this artifact</p>
      <Textarea
        value={localDraft}
        onChange={(e) => setLocalDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a note about the whole artifact…"
        className="min-h-20"
        aria-label="Artifact comment"
      />
      <div className="flex items-center justify-end gap-2">
        {posted && (
          <span className="flex items-center gap-1 text-xs text-clay" aria-live="polite">
            <Check className="size-3" />
            Posted
          </span>
        )}
        <span className="text-[10px] text-muted-foreground hidden md:inline">{shortcutLabel()} to post</span>
        <Button size="sm" disabled={!localDraft.trim()} onClick={handlePost}>
          Post
        </Button>
      </div>
    </div>
  )
}

function NodeCommentComposer() {
  const ctx = useAIColabContext()
  const selectedNode = ctx.selectedNode
  const [posted, setPosted] = useState(false)
  const postedTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (postedTimeoutRef.current) {
        window.clearTimeout(postedTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!selectedNode) return
    const isMobile =
      typeof window !== "undefined" &&
      (window.matchMedia("(pointer:coarse)").matches || window.innerWidth <= 768)
    if (!isMobile) return

    const id = window.setTimeout(() => {
      const el = document.getElementById("ai-colab-node-textarea") as HTMLTextAreaElement | null
      if (el) {
        try {
          el.focus()
        } catch {}
        try {
          el.scrollIntoView({ behavior: "smooth", block: "center" })
        } catch {}
      }
    }, 220)

    return () => clearTimeout(id)
  }, [selectedNode])

  if (!selectedNode) return null

  function handlePost() {
    if (!ctx.draftText.trim()) return
    ctx.addComment(ctx.draftText)
    setPosted(true)
    if (postedTimeoutRef.current) window.clearTimeout(postedTimeoutRef.current)
    postedTimeoutRef.current = window.setTimeout(() => setPosted(false), 1500)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault()
      handlePost()
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-2">
            <Textarea
              id="ai-colab-node-textarea"
              value={ctx.draftText}
              onChange={(e) => ctx.setDraftText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a note about this component…"
              className="min-h-20 md:min-h-28"
              aria-label="Component comment"
            />
            <div className="flex items-center justify-end gap-2">
              {posted && (
                <span className="flex items-center gap-1 text-xs text-clay" aria-live="polite">
                  <Check className="size-3" />
                  Posted
                </span>
              )}
              <span className="text-[10px] text-muted-foreground hidden md:inline">{shortcutLabel()} to post</span>
              <Button size="sm" disabled={!ctx.draftText.trim()} onClick={handlePost}>
                Post
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={label}
      title={label}
    >
      <ArrowLeft className="size-4" />
      <span className="sr-only">{label}</span>
    </button>
  )
}

function CopyMarkdownButton() {
  const ctx = useAIColabContext()
  const disabled = !ctx.spec || ctx.comments.length === 0

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={disabled}
      onClick={() => ctx.copyToClipboard()}
      aria-label={ctx.copied ? "Copied Markdown to clipboard" : "Copy Markdown to clipboard"}
      title={ctx.copied ? "Copied Markdown to clipboard" : "Copy Markdown to clipboard"}
    >
      {ctx.copied ? (
        <>
          <Check data-icon="inline-start" />
          Copied
        </>
      ) : (
        <>
          <Copy data-icon="inline-start" />
          Copy Markdown
        </>
      )}
    </Button>
  )
}

function shortcutLabel(): string {
  if (typeof navigator !== "undefined" && navigator.platform?.toLowerCase().includes("mac")) {
    return "⌘ + Enter"
  }
  return "Ctrl + Enter"
}
