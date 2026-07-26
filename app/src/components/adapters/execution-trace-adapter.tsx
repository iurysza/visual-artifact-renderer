"use client"

import { useMemo, useState } from "react"
import {
  ArrowRight,
  Braces,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  FileInput,
  FileOutput,
  GitBranch,
  Network,
  OctagonAlert,
  ShieldCheck,
  Terminal,
  Workflow,
  XCircle,
} from "lucide-react"

import { Figure } from "@/components/artifact-primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { AdapterArgs } from "@/components/artifact-types"
import type {
  ExecutionTraceBoundaryKind,
  ExecutionTraceCallFrame,
  ExecutionTraceEvent,
  ExecutionTraceProvenance,
  ExecutionTraceTypedValue,
} from "@/lib/contract/artifact-schema"

type TraceFilter =
  | "boundaries"
  | "all"
  | "validation"
  | "io"
  | "runtime"
  | "mapping"
  | "failures"

type FilterDef = {
  value: TraceFilter
  label: string
}

const FILTERS: FilterDef[] = [
  { value: "boundaries", label: "Boundaries" },
  { value: "all", label: "All events" },
  { value: "validation", label: "Validation" },
  { value: "io", label: "I/O" },
  { value: "runtime", label: "Runtime" },
  { value: "mapping", label: "Mapping" },
  { value: "failures", label: "Failures" },
]

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

export function renderExecutionTrace({ node }: AdapterArgs<"execution-trace">) {
  return <ExecutionTraceReview {...node.props} />
}

