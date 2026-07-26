"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Braces,
  CheckCircle2,
  CircleDot,
  FileCode2,
  Layers3,
  ShieldCheck,
  XCircle,
} from "lucide-react"

import { Figure } from "@/components/artifact-primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DARK_CODE_THEME,
  getCodeHighlighter,
  LIGHT_CODE_THEME,
  normalizeCodeLanguage,
  useIsDarkTheme,
} from "@/lib/code-highlighting"
import { cn } from "@/lib/utils"
import type { ThemedToken } from "shiki"

import type { AdapterArgs } from "@/components/artifact-types"
import type {
  ExecutionTraceBoundaryKind,
  ExecutionTraceEvent,
  ExecutionTraceProvenance,
  ExecutionTraceTypedValue,
} from "@/lib/contract/artifact-schema"

const BOUNDARY_LABELS: Record<ExecutionTraceBoundaryKind, string> = {
  validation: "Validation",
  parse: "Parse",
  "file-read": "File read",
  "file-write": "File write",
  "process-spawn": "Process spawn",
  "network-request": "Network request",
  "registry-adapter": "Registry → adapter",
  runtime: "Runtime",
  input: "Input",
  output: "Output",
}

const SOURCE_CONTEXT_LINES = 7
const SOURCE_WINDOW_LINES = SOURCE_CONTEXT_LINES * 2 + 1

export function renderExecutionTrace({ node }: AdapterArgs<"execution-trace">) {
  return <ExecutionTraceReview {...node.props} />
}

function ExecutionTraceReview({
  title,
  caption,
  provenance,
  events,
  initialEventId,
  showCallStack = true,
}: {
  title?: string
  caption?: string
  provenance: ExecutionTraceProvenance
  events: ExecutionTraceEvent[]
  initialEventId?: string
  showCallStack?: boolean
}) {
  const orderedEvents = useMemo(
    () => [...events].sort((left, right) => left.order - right.order),
    [events],
  )
  const [selectedId, setSelectedId] = useState(
    () => orderedEvents.find((event) => event.id === initialEventId)?.id ?? orderedEvents[0]?.id ?? "",
  )
  const selectedIndex = Math.max(0, orderedEvents.findIndex((event) => event.id === selectedId))
  const selectedEvent = orderedEvents[selectedIndex] ?? orderedEvents[0]

  function moveSelection(direction: -1 | 1) {
    const nextIndex = Math.max(0, Math.min(orderedEvents.length - 1, selectedIndex + direction))
    setSelectedId(orderedEvents[nextIndex]?.id ?? "")
  }

  if (!selectedEvent) return null

  return (
    <Figure className="gap-0 overflow-hidden rounded-xl bg-background p-0 shadow-none">
      <div
        className="min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return
          if (event.key === "ArrowLeft") {
            event.preventDefault()
            moveSelection(-1)
          }
          if (event.key === "ArrowRight") {
            event.preventDefault()
            moveSelection(1)
          }
        }}
      >
        <TraceToolbar
          title={title ?? "Execution trace"}
          caption={caption}
          event={selectedEvent}
          current={selectedIndex + 1}
          total={orderedEvents.length}
          onPrevious={() => moveSelection(-1)}
          onNext={() => moveSelection(1)}
        />

        <div className="grid min-w-0 lg:grid-cols-[19rem_minmax(0,1fr)]">
          <CallStackPanel
            events={orderedEvents}
            selectedId={selectedEvent.id}
            visible={showCallStack}
            onSelect={setSelectedId}
          />

          <main className="order-1 min-w-0 lg:order-2">
            <SourcePane event={selectedEvent} />
            <EventInspector event={selectedEvent} />
          </main>
        </div>

        <TraceProvenance provenance={provenance} />
      </div>
    </Figure>
  )
}

