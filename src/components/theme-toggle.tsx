"use client"

import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"

export function ThemeToggle({ className }: { className?: string }) {
  const { setTheme } = useTheme()

  function toggleTheme() {
    const dark = !document.documentElement.classList.contains("dark")
    setTheme(dark ? "dark" : "light")
  }

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
      <span className="dark:hidden">Dark</span>
      <span className="hidden dark:inline">Light</span>
    </button>
  )
}
