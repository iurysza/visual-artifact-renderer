"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { format, formatDistanceToNowStrict, isValid } from "date-fns"
import { AlertTriangle, CheckCircle2, Circle, Crosshair, MessageSquare, RefreshCcw, Send, X } from "lucide-react"
import { LOCAL_ANONYMOUS_AUTHOR } from "@agents/visual-artifact-annotations"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAnnotationContext, type PanelView } from "@/components/annotation-provider"
import { useAnchorPresence } from "@/hooks/use-anchor-presence"
import { threadNodeIdentity } from "@/components/annotation-helpers"
import type { AnnotationThread, AnnotationMessage, AnnotationAuthor } from "@/lib/artifacts/annotations"
import { cn } from "@/lib/utils"

function formatAnnotationTime(dateInput: string): string {
  const date = new Date(dateInput)
  if (!isValid(date)) return dateInput
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  if (diffMs < 0) return format(date, "MMM d, yyyy")
  if (diffMs < 60_000) return "just now"
  const days = diffMs / (1000 * 60 * 60 * 24)
  if (days < 7) return formatDistanceToNowStrict(date, { addSuffix: true })
  return format(date, "MMM d, yyyy")
}

function formatSaveError(error: string | null): string {
  if (!error) return "Something went wrong."
  try {
    const parsed = JSON.parse(error)
    const raw = typeof parsed.error === "string" ? parsed.error : typeof parsed.message === "string" ? parsed.message : error
    if (raw.includes("author.email") || raw.toLowerCase().includes("invalid email")) {
      return "We couldn't save your comment. Check your Git author email and try again."
    }
    if (raw.includes("author.name") || raw.toLowerCase().includes("invalid name")) {
      return "We couldn't save your comment. Check your Git author name and try again."
    }
    return "We couldn't save your comment. Please try again."
  } catch {
    return "We couldn't save your comment. Please try again."
  }
}

export function AnnotationPanel() {
  const ctx = useAnnotationContext()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!ctx.isCommentMode) return
    closeButtonRef.current?.focus()
  }, [ctx.isCommentMode])

  return (
    <aside
      ref={panelRef}
      className={cn(
        "va-panel fixed right-0 top-14 z-30 flex h-[calc(100vh-3.5rem)] w-full flex-col border-l bg-card/95 shadow-sm backdrop-blur-sm md:w-[var(--va-annotation-panel-width)]",
        ctx.isCommentMode
          ? "va-panel-open visible translate-x-0 opacity-100"
          : "invisible translate-x-5 opacity-0 pointer-events-none",
      )}
      data-state={ctx.isCommentMode ? "open" : "closed"}
      aria-hidden={!ctx.isCommentMode}
      inert={!ctx.isCommentMode}
      role={ctx.isCommentMode ? "complementary" : undefined}
      aria-label={ctx.isCommentMode ? "Annotation sidebar" : undefined}
    >
      <PanelHeader closeButtonRef={closeButtonRef} />
      <PanelContent />
    </aside>
  )
}

function PanelHeader({ closeButtonRef }: { closeButtonRef: React.RefObject<HTMLButtonElement | null> }) {
  const ctx = useAnnotationContext()

  return (
    <div className="flex items-center justify-between border-b px-4 py-3">
      <div className="flex items-center gap-2">
        <h3 className="font-serif text-base font-medium tracking-tight">Comments</h3>
        {ctx.totalThreadCount > 0 && <Badge variant="secondary">{ctx.totalThreadCount}</Badge>}
      </div>
      <div className="flex items-center gap-2">
        {ctx.isPickingNode && (
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-clay/10 px-2 py-0.5 text-[10px] font-medium text-clay">
            <Crosshair className="size-3" />
            Pick a component
          </span>
        )}
        {ctx.isSaving && (
          <RefreshCcw className="size-3.5 animate-spin text-muted-foreground" />
        )}
        <Button
          ref={closeButtonRef}
          variant="ghost"
          size="icon-xs"
          onClick={ctx.closeComments}
          aria-label="Close comments"
          title="Close comments"
        >
          <X data-icon="only" />
          <span className="sr-only">Close comments</span>
        </Button>
      </div>
    </div>
  )
}