function TraceToolbar({
  title,
  caption,
  event,
  current,
  total,
  onPrevious,
  onNext,
}: {
  title: string
  caption?: string
  event: ExecutionTraceEvent
  current: number
  total: number
  onPrevious: () => void
  onNext: () => void
}) {
  return (
    <header className="border-b bg-muted/25">
      <div className="flex flex-col lg:grid lg:grid-cols-[19rem_minmax(0,1fr)]">
        <div className="flex min-w-0 items-center gap-3 border-b px-4 py-3 lg:border-b-0 lg:border-r">
          <Layers3 className="size-4 shrink-0 text-clay-dark" />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>
            {caption && <p className="mt-0.5 break-words text-xs leading-4 text-muted-foreground">{caption}</p>}
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 px-3 py-2">
          <div className="flex items-center rounded-lg border border-clay/35 bg-background/70 p-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="min-h-10 min-w-10 text-clay-dark hover:bg-clay/10 disabled:bg-transparent disabled:text-muted-foreground disabled:hover:bg-transparent [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
              onClick={onPrevious}
              disabled={current === 1}
              aria-label="Previous call-stack item"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="h-5 w-px bg-clay/30" />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="min-h-10 min-w-10 text-clay-dark hover:bg-clay/10 disabled:bg-transparent disabled:text-muted-foreground disabled:hover:bg-transparent [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
              onClick={onNext}
              disabled={current === total}
              aria-label="Next call-stack item"
            >
              <ArrowRight className="size-4" />
            </Button>
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
            <EventIcon event={event} />
            <span className="min-w-0 truncate text-sm font-medium text-foreground">{event.label}</span>
            <Badge variant="outline" className="hidden shrink-0 border-clay/35 bg-clay/10 sm:inline-flex">
              {event.boundary ? BOUNDARY_LABELS[event.boundary.kind] : event.kind}
            </Badge>
          </div>

          <span className="ml-auto min-w-12 shrink-0 text-right font-mono text-[11px] text-muted-foreground" aria-live="polite">
            {current} / {total}
          </span>
        </div>
      </div>
    </header>
  )
}

function CallStackPanel({
  events,
  selectedId,
  visible,
  onSelect,
}: {
  events: ExecutionTraceEvent[]
  selectedId: string
  visible: boolean
  onSelect: (id: string) => void
}) {
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    const list = listRef.current
    const current = list?.querySelector<HTMLElement>('[data-current="true"]')
    if (!list || !current) return

    const rowTop = current.offsetTop
    const rowBottom = rowTop + current.offsetHeight
    if (rowTop < list.scrollTop) list.scrollTop = rowTop
    if (rowBottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = rowBottom - list.clientHeight
    }
  }, [selectedId])

  return (
    <aside className="order-2 flex min-w-0 flex-col border-t bg-muted/15 lg:order-1 lg:border-r lg:border-t-0">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Call stack</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{events.length} frames · execution order</p>
        </div>
      </div>

      {visible ? (
        <ol
          ref={listRef}
          className="relative mx-3 my-3 max-h-[calc(30rem+2px)] divide-y overflow-y-auto overscroll-contain rounded-lg border bg-background [scrollbar-gutter:stable]"
          aria-label="Execution call stack"
        >
          {events.map((event, index) => (
            <CallStackRow
              key={event.id}
              event={event}
              index={index}
              selected={event.id === selectedId}
              onSelect={() => onSelect(event.id)}
            />
          ))}
        </ol>
      ) : (
        <div className="px-4 py-8 text-sm text-muted-foreground">Call stack hidden for this trace.</div>
      )}
    </aside>
  )
}

function TraceProvenance({ provenance }: { provenance: ExecutionTraceProvenance }) {
  return (
    <footer className="grid min-w-0 gap-1 border-t bg-muted/15 px-4 py-3 text-xs leading-5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
      <p className="font-medium text-foreground">About this trace</p>
      <p className="text-muted-foreground">{provenance.summary}</p>
    </footer>
  )
}

function CallStackRow({
  event,
  index,
  selected,
  onSelect,
}: {
  event: ExecutionTraceEvent
  index: number
  selected: boolean
  onSelect: () => void
}) {
  const frame = event.callStack?.find((candidate) => candidate.active) ?? event.callStack?.[0]
  const file = frame?.file ?? event.codeRef?.file
  const line = frame?.line ?? event.codeRef?.line

  return (
    <li
      className={cn("h-20 min-w-0 overflow-hidden", selected && "bg-clay/10")}
      data-current={selected ? "true" : undefined}
    >
      <button
        type="button"
        className="flex h-full w-full min-w-0 items-start gap-2.5 overflow-hidden px-3 py-3 text-left hover:bg-clay/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onClick={onSelect}
        aria-current={selected ? "step" : undefined}
      >
        <span
          className={cn(
            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-[10px] text-muted-foreground",
            selected && "bg-clay/20 text-clay-dark ring-1 ring-clay/40",
          )}
        >
          {index}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block min-w-0 truncate font-mono text-xs font-semibold text-foreground">
            {frame?.fn ?? event.label}
          </span>
          <span className="mt-1 block truncate text-[11px] text-muted-foreground">{event.label}</span>
          {file && (
            <span className="mt-1 block truncate font-mono text-[10px] text-muted-foreground">
              {file}:{line ?? "—"}
            </span>
          )}
        </span>
      </button>
    </li>
  )
}

