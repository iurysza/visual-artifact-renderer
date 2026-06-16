"use client"

import { useEffect, useMemo, useState } from "react"

import { cn } from "@/lib/utils"

const THEME_BRIDGE = `
<script>
  (function () {
    try {
      const key = "visualizer-theme"
      const stored = localStorage.getItem(key)
      const dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches
      document.documentElement.classList.toggle("dark", dark)
      document.documentElement.style.colorScheme = dark ? "dark" : "light"
    } catch (e) {}
  })()
</script>
`

function injectThemeBridge(html: string): string {
  if (html.includes("</head>")) {
    return html.replace("</head>", `${THEME_BRIDGE}</head>`)
  }
  if (html.includes("<body>")) {
    return html.replace("<body>", `${THEME_BRIDGE}<body>`)
  }
  return `${THEME_BRIDGE}${html}`
}

export function SvgDiagram({
  html,
  title,
  caption,
  height = 720,
  className,
}: {
  html: string
  title?: string
  caption?: string
  height?: number
  className?: string
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const srcDoc = useMemo(() => injectThemeBridge(html), [html])

  return (
    <figure className={cn("flex flex-col gap-3", className)}>
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
      {mounted ? (
        <iframe
          title={title ?? "Interactive SVG diagram"}
          sandbox="allow-scripts"
          srcDoc={srcDoc}
          className="w-full rounded-xl border bg-background"
          style={{ height }}
        />
      ) : (
        <div
          className="w-full rounded-xl border bg-muted/30"
          style={{ height }}
          aria-label="Loading diagram"
        />
      )}
    </figure>
  )
}
