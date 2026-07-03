"use client"

import { useMemo, useState } from "react"
import { format, formatDistanceToNowStrict, isValid } from "date-fns"
import { AlertTriangle, CheckCircle2, Circle, MessageSquare, RefreshCcw, Send, X } from "lucide-react"
import { LOCAL_ANONYMOUS_AUTHOR } from "@agents/visual-artifact-annotations"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAnnotationContext } from "@/components/annotation-provider"
import { useAnchorPresence } from "@/hooks/use-anchor-presence"
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

export function AnnotationPanel() {
  const ctx = useAnnotationContext()

  if (!ctx.isCommentMode && !ctx.error) return null

  return (
    <aside
      className="fixed right-0 top-14 z-30 flex h-[calc(100vh-3.5rem)] w-full flex-col border-l bg-card/95 shadow-sm backdrop-blur-sm md:w-80"
      aria-label="Annotation sidebar"
    >
      <PanelHeader />
      <PanelContent />
    </aside>
  )
}

function PanelHeader() {
  const ctx = useAnnotationContext()

  return (
    <div className="flex items-center justify-between border-b px-4 py-3">
      <div className="flex items-center gap-2">
        <h3 className="font-serif text-base font-medium tracking-tight">Comments</h3>
        {ctx.totalThreadCount > 0 && (
          <Badge variant="secondary">{ctx.totalThreadCount}</Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        {ctx.isSaving && (
          <RefreshCcw className="size-3.5 animate-spin text-muted-foreground" />
        )}
        <Button
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
  const { isLoading, error, doc, activeThreadId, selectedNode } = ctx

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-clay"></span>
          Loading comments...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">Could not save comments.</p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        </div>
        <Button variant="outline" size="sm" onClick={ctx.resetError}>
          Dismiss
        </Button>
      </div>
    )
  }

  if (activeThreadId) {
    const thread = doc?.threads.find((t) => t.id === activeThreadId)
    if (thread) return <ThreadDetail thread={thread} />
  }

  if (selectedNode) {
    return <CreateThreadComposer />
  }

  return <ThreadList />
}

function ThreadList() {
  const ctx = useAnnotationContext()
  const { filteredThreads, openThreadCount, resolvedThreadCount, filter, setFilter } = ctx

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-1 border-b px-4 py-2">
        <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
          All {filteredThreads.length > 0 && `(${ctx.totalThreadCount})`}
        </FilterButton>
        <FilterButton active={filter === "open"} onClick={() => setFilter("open")}>
          Open {openThreadCount > 0 && `(${openThreadCount})`}
        </FilterButton>
        <FilterButton active={filter === "resolved"} onClick={() => setFilter("resolved")}>
          Resolved {resolvedThreadCount > 0 && `(${resolvedThreadCount})`}
        </FilterButton>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col p-3">
          {filteredThreads.length === 0 && (
            <div className="rounded-lg border border-dashed p-4 text-center">
              <MessageSquare className="mx-auto size-6 text-muted-foreground/60" />
              <p className="mt-2 text-sm text-muted-foreground">
                No {filter === "all" ? "" : filter} threads yet.
              </p>
              <p className="text-xs text-muted-foreground">Use the target button to pick a node.</p>
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

  return (
    <button
      type="button"
      onClick={() => ctx.selectThread(thread.id)}
      className="group flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-1 text-sm font-medium text-foreground">
          {snippet}
        </span>
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
      <p className="line-clamp-2 text-xs text-muted-foreground">
        {lastMessage?.body}
      </p>
      <p className="text-[10px] text-muted-foreground">
        {thread.messages.length} {thread.messages.length === 1 ? "reply" : "replies"}
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
      <div className="border-b px-4 py-3">
        <button
          type="button"
          onClick={() => ctx.setActiveThreadId(null)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Back to threads
        </button>
        <div className="mt-2 flex items-start justify-between gap-2">
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
          <ThreadStatusBadge status={thread.status} />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 p-4">
          {thread.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>
      </ScrollArea>

      <div className="border-t p-4">
        {thread.status === "resolved" ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">This thread is resolved.</p>
            <Button variant="outline" size="sm" onClick={() => ctx.reopenThread(thread.id)}>
              Reopen
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => ctx.resolveThread(thread.id)}
            >
              <CheckCircle2 data-icon="inline-start" />
              Resolve thread
            </Button>
            <div className="flex flex-col gap-2">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Reply..."
                className="min-h-20"
                aria-label="Reply"
              />
              <div className="flex justify-end">
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

  return (
    <div className="flex flex-1 flex-col">
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 p-4">
          {nodeThreads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => ctx.setActiveThreadId(thread.id)}
              className="rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
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
        <div className="flex flex-col gap-2">
          <p className="text-[10px] text-muted-foreground">
            Posting as {ctx.author?.name ?? "Local Author"}
            {ctx.isFallbackAuthor && " (git identity not set)"}
          </p>
          <Textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Start a comment..."
            className="min-h-28"
            aria-label="Start a comment"
          />
          <div className="flex justify-end">
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