function useHighlightedLines(code: string, language: string) {
  const isDark = useIsDarkTheme()
  const [highlighted, setHighlighted] = useState<{ code: string; lines: ThemedToken[][] | null } | null>(null)

  useEffect(() => {
    let cancelled = false

    getCodeHighlighter()
      .then((highlighter) => {
        const lang = normalizeCodeLanguage(language, highlighter)
        const lines = highlighter.codeToTokens(code, {
          lang,
          theme: isDark ? DARK_CODE_THEME : LIGHT_CODE_THEME,
        }).tokens
        if (!cancelled) setHighlighted({ code, lines })
      })
      .catch(() => {
        if (!cancelled) setHighlighted({ code, lines: null })
      })

    return () => {
      cancelled = true
    }
  }, [code, language, isDark])

  return highlighted?.code === code ? highlighted.lines : null
}

function SourcePane({ event }: { event: ExecutionTraceEvent }) {
  const content = event.code?.content
  const file = event.codeRef?.file ?? "Source not included"
  const fileName = file.split("/").at(-1) ?? file
  const allLines = content?.replace(/\r\n/g, "\n").split("\n") ?? []
  const requestedLine = event.codeRef?.line
  const activeIndex = requestedLine && requestedLine <= allLines.length ? requestedLine - 1 : -1
  let startIndex = activeIndex >= 0 ? Math.max(0, activeIndex - SOURCE_CONTEXT_LINES) : 0
  const endIndex = Math.min(allLines.length, startIndex + SOURCE_WINDOW_LINES)
  startIndex = Math.max(0, endIndex - SOURCE_WINDOW_LINES)
  const visibleLines = allLines.slice(startIndex, endIndex)
  const highlightedLines = useHighlightedLines(
    visibleLines.join("\n"),
    event.code?.language ?? "text",
  )

  return (
    <section className="min-w-0">
      <div className="flex min-w-0 items-center justify-between gap-3 border-b bg-accent/35 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <FileCode2 className="size-4 shrink-0 text-clay-dark" />
          <span className="truncate font-mono text-xs font-semibold text-foreground">{fileName}</span>
          <span className="hidden min-w-0 truncate font-mono text-[10px] text-muted-foreground sm:inline">
            {file}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 font-mono text-[10px] text-muted-foreground">
          {event.code?.language && <span>{event.code.language}</span>}
          {event.codeRef && <span>Ln {event.codeRef.line}{event.codeRef.column ? `:${event.codeRef.column}` : ""}</span>}
        </div>
      </div>

      {visibleLines.length ? (
        <div className="max-h-[28rem] min-h-[20rem] overflow-auto bg-background">
          <div className="min-w-max py-3 font-mono text-xs leading-6">
            {visibleLines.map((line, offset) => {
              const lineNumber = startIndex + offset + 1
              const active = lineNumber === requestedLine
              return (
                <div
                  key={lineNumber}
                  className={cn(
                    "grid grid-cols-[3rem_1.25rem_minmax(max-content,1fr)] px-3",
                    active && "bg-clay/15 text-foreground",
                  )}
                  aria-current={active ? "step" : undefined}
                >
                  <span className="select-none text-right text-muted-foreground/70">{lineNumber}</span>
                  <span className="flex items-center justify-center text-clay-dark">
                    {active && <ArrowRight className="size-3" />}
                  </span>
                  <code className="whitespace-pre pr-6 text-foreground/85">
                    {highlightedLines?.[offset]?.length
                      ? highlightedLines[offset].map((token, tokenIndex) => (
                          <span
                            key={`${token.offset}-${tokenIndex}`}
                            style={{
                              color: token.color,
                              fontStyle: token.fontStyle && token.fontStyle & 1 ? "italic" : undefined,
                              fontWeight: token.fontStyle && token.fontStyle & 2 ? 700 : undefined,
                              textDecoration: token.fontStyle && token.fontStyle & 4 ? "underline" : undefined,
                            }}
                          >
                            {token.content}
                          </span>
                        ))
                      : line || " "}
                  </code>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="flex min-h-[20rem] items-center justify-center bg-muted/10 px-6 text-center">
          <div className="max-w-sm">
            <Braces className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">Source not included</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Add event.code.src to load a project file at create-time, or provide event.code.content.
            </p>
          </div>
        </div>
      )}

      {visibleLines.length > 0 && (
        <div className="border-t bg-muted/10 px-4 py-1.5 font-mono text-[10px] text-muted-foreground">
          Lines {startIndex + 1}–{endIndex} of {allLines.length}
        </div>
      )}
    </section>
  )
}

function EventInspector({ event }: { event: ExecutionTraceEvent }) {
  return (
    <section className="min-w-0 border-t bg-card/40">
      {event.boundary && <BoundaryBar event={event} />}

      {(event.inputs?.length || event.outputs?.length) && (
        <div className="grid min-w-0 md:grid-cols-2">
          <TypedValueColumn title="Inputs" values={event.inputs ?? []} tone="input" />
          <TypedValueColumn title="Outputs" values={event.outputs ?? []} tone="output" className="border-t md:border-l md:border-t-0" />
        </div>
      )}
    </section>
  )
}

function BoundaryBar({ event }: { event: ExecutionTraceEvent }) {
  const boundary = event.boundary!
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b bg-accent/25 px-4 py-3 text-xs">
      <Badge variant="outline" className="border-clay/35 bg-clay/10">{BOUNDARY_LABELS[boundary.kind]}</Badge>
      <span className="font-medium text-foreground">{boundary.from.label}</span>
      <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
        <ArrowRight className="size-3.5 shrink-0" />
        <span className="break-all font-mono text-[10px]">{boundary.operation}</span>
        <ArrowRight className="size-3.5 shrink-0" />
      </span>
      <span className="font-medium text-foreground">{boundary.to.label}</span>
      {boundary.outcome !== "passed" && (
        <span className="ml-auto"><OutcomeBadge outcome={boundary.outcome} /></span>
      )}
    </div>
  )
}

function TypedValueColumn({
  title,
  values,
  tone,
  className,
}: {
  title: string
  values: ExecutionTraceTypedValue[]
  tone: "input" | "output"
  className?: string
}) {
  return (
    <section className={cn("min-w-0", className)}>
      <div
        className={cn(
          "flex items-center gap-2 border-b px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground",
          tone === "input" ? "bg-clay/10" : "bg-olive/10",
        )}
      >
        <span className={cn("size-1.5 rounded-full", tone === "input" ? "bg-clay" : "bg-olive")} />
        {title}
      </div>
      {values.length ? (
        <div className="divide-y">
          {values.map((value) => <TypedValueRow key={value.id} value={value} tone={tone} />)}
        </div>
      ) : (
        <p className="px-4 py-4 text-xs text-muted-foreground">No {title.toLowerCase()} recorded.</p>
      )}
    </section>
  )
}

function TypedValueRow({ value, tone }: { value: ExecutionTraceTypedValue; tone: "input" | "output" }) {
  const visibleFields = value.preview.fields?.slice(0, 4) ?? []
  const hiddenFieldCount = Math.max(0, (value.preview.fields?.length ?? 0) - visibleFields.length)

  return (
    <div className="min-w-0 px-4 py-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="break-all font-mono text-xs font-semibold text-foreground">{value.name}</span>
        {value.staticType && (
          <Badge
            variant="outline"
            className={cn(
              "max-w-full break-all font-mono text-[9px]",
              tone === "input" ? "border-clay/35 bg-clay/10" : "border-olive/40 bg-olive/10",
            )}
          >
            {value.staticType}
          </Badge>
        )}
        {value.runtimeType && <Badge variant="outline" className="max-w-full break-all font-mono text-[9px]">runtime {value.runtimeType}</Badge>}
      </div>
      <p className="mt-2 break-all font-mono text-[11px] leading-5 text-foreground/80">{value.preview.text}</p>
      {visibleFields.length > 0 && (
        <dl className="mt-2 divide-y border-y text-[10px]">
          {visibleFields.map((field) => (
            <div key={field.name} className="grid min-w-0 grid-cols-[minmax(5rem,0.45fr)_minmax(0,1fr)] gap-3 py-1.5">
              <dt className="break-all font-mono text-muted-foreground">{field.name}: {field.type}</dt>
              <dd className="break-all font-mono text-foreground">{field.preview ?? "—"}</dd>
            </div>
          ))}
        </dl>
      )}
      {hiddenFieldCount > 0 && <p className="mt-2 text-[10px] text-muted-foreground">+{hiddenFieldCount} more fields</p>}
    </div>
  )
}

function OutcomeBadge({ outcome }: { outcome: "passed" | "blocked" | "failed" | "skipped" }) {
  return (
    <Badge variant={outcome === "failed" || outcome === "blocked" ? "destructive" : outcome === "passed" ? "secondary" : "outline"}>
      {outcome}
    </Badge>
  )
}

function EventIcon({ event }: { event: ExecutionTraceEvent }) {
  if (event.kind === "throw") return <XCircle className="size-4 text-destructive" />
  if (event.boundary?.kind === "validation") return <ShieldCheck className="size-4 text-olive" />
  if (event.boundary?.kind === "output") return <CheckCircle2 className="size-4 text-olive" />
  if (event.boundary) return <CheckCircle2 className="size-4 text-clay-dark" />
  return <CircleDot className="size-4 text-clay-dark" />
}
