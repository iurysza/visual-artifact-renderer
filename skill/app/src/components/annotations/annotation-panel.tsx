"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { format, formatDistanceToNowStrict, isValid } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  Crosshair,
  MessageSquare,
  Pencil,
  RefreshCcw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { LOCAL_ANONYMOUS_AUTHOR } from "@agents/visual-artifact-annotations";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useAnnotationContext,
  type AuthorStatus,
  type PanelView,
} from "./annotation-provider";
import { useAnchorPresence } from "@/hooks/use-anchor-presence";
import { threadNodeIdentity } from "./annotation-helpers";
import { NodePickToggle } from "./annotation-toggle";
import type {
  AnnotationThread,
  AnnotationMessage,
  AnnotationAuthor,
} from "@/lib/artifacts/annotations";
import { cn } from "@/lib/utils";

function formatAnnotationTime(dateInput: string): string {
  const date = new Date(dateInput);
  if (!isValid(date)) return dateInput;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return format(date, "MMM d, yyyy");
  if (diffMs < 60_000) return "just now";
  const days = diffMs / (1000 * 60 * 60 * 24);
  if (days < 7) return formatDistanceToNowStrict(date, { addSuffix: true });
  return format(date, "MMM d, yyyy");
}

function formatSaveError(error: string | null): string {
  if (!error) return "Something went wrong.";
  try {
    const parsed = JSON.parse(error);
    const raw =
      typeof parsed.error === "string"
        ? parsed.error
        : typeof parsed.message === "string"
          ? parsed.message
          : error;
    if (
      raw.includes("author.email") ||
      raw.toLowerCase().includes("invalid email")
    ) {
      return "We couldn't save your comment. Check your Git author email and try again.";
    }
    if (
      raw.includes("author.name") ||
      raw.toLowerCase().includes("invalid name")
    ) {
      return "We couldn't save your comment. Check your Git author name and try again.";
    }
    return "We couldn't save your comment. Please try again.";
  } catch {
    return "We couldn't save your comment. Please try again.";
  }
}

function ComposerAuthorLabel({
  author,
  status,
}: {
  author: AnnotationAuthor;
  status: AuthorStatus;
}) {
  if (status === "loading") {
    return (
      <span className="text-xs text-muted-foreground" aria-live="polite">
        Loading author…
      </span>
    );
  }
  if (status === "fallback") {
    return (
      <span
        className="text-xs text-muted-foreground"
        title="Git identity not set; using local fallback author."
      >
        Posting as{" "}
        <span className="font-medium text-foreground">{author.name}</span>{" "}
        (local fallback)
      </span>
    );
  }
  return (
    <span className="text-xs text-muted-foreground">
      Posting as{" "}
      <span className="font-medium text-foreground">{author.name}</span>
    </span>
  );
}

export function AnnotationPanel() {
  const ctx = useAnnotationContext();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Focus the close button when comments open, but do not steal focus while
    // the user is actively picking a node (mobile pick HUD should be focusable).
    if (!ctx.isCommentMode || ctx.isPickingNode) return;
    closeButtonRef.current?.focus();
  }, [ctx.isCommentMode, ctx.isPickingNode]);

  return (
    <aside
      ref={panelRef}
      className={cn(
        "va-panel fixed right-0 top-14 z-30 flex h-[calc(100vh-3.5rem)] w-full flex-col border-l bg-card/95 shadow-sm backdrop-blur-sm md:w-[var(--va-annotation-panel-width)]",
        // Hide the panel while the user is picking a node so the artifact canvas
        // becomes fully tappable on mobile. Keep comment mode active.
        ctx.isCommentMode && !ctx.isPickingNode
          ? "va-panel-open visible translate-x-0 opacity-100"
          : "invisible translate-x-5 opacity-0 pointer-events-none",
      )}
      data-state={ctx.isCommentMode && !ctx.isPickingNode ? "open" : "closed"}
      aria-hidden={!(ctx.isCommentMode && !ctx.isPickingNode)}
      // Make the panel inert while hidden so screen readers and focus don't
      // interact with it during picking.
      inert={!(ctx.isCommentMode && !ctx.isPickingNode)}
      role={
        ctx.isCommentMode && !ctx.isPickingNode ? "complementary" : undefined
      }
      aria-label={
        ctx.isCommentMode && !ctx.isPickingNode
          ? "Annotation sidebar"
          : undefined
      }
    >
      <PanelHeader closeButtonRef={closeButtonRef} />
      <PanelContent />
    </aside>
  );
}