function PanelContent() {
  const ctx = useAnnotationContext()
  const { isLoading, error, panelView } = ctx

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState />

  return (
    <ViewSwitcher view={panelView}>
      {panelView === "thread" && ctx.activeThreadId ? (
        (() => {
          const thread = ctx.doc?.threads.find((t) => t.id === ctx.activeThreadId)
          return thread ? <ThreadDetail thread={thread} /> : <ThreadList />
        })()
      ) : panelView === "node" ? (
        <CreateThreadComposer />
      ) : (
        <ThreadList />
      )}
    </ViewSwitcher>
  )
}

function ViewSwitcher({ view, children }: { view: PanelView; children: React.ReactNode }) {
  const lastViewRef = useRef<PanelView>(view)
  const lastChildrenRef = useRef<React.ReactNode>(children)
  const [exiting, setExiting] = useState<{ view: PanelView; children: React.ReactNode } | null>(null)

  useLayoutEffect(() => {
    if (view !== lastViewRef.current) {
      // capture the previous view/children and show exit overlay
      setExiting({ view: lastViewRef.current, children: lastChildrenRef.current })
      lastViewRef.current = view
      lastChildrenRef.current = children
      const id = window.setTimeout(() => setExiting(null), 140)
      return () => window.clearTimeout(id)
    }
    // keep the last children up to date when view hasn't changed
    lastChildrenRef.current = children
  }, [view, children])

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {exiting && (
        <div key={`exit-${exiting.view}`} className="va-view-exit absolute inset-0 z-0" aria-hidden="true" inert>
          {exiting.children}
        </div>
      )}
      <div key={`enter-${view}`} className="va-view-enter relative z-10 flex flex-1 flex-col">
        {children}
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="h-1.5 w-1.5 animate-ping rounded-full bg-clay"></span>
        Loading comments...
      </p>
    </div>
  )
}

function ErrorState() {
  const ctx = useAnnotationContext()
  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
        <p className="text-sm text-destructive">{formatSaveError(ctx.error)}</p>
      </div>
      <Button variant="outline" size="sm" onClick={ctx.resetError}>
        Dismiss
      </Button>
    </div>
  )
}

