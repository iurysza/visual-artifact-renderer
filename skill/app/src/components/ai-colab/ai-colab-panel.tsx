"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, Copy, MessageSquare, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CommentCard } from "@/components/annotations/comment-card"
import type { CommentListItem } from "@/components/annotations/comment-list-item"
import { scrollToNode } from "@/components/annotations"
import { useAIColabContext } from "@/components/ai-colab/ai-colab-provider"
import { DetailPanelHeader } from "@/components/panel-shell/detail-panel-header"
import { PanelShell } from "@/components/panel-shell/panel-shell"
import { shortcutLabel } from "@/components/panel-shell/shortcut-label"
import { useAnchorPresence } from "@/hooks/use-anchor-presence"
import { useMobileTextareaFocus } from "@/hooks/use-mobile-textarea-focus"
import type { AIColabComment } from "@/lib/ai-colab/types"

export function AIColabPanel() {
  const ctx = useAIColabContext()
  const open = ctx.isAIColabMode && !ctx.isPickingNode

  return (
    <PanelShell open={open} ariaLabel="AI Colab panel">
      <AIColabPanelHeader />
      <AIColabPanelContent />
    </PanelShell>
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

  useMobileTextareaFocus("ai-colab-node-textarea", [selectedNode])

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