function ExecutionTraceReview({
  title,
  caption,
  provenance,
  events,
  initialFilter = "boundaries",
  initialEventId,
  showCallStack = true,
}: {
  title?: string
  caption?: string
  provenance: ExecutionTraceProvenance
  events: ExecutionTraceEvent[]
  initialFilter?: TraceFilter
  initialEventId?: string
  showCallStack?: boolean
}) {
  const orderedEvents = useMemo(
    () => [...events].sort((left, right) => left.order - right.order),
    [events],
  )
  const [filter, setFilter] = useState<TraceFilter>(initialFilter)
  const [selectedId, setSelectedId] = useState<string>(() => {
    const requested = orderedEvents.find(
      (event) => event.id === initialEventId && matchesFilter(event, initialFilter),
    )
    const initial = orderedEvents.find((event) => matchesFilter(event, initialFilter))
    return requested?.id ?? initial?.id ?? orderedEvents[0]?.id ?? ""
  })

  const visibleEvents = useMemo(
    () => orderedEvents.filter((event) => matchesFilter(event, filter)),
    [filter, orderedEvents],
  )
  const selectedEvent =
    visibleEvents.find((event) => event.id === selectedId) ?? visibleEvents[0]
  const boundaryCount = orderedEvents.filter((event) => event.kind === "boundary").length

  function chooseFilter(nextFilter: TraceFilter) {
    setFilter(nextFilter)
    const nextEvents = orderedEvents.filter((event) => matchesFilter(event, nextFilter))
    if (!nextEvents.some((event) => event.id === selectedId)) {
      setSelectedId(nextEvents[0]?.id ?? "")
    }
  }

  function moveSelection(direction: -1 | 1) {
    if (!selectedEvent || visibleEvents.length < 2) return
    const index = visibleEvents.findIndex((event) => event.id === selectedEvent.id)
    const nextIndex = Math.max(0, Math.min(visibleEvents.length - 1, index + direction))
    setSelectedId(visibleEvents[nextIndex].id)
  }

  return (
    <Figure title={title} caption={caption}>
      <div
        className="min-w-0 overflow-hidden rounded-xl border bg-background/65 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return
          if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            event.preventDefault()
            moveSelection(-1)
          }
          if (event.key === "ArrowRight" || event.key === "ArrowDown") {
            event.preventDefault()
            moveSelection(1)
          }
        }}
      >
        <TraceHeader provenance={provenance} boundaryCount={boundaryCount} eventCount={orderedEvents.length} />

        <div className="border-b px-3 py-2.5">
          <div className="flex min-w-0 gap-1 overflow-x-auto pb-1">
            {FILTERS.map((item) => {
              const count = orderedEvents.filter((event) => matchesFilter(event, item.value)).length
              if (count === 0 && item.value !== "boundaries" && item.value !== "all") return null
              return (
                <Button
                  key={item.value}
                  type="button"
                  variant={filter === item.value ? "secondary" : "ghost"}
                  size="xs"
                  className="min-h-9 shrink-0 px-3 [@media(pointer:coarse)]:min-h-11"
                  onClick={() => chooseFilter(item.value)}
                  aria-pressed={filter === item.value}
                >
                  {item.label}
                  <span className="font-mono text-[10px] text-muted-foreground">{count}</span>
                </Button>
              )
            })}
          </div>
        </div>

        {visibleEvents.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No events match this filter.
          </p>
        ) : (
          <div className="grid min-w-0 lg:grid-cols-[minmax(18rem,0.9fr)_minmax(25rem,1.35fr)]">
            <div className="min-w-0 divide-y lg:border-r">
              {visibleEvents.map((event, index) => {
                const isSelected = event.id === selectedEvent?.id
                return (
                  <div key={event.id}>
                    <TraceEventRow
                      event={event}
                      index={index}
                      selected={isSelected}
                      onSelect={() => setSelectedId(event.id)}
                    />
                    {isSelected && (
                      <div className="border-t bg-muted/10 p-3 lg:hidden">
                        <EventDetail
                          key={event.id}
                          event={event}
                          showCallStack={showCallStack}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <aside className="hidden min-w-0 bg-muted/10 p-4 lg:block">
              {selectedEvent && (
                <EventDetail
                  key={selectedEvent.id}
                  event={selectedEvent}
                  showCallStack={showCallStack}
                />
              )}
            </aside>
          </div>
        )}
      </div>
    </Figure>
  )
}

function TraceHeader({
  provenance,
  boundaryCount,
  eventCount,
}: {
  provenance: ExecutionTraceProvenance
  boundaryCount: number
  eventCount: number
}) {
  return (
    <div className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={provenance.mode === "captured" ? "default" : "outline"}>
            {provenance.mode}
          </Badge>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {provenance.method.replaceAll("-", " ")} · {provenance.confidence} confidence
          </span>
        </div>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          {provenance.summary}
        </p>
      </div>
      <div className="flex shrink-0 gap-3 font-mono text-[11px] text-muted-foreground">
        <span><strong className="text-foreground">{boundaryCount}</strong> boundaries</span>
        <span><strong className="text-foreground">{eventCount}</strong> events</span>
      </div>
    </div>
  )
}

function TraceEventRow({
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
  const transition = typeTransition(event)

  return (
    <button
      type="button"
      className={cn(
        "flex min-h-14 w-full min-w-0 items-start gap-3 px-3 py-3 text-left transition-colors",
        selected ? "bg-accent/45" : "hover:bg-accent/20",
      )}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background",
          selected && "border-ring/50",
          event.kind === "throw" && "border-destructive/40 text-destructive",
        )}
      >
        <EventIcon event={event} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-[10px] text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="break-words text-sm font-semibold text-foreground">{event.label}</span>
          <Badge variant="outline" className="font-mono text-[10px]">
            {event.boundary ? BOUNDARY_LABELS[event.boundary.kind] : event.kind}
          </Badge>
        </span>

        {event.boundary && (
          <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate">{event.boundary.from.label}</span>
            <ArrowRight className="size-3 shrink-0" />
            <span className="truncate">{event.boundary.to.label}</span>
          </span>
        )}

        {transition && (
          <span className="mt-1 block break-words font-mono text-[11px] text-foreground/80">
            {transition}
          </span>
        )}

        {event.summary && (
          <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">
            {event.summary}
          </span>
        )}
      </span>

      <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
        {event.boundary && <OutcomeBadge outcome={event.boundary.outcome} />}
        <span className="font-mono text-[10px] text-muted-foreground">
          {event.evidence.origin}
        </span>
      </span>
    </button>
  )
}

function EventDetail({
  event,
  showCallStack,
}: {
  event: ExecutionTraceEvent
  showCallStack: boolean
}) {
  const [stackOpen, setStackOpen] = useState(showCallStack)

  return (
    <div className="min-w-0 space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{event.phase}</Badge>
          <Badge variant={event.evidence.origin === "captured" ? "default" : "outline"}>
            {event.evidence.origin}
          </Badge>
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            {event.evidence.confidence} confidence
          </span>
        </div>
        <h4 className="mt-2 break-words font-serif text-xl font-medium text-foreground">
          {event.label}
        </h4>
        {event.summary && (
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{event.summary}</p>
        )}
      </div>

      {event.boundary && <BoundaryCrossing event={event} />}

      {(event.inputs?.length || event.outputs?.length) && (
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <TypedValueGroup title="Inputs" values={event.inputs ?? []} empty="No input captured" />
          <TypedValueGroup title="Outputs" values={event.outputs ?? []} empty="No output captured" />
        </div>
      )}

      {event.transformation && (
        <section className="border-t pt-4">
          <SectionLabel>Transformation</SectionLabel>
          <p className="mt-2 text-sm leading-6 text-foreground">
            {event.transformation.summary}
          </p>
          {event.transformation.mappings?.length ? (
            <div className="mt-3 divide-y overflow-hidden rounded-lg border bg-background/60">
              {event.transformation.mappings.map((mapping, index) => (
                <div
                  key={`${mapping.from}-${mapping.to}-${index}`}
                  className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-2 text-xs"
                >
                  <span className="break-all font-mono text-muted-foreground">{mapping.from}</span>
                  <span className="flex flex-col items-center gap-0.5">
                    <Badge variant="outline" className="font-mono text-[9px]">{mapping.operation}</Badge>
                    <ArrowRight className="size-3 text-muted-foreground" />
                  </span>
                  <span className="break-all font-mono text-foreground">{mapping.to}</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      )}

      {showCallStack && event.callStack?.length ? (
        <section className="border-t pt-4">
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
            onClick={() => setStackOpen((open) => !open)}
            aria-expanded={stackOpen}
          >
            <span>
              <SectionLabel>Call stack</SectionLabel>
              <span className="mt-1 block text-xs text-muted-foreground">
                Current frame first · {event.callStack.length} frame{event.callStack.length === 1 ? "" : "s"}
              </span>
            </span>
            {stackOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
          {stackOpen && <CallStack frames={event.callStack} />}
        </section>
      ) : null}

      <section className="border-t pt-4">
        <SectionLabel>Evidence</SectionLabel>
        <div className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">{event.evidence.origin}</span>
            {" · "}{event.evidence.confidence} confidence
          </p>
          {event.evidence.note && <p>{event.evidence.note}</p>}
          {event.codeRef && (
            <p className="break-all font-mono text-foreground/80">
              {event.codeRef.file}:{event.codeRef.line}
              {event.codeRef.column ? `:${event.codeRef.column}` : ""}
            </p>
          )}
          {event.note && <p>{event.note}</p>}
        </div>
      </section>
    </div>
  )
}

function BoundaryCrossing({ event }: { event: ExecutionTraceEvent }) {
  const boundary = event.boundary!
  return (
    <section>
      <SectionLabel>Boundary crossing</SectionLabel>
      <div className="mt-2 grid min-w-0 items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
        <SystemEndpoint label={boundary.from.label} system={boundary.from.system} />
        <span className="flex items-center justify-center gap-2 text-muted-foreground sm:flex-col">
          <ArrowRight className="size-4 rotate-90 sm:rotate-0" />
          <span className="max-w-full break-all text-center font-mono text-[9px] uppercase tracking-[0.1em]">{boundary.operation}</span>
        </span>
        <SystemEndpoint label={boundary.to.label} system={boundary.to.system} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <OutcomeBadge outcome={boundary.outcome} />
        {boundary.policy && (
          <span className="text-xs text-muted-foreground">Policy: {boundary.policy}</span>
        )}
      </div>
    </section>
  )
}

function SystemEndpoint({ label, system }: { label: string; system: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-background/65 px-3 py-2">
      <p className="break-words text-sm font-medium text-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        {system}
      </p>
    </div>
  )
}

function TypedValueGroup({
  title,
  values,
  empty,
}: {
  title: string
  values: ExecutionTraceTypedValue[]
  empty: string
}) {
  return (
    <section className="min-w-0">
      <SectionLabel>{title}</SectionLabel>
      {values.length ? (
        <div className="mt-2 space-y-2">
          {values.map((value) => <TypedValue key={value.id} value={value} />)}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">{empty}</p>
      )}
    </section>
  )
}

function TypedValue({ value }: { value: ExecutionTraceTypedValue }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border bg-background/65">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <span className="break-all font-mono text-xs font-semibold text-foreground">{value.name}</span>
        <span className="flex flex-wrap items-center gap-1.5">
          {value.staticType && (
            <Badge variant="secondary" className="max-w-full whitespace-normal break-all text-left font-mono text-[9px]">
              {value.staticType}
            </Badge>
          )}
          {value.runtimeType && (
            <Badge variant="outline" className="max-w-full whitespace-normal break-all text-left font-mono text-[9px]">
              runtime: {value.runtimeType}
            </Badge>
          )}
        </span>
      </div>
      <div className="space-y-2 px-3 py-2.5">
        <p className="break-all font-mono text-[11px] leading-5 text-foreground/90">
          {value.preview.text}
        </p>
        {value.preview.fields?.length ? (
          <dl className="divide-y rounded-md border bg-muted/15">
            {value.preview.fields.map((field) => (
              <div
                key={field.name}
                className="grid min-w-0 grid-cols-[minmax(5rem,0.45fr)_minmax(0,1fr)] gap-2 px-2.5 py-1.5 text-[11px]"
              >
                <dt className="min-w-0 break-all font-mono text-muted-foreground">
                  {field.name}
                  <span className="ml-1 text-[9px] opacity-75">:{field.type}</span>
                </dt>
                <dd className="min-w-0 break-all font-mono text-foreground">
                  {field.preview ?? "—"}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
          <span>{value.provenance}</span>
          {value.preview.itemCount != null && <span>{value.preview.itemCount} items</span>}
          {value.preview.truncated && <span>truncated</span>}
        </div>
      </div>
    </div>
  )
}

function CallStack({ frames }: { frames: ExecutionTraceCallFrame[] }) {
  return (
    <ol className="mt-3 space-y-2">
      {frames.map((frame, index) => (
        <li
          key={frame.id}
          className={cn(
            "min-w-0 rounded-lg border bg-background/65 px-3 py-2",
            frame.active && "border-ring/50 bg-accent/25",
          )}
        >
          <div className="flex min-w-0 items-start gap-2">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[9px] text-muted-foreground">
              {index}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="break-all font-mono text-xs font-semibold text-foreground">{frame.fn}</span>
                {frame.returnType && (
                  <Badge variant="outline" className="max-w-full whitespace-normal break-all text-left font-mono text-[9px]">
                    → {frame.returnType}
                  </Badge>
                )}
                {frame.active && <Badge variant="secondary">current</Badge>}
              </div>
              {frame.signature && (
                <p className="mt-1 break-all font-mono text-[10px] text-foreground/80">
                  {frame.signature}
                </p>
              )}
              {frame.file && (
                <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                  {frame.file}:{frame.line ?? "—"}
                </p>
              )}
              {frame.args?.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {frame.args.map((arg) => (
                    <span
                      key={arg.id}
                      className="max-w-full break-all rounded-md bg-muted px-2 py-1 font-mono text-[9px] text-muted-foreground"
                    >
                      {arg.name}: {arg.staticType ?? arg.runtimeType ?? "unknown"} = {arg.preview.text}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

function OutcomeBadge({
  outcome,
}: {
  outcome: "passed" | "blocked" | "failed" | "skipped"
}) {
  return (
    <Badge
      variant={outcome === "failed" || outcome === "blocked" ? "destructive" : outcome === "passed" ? "secondary" : "outline"}
    >
      {outcome}
    </Badge>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </p>
  )
}

function matchesFilter(event: ExecutionTraceEvent, filter: TraceFilter): boolean {
  if (filter === "all") return true
  if (filter === "boundaries") return event.kind === "boundary"
  if (filter === "failures") {
    return event.kind === "throw" || event.boundary?.outcome === "failed" || event.boundary?.outcome === "blocked"
  }
  if (filter === "validation") {
    return event.boundary?.kind === "validation" || event.boundary?.kind === "parse"
  }
  if (filter === "io") {
    return ["file-read", "file-write", "network-request"].includes(event.boundary?.kind ?? "")
  }
  if (filter === "runtime") {
    return event.boundary?.kind === "process-spawn" || event.boundary?.kind === "runtime"
  }
  return event.boundary?.kind === "registry-adapter"
}

function typeTransition(event: ExecutionTraceEvent): string | null {
  const input = event.inputs?.[0]
  const output = event.outputs?.[0]
  if (!input || !output) return null
  return `${input.staticType ?? input.runtimeType ?? "unknown"} → ${output.staticType ?? output.runtimeType ?? "unknown"}`
}

function EventIcon({ event }: { event: ExecutionTraceEvent }) {
  if (event.kind === "throw") return <XCircle className="size-4" />
  if (!event.boundary) return <CircleDot className="size-4" />

  switch (event.boundary.kind) {
    case "validation": return <ShieldCheck className="size-4" />
    case "parse": return <Braces className="size-4" />
    case "file-read": return <FileInput className="size-4" />
    case "file-write": return <FileOutput className="size-4" />
    case "process-spawn": return <Terminal className="size-4" />
    case "network-request": return <Network className="size-4" />
    case "registry-adapter": return <GitBranch className="size-4" />
    case "runtime": return <Workflow className="size-4" />
    case "input": return <CircleDot className="size-4" />
    case "output": return <CheckCircle2 className="size-4" />
    default: return <OctagonAlert className="size-4" />
  }
}
