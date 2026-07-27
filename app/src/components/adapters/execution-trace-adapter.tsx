"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Braces,
  FileCode2,
  Info,
  Layers3,
} from "lucide-react"

import { Figure } from "@/components/artifact-primitives"
import { Badge, badgeVariants } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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
  ExecutionTraceImpact,
  ExecutionTraceProvenance,
  ExecutionTraceTypeDefinition,
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
  typeDefinitions = [],
  initialEventId,
  showCallStack = true,
}: {
  title?: string
  caption?: string
  provenance: ExecutionTraceProvenance
  events: ExecutionTraceEvent[]
  typeDefinitions?: ExecutionTraceTypeDefinition[]
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
        <div className="grid min-w-0 lg:grid-cols-[19rem_minmax(0,1fr)] lg:grid-rows-[auto_auto_minmax(0,1fr)]">
          <TraceTitleSection
            title={title ?? "Execution trace"}
            caption={caption}
            provenance={provenance}
          />

          <TraceControls
            event={selectedEvent}
            current={selectedIndex + 1}
            total={orderedEvents.length}
            onPrevious={() => moveSelection(-1)}
            onNext={() => moveSelection(1)}
          />

          <CallStackPanel
            events={orderedEvents}
            selectedId={selectedEvent.id}
            visible={showCallStack}
            current={selectedIndex + 1}
            onSelect={setSelectedId}
            onPrevious={() => moveSelection(-1)}
            onNext={() => moveSelection(1)}
          />

          <main className="order-3 min-w-0 lg:col-start-2 lg:row-span-3 lg:row-start-1">
            <SourcePane event={selectedEvent} />
            <EventInspector event={selectedEvent} typeDefinitions={typeDefinitions} />
          </main>
        </div>
      </div>
    </Figure>
  )
}

function TraceTitleSection({
  title,
  caption,
  provenance,
}: {
  title: string
  caption?: string
  provenance: ExecutionTraceProvenance
}) {
  const provenanceNote = {
    captured: "Captured from a runtime trace.",
    inferred: "Based on reviewed source; example values aren’t live.",
    mixed: "Combines runtime data with reviewed source.",
    simulated: "Uses example values, not live runtime data.",
  }[provenance.mode]

  return (
    <header className="order-1 flex min-w-0 items-center gap-3 border-b bg-muted/25 px-4 py-3 lg:col-start-1 lg:row-start-1 lg:border-r">
      <Layers3 className="size-4 shrink-0 text-clay-dark" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>
          <TooltipProvider delay={100}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label="About this trace"
                    className="shrink-0 rounded-full text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Info className="size-3.5" />
                  </button>
                }
              />
              <TooltipContent side="top" align="start">
                <div className="grid max-w-56 gap-0.5">
                  <p className="font-medium">About this trace</p>
                  <p className="text-background/80">{provenanceNote}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {caption && <p className="mt-0.5 break-words text-xs leading-4 text-muted-foreground">{caption}</p>}
      </div>
    </header>
  )
}

function TraceControls({
  event,
  current,
  total,
  onPrevious,
  onNext,
}: {
  event: ExecutionTraceEvent
  current: number
  total: number
  onPrevious: () => void
  onNext: () => void
}) {
  return (
    <section className="order-2 min-w-0 border-b bg-muted/25 px-3 py-3 lg:col-start-1 lg:row-start-2 lg:border-r">
      <div className="flex justify-center lg:hidden">
        <TracePager
          current={current}
          total={total}
          onPrevious={onPrevious}
          onNext={onNext}
        />
      </div>

      <p className="mx-auto max-w-[17rem] break-words text-center text-sm font-medium leading-5 text-foreground max-lg:mt-2">
        {event.label}
      </p>
    </section>
  )
}