function PanelHeader({
  closeButtonRef,
}: {
  closeButtonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const ctx = useAnnotationContext();
  const activeThread = ctx.activeThreadId
    ? ctx.doc?.threads.find((t) => t.id === ctx.activeThreadId)
    : null;

  if (ctx.panelView === "thread" && activeThread) {
    return <ThreadPanelHeader thread={activeThread} />;
  }

  if (ctx.panelView === "node" && ctx.selectedNode) {
    return <NodePanelHeader closeButtonRef={closeButtonRef} />;
  }

  return (
    <>
      {/* Desktop list header */}
      <div className="hidden md:flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="font-serif text-base font-medium tracking-tight">
            Review comments
          </h3>
          {ctx.totalThreadCount > 0 && (
            <Badge variant="secondary">{ctx.totalThreadCount}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {ctx.isPickingNode && (
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-clay/10 px-2 py-0.5 text-[10px] font-medium text-clay">
              <Crosshair className="size-3" />
              Selecting component
            </span>
          )}
          {ctx.isSaving && (
            <RefreshCcw className="size-3.5 animate-spin text-muted-foreground" />
          )}
          <div className="md:hidden">
            <NodePickToggle />
          </div>
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

      {/* Mobile list header */}
      <div className="flex md:hidden items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="font-serif text-base font-medium tracking-tight">
            Comments
          </h3>
          {ctx.totalThreadCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {ctx.totalThreadCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <NodePickToggle />
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
    </>
  );
}

function NodePanelHeader({
  closeButtonRef,
}: {
  closeButtonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const ctx = useAnnotationContext();
  const selectedNode = ctx.selectedNode;
  const isPresent = useAnchorPresence(
    selectedNode?.nodeId,
    selectedNode?.nodePath ?? "",
  );

  if (!selectedNode) return null;

  const nodeThreads = ctx.getThreadsForNode(
    selectedNode.nodeId,
    selectedNode.nodePath,
  );
  const snippet =
    selectedNode.textSnippet || selectedNode.nodeType || "Selected component";
  const nodeType = selectedNode.nodeType || "node";

  const changeButton = (
    <button
      type="button"
      onClick={() => ctx.startNodePick()}
      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
    >
      Change component
    </button>
  );

  const closeButton = (
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
  );

  return (
    <DetailPanelHeader
      title="New comment"
      count={nodeThreads.length}
      snippet={snippet}
      nodeType={nodeType}
      isPresent={isPresent}
      onBack={ctx.navigateBack}
      backLabel="Back to comments"
      mobileActions={
        <>
          {changeButton}
          {closeButton}
        </>
      }
    />
  );
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
  title: string;
  count?: number;
  snippet: string;
  nodeType: string;
  isPresent: boolean;
  onBack: () => void;
  backLabel?: string;
  desktopActions?: React.ReactNode;
  mobileActions?: React.ReactNode;
}) {
  return (
    <>
      {/* Desktop header */}
      <div className="hidden md:flex flex-col gap-2 border-b px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <BackButton onClick={onBack} label={backLabel} />
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-base font-medium tracking-tight">
                {title}
              </h3>
              {typeof count === "number" && (
                <Badge variant="secondary">{count}</Badge>
              )}
            </div>
          </div>
          {desktopActions && (
            <div className="flex shrink-0 items-center gap-2">
              {desktopActions}
            </div>
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
      <div className="flex md:hidden items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <BackButton onClick={onBack} label="Back" />
          <h3 className="font-serif text-base font-medium tracking-tight">
            {title}
          </h3>
          {typeof count === "number" && (
            <Badge variant="secondary">{count}</Badge>
          )}
        </div>
        {mobileActions && (
          <div className="flex items-center gap-2">{mobileActions}</div>
        )}
      </div>
    </>
  );
}

function ThreadPanelHeader({ thread }: { thread: AnnotationThread }) {
  const ctx = useAnnotationContext();
  const snippet = thread.anchor.textSnippet || thread.anchor.nodeType;
  const isPresent = useAnchorPresence(
    thread.anchor.nodeId,
    thread.anchor.nodePath,
  );

  const resolveButton =
    thread.status === "resolved" ? (
      <Button
        variant="outline"
        size="sm"
        onClick={() => ctx.reopenThread(thread.id)}
      >
        Reopen
      </Button>
    ) : (
      <Button
        variant="outline"
        size="sm"
        onClick={() => ctx.resolveThread(thread.id)}
      >
        <CheckCircle2 data-icon="inline-start" />
        Resolve
      </Button>
    );

  const mobileResolveButton =
    thread.status === "resolved" ? (
      <Button
        variant="outline"
        size="sm"
        onClick={() => ctx.reopenThread(thread.id)}
      >
        Reopen
      </Button>
    ) : (
      <Button
        variant="outline"
        size="icon-xs"
        onClick={() => ctx.resolveThread(thread.id)}
        aria-label="Resolve"
        title="Resolve"
      >
        <CheckCircle2 className="size-3" />
        <span className="sr-only">Resolve</span>
      </Button>
    );

  return (
    <DetailPanelHeader
      title="Thread"
      count={thread.messages.length}
      snippet={snippet}
      nodeType={thread.anchor.nodeType}
      isPresent={isPresent}
      onBack={ctx.navigateBack}
      backLabel="Back to comments"
      desktopActions={resolveButton}
      mobileActions={mobileResolveButton}
    />
  );
}

function BackButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
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
  );
}

function PanelContent() {
  const ctx = useAnnotationContext();
  const { isLoading, error, panelView } = ctx;

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState />;

  return (
    <ViewSwitcher view={panelView}>
      {panelView === "thread" && ctx.activeThreadId ? (
        (() => {
          const thread = ctx.doc?.threads.find(
            (t) => t.id === ctx.activeThreadId,
          );
          return thread ? <ThreadDetail thread={thread} /> : <ThreadList />;
        })()
      ) : panelView === "node" ? (
        <CreateThreadComposer />
      ) : (
        <ThreadList />
      )}
    </ViewSwitcher>
  );
}

function ViewSwitcher({
  view,
  children,
}: {
  view: PanelView;
  children: React.ReactNode;
}) {
  const lastViewRef = useRef<PanelView>(view);
  const lastChildrenRef = useRef<React.ReactNode>(children);
  const [exiting, setExiting] = useState<{
    view: PanelView;
    children: React.ReactNode;
  } | null>(null);

  useLayoutEffect(() => {
    if (view !== lastViewRef.current) {
      // capture the previous view/children and show exit overlay
      setExiting({
        view: lastViewRef.current,
        children: lastChildrenRef.current,
      });
      lastViewRef.current = view;
      lastChildrenRef.current = children;
      const id = window.setTimeout(() => setExiting(null), 140);
      return () => window.clearTimeout(id);
    }
    // keep the last children up to date when view hasn't changed
    lastChildrenRef.current = children;
  }, [view, children]);

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {exiting && (
        <div
          key={`exit-${exiting.view}`}
          className="va-view-exit absolute inset-0 z-0"
          aria-hidden="true"
          inert
        >
          {exiting.children}
        </div>
      )}
      <div
        key={`enter-${view}`}
        className="va-view-enter relative z-10 flex flex-1 flex-col"
      >
        {children}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="h-1.5 w-1.5 animate-ping rounded-full bg-clay"></span>
        Loading comments...
      </p>
    </div>
  );
}

function ErrorState() {
  const ctx = useAnnotationContext();
  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
        <p className="text-sm text-destructive">{formatSaveError(ctx.error)}</p>
      </div>
      <Button variant="outline" size="sm" onClick={ctx.resetError}>
        Dismiss
      </Button>
    </div>
  );
}

function ThreadList() {
  const ctx = useAnnotationContext();
  const {
    filteredThreads,
    openThreadCount,
    resolvedThreadCount,
    filter,
    setFilter,
    isPickingNode,
  } = ctx;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-1 border-b px-4 py-2">
        <FilterButton
          active={filter === "all"}
          onClick={() => setFilter("all")}
        >
          All {ctx.totalThreadCount > 0 && `(${ctx.totalThreadCount})`}
        </FilterButton>
        <FilterButton
          active={filter === "open"}
          onClick={() => setFilter("open")}
        >
          Open {openThreadCount > 0 && `(${openThreadCount})`}
        </FilterButton>
        <FilterButton
          active={filter === "resolved"}
          onClick={() => setFilter("resolved")}
        >
          Resolved {resolvedThreadCount > 0 && `(${resolvedThreadCount})`}
        </FilterButton>
      </div>

      <ScrollArea className="max-h-[48vh] md:max-h-none md:flex-1">
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
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
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
  );
}

function ThreadListItem({ thread }: { thread: AnnotationThread }) {
  const ctx = useAnnotationContext();
  const lastMessage = thread.messages[thread.messages.length - 1];
  const snippet = thread.anchor.textSnippet || thread.anchor.nodeType;
  const isPresent = useAnchorPresence(
    thread.anchor.nodeId,
    thread.anchor.nodePath,
  );
  const isActive = ctx.activeThreadId === thread.id;
  const identity = threadNodeIdentity(thread);
  const replyLabel = thread.messages.length === 1 ? "reply" : "replies";

  return (
    <button
      type="button"
      onClick={() => ctx.selectThread(thread.id)}
      onMouseEnter={() => ctx.setPreviewNode(identity)}
      onMouseLeave={() => ctx.setPreviewNode(null)}
      aria-label={`Open thread on ${snippet}, ${thread.status}, ${thread.messages.length} ${replyLabel}`}
      className={cn(
        "group flex flex-col gap-2 md:gap-1 rounded-xl md:rounded-lg border p-4 md:p-3 text-left transition-all duration-[var(--va-annotation-fast)] ease-[var(--va-annotation-ease-standard)]",
        "hover:border-muted-foreground/20 hover:bg-muted/50",
        isActive && "border-clay/40 bg-clay/[0.04]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-1 text-sm md:text-sm font-medium text-foreground">
          {snippet}
        </span>
        <div className="flex shrink-0 items-center gap-2">
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
      <p className="line-clamp-2 text-xs text-muted-foreground md:truncate md:overflow-hidden">
        {lastMessage?.body}
      </p>
      <p className="text-[10px] text-muted-foreground flex items-center gap-2">
        {lastMessage?.author?.name && (
          <span className="hidden md:inline text-[11px] text-muted-foreground">
            {lastMessage.author.name} ·
          </span>
        )}
        <span>
          {thread.messages.length} {replyLabel}
        </span>
        <span>·</span>
        <TimeLabel date={thread.updatedAt} />
      </p>
    </button>
  );
}

function ThreadDetail({ thread }: { thread: AnnotationThread }) {
  const ctx = useAnnotationContext();
  const [replyText, setReplyText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (replyText.trim()) {
        event.preventDefault();
        event.stopPropagation();
        setReplyText("");
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [replyText]);

  async function handleSubmit() {
    if (!replyText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    await ctx.addReply(thread.id, replyText);
    setReplyText("");
    setIsSubmitting(false);
  }

  return (
    <div className="flex flex-1 flex-col">
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 p-4">
          {thread.messages.map((message) => (
            <MessageBubble
              key={message.id}
              threadId={thread.id}
              message={message}
            />
          ))}
        </div>
      </ScrollArea>

      <div className="border-t p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:sticky md:bottom-0 md:z-10 md:bg-card">
        {thread.status === "resolved" ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              This thread is resolved.
            </p>
          </div>
        ) : (
          <MessageComposer
            value={replyText}
            onChange={setReplyText}
            onSubmit={() => handleSubmit()}
            placeholder="Reply..."
            buttonLabel="Reply"
            shortcutSuffix="reply"
            isSubmitting={isSubmitting}
            textareaId="thread-reply-textarea"
            ariaLabel="Reply"
          />
        )}
      </div>
    </div>
  );
}

function MessageBubble({
  threadId,
  message,
}: {
  threadId: string;
  message: AnnotationMessage;
}) {
  const ctx = useAnnotationContext();
  const isFallback =
    message.author.name === LOCAL_ANONYMOUS_AUTHOR.name &&
    message.author.email === LOCAL_ANONYMOUS_AUTHOR.email;
  const isAuthor =
    ctx.authorStatus !== "loading" && message.author.email === ctx.author.email;

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.body);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  function handleStartEdit() {
    setEditText(message.body);
    setIsEditing(true);
    setIsConfirmingDelete(false);
  }

  function handleSave() {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === message.body) {
      setIsEditing(false);
      return;
    }
    ctx.editMessage(threadId, message.id, trimmed);
    setIsEditing(false);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setEditText(message.body);
  }

  function handleConfirmDelete() {
    ctx.deleteMessage(threadId, message.id);
    setIsConfirmingDelete(false);
  }

  function handleEditKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      handleSave();
    } else if (event.key === "Escape") {
      event.preventDefault();
      handleCancelEdit();
    }
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <AuthorLabel author={message.author} isFallback={isFallback} />
          <span className="shrink-0 text-[10px] text-muted-foreground">
            <TimeLabel date={message.updatedAt} />
          </span>
        </div>
        <Textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={handleEditKeyDown}
          placeholder="Edit comment..."
          className="min-h-20"
          aria-label="Edit comment"
        />
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!editText.trim()}>
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start justify-between gap-2">
        <AuthorLabel author={message.author} isFallback={isFallback} />
        <div className="flex items-center gap-2">
          {isAuthor && !isConfirmingDelete && (
            <>
              <button
                type="button"
                onClick={handleStartEdit}
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Edit comment"
                title="Edit comment"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                className="text-muted-foreground transition-colors hover:text-destructive"
                aria-label="Delete comment"
                title="Delete comment"
              >
                <Trash2 className="size-3.5" />
              </button>
            </>
          )}
          {isConfirmingDelete && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">Delete?</span>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="text-destructive transition-colors hover:text-destructive/80"
                aria-label="Confirm delete"
                title="Confirm delete"
              >
                <Check className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Cancel delete"
                title="Cancel delete"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
          <span className="shrink-0 text-[10px] text-muted-foreground">
            <TimeLabel date={message.createdAt} />
          </span>
        </div>
      </div>
      <p className="whitespace-pre-wrap text-sm text-foreground">
        {message.body}
      </p>
    </div>
  );
}

function AuthorLabel({
  author,
  isFallback,
}: {
  author: AnnotationAuthor;
  isFallback?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-foreground">
          {author.name}
        </span>
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
  );
}

interface MessageComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  placeholder: string;
  buttonLabel: string;
  shortcutSuffix: "reply" | "post";
  isSubmitting?: boolean;
  textareaId?: string;
  ariaLabel: string;
  size?: "compact" | "comfortable";
}

