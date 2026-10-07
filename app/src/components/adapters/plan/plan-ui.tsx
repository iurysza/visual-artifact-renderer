// Small presentational pieces shared by the plan adapters.
import type { ReactNode } from "react"

import type { ChangeMark } from "@/lib/contract/artifact-manifest"
import { cn } from "@/lib/utils"

export const MARK_GLYPH: Record<ChangeMark, string> = {
  added: "+",
  removed: "−",
  changed: "~",
  proposed: "?",
  context: "",
}

export const MARK_LABEL: Record<ChangeMark, string> = {
  added: "added",
  removed: "removed",
  changed: "changed",
  proposed: "proposed",
  context: "unchanged",
}

export function markTextClass(mark: ChangeMark | undefined): string {
  switch (mark) {
    case "added":
    case "proposed":
      return "text-change-added"
    case "changed":
      return "text-change-changed"
    case "removed":
      return "text-change-removed"
    default:
      return "text-muted-foreground"
  }
}

export function markRowClass(mark: ChangeMark | undefined): string {
  switch (mark) {
    case "added":
      return "bg-change-added/10"
    case "proposed":
      return "bg-change-added/[0.06]"
    case "changed":
      return "bg-change-changed/10"
    case "removed":
      return "bg-change-removed/10"
    default:
      return ""
  }
}

/** Stroke colour for SVG diagrams. */
export function markStroke(mark: ChangeMark | undefined): string {
  switch (mark) {
    case "added":
    case "proposed":
      return "var(--change-added)"
    case "changed":
      return "var(--change-changed)"
    case "removed":
      return "var(--change-removed)"
    default:
      return "var(--muted-foreground)"
  }
}

/** Renders `**bold**` spans; everything else is plain text. */
export function InlineBold({ text, boldClassName }: { text: string; boldClassName?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
          <strong key={index} className={cn("font-semibold", boldClassName)}>
            {part.slice(2, -2)}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  )
}

/** Dark mono header strip used by call stacks and diagrams ("calls · The list"). */
export function PlanHeader({ chip, title, right }: { chip: string; title?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-muted/60 px-4 py-2 font-mono text-xs">
      <span className="rounded bg-foreground px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-background">{chip}</span>
      {title && <span className="min-w-[12rem] flex-1 break-words font-semibold text-foreground">{title}</span>}
      {right && <span className="ml-auto flex flex-wrap items-center gap-2 text-muted-foreground">{right}</span>}
    </div>
  )
}

export function PlanFrame({ children, className, ...rest }: { children: ReactNode; className?: string } & Record<`data-${string}`, string | undefined>) {
  return (
    <figure className={cn("overflow-hidden rounded-xl border bg-card", className)} {...rest}>
      {children}
    </figure>
  )
}

export function PlanCaption({ children }: { children: ReactNode }) {
  return <figcaption className="border-t px-4 py-2 text-sm leading-6 text-muted-foreground">{children}</figcaption>
}