function TracePager({
  current,
  total,
  onPrevious,
  onNext,
}: {
  current: number
  total: number
  onPrevious: () => void
  onNext: () => void
}) {
  return (
    <div className="inline-flex items-center overflow-hidden rounded-full border border-clay/35 bg-background/70">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="min-h-10 min-w-10 rounded-none text-clay-dark hover:bg-clay/10 disabled:bg-transparent disabled:text-muted-foreground disabled:hover:bg-transparent [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
        onClick={onPrevious}
        disabled={current === 1}
        aria-label="Previous execution step"
      >
        <ArrowLeft className="size-4" />
      </Button>
      <span className="min-w-14 border-x border-clay/25 px-2 text-center font-mono text-[11px] text-muted-foreground" aria-live="polite">
        {current} / {total}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="min-h-10 min-w-10 rounded-none text-clay-dark hover:bg-clay/10 disabled:bg-transparent disabled:text-muted-foreground disabled:hover:bg-transparent [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
        onClick={onNext}
        disabled={current === total}
        aria-label="Next execution step"
      >
        <ArrowRight className="size-4" />
      </Button>
    </div>
  )
}

function CallStackPanel({
  events,
  selectedId,
  visible,
  current,
  onSelect,
  onPrevious,
  onNext,
}: {
  events: ExecutionTraceEvent[]
  selectedId: string
  visible: boolean
  current: number
  onSelect: (id: string) => void
  onPrevious: () => void
  onNext: () => void
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
    <aside className="order-4 flex min-w-0 flex-col border-t bg-muted/15 lg:col-start-1 lg:row-start-3 lg:border-r lg:border-t-0">
      <div className="flex min-h-16 items-center justify-between gap-3 border-b px-4 py-2.5">
        <p className="text-sm font-semibold text-foreground">Call stack</p>
        <div className="hidden lg:block">
          <TracePager
            current={current}
            total={events.length}
            onPrevious={onPrevious}
            onNext={onNext}
          />
        </div>
      </div>

      {visible ? (
        <ol
          ref={listRef}
          className="relative mx-3 my-3 max-h-[calc(30rem+2px)] divide-y overflow-y-auto overscroll-contain rounded-lg border bg-background [scrollbar-gutter:stable]"
          aria-label="Call stack"
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
        <div className="px-4 py-8 text-sm text-muted-foreground">Execution path hidden for this trace.</div>
      )}
    </aside>
  )
}

function sourceIdentity(symbol: string | undefined, text: string): string {
  if (symbol) return `${symbol}()`
  return text.replace(/\s+/g, " ").trim()
}

function lineRange(startLine: number, endLine: number): string {
  return startLine === endLine ? String(startLine) : `${startLine}–${endLine}`
}