function MessageComposer({
  value,
  onChange,
  onSubmit,
  placeholder,
  buttonLabel,
  shortcutSuffix,
  isSubmitting = false,
  textareaId,
  ariaLabel,
  size = "compact",
}: MessageComposerProps) {
  const ctx = useAnnotationContext();

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <ComposerAuthorLabel author={ctx.author} status={ctx.authorStatus} />
      </div>
      <Textarea
        id={textareaId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          size === "comfortable" ? "min-h-20 md:min-h-28" : "min-h-20",
        )}
        aria-label={ariaLabel}
        aria-disabled={ctx.authorStatus === "loading"}
      />
      <div className="flex items-center justify-end gap-2">
        <span className="text-[10px] text-muted-foreground hidden md:inline">
          {shortcutLabel()} to {shortcutSuffix}
        </span>
        <Button
          size="sm"
          disabled={
            ctx.authorStatus === "loading" || !value.trim() || isSubmitting
          }
          onClick={() => onSubmit()}
        >
          <Send data-icon="inline-start" />
          {buttonLabel}
        </Button>
      </div>
    </div>
  );
}

function CreateThreadComposer() {
  const ctx = useAnnotationContext();
  const { selectedNode, draftText, setDraftText, createThread } = ctx;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nodeThreads = useMemo(() => {
    if (!selectedNode) return [];
    return ctx.getThreadsForNode(selectedNode.nodeId, selectedNode.nodePath);
  }, [ctx, selectedNode]);

  async function handleSubmit() {
    if (!selectedNode || !draftText.trim() || isSubmitting) return;
    setIsSubmitting(true);

    await createThread(
      {
        nodeId: selectedNode.nodeId,
        nodePath: selectedNode.nodePath,
        nodeType: selectedNode.nodeType || "node",
        textSnippet: selectedNode.textSnippet,
      },
      draftText,
    );
    setIsSubmitting(false);
  }

  // focus and ensure visibility of the composer on mobile when a node is
  // selected so the textarea isn't hidden behind the keyboard or chrome.
  // We only do this for small/coarse-pointer devices to avoid stealing focus
  // on desktop.
  useEffect(() => {
    const isClient = typeof window !== "undefined";
    if (!isClient) return;
    const isMobile = window.matchMedia
      ? window.matchMedia("(pointer:coarse)").matches ||
        window.innerWidth <= 768
      : window.innerWidth <= 768;
    if (!isMobile) return;

    const id = setTimeout(() => {
      const el = document.getElementById(
        "create-thread-textarea",
      ) as HTMLTextAreaElement | null;
      if (el) {
        try {
          el.focus();
        } catch {}
        // try to bring it into view
        try {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch {}
      }
    }, 220);

    return () => clearTimeout(id);
  }, [selectedNode]);

  if (!selectedNode) return null;

  return (
    <div className="flex flex-1 flex-col">
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 p-4">
          {nodeThreads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => ctx.selectThread(thread.id)}
              onMouseEnter={() =>
                ctx.setPreviewNode(threadNodeIdentity(thread))
              }
              onMouseLeave={() => ctx.setPreviewNode(null)}
              aria-label={`Open thread on ${selectedNode.textSnippet ?? selectedNode.nodeType}, ${thread.status}, ${thread.messages.length} ${thread.messages.length === 1 ? "reply" : "replies"}`}
              className="group flex flex-col gap-2 rounded-xl border p-4 text-left transition-all duration-[var(--va-annotation-fast)] ease-[var(--va-annotation-ease-standard)] hover:border-muted-foreground/20 hover:bg-muted/50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-foreground">
                  {thread.messages.length}{" "}
                  {thread.messages.length === 1 ? "reply" : "replies"}
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

      <div className="border-t p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:sticky md:bottom-0 md:z-10 md:bg-card">
        <MessageComposer
          value={draftText}
          onChange={setDraftText}
          onSubmit={() => handleSubmit()}
          placeholder="Start a comment..."
          buttonLabel="Post"
          shortcutSuffix="post"
          isSubmitting={isSubmitting}
          textareaId="create-thread-textarea"
          ariaLabel="Start a comment"
          size="comfortable"
        />
      </div>
    </div>
  );
}

function ThreadStatusBadge({ status }: { status: "open" | "resolved" }) {
  if (status === "resolved") {
    return (
      <>
        <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <CheckCircle2 className="size-3" />
          <span>Resolved</span>
        </span>
        <Badge variant="secondary" className="gap-1 md:hidden">
          <CheckCircle2 className="size-3" />
          Resolved
        </Badge>
      </>
    );
  }
  return (
    <>
      <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <span className="inline-block h-2 w-2 rounded-full bg-clay" />
        <span>Open</span>
      </span>
      <Badge variant="outline" className="gap-1 md:hidden">
        <Circle className="size-3" />
        Open
      </Badge>
    </>
  );
}

function TimeLabel({ date }: { date: string }) {
  return useMemo(() => formatAnnotationTime(date), [date]);
}

function shortcutLabel(): string {
  if (
    typeof navigator !== "undefined" &&
    navigator.platform?.toLowerCase().includes("mac")
  ) {
    return "⌘ + Enter";
  }
  return "Ctrl + Enter";
}
