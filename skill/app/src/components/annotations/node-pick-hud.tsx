"use client"

import { useEffect } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAnnotationContext } from "./annotation-provider"

export function NodePickHUD() {
  const ctx = useAnnotationContext()

  // When entering explicit pick mode, move focus to a visible, tappable
  // control so keyboard and screen reader users always have a clear target.
  useEffect(() => {
    if (!ctx.isPickingNode) return
    const el = document.getElementById("node-pick-cancel") as HTMLElement | null
    if (el) el.focus()
  }, [ctx.isPickingNode])

  if (!ctx.isPickingNode) return null

  const candidate = ctx.pickCandidateNode

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 bottom-6 z-50 w-[min(92%,20rem)] -translate-x-1/2 rounded-lg border bg-card/95 p-3 shadow-sm backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          {!candidate ? (
            <>
              <p className="text-sm font-medium">Select component</p>
              <p className="text-xs text-muted-foreground">Tap a component to select it. Scroll freely.</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Comment on</p>
              <p className="text-xs text-muted-foreground">{candidate.textSnippet ?? candidate.nodeType ?? "Selected component"}</p>
            </>
          )}
        </div>
        <div className="flex items-start gap-2">
          {candidate ? (
            <>
              <Button id="node-pick-confirm" size="lg" onClick={() => ctx.confirmNodePick()} aria-label="Confirm pick">
                Comment on this
              </Button>
              <Button id="node-pick-cancel" size="lg" variant="ghost" onClick={() => ctx.stopNodePick()} aria-label="Cancel picking">
                <X />
                <span>Cancel</span>
              </Button>
            </>
          ) : (
            <Button id="node-pick-cancel" size="lg" variant="ghost" onClick={() => ctx.stopNodePick()} aria-label="Cancel picking">
              <X />
              <span>Cancel</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
