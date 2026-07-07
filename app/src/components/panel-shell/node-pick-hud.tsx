"use client"

import { useEffect } from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface NodePickHUDProps {
  isPicking: boolean
  /** Prefix for the confirm/cancel button DOM ids (focus target). */
  domIdPrefix: string
  hasCandidate: boolean
  onConfirm: () => void
  onStop: () => void
  /** Optional content shown on the left (e.g. instruction/snippet). */
  children?: React.ReactNode
}

export function NodePickHUD({
  isPicking,
  domIdPrefix,
  hasCandidate,
  onConfirm,
  onStop,
  children,
}: NodePickHUDProps) {
  useEffect(() => {
    if (!isPicking) return
    const el = document.getElementById(`${domIdPrefix}-cancel`) as HTMLElement | null
    if (el) el.focus()
  }, [isPicking, domIdPrefix])

  if (!isPicking) return null

  const confirmId = `${domIdPrefix}-confirm`
  const cancelId = `${domIdPrefix}-cancel`

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 bottom-6 z-50 w-[min(92%,20rem)] -translate-x-1/2 rounded-lg border bg-card/95 p-3 shadow-sm backdrop-blur-sm"
    >
      <div
        className={cn(
          "flex items-start gap-3",
          children ? "justify-between" : "justify-end gap-2",
        )}
      >
        {children}
        <div className="flex items-start gap-2">
          {hasCandidate ? (
            <>
              <Button
                id={confirmId}
                size="lg"
                onClick={onConfirm}
                aria-label="Confirm pick"
              >
                Comment on this
              </Button>
              <Button
                id={cancelId}
                size="lg"
                variant="ghost"
                onClick={onStop}
                aria-label="Cancel picking"
              >
                <X />
                <span>Cancel</span>
              </Button>
            </>
          ) : (
            <Button
              id={cancelId}
              size="lg"
              variant="ghost"
              onClick={onStop}
              aria-label="Cancel picking"
            >
              <X />
              <span>Cancel</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}