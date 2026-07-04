"use client"

import { Crosshair, MessageSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAnnotationContext } from "@/components/annotation-provider"

export function AnnotationToggle() {
  const ctx = useAnnotationContext()
  const active = ctx.isCommentMode

  return (
    <Button
      variant={active ? "secondary" : "outline"}
      size="sm"
      onClick={() => (active ? ctx.closeComments() : ctx.openComments())}
      aria-pressed={active}
      aria-label={active ? "Close comments" : "Open comments"}
      className="rounded-full"
    >
      <MessageSquare data-icon="inline-start" />
      <span className="hidden sm:inline">Comments</span>
      {ctx.totalThreadCount > 0 && (
        <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0 text-[10px] font-medium">
          {ctx.totalThreadCount}
        </span>
      )}
    </Button>
  )
}

export function NodePickToggle() {
  const ctx = useAnnotationContext()
  const active = ctx.isPickingNode

  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={() => (active ? ctx.stopNodePick() : ctx.startNodePick())}
      aria-pressed={active}
      aria-label={active ? "Stop picking a node" : "Pick a node to comment"}
      title={active ? "Stop picking a node" : "Pick a node to comment"}
      className="rounded-full"
    >
      <Crosshair data-icon="only" />
      <span className="sr-only">Pick a node to comment</span>
    </Button>
  )
}
