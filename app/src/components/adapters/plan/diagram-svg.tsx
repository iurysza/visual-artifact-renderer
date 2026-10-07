// SVG building blocks shared by box-diagram and state-machine.
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function ArrowDefs({ id }: { id: string }) {
  const marker = (suffix: string, color: string) => (
    <marker id={`${id}-${suffix}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill={color} />
    </marker>
  )
  return (
    <defs>
      {marker("muted", "var(--muted-foreground)")}
      {marker("added", "var(--change-added)")}
      {marker("changed", "var(--change-changed)")}
      {marker("removed", "var(--change-removed)")}
    </defs>
  )
}

export function markerFor(id: string, mark: string | undefined) {
  if (mark === "added" || mark === "proposed") return `url(#${id}-added)`
  if (mark === "changed") return `url(#${id}-changed)`
  if (mark === "removed") return `url(#${id}-removed)`
  return `url(#${id}-muted)`
}

/** Dot-grid canvas that scrolls horizontally on narrow screens with a fade mask. */
export function DiagramCanvas({ width, height, label, children }: { width: number; height: number; label: string; children: ReactNode }) {
  return (
    <div className="va-scroll-fade va-dot-grid" tabIndex={0} role="region" aria-label={`${label} (scrolls horizontally)`}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="mx-auto block max-w-none"
        role="img"
        aria-label={label}
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {children}
      </svg>
    </div>
  )
}

export function EdgeLabel({ x, y, text, className }: { x: number; y: number; text: string; className?: string }) {
  const w = Math.min(220, text.length * 6.4 + 10)
  return (
    <g className={cn("pointer-events-none", className)}>
      <rect x={x - w / 2} y={y - 9} width={w} height={16} rx={4} fill="var(--card)" opacity={0.92} />
      <text x={x} y={y + 3} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)" fontFamily="var(--font-mono)">
        {text}
      </text>
    </g>
  )
}
