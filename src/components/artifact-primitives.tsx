"use client"

import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { statusPanelClass } from "@/lib/status"
import type { ArtifactTone } from "@/lib/artifact-schema"

export function Figure({
  title,
  caption,
  error,
  loading,
  loadingLabel = "Loading…",
  height,
  children,
  className,
}: {
  title?: string
  caption?: string
  error?: string
  loading?: boolean
  loadingLabel?: string
  height?: number | string
  children?: ReactNode
  className?: string
}) {
  return (
    <figure
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-card/80 p-4 shadow-sm",
        className
      )}
    >
      {(title || caption) && (
        <figcaption className="flex flex-col gap-1">
          {title && (
            <h3 className="font-serif text-2xl font-medium tracking-[-0.02em] text-foreground">
              {title}
            </h3>
          )}
          {caption && (
            <p className="text-sm leading-6 text-muted-foreground">{caption}</p>
          )}
        </figcaption>
      )}
      {error ? (
        <pre className="whitespace-pre-wrap rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </pre>
      ) : loading ? (
        <div
          className="rounded-xl border bg-background/60 p-4"
          style={{ minHeight: height }}
        >
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
            {loadingLabel}
          </p>
        </div>
      ) : (
        children
      )}
    </figure>
  )
}

export function PanelCard({
  tone,
  className,
  children,
}: {
  tone?: unknown
  className?: string
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        "min-h-full rounded-xl border bg-background/70 p-4",
        statusPanelClass(tone),
        className
      )}
    >
      {children}
    </div>
  )
}

export function TrendPill({
  trend,
  children,
}: {
  trend: "up" | "down" | "neutral"
  children: ReactNode
}) {
  return (
    <Badge
      variant={
        trend === "down" ? "destructive" : trend === "neutral" ? "outline" : "secondary"
      }
    >
      {children}
    </Badge>
  )
}

export function tonePanelClass(tone: ArtifactTone | undefined) {
  return cn(
    tone && tone !== "default" && "border-l-4",
    tone === "accent" && "border-l-[var(--clay)]",
    tone === "success" && "border-l-[var(--olive)]",
    tone === "warning" && "border-l-[var(--clay)]",
    tone === "danger" && "border-l-[var(--rust)]"
  )
}

export function columnsClass(columns: 1 | 2 | 3 | 4) {
  if (columns === 1) return "grid-cols-1"
  if (columns === 3) return "md:grid-cols-3"
  if (columns === 4) return "md:grid-cols-2 xl:grid-cols-4"

  return "md:grid-cols-2"
}
