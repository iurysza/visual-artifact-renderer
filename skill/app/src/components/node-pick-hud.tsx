"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAnnotationContext } from "@/components/annotation-provider"

export function NodePickHUD() {
  const ctx = useAnnotationContext()
  if (!ctx.isPickingNode) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 bottom-6 z-50 w-[min(92%,20rem)] -translate-x-1/2 rounded-lg border bg-card/95 p-3 shadow-sm backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Select component</p>
          <p className="text-xs text-muted-foreground">Tap any component on the page to comment</p>
        </div>
        <div className="flex items-start gap-2">
          <Button size="sm" variant="ghost" onClick={() => ctx.stopNodePick()} aria-label="Cancel picking">
            <X />
            <span className="sr-only">Cancel picking</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
