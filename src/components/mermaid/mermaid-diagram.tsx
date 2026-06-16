"use client"

import { useEffect, useId, useMemo, useState } from "react"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

import { Figure } from "@/components/artifact-primitives"
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
  title,
  caption,
  height = 420,
}: {
  code: string
  title?: string
  caption?: string
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

          return mermaid.render(`${diagramId}-${theme}`, code)
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
  }, [code, diagramId, theme])

  return (
    <Figure
      title={title}
      caption={caption}
      error={error ?? undefined}
      loading={!svg && !error}
      loadingLabel="Rendering Mermaid…"
      height={height}
    >
      <ZoomableMermaidViewport
        height={height}
        instructionsId={`${diagramId}-instructions`}
        svg={svg}
      />
    </Figure>
  )
}

function ZoomableMermaidViewport({
  svg,
  height,
  instructionsId,
}: {
  svg: string
  height: number
  instructionsId: string
}) {
  const [isMaximized, setIsMaximized] = useState(false)

  return (
    <>
      <MermaidViewport
        svg={svg}
        height={height}
        instructionsId={instructionsId}
        onToggleMaximize={() => setIsMaximized(true)}
      />
      <Dialog open={isMaximized} onOpenChange={setIsMaximized}>
        <DialogContent
          className="gap-0 overflow-hidden rounded-2xl p-0"
          style={{
            width: "min(calc(100vw - 1rem), 80rem)",
            maxWidth: "calc(100vw - 1rem)",
            height: "80dvh",
            maxHeight: "calc(100dvh - 1rem)",
          }}
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Maximized Mermaid diagram</DialogTitle>
          </DialogHeader>
          <div className="flex h-full min-h-0 flex-col gap-3 p-3 sm:p-4">
            <MermaidViewport
              svg={svg}
              height="100%"
              instructionsId={`${instructionsId}-maximized`}
              isMaximized
              onToggleMaximize={() => setIsMaximized(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
