"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Check, Copy, MessageSquare, Plus, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAIColabContext } from "@/components/ai-colab/ai-colab-provider"
import { useAnchorPresence } from "@/hooks/use-anchor-presence"
import { cn } from "@/lib/utils"
import type { AIColabComment } from "@/lib/ai-colab/types"

function formatTime(dateInput: string): string {
  const date = new Date(dateInput)
  if (isNaN(date.getTime())) return dateInput
  return date.toLocaleString()
}

export function AIColabPanel() {
  const ctx = useAIColabContext()
  const desktopCloseRef = useRef<HTMLButtonElement>(null)
  const mobileCloseRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!ctx.isAIColabMode || ctx.isPickingNode) return
    const isDesktop =
      typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches
    if (isDesktop) {
      desktopCloseRef.current?.focus()
    } else {
      mobileCloseRef.current?.focus()
    }
  }, [ctx.isAIColabMode, ctx.isPickingNode])

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
      <AIColabPanelHeader desktopCloseRef={desktopCloseRef} mobileCloseRef={mobileCloseRef} />
      <AIColabPanelContent />
    </aside>
  )
}

function AIColabPanelHeader({
  desktopCloseRef,
  mobileCloseRef,
}: {
  desktopCloseRef: React.RefObject<HTMLButtonElement | null>
  mobileCloseRef: React.RefObject<HTMLButtonElement | null>
}) {
  const ctx = useAIColabContext()
  const isNodeView = ctx.panelView === "node" && ctx.selectedNode
  const title = isNodeView ? "Comment on selection" : "AI Colab"

  return (
    <>
      {/* Desktop header */}
      <div className="hidden items-center justify-between border-b px-4 py-3 md:flex">
        <div className="flex items-center gap-3">
          {isNodeView && (
            <button
              type="button"
              onClick={() => ctx.goToList()}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Back"
            >
              ←
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-base font-medium tracking-tight">{title}</h3>
              {ctx.comments.length > 0 && <Badge variant="secondary">{ctx.comments.length}</Badge>}
            </div>
            {isNodeView && (
              <div className="text-xs text-muted-foreground mt-0.5">
                <span className="font-medium text-foreground">
                  {ctx.selectedNode?.textSnippet ?? "Selected component"}
                </span>
                <span className="ml-2">{ctx.selectedNode?.nodeType ?? "node"}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isNodeView && (
            <button
              type="button"
              onClick={() => ctx.startNodePick()}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Change component
            </button>
          )}
          <CopyMarkdownButton />
          {ctx.copyError && (
            <span className="text-xs text-destructive">{ctx.copyError}</span>
          )}
          <Button
            ref={desktopCloseRef}
            variant="ghost"
            size="icon-xs"
            onClick={ctx.closeAIColab}
            aria-label="Close AI Colab panel"
            title="Close AI Colab panel"
          >
            <X data-icon="only" />
            <span className="sr-only">Close AI Colab panel</span>
          </Button>
        </div>
      </div>

      {/* Mobile header */}
      <div className="flex items-center justify-between border-b px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          {isNodeView && (
            <button
              type="button"
              onClick={() => ctx.goToList()}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Back"
            >
              ←
            </button>
          )}
          <h3 className="font-serif text-base font-medium tracking-tight">{title}</h3>
          {ctx.comments.length > 0 && <Badge variant="secondary">{ctx.comments.length}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <CopyMarkdownButton />
          {ctx.copyError && (
            <span className="text-xs text-destructive">{ctx.copyError}</span>
          )}
          <Button
            ref={mobileCloseRef}
            variant="ghost"
            size="icon-xs"
            onClick={ctx.closeAIColab}
            aria-label="Close AI Colab panel"
          >
            <X data-icon="only" />
            <span className="sr-only">Close AI Colab panel</span>
          </Button>
        </div>
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
  const artifactComments = useMemo(
    () => ctx.comments.filter((c) => c.target.kind === "artifact"),
    [ctx.comments]
  )
  const nodeComments = useMemo(
    () => ctx.comments.filter((c) => c.target.kind === "node"),
    [ctx.comments]
  )

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

          {artifactComments.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Artifact</p>
              {artifactComments.map((comment) => (
                <CommentCard key={comment.id} comment={comment} />
              ))}
            </div>
          )}

          {nodeComments.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Components</p>
              {nodeComments.map((comment) => (
                <CommentCard key={comment.id} comment={comment} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function CommentCard({ comment }: { comment: AIColabComment }) {
  const ctx = useAIColabContext()
  const target = comment.target
  const isNode = target.kind === "node"
  const isPresent = useAnchorPresence(isNode ? target.nodeId : undefined, isNode ? target.nodePath : "")
  const label = isNode
    ? target.label ?? target.nodeType ?? "component"
    : "Artifact"

  return (
    <div
      className="group flex flex-col gap-2 rounded-xl border p-3 transition-all hover:border-muted-foreground/20 hover:bg-muted/50"
      aria-label={`Comment on ${label}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="line-clamp-1 text-xs font-medium text-foreground">{label}</span>
          {!isPresent && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground" title="Component not found">
              <AlertTriangle className="size-3" />
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => ctx.deleteComment(comment.id)}
          className="text-muted-foreground transition-colors hover:text-destructive"
          aria-label="Delete comment"
          title="Delete comment"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      <p className="whitespace-pre-wrap text-sm text-foreground">{comment.body}</p>
      <p className="text-[10px] text-muted-foreground">{comment.createdAt ? formatTime(comment.createdAt) : ""}</p>
    </div>
  )
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
          <div className="flex items-center justify-between gap-2 rounded-lg border p-2 md:hidden">
            <div className="min-w-0">
              <p className="line-clamp-1 text-sm font-medium text-foreground">
                {selectedNode.textSnippet ?? "Selected component"}
              </p>
              <p className="text-xs text-muted-foreground">{selectedNode.nodeType ?? "node"}</p>
            </div>
            <button
              type="button"
              onClick={() => ctx.startNodePick()}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Change
            </button>
          </div>

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