function sourceLocation(file: string, startLine: number, endLine: number): string {
  return `${file}:${lineRange(startLine, endLine)}`
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
  const { focus, span } = event.source.facts
  const identity = sourceIdentity(focus.symbol, focus.text)
  const location = sourceLocation(span.file, span.startLine, span.endLine)

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
            {identity}
          </span>
          <span className="mt-1 block truncate text-[11px] text-muted-foreground">{event.label}</span>
          <span className="mt-1 block truncate font-mono text-[10px] text-muted-foreground">
            {location}
          </span>
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
  const content = event.source.content
  const { focus, scope, span, language } = event.source.facts
  const allLines = content?.replace(/\r\n/g, "\n").split("\n") ?? []
  const activeIndex = span.startLine <= allLines.length ? span.startLine - 1 : -1
  let startIndex = activeIndex >= 0 ? Math.max(0, activeIndex - SOURCE_CONTEXT_LINES) : 0
  const requestedWindowEnd = Math.max(span.endLine, span.startLine + SOURCE_CONTEXT_LINES)
  const endIndex = Math.min(allLines.length, Math.max(startIndex + SOURCE_WINDOW_LINES, requestedWindowEnd))
  startIndex = Math.max(0, Math.min(startIndex, endIndex - SOURCE_WINDOW_LINES))
  const visibleLines = allLines.slice(startIndex, endIndex)
  const highlightedLines = useHighlightedLines(
    visibleLines.join("\n"),
    language,
  )
  const identity = sourceIdentity(focus.symbol, focus.text)
  const scopeIdentity = scope?.symbol ? sourceIdentity(scope.symbol, scope.symbol) : undefined

  return (
    <section className="min-w-0">
      <div className="flex min-w-0 items-center justify-between gap-3 border-b bg-accent/35 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <FileCode2 className="size-4 shrink-0 text-clay-dark" />
          <div className="min-w-0">
            <p className="truncate font-mono text-xs font-semibold text-foreground">{identity}</p>
            {scopeIdentity && (
              <p className="truncate font-mono text-[10px] text-muted-foreground">inside {scopeIdentity}</p>
            )}
          </div>
        </div>
        <div className="flex min-w-0 shrink-0 items-center gap-2 text-[10px] text-muted-foreground">
          <span className="hidden max-w-52 truncate font-mono sm:inline">{span.file}</span>
          <span className="font-mono">Ln {lineRange(span.startLine, span.endLine)}</span>
        </div>
      </div>

      {visibleLines.length ? (
        <div className="max-h-[28rem] min-h-[20rem] overflow-auto bg-background">
          <div className="min-w-max py-3 font-mono text-xs leading-6">
            {visibleLines.map((line, offset) => {
              const lineNumber = startIndex + offset + 1
              const active = lineNumber >= span.startLine && lineNumber <= span.endLine
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
                    {lineNumber === span.startLine && <ArrowRight className="size-3" />}
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
              Run trace inspect and create the artifact again to verify and inline this source span.
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

function EventInspector({
  event,
  typeDefinitions,
}: {
  event: ExecutionTraceEvent
  typeDefinitions: ExecutionTraceTypeDefinition[]
}) {
  const hasValues = Boolean(event.inputs?.length || event.outputs?.length)

  return (
    <section className="min-w-0 border-t bg-card/40">
      {event.boundary && <BoundaryBar event={event} />}

      {hasValues && (
        <div className="grid min-w-0 md:grid-cols-2">
          <TypedValueColumn
            title="Inputs"
            values={event.inputs ?? []}
            typeDefinitions={typeDefinitions}
            tone="input"
          />
          <TypedValueColumn
            title="Outputs"
            values={event.outputs ?? []}
            typeDefinitions={typeDefinitions}
            tone="output"
            className="border-t md:border-l md:border-t-0"
          />
        </div>
      )}

      {event.impacts?.length ? (
        <ImpactGrid impacts={event.impacts} className={hasValues ? "border-t" : undefined} />
      ) : null}
    </section>
  )
}

function ImpactGrid({ impacts, className }: { impacts: ExecutionTraceImpact[]; className?: string }) {
  const effects = impacts.filter((impact) => impact.kind === "effect")
  const errors = impacts.filter((impact) => impact.kind === "error")
  const hasBoth = effects.length > 0 && errors.length > 0

  return (
    <div className={cn("grid min-w-0", hasBoth && "md:grid-cols-2", className)}>
      {effects.length > 0 && <ImpactColumn title="Side effects" impacts={effects} tone="effect" />}
      {errors.length > 0 && (
        <ImpactColumn
          title="Possible errors"
          impacts={errors}
          tone="error"
          className={cn(hasBoth && "border-t md:border-l md:border-t-0")}
        />
      )}
    </div>
  )
}

function ImpactColumn({
  title,
  impacts,
  tone,
  className,
}: {
  title: string
  impacts: ExecutionTraceImpact[]
  tone: "effect" | "error"
  className?: string
}) {
  return (
    <section className={cn("min-w-0", className)}>
      <div
        className={cn(
          "flex items-center gap-2 border-b px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground",
          tone === "effect" ? "bg-accent/45" : "bg-destructive/10",
        )}
      >
        <span className={cn("size-1.5 rounded-full", tone === "effect" ? "bg-clay-dark" : "bg-destructive")} />
        {title}
      </div>
      <div className="divide-y">
        {impacts.map((impact, index) => (
          <div key={`${impact.title}-${impact.codeRef?.file ?? ""}-${impact.codeRef?.line ?? ""}-${index}`} className="min-w-0 px-4 py-3">
            <p className="text-xs font-semibold leading-5 text-foreground">{impact.title}</p>
            {impact.description && (
              <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">{impact.description}</p>
            )}
            {impact.codeRef && (
              <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                {impact.codeRef.file}:{impact.codeRef.line}{impact.codeRef.column ? `:${impact.codeRef.column}` : ""}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function BoundaryBar({ event }: { event: ExecutionTraceEvent }) {
  const boundary = event.boundary!
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b bg-accent/25 px-4 py-3 text-xs">
      <Badge variant="outline" className="border-clay/35 bg-clay/10">{BOUNDARY_LABELS[boundary.kind]}</Badge>
      <span className="font-medium text-foreground">{boundary.from.label}</span>
      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
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
  typeDefinitions,
  tone,
  className,
}: {
  title: string
  values: ExecutionTraceTypedValue[]
  typeDefinitions: ExecutionTraceTypeDefinition[]
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
          {values.map((value) => (
            <TypedValueRow
              key={value.id}
              value={value}
              typeDefinitions={typeDefinitions}
              tone={tone}
            />
          ))}
        </div>
      ) : (
        <p className="px-4 py-4 text-xs text-muted-foreground">No {title.toLowerCase()} recorded.</p>
      )}
    </section>
  )
}

function TypedValueRow({
  value,
  typeDefinitions,
  tone,
}: {
  value: ExecutionTraceTypedValue
  typeDefinitions: ExecutionTraceTypeDefinition[]
  tone: "input" | "output"
}) {
  const visibleFields = value.preview.fields?.slice(0, 4) ?? []
  const hiddenFieldCount = Math.max(0, (value.preview.fields?.length ?? 0) - visibleFields.length)

  return (
    <div className="min-w-0 px-4 py-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="break-all font-mono text-xs font-semibold text-foreground">{value.name}</span>
        {value.staticType && (
          <TypeReference
            type={value.staticType}
            definitions={typeDefinitions}
            tone={tone}
          />
        )}
        {value.runtimeType && <Badge variant="outline" className="max-w-full break-all font-mono text-[9px]">runtime {value.runtimeType}</Badge>}
      </div>
      <p className="mt-2 break-all font-mono text-[11px] leading-5 text-foreground/80">{value.preview.text}</p>
      {visibleFields.length > 0 && (
        <dl className="mt-2 divide-y border-y text-[10px]">
          {visibleFields.map((field) => (
            <div key={field.name} className="grid min-w-0 grid-cols-[minmax(5rem,0.45fr)_minmax(0,1fr)] gap-3 py-1.5">
              <dt className="flex min-w-0 flex-wrap items-center gap-1 font-mono text-muted-foreground">
                <span className="break-all">{field.name}:</span>
                <TypeReference
                  type={field.type}
                  definitions={typeDefinitions}
                  tone={tone}
                  compact
                />
              </dt>
              <dd className="break-all font-mono text-foreground">{field.preview ?? "—"}</dd>
            </div>
          ))}
        </dl>
      )}
      {hiddenFieldCount > 0 && <p className="mt-2 text-[10px] text-muted-foreground">+{hiddenFieldCount} more fields</p>}
    </div>
  )
}

function definitionsForType(
  type: string,
  definitions: ExecutionTraceTypeDefinition[],
) {
  return definitions.filter((definition) => {
    const escapedName = definition.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return new RegExp(`(^|[^\\w$])${escapedName}(?=$|[^\\w$])`).test(type)
  })
}

function TypeReference({
  type,
  definitions,
  tone,
  compact = false,
}: {
  type: string
  definitions: ExecutionTraceTypeDefinition[]
  tone: "input" | "output"
  compact?: boolean
}) {
  const referencedDefinitions = definitionsForType(type, definitions)
  const [open, setOpen] = useState(false)

  if (referencedDefinitions.length === 0) {
    if (compact) return <span className="break-all">{type}</span>
    return (
      <Badge variant="outline" className="max-w-full break-all font-mono text-[9px]">
        {type}
      </Badge>
    )
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen, details) => {
        const desktopPointerPress =
          details.reason === "trigger-press" &&
          typeof window !== "undefined" &&
          window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
          !(details.event instanceof KeyboardEvent)

        if (desktopPointerPress) {
          details.cancel()
          return
        }

        setOpen(nextOpen)
      }}
    >
      <PopoverTrigger
        openOnHover
        delay={100}
        closeDelay={140}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return
          event.preventDefault()
          setOpen((currentOpen) => !currentOpen)
        }}
        className="group inline-flex min-h-6 max-w-full cursor-help items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(pointer:coarse)]:min-h-11"
        aria-label={`Inspect type ${type}`}
      >
        {compact ? (
          <span className="inline-flex max-w-full items-center gap-0.5 rounded border-b border-dashed border-current/50 px-0.5 font-mono text-[10px] font-medium transition-colors group-hover:border-current group-hover:bg-accent group-hover:text-foreground">
            <Braces className="size-2.5 shrink-0 opacity-70" aria-hidden="true" />
            <span className="break-all">{type}</span>
          </span>
        ) : (
          <span
            className={cn(
              badgeVariants({ variant: "outline" }),
              "pointer-events-none max-w-full gap-1 border-dashed font-mono text-[9px] transition-colors group-hover:ring-1 group-hover:ring-current/30",
              tone === "input" ? "border-clay/50 bg-clay/10 group-hover:bg-clay/20" : "border-olive/55 bg-olive/10 group-hover:bg-olive/20",
            )}
          >
            <Braces className="size-2.5 shrink-0 opacity-70" aria-hidden="true" />
            <span className="break-all">{type}</span>
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[min(30rem,calc(100vw-2rem))] gap-0 overflow-hidden p-0"
      >
        {referencedDefinitions.map((definition, index) => (
          <TypeDefinitionPreview
            key={definition.name}
            definition={definition}
            divided={index > 0}
          />
        ))}
      </PopoverContent>
    </Popover>
  )
}

function TypeDefinitionPreview({
  definition,
  divided,
}: {
  definition: ExecutionTraceTypeDefinition
  divided: boolean
}) {
  return (
    <section className={cn("min-w-0", divided && "border-t")}>
      <div className="flex min-w-0 items-start justify-between gap-3 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Braces className="size-4 shrink-0 text-clay-dark" />
          <strong className="truncate font-mono text-xs text-foreground">{definition.name}</strong>
        </div>
        {definition.file && (
          <span className="min-w-0 truncate text-right font-mono text-[9px] text-muted-foreground">
            {definition.file}{definition.line ? `:${definition.line}` : ""}
          </span>
        )}
      </div>
      <TypeDefinitionCode definition={definition} />
      <p className="border-t bg-muted/20 px-3 py-2 text-[10px] text-muted-foreground">
        {definition.provenance === "derived" ? "Source-derived definition" : "Static-analysis inference"}
      </p>
    </section>
  )
}

function TypeDefinitionCode({ definition }: { definition: ExecutionTraceTypeDefinition }) {
  const lines = definition.definition.replace(/\r\n/g, "\n").split("\n")
  const highlightedLines = useHighlightedLines(
    definition.definition,
    definition.language ?? "typescript",
  )

  return (
    <pre className="max-h-72 overflow-auto bg-background px-3 py-2.5 font-mono text-[11px] leading-5 text-foreground">
      <code>
        {lines.map((line, lineIndex) => (
          <span key={lineIndex} className="block min-w-max pr-3">
            {highlightedLines?.[lineIndex]?.length
              ? highlightedLines[lineIndex].map((token, tokenIndex) => (
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
          </span>
        ))}
      </code>
    </pre>
  )
}

function OutcomeBadge({ outcome }: { outcome: "passed" | "blocked" | "failed" | "skipped" }) {
  return (
    <Badge variant={outcome === "failed" || outcome === "blocked" ? "destructive" : outcome === "passed" ? "secondary" : "outline"}>
      {outcome}
    </Badge>
  )
}
