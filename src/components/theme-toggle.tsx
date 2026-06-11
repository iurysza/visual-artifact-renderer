"use client"

const STORAGE_KEY = "visualizer-theme"

function toggleTheme() {
  const root = document.documentElement
  const dark = !root.classList.contains("dark")

  root.classList.toggle("dark", dark)
  root.style.colorScheme = dark ? "dark" : "light"
  localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light")
}

export function ThemeToggle() {
  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      className="fixed right-4 top-4 z-50 rounded-full border bg-card/90 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:right-6 sm:top-6"
      onClick={toggleTheme}
    >
      <span className="dark:hidden">Dark</span>
      <span className="hidden dark:inline">Light</span>
    </button>
  )
}
