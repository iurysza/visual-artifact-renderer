"use client"

import { useMemo, useSyncExternalStore } from "react"

import { Figure } from "@/components/artifact-primitives"

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
  height = "min(720px, 70vh)",
  className,
}: {
  html: string
  title?: string
  caption?: string
  height?: number | string
  className?: string
}) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  const srcDoc = useMemo(() => injectThemeBridge(html), [html])

  return (
    <Figure title={title} caption={caption} className={className}>
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
    </Figure>
  )
}
