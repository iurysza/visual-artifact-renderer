"use client"

import * as React from "react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export type LogProps = React.ComponentProps<"div"> & {
  lines?: string[]
  dataKey?: string
  data?: Record<string, unknown>
  variant?: "default" | "dark"
  showLineNumbers?: boolean
}

function resolveLines(
  lines: string[] | undefined,
  dataKey: string | undefined,
  data: Record<string, unknown> | undefined
): string[] {
  if (lines) return lines

  if (dataKey && data) {
    const value = data[dataKey]

    if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
      return value as string[]
    }
  }

  return []
}

export function Log({
  lines,
  dataKey,
  data,
  variant = "default",
  showLineNumbers = false,
  className,
  ...props
}: LogProps) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const resolvedLines = React.useMemo(
    () => resolveLines(lines, dataKey, data),
    [lines, dataKey, data]
  )

  React.useEffect(() => {
    const viewport = rootRef.current?.querySelector(
      "[data-slot='scroll-area-viewport']"
    )

    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight
    }
  }, [resolvedLines])

  const isDark = variant === "dark"

  return (
    <div
      ref={rootRef}
      data-slot="log"
      className={cn(
        "flex h-80 flex-col overflow-hidden rounded-2xl border-[1.5px] shadow-[0_10px_34px_rgba(20,20,19,0.06)] dark:shadow-black/20",
        isDark
          ? "border-slate-800 bg-slate-950 text-slate-50"
          : "border-border bg-card/95 text-card-foreground",
        className
      )}
      {...props}
    >
      <ScrollArea className="flex-1 min-h-0">
        <div
          role="log"
          aria-live="polite"
          aria-atomic="false"
          className={cn(
            "min-w-full p-4 font-mono text-sm leading-6",
            isDark ? "bg-slate-950 text-slate-50" : "bg-muted/40 text-foreground"
          )}
        >
          {resolvedLines.length === 0 ? (
            <span
              className={cn(
                "block italic",
                isDark ? "text-slate-500" : "text-muted-foreground"
              )}
            >
              No output
            </span>
          ) : (
            resolvedLines.map((line, index) => (
              <div
                key={index}
                className={cn(
                  "grid gap-3",
                  showLineNumbers && "grid-cols-[2rem_1fr]"
                )}
              >
                {showLineNumbers && (
                  <span
                    className={cn(
                      "select-none text-right tabular-nums",
                      isDark ? "text-slate-500" : "text-muted-foreground"
                    )}
                  >
                    {index + 1}
                  </span>
                )}
                <span className="whitespace-pre-wrap break-words">{line}</span>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