function ThreadList() {
  const ctx = useAnnotationContext()
  const { filteredThreads, openThreadCount, resolvedThreadCount, filter, setFilter, isPickingNode } = ctx

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-1 border-b px-4 py-2">
        <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
          All {ctx.totalThreadCount > 0 && `(${ctx.totalThreadCount})`}
        </FilterButton>
        <FilterButton active={filter === "open"} onClick={() => setFilter("open")}>
          Open {openThreadCount > 0 && `(${openThreadCount})`}
        </FilterButton>
        <FilterButton active={filter === "resolved"} onClick={() => setFilter("resolved")}>
          Resolved {resolvedThreadCount > 0 && `(${resolvedThreadCount})`}
        </FilterButton>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 p-4">
          {filteredThreads.length === 0 && (
            <div className="rounded-xl border border-dashed p-5 text-center">
              <MessageSquare className="mx-auto size-6 text-muted-foreground/60" />
              <p className="mt-2 text-sm text-muted-foreground">
                No {filter === "all" ? "" : filter} threads yet.
              </p>
              <p className="text-xs text-muted-foreground">
                {isPickingNode
                  ? "Click a component on the canvas to comment."
                  : "Click any component on the canvas to start a comment."}
              </p>
            </div>
          )}

          {filteredThreads.map((thread) => (
            <ThreadListItem key={thread.id} thread={thread} />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  )
}

function ThreadListItem({ thread }: { thread: AnnotationThread }) {
  const ctx = useAnnotationContext()
  const lastMessage = thread.messages[thread.messages.length - 1]
  const snippet = thread.anchor.textSnippet || thread.anchor.nodeType
  const isPresent = useAnchorPresence(thread.anchor.nodeId, thread.anchor.nodePath)
  const isActive = ctx.activeThreadId === thread.id
  const identity = threadNodeIdentity(thread)
  const replyLabel = thread.messages.length === 1 ? "reply" : "replies"

  return (
    <button
      type="button"
      onClick={() => ctx.selectThread(thread.id)}
      onMouseEnter={() => ctx.setPreviewNode(identity)}
      onMouseLeave={() => ctx.setPreviewNode(null)}
      aria-label={`Open thread on ${snippet}, ${thread.status}, ${thread.messages.length} ${replyLabel}`}
      className={cn(
        "group flex flex-col gap-2 rounded-xl border p-4 text-left transition-all duration-[var(--va-annotation-fast)] ease-[var(--va-annotation-ease-standard)]",
        "hover:border-muted-foreground/20 hover:bg-muted/50",
        isActive && "border-clay/40 bg-clay/[0.04]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-1 text-sm font-medium text-foreground">{snippet}</span>
        <div className="flex shrink-0 items-center gap-1">
          {!isPresent && (
            <span
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
              title="Anchor not found"
            >
              <AlertTriangle className="size-3" />
            </span>
          )}
          <ThreadStatusBadge status={thread.status} />
        </div>
      </div>
      <p className="line-clamp-2 text-xs text-muted-foreground">{lastMessage?.body}</p>
      <p className="text-[10px] text-muted-foreground">
        {thread.messages.length} {replyLabel}
        {" · "}
        <TimeLabel date={thread.updatedAt} />
      </p>
    </button>
  )
}

function ThreadDetail({ thread }: { thread: AnnotationThread }) {
  const ctx = useAnnotationContext()
  const [replyText, setReplyText] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const snippet = thread.anchor.textSnippet || thread.anchor.nodeType
  const isPresent = useAnchorPresence(thread.anchor.nodeId, thread.anchor.nodePath)
  const backLabel = ctx.returnView === "node" ? "← Back to selected node" : "← Back to threads"

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      if (replyText.trim()) {
        event.preventDefault()
        event.stopPropagation()
        setReplyText("")
      }
    }

    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [replyText])

  async function handleSubmit(event?: React.FormEvent) {
    event?.preventDefault()
    if (!replyText.trim() || isSubmitting) return
    setIsSubmitting(true)
    await ctx.addReply(thread.id, replyText)
    setReplyText("")
    setIsSubmitting(false)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b px-4 py-4">
        <button
          type="button"
          onClick={ctx.navigateBack}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {backLabel}
        </button>
        <div className="mt-3 flex items-start justify-between gap-2">
          <div>
            <p className="line-clamp-1 text-sm font-medium text-foreground">{snippet}</p>
            <p className="text-xs text-muted-foreground">{thread.anchor.nodeType}</p>
            {!isPresent && (
              <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                <AlertTriangle className="size-3" />
                Anchor not found; this thread may have moved.
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {thread.status === "resolved" ? (
              <Button variant="outline" size="sm" onClick={() => ctx.reopenThread(thread.id)}>
                Reopen
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => ctx.resolveThread(thread.id)}>
                <CheckCircle2 data-icon="inline-start" />
                Resolve
              </Button>
            )}
            <ThreadStatusBadge status={thread.status} />
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 p-4">
          {thread.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>
      </ScrollArea>

      <div className="border-t p-4">
        {thread.status === "resolved" ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">This thread is resolved.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Reply..."
              className="min-h-20"
              aria-label="Reply"
            />
            <div className="flex items-center justify-end gap-2">
              <span className="text-[10px] text-muted-foreground">{shortcutLabel()} to reply</span>
              <Button
                size="sm"
                disabled={!replyText.trim() || isSubmitting}
                onClick={() => handleSubmit()}
              >
                <Send data-icon="inline-start" />
                Reply
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: AnnotationMessage }) {
  const isFallback =
    message.author.name === LOCAL_ANONYMOUS_AUTHOR.name &&
    message.author.email === LOCAL_ANONYMOUS_AUTHOR.email

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start justify-between gap-2">
        <AuthorLabel author={message.author} isFallback={isFallback} />
        <span className="shrink-0 text-[10px] text-muted-foreground">
          <TimeLabel date={message.createdAt} />
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm text-foreground">{message.body}</p>
    </div>
  )
}

function AuthorLabel({
  author,
  isFallback,
}: {
  author: AnnotationAuthor
  isFallback?: boolean
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-foreground">{author.name}</span>
        {isFallback && (
          <span
            className="text-[10px] text-muted-foreground"
            title="Git identity not set; using local author."
          >
            (git identity not set)
          </span>
        )}
      </div>
      <span className="text-[10px] text-muted-foreground">{author.email}</span>
    </div>
  )
}

function CreateThreadComposer() {
  const ctx = useAnnotationContext()
  const { selectedNode, draftText, setDraftText, createThread } = ctx
  const [isSubmitting, setIsSubmitting] = useState(false)
  const nodeThreads = useMemo(() => {
    if (!selectedNode) return []
    return ctx.getThreadsForNode(selectedNode.nodeId, selectedNode.nodePath)
  }, [ctx, selectedNode])

  async function handleSubmit(event?: React.FormEvent) {
    event?.preventDefault()
    if (!selectedNode || !draftText.trim() || isSubmitting) return
    setIsSubmitting(true)

    await createThread(
      {
        nodeId: selectedNode.nodeId,
        nodePath: selectedNode.nodePath,
        nodeType: selectedNode.nodeType || "node",
        textSnippet: selectedNode.textSnippet,
      },
      draftText,
    )
    setIsSubmitting(false)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault()
      handleSubmit()
    }
  }

  if (!selectedNode) return null

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b px-4 py-4">
        <button
          type="button"
          onClick={ctx.navigateBack}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to all comments
        </button>
        <div className="mt-3">
          <p className="line-clamp-1 text-sm font-medium text-foreground">
            {selectedNode.textSnippet ?? "Selected component"}
          </p>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">{selectedNode.nodeType ?? "node"}</p>
            <span className="text-[10px] text-muted-foreground">
              · {nodeThreads.length} thread{nodeThreads.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 p-4">
          {nodeThreads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => ctx.selectThread(thread.id)}
              onMouseEnter={() => ctx.setPreviewNode(threadNodeIdentity(thread))}
              onMouseLeave={() => ctx.setPreviewNode(null)}
              aria-label={`Open thread on ${selectedNode.textSnippet ?? selectedNode.nodeType}, ${thread.status}, ${thread.messages.length} ${thread.messages.length === 1 ? "reply" : "replies"}`}
              className="group flex flex-col gap-2 rounded-xl border p-4 text-left transition-all duration-[var(--va-annotation-fast)] ease-[var(--va-annotation-ease-standard)] hover:border-muted-foreground/20 hover:bg-muted/50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-foreground">
                  {thread.messages.length} {thread.messages.length === 1 ? "reply" : "replies"}
                </span>
                <ThreadStatusBadge status={thread.status} />
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {thread.messages[thread.messages.length - 1]?.body}
              </p>
            </button>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t p-4">
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-xs font-medium text-foreground">
              Commenting on{" "}
              <span className="text-clay">{selectedNode.textSnippet ?? "selected component"}</span>
            </p>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="capitalize">{selectedNode.nodeType ?? "node"}</span>
              <span>·</span>
              <span>
                {nodeThreads.length} thread{nodeThreads.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Posting as <span className="font-medium text-foreground">{ctx.author?.name ?? "Local Author"}</span>
                {ctx.isFallbackAuthor && " (git identity not set)"}
              </span>
            </div>
            <Textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Start a comment..."
              className="min-h-28"
              aria-label="Start a comment"
            />
            <div className="flex items-center justify-end gap-2">
              <span className="text-[10px] text-muted-foreground">{shortcutLabel()} to post</span>
              <Button
                size="sm"
                disabled={!draftText.trim() || isSubmitting}
                onClick={() => handleSubmit()}
              >
                <Send data-icon="inline-start" />
                Post
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ThreadStatusBadge({ status }: { status: "open" | "resolved" }) {
  if (status === "resolved") {
    return (
      <Badge variant="secondary" className="gap-1">
        <CheckCircle2 className="size-3" />
        Resolved
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Circle className="size-3" />
      Open
    </Badge>
  )
}

function TimeLabel({ date }: { date: string }) {
  return useMemo(() => formatAnnotationTime(date), [date])
}

function shortcutLabel(): string {
  if (typeof navigator !== "undefined" && navigator.platform?.toLowerCase().includes("mac")) {
    return "⌘ + Enter"
  }
  return "Ctrl + Enter"
}
