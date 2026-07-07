"use client"

import { useEffect, useId, useMemo, useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { MermaidViewport } from "./mermaid-viewport"

let mermaidRenderQueue: Promise<unknown> = Promise.resolve()

function runWithTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Mermaid render timed out after ${ms}ms`))
    }, ms)

    fn().then(
      (result) => {
        clearTimeout(timeoutId)
        resolve(result)
      },
      (error) => {
        clearTimeout(timeoutId)
        reject(error)
      }
    )
  })
}

function enqueueMermaidRender<T>(renderFn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = async () => {
      try {
        const result = await runWithTimeout(renderFn, 10000)
        resolve(result)
        return result
      } catch (error) {
        reject(error)
        return undefined
      }
    }

    mermaidRenderQueue = mermaidRenderQueue.then(run, run)
  })
}

export function MermaidDiagram({
  code,
  caption,
  height = 420,
}: {
  code: string
  caption: string
  height?: number
}) {
  const rawId = useId()
  const diagramId = useMemo(
    () => `mermaid-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [rawId]
  )
  const [theme, setTheme] = useState<"default" | "dark">("default")
  const [svg, setSvg] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isMaximized, setIsMaximized] = useState(false)

  const normalizedCode = useMemo(
    () =>
      code.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\\\/g, "\\"),
    [code]
  )

  useEffect(() => {
    const syncTheme = () =>
      setTheme(
        document.documentElement.classList.contains("dark") ? "dark" : "default"
      )

    syncTheme()

    const observer = new MutationObserver(syncTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false

    async function renderDiagram() {
      try {
        setError(null)
        setSvg("")

        const rendered = await enqueueMermaidRender(async () => {
          const { default: mermaid } = await import("mermaid")

          mermaid.initialize({
            startOnLoad: false,
            theme,
            securityLevel: "strict",
            fontFamily: "var(--font-geist-sans)",
          })

          await mermaid.parse(normalizedCode)

          return mermaid.render(`${diagramId}-${theme}`, normalizedCode)
        })

        if (!cancelled) {
          setSvg(rendered.svg)
        }
      } catch (renderError) {
        if (!cancelled) {
          setError(
            renderError instanceof Error
              ? renderError.message
              : "Could not render Mermaid diagram"
          )
        }
      }
    }

    renderDiagram()

    return () => {
      cancelled = true
    }
  }, [normalizedCode, diagramId, theme])

  return (
    <figure className="flex flex-col gap-3">
      {error ? (
        <pre className="whitespace-pre-wrap rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </pre>
      ) : !svg ? (
        <div
          className="rounded-2xl border bg-background/60 p-4"
          style={{ minHeight: height }}
        >
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Rendering Mermaid…
          </p>
        </div>
      ) : (
        <div
          className="relative rounded-2xl bg-white p-2 shadow-[var(--shadow-card-sm)]"
          style={{ height }}
        >
          <MermaidViewport
            svg={svg}
            height={height - 16}
            instructionsId={`${diagramId}-instructions`}
            onToggleMaximize={() => setIsMaximized(true)}
          />
        </div>
      )}

      <figcaption className="break-words px-1 text-sm leading-6 text-muted-foreground">
        {caption}
      </figcaption>

      <Dialog open={isMaximized} onOpenChange={setIsMaximized}>
        <DialogContent
          className="gap-0 overflow-hidden rounded-2xl p-0"
          style={{
            width: "min(calc(100vw - 1rem), 80rem)",
            maxWidth: "calc(100vw - 1rem)",
            height: "calc(100dvh - 1rem)",
            maxHeight: "calc(100dvh - 1rem)",
          }}
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{caption}</DialogTitle>
          </DialogHeader>
          <div className="flex h-full min-h-0 flex-col gap-3 p-2">
            {error ? (
              <pre className="whitespace-pre-wrap overflow-auto rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </pre>
            ) : (
              <div className="relative flex-1 rounded-2xl bg-white p-2">
                <MermaidViewport
                  svg={svg}
                  height="100%"
                  instructionsId={`${diagramId}-instructions-maximized`}
                  isMaximized
                  onToggleMaximize={() => setIsMaximized(false)}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </figure>
  )
}
