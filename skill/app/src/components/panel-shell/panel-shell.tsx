"use client"

import { cn } from "@/lib/utils"

interface PanelShellProps {
  /**
   * Whether the panel is currently revealed. When false the panel is moved
   * off-screen, hidden from assistive tech, and made pointer-inert so the
   * artifact canvas stays fully tappable.
   */
  open: boolean
  /** Accessibility label for the revealed panel. */
  ariaLabel: string
  children: React.ReactNode
}

export function PanelShell({ open, ariaLabel, children }: PanelShellProps) {
  return (
    <aside
      className={cn(
        "va-panel fixed right-0 top-14 z-30 flex h-[calc(100vh-3.5rem)] h-[calc(100dvh-3.5rem)] w-full flex-col border-l bg-card/95 shadow-sm backdrop-blur-sm md:w-[var(--va-annotation-panel-width)]",
        open
          ? "va-panel-open visible translate-x-0 opacity-100"
          : "invisible translate-x-5 opacity-0 pointer-events-none",
      )}
      data-state={open ? "open" : "closed"}
      aria-hidden={!open}
      inert={!open}
      role={open ? "complementary" : undefined}
      aria-label={open ? ariaLabel : undefined}
    >
      {children}
    </aside>
  )
}