"use client"

// mockup: a drawn frame (browser/phone/desktop/terminal) around sketch content.
// Content is non-interactive via CSS ([data-mock-surface]), not `inert`, so
// comment-mode node picking still works. Pins sit in an overlay above it.
import { useLayoutEffect, useRef, useState, type ReactNode } from "react"

import type { AdapterArgs } from "@/components/artifact-types"
import { cn } from "@/lib/utils"

import { MARK_LABEL, markTextClass } from "./plan-ui"

function Chrome({ frame, label, children }: { frame: string; label?: string; children: ReactNode }) {
  if (frame === "browser" || frame === "desktop") {
    return (
      <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
        <div className="flex items-center gap-2 border-b bg-muted/70 px-3 py-2">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-change-removed/60" />
            <span className="size-2.5 rounded-full bg-change-changed/60" />
            <span className="size-2.5 rounded-full bg-change-added/60" />
          </span>
          {frame === "browser" ? (
            <span className="ml-2 min-w-0 flex-1 truncate rounded-md bg-background px-3 py-0.5 font-mono text-xs text-muted-foreground">{label ?? "localhost"}</span>
          ) : (
            <span className="ml-2 truncate text-xs font-medium text-muted-foreground">{label}</span>
          )}
        </div>
        {children}
      </div>
    )
  }
  if (frame === "phone") {
    return (
      <div className="mx-auto w-full max-w-[22rem] rounded-[2rem] border-[6px] border-foreground/80 bg-background p-1 shadow-sm">
        <div className="mx-auto mb-1 h-1.5 w-16 rounded-full bg-foreground/20" aria-hidden="true" />
        <div className="overflow-hidden rounded-[1.4rem]">{children}</div>
        {label && <p className="mt-1 text-center text-[11px] text-muted-foreground">{label}</p>}
      </div>
    )
  }
  if (frame === "terminal") {
    return (
      <div className="overflow-hidden rounded-lg border border-foreground/20 bg-[color-mix(in_oklch,var(--foreground),var(--background)_92%)] shadow-sm">
        <div className="border-b border-foreground/10 px-3 py-1.5 font-mono text-[11px] text-muted-foreground">{label ?? "terminal"}</div>
        {children}
      </div>
    )
  }
  return <div className="rounded-lg border border-dashed bg-background">{children}</div>
}

export function renderMockup({ node, children }: AdapterArgs<"mockup">) {
  const { frame, width, label, caption, pins } = node.props
  return (
    <figure className="space-y-2" data-frame={frame} data-mockup>
      <div className="relative mx-auto" style={{ maxWidth: width ? `${width}px` : undefined }}>
        <Chrome frame={frame} label={label}>
          <div data-mock-surface className="space-y-3 p-4 text-sm" aria-roledescription="mockup">
            {children}
          </div>
        </Chrome>
        {pins && pins.length > 0 && <PinOverlay pins={pins} />}
      </div>
      {(pins?.length || caption) && (
        <figcaption className="space-y-1 text-sm text-muted-foreground">
          {pins && pins.length > 0 && (
            <ol className="space-y-1">
              {pins.map((pin, index) => (
                <li key={index} className="flex gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-clay font-mono text-[11px] font-semibold text-white">{pin.n ?? index + 1}</span>
                  <span>
                    {pin.target && <code className="mr-1 rounded bg-muted px-1 text-xs">{pin.target}</code>}
                    {pin.text}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {caption && <p>{caption}</p>}
        </figcaption>
      )}
    </figure>
  )
}

type Pin = { n?: number; target?: string; x?: number; y?: number; text: string }

/** Positions numbered badges: x/y pins by fraction, target pins on the target node's top-right corner. */
function PinOverlay({ pins }: { pins: Pin[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [spots, setSpots] = useState<({ left: string; top: string } | null)[]>([])
  useLayoutEffect(() => {
    const overlay = ref.current
    const frame = overlay?.parentElement
    if (!overlay || !frame) return
    const measure = () => {
      const base = frame.getBoundingClientRect()
      setSpots(
        pins.map((pin) => {
          if (pin.x !== undefined && pin.y !== undefined) return { left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }
          const el = pin.target ? frame.querySelector(`[data-va-node-id="${CSS.escape(pin.target)}"]`) : null
          if (!el) return null
          const rect = el.getBoundingClientRect()
          return { left: `${rect.right - base.left - 4}px`, top: `${rect.top - base.top + 4}px` }
        }),
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [pins])
  return (
    <div ref={ref} className="pointer-events-none absolute inset-0" aria-hidden="true">
      {pins.map((pin, index) =>
        spots[index] ? (
          <span
            key={index}
            data-pin={pin.n ?? index + 1}
            className="absolute flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-clay font-mono text-[11px] font-semibold text-white shadow ring-2 ring-background"
            style={spots[index]!}
          >
            {pin.n ?? index + 1}
          </span>
        ) : null,
      )}
    </div>
  )
}

const box = "rounded-md border bg-background"

export function renderWireframe({ node }: AdapterArgs<"wireframe">) {
  const { element, text, items, lines = 3, state, mark } = node.props
  const markClass = mark && mark !== "context" ? cn("ring-2 ring-offset-1 ring-offset-background", mark === "removed" ? "ring-change-removed/60" : mark === "changed" ? "ring-change-changed/60" : "ring-change-added/60 ring-dashed") : undefined
  const tag = mark && mark !== "context" ? <span className={cn("ml-auto font-mono text-[10px] uppercase", markTextClass(mark))}>{MARK_LABEL[mark]}</span> : null
  const disabled = state === "disabled" && "opacity-50"
  const error = state === "error" && "border-change-removed"
  const wrap = (content: ReactNode, className?: string) => (
    <div className={cn(markClass, disabled, className)} data-wireframe={element} data-state={state}>
      {content}
    </div>
  )
  switch (element) {
    case "navbar":
      return wrap(
        <div className={cn(box, "flex items-center gap-4 px-3 py-2")}>
          <span className="font-semibold">{text ?? "App"}</span>
          {(items ?? []).map((item, i) => (
            <span key={i} className={cn("text-muted-foreground", i === 0 && state === "active" && "text-foreground underline underline-offset-4")}>{item}</span>
          ))}
          {tag}
        </div>,
      )
    case "sidebar":
      return wrap(
        <div className={cn(box, "w-44 space-y-1 p-2")}>
          {(items ?? ["Item"]).map((item, i) => (
            <div key={i} className={cn("rounded px-2 py-1", i === 0 ? "bg-muted font-medium" : "text-muted-foreground")}>{item}</div>
          ))}
        </div>,
      )
    case "input":
    case "select":
      return wrap(
        <label className="block space-y-1">
          {text && <span className="text-xs font-medium">{text}</span>}
          <span className={cn(box, error, "flex h-9 items-center justify-between px-3 text-muted-foreground")}>
            {items?.[0] ?? "…"}
            {element === "select" && <span aria-hidden="true">▾</span>}
          </span>
          {tag}
        </label>,
      )
    case "textarea":
      return wrap(
        <label className="block space-y-1">
          {text && <span className="text-xs font-medium">{text}</span>}
          <span className={cn(box, error, "block h-20 px-3 py-2 text-muted-foreground")}>{items?.[0] ?? ""}</span>
        </label>,
      )
    case "toggle":
    case "checkbox": {
      const on = state === "checked" || state === "active"
      return wrap(
        <span className="flex items-center gap-2">
          {element === "toggle" ? (
            <span className={cn("flex h-5 w-9 items-center rounded-full p-0.5", on ? "justify-end bg-foreground" : "bg-muted")}>
              <span className="size-4 rounded-full bg-background shadow" />
            </span>
          ) : (
            <span className={cn("flex size-4 items-center justify-center rounded border text-[10px]", on && "bg-foreground text-background")}>{on ? "✓" : ""}</span>
          )}
          <span>{text}</span>
          {tag}
        </span>,
      )
    }
    case "avatar":
      return wrap(
        <span className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-muted font-medium">{(text ?? "?").slice(0, 1).toUpperCase()}</span>
          {text && <span>{text}</span>}
        </span>,
      )
    case "placeholder":
      return wrap(
        <div className={cn("flex min-h-24 items-center justify-center rounded-md border border-dashed bg-muted/40 text-xs text-muted-foreground", "[background-image:linear-gradient(135deg,transparent_48%,var(--border)_49%,var(--border)_51%,transparent_52%)]")}>
          <span className="rounded bg-background px-1.5">{text ?? "placeholder"}</span>
        </div>,
      )
    case "skeleton-lines":
      return wrap(
        <div className="space-y-2" aria-label={text ?? "loading"}>
          {Array.from({ length: lines }, (_, i) => (
            <div key={i} className="h-2.5 rounded bg-muted" style={{ width: `${i === lines - 1 ? 60 : 100 - i * 6}%` }} />
          ))}
        </div>,
      )
    case "toast":
      return wrap(
        <div className={cn(box, "ml-auto flex max-w-xs items-center gap-2 px-3 py-2 shadow-md", state === "error" && "border-change-removed")}>
          <span className={cn("size-2 rounded-full", state === "error" ? "bg-change-removed" : "bg-change-added")} />
          <span>{text}</span>
          {tag}
        </div>,
      )
    case "modal-scrim":
      return wrap(
        <div className="rounded-md bg-foreground/15 p-6">
          <div className={cn(box, "mx-auto max-w-sm space-y-2 p-4 shadow-lg")}>
            <p className="font-semibold">{text ?? "Dialog"}</p>
            <div className="flex justify-end gap-2">
              {(items ?? ["Cancel", "OK"]).map((item, i) => (
                <span key={i} className={cn("rounded-md border px-2.5 py-1 text-xs", i === (items?.length ?? 2) - 1 && "bg-foreground text-background")}>{item}</span>
              ))}
            </div>
          </div>
        </div>,
      )
    case "divider":
      return wrap(
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          {text}
          {text && <span className="h-px flex-1 bg-border" />}
        </div>,
      )
    case "prompt":
      return wrap(
        <p className="font-mono text-[13px]">
          <span className="text-change-added">❯</span> {text}
          {tag}
        </p>,
      )
    case "output":
      return wrap(
        <pre className={cn("whitespace-pre-wrap font-mono text-[12.5px] leading-5", state === "error" ? "text-change-removed" : "text-muted-foreground")}>{[text, ...(items ?? [])].filter(Boolean).join("\n")}</pre>,
      )
    case "spinner":
      return wrap(
        <span className="flex items-center gap-2 text-muted-foreground">
          <span className="size-3.5 animate-spin rounded-full border-2 border-muted border-t-foreground motion-reduce:animate-none" aria-hidden="true" />
          {text ?? "Loading…"}
        </span>,
      )
  }
}
