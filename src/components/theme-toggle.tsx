"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"

function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}

export function ThemeToggle({ className }: { className?: string }) {
  const { setTheme, resolvedTheme } = useTheme()
  const mounted = useMounted()

  function toggleTheme() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  // Render a stable label during SSR/hydration to avoid a mismatch, then
  // switch to the action label once the theme has resolved on the client.
  const label = mounted
    ? resolvedTheme === "dark"
      ? "Light"
      : "Dark"
    : "Theme"

  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      className={cn(
        "rounded-full border bg-card/90 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      onClick={toggleTheme}
    >
      {label}
    </button>
  )
}
