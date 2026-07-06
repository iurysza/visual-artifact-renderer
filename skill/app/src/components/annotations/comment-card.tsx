"use client"

import { useMemo } from "react"
import { AlertTriangle, CheckCircle2, Circle, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { formatAnnotationTime } from "@/components/panel-shell/format-annotation-time"
import { useAnchorPresence } from "@/hooks/use-anchor-presence"
import { cn } from "@/lib/utils"
import type { CommentListItem } from "./comment-list-item"

interface CommentCardProps {
  item: CommentListItem
  onClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onDelete?: () => void
  ariaLabelPrefix?: string
}

export function CommentCard({
  item,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onDelete,
  ariaLabelPrefix = "Comment",
}: CommentCardProps) {
  const isNode = item.target.kind === "node"
  const isPresent = useAnchorPresence(
    isNode ? item.target.nodeId : undefined,
    isNode ? item.target.nodePath ?? "" : "",
  )
  const replyLabel = useMemo(() => {
    if (typeof item.replyCount !== "number") return undefined
    return `${item.replyCount} ${item.replyCount === 1 ? "reply" : "replies"}`
  }, [item.replyCount])
  const dateInput = item.updatedAt ?? item.createdAt
  const dateLabel = dateInput ? formatAnnotationTime(dateInput) : undefined

  const ariaLabel = [
    `${ariaLabelPrefix} on ${item.target.label}`,
    item.status,
    replyLabel,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        aria-label={ariaLabel}
        className={cn(
          "group flex w-full flex-col gap-2 md:gap-1 rounded-xl md:rounded-lg border p-4 md:p-3 text-left transition-all duration-[var(--va-annotation-fast)] ease-[var(--va-annotation-ease-standard)]",
          "hover:border-muted-foreground/20 hover:bg-muted/50",
          item.isActive && "border-clay/40 bg-clay/[0.04]",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="line-clamp-1 text-sm md:text-sm font-medium text-foreground">
            {item.target.label}
          </span>
          <div
            className={cn(
              "flex shrink-0 items-center gap-2",
              onDelete && "pr-6",
            )}
          >
            {!isPresent && isNode && (
              <span
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                title="Anchor not found"
              >
                <AlertTriangle className="size-3" />
              </span>
            )}
            {item.status && <ThreadStatusBadge status={item.status} />}
          </div>
        </div>
        <p className="line-clamp-2 text-xs text-muted-foreground md:truncate md:overflow-hidden">
          {item.body}
        </p>
        <p className="text-[10px] text-muted-foreground flex items-center gap-2">
          {item.authorName && (
            <span className="hidden md:inline text-[11px] text-muted-foreground">
              {item.authorName} ·
            </span>
          )}
          {replyLabel && <span>{replyLabel}</span>}
          {replyLabel && dateLabel && <span>·</span>}
          {dateLabel && <span>{dateLabel}</span>}
        </p>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="absolute right-3 top-3 text-muted-foreground transition-colors hover:text-destructive"
          aria-label="Delete comment"
          title="Delete comment"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export function ThreadStatusBadge({
  status,
}: {
  status: "open" | "resolved"
}) {
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
    )
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
  )
}
