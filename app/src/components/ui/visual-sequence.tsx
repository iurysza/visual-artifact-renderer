"use client"

import { useId, useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

export type VisualSequenceItem = {
  title: string
  description?: string
}

export type VisualSequenceProps = {
  title?: string
  caption?: string
  items: VisualSequenceItem[]
  renderFrame: (index: number) => ReactNode
}

export function VisualSequence({
  title,
  caption,
  items,
  renderFrame,
}: VisualSequenceProps) {
  const [requestedIndex, setRequestedIndex] = useState(0)
  const titleId = useId()
  const currentIndex = Math.min(requestedIndex, items.length - 1)
  const currentItem = items[currentIndex]
  const progress = ((currentIndex + 1) / items.length) * 100

  const goTo = (index: number) => {
    setRequestedIndex(Math.max(0, Math.min(index, items.length - 1)))
  }

  return (
    <section
      className="overflow-hidden rounded-xl border bg-card"
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : "Visual sequence"}
    >
      <div className="flex flex-col gap-4 border-b px-4 py-4 sm:px-5">
        {(title || caption) && (
          <div className="flex flex-col gap-1">
            {title && (
              <h3 id={titleId} className="text-balance font-serif text-2xl font-medium tracking-[-0.02em]">
                {title}
              </h3>
            )}
            {caption && (
              <p className="max-w-[70ch] text-sm leading-6 text-muted-foreground">
                {caption}
              </p>
            )}
          </div>
        )}
        <div className="flex items-center gap-3">
          <Progress
            value={progress}
            className="flex-1 gap-0"
            aria-label={`Step ${currentIndex + 1} of ${items.length}`}
          />
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {currentIndex + 1} / {items.length}
          </span>
        </div>
      </div>

      <div className="flex min-h-56 flex-col gap-5 px-4 py-5 sm:px-5">
        <p className="sr-only" aria-live="polite">
          Step {currentIndex + 1}: {currentItem.title}
        </p>
        <div className="flex flex-col gap-1">
          <h4 className="text-balance font-serif text-xl font-medium tracking-[-0.015em]">
            {currentItem.title}
          </h4>
          {currentItem.description && (
            <p className="max-w-[70ch] break-words text-sm leading-6 text-muted-foreground">
              {currentItem.description}
            </p>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-5">{renderFrame(currentIndex)}</div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t px-4 py-3 sm:px-5">
        <Button
          type="button"
          variant="outline"
          disabled={currentIndex === 0}
          onClick={(event) => {
            event.stopPropagation()
            goTo(currentIndex - 1)
          }}
        >
          Previous
        </Button>
        <Button
          type="button"
          disabled={currentIndex === items.length - 1}
          onClick={(event) => {
            event.stopPropagation()
            goTo(currentIndex + 1)
          }}
        >
          Next
        </Button>
      </div>
    </section>
  )
}
