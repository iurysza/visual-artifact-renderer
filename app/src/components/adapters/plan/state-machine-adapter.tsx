"use client"

// state-machine: states on a grid, event edges, a selected state whose screen
// child renders below. Inactive screens stay mounted but `hidden`, so node paths are stable.
import { Children, useId, useMemo, useState, type KeyboardEvent } from "react"

import type { AdapterArgs } from "@/components/artifact-types"
import { normalizeMachineEvents, parseGridRows } from "@/lib/contract/artifact-manifest"
import { autoCells, layoutGrid, pairOffsets, pointsToPath, routeEdge } from "@/lib/plan/grid-layout"
import { cn } from "@/lib/utils"

import { ArrowDefs, DiagramCanvas, EdgeLabel, markerFor } from "./diagram-svg"
import { PlanCaption, PlanFrame, PlanHeader, markStroke } from "./plan-ui"

const METRICS = { cellW: 190, cellH: 104, boxW: 136, boxH: 38, pad: 28 }

/** Replays a trace from `initial`; returns the visited states (initial first). */
export function replayTrace(initial: string, events: readonly { from: string; event: string; to: string }[], trace: readonly string[]): string[] {
  const out = [initial]
  let current = initial
  for (const name of trace) {
    const edge = events.find((e) => e.from === current && e.event === name)
    if (!edge) break
    current = edge.to
    out.push(current)
  }
  return out
}

export function renderStateMachine(args: AdapterArgs<"state-machine">) {
  return <StateMachine {...args} />
}

function StateMachine({ node, children: renderedChildren }: AdapterArgs<"state-machine">) {
  const { title, caption, initial, states, traces } = node.props
  const markerId = useId().replace(/:/g, "")
  const { events } = useMemo(() => normalizeMachineEvents(node.props.events), [node.props.events])
  const grid = node.props.grid ? parseGridRows(node.props.grid).cells : autoCells(states.map((s) => s.id), 4)
  const layout = layoutGrid(grid, METRICS)
  const offsets = pairOffsets(events)
  const [selected, setSelected] = useState(initial)
  const [trace, setTrace] = useState<{ name: string; step: number } | null>(null)
  const current = states.find((s) => s.id === selected)
  const children = node.children ?? []
  const screenIndex = current?.screen ? children.findIndex((child) => child.metadata?.id === current.screen) : -1

  const select = (id: string) => {
    setSelected(id)
    setTrace(null)
  }

  const stepTrace = (name: string) => {
    const t = traces?.find((tr) => tr.name === name)
    if (!t) return
    const path = replayTrace(initial, events, t.events)
    const step = trace?.name === name ? (trace.step + 1) % path.length : 0
    setTrace({ name, step })
    setSelected(path[step])
  }

  const onStateKey = (event: KeyboardEvent<SVGGElement>, id: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      select(id)
      return
    }
    if (!event.key.startsWith("Arrow")) return
    event.preventDefault()
    const outgoing = events.filter((e) => e.from === id && e.to !== id)
    if (!outgoing.length) return
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown"
    const targetId = forward ? outgoing[0].to : events.find((e) => e.to === id && e.from !== id)?.from
    if (!targetId) return
    select(targetId)
    const svg = event.currentTarget.ownerSVGElement
    svg?.querySelector<SVGGElement>(`[data-state="${CSS.escape(targetId)}"]`)?.focus()
  }

  const traceIndex = trace ? replayTrace(initial, events, traces?.find((t) => t.name === trace.name)?.events ?? []) : null

  return (
    <PlanFrame data-state-machine="">
      <PlanHeader chip="states" title={title} right={<span>{states.length} states · {events.length} events</span>} />
      <DiagramCanvas width={layout.width} height={layout.height + 20} label={title ?? "State machine"}>
        <ArrowDefs id={markerId} />
        {events.map((edge, index) => {
          const a = layout.boxes.get(edge.from)
          const b = layout.boxes.get(edge.to)
          if (!a || !b) return null
          const route = routeEdge(a, b, offsets[index], { backUnder: true })
          const active = edge.from === selected
          const stroke = edge.mark && edge.mark !== "context" ? markStroke(edge.mark) : active ? "var(--foreground)" : "var(--muted-foreground)"
          return (
            <g key={index} data-event={edge.event} opacity={active || edge.mark ? 1 : 0.7}>
              <path
                d={pointsToPath(route.points, route.kind)}
                fill="none"
                stroke={stroke}
                strokeWidth={active ? 2 : 1.4}
                strokeDasharray={edge.mark === "proposed" || edge.mark === "added" ? "8 5" : undefined}
                markerEnd={markerFor(markerId, edge.mark)}
              />
              <EdgeLabel x={route.label.x} y={route.label.y} text={edge.label ?? edge.event} />
            </g>
          )
        })}
        {states.map((state) => {
          const box = layout.boxes.get(state.id)
          if (!box) return null
          const isSelected = state.id === selected
          const stroke = state.mark && state.mark !== "context" ? markStroke(state.mark) : isSelected ? "var(--clay)" : "var(--foreground)"
          return (
            <g
              key={state.id}
              data-state={state.id}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`State ${state.label ?? state.id}${state.final ? ", final" : ""}${state.id === initial ? ", initial" : ""}`}
              onClick={() => select(state.id)}
              onKeyDown={(event) => onStateKey(event, state.id)}
              className="cursor-pointer outline-none [&:focus-visible>rect:first-of-type]:stroke-[3]"
            >
              {state.id === initial && <circle cx={box.x - 14} cy={box.cy} r={4} fill="var(--foreground)" />}
              <rect
                x={box.x}
                y={box.y}
                width={box.w}
                height={box.h}
                rx={box.h / 2}
                fill={isSelected ? "color-mix(in oklch, var(--clay), transparent 84%)" : "var(--card)"}
                stroke={stroke}
                strokeWidth={isSelected ? 2 : 1.4}
                strokeDasharray={state.mark === "proposed" || state.mark === "added" ? "8 5" : undefined}
              />
              {state.final && <rect x={box.x + 3} y={box.y + 3} width={box.w - 6} height={box.h - 6} rx={(box.h - 6) / 2} fill="none" stroke={stroke} strokeWidth={1} />}
              <text x={box.cx} y={box.cy + 4} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="var(--foreground)" fontFamily="var(--font-mono)">
                {state.label ?? state.id}
              </text>
            </g>
          )
        })}
      </DiagramCanvas>
      <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2 text-sm">
        <span className="font-mono text-xs text-muted-foreground">state</span>
        <span className="font-mono font-semibold" aria-live="polite">{current?.label ?? selected}</span>
        {current?.description && <span className="text-muted-foreground">— {current.description}</span>}
        {current?.sets && <code className="rounded bg-muted px-1.5 text-xs">sets {current.sets}</code>}
        {current?.code && <code className="rounded bg-muted px-1.5 text-xs text-muted-foreground">{current.code}</code>}
        {traces && traces.length > 0 && (
          <span className="ml-auto flex flex-wrap gap-1.5">
            {traces.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => stepTrace(t.name)}
                aria-label={`Step trace ${t.name}`}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 font-mono text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                  trace?.name === t.name && "border-clay bg-clay/10",
                )}
              >
                ▶ {t.name}
                {trace?.name === t.name && traceIndex && ` ${trace.step + 1}/${traceIndex.length}`}
              </button>
            ))}
          </span>
        )}
      </div>
      {children.length > 0 && (
        <div className="border-t bg-muted/30 p-4">
          {Children.toArray(renderedChildren).map((child, index) => (
            <div key={index} hidden={index !== screenIndex} data-screen={children[index]?.metadata?.id}>
              {child}
            </div>
          ))}
          {screenIndex < 0 && <p className="text-sm text-muted-foreground">No screen for this state.</p>}
        </div>
      )}
      {caption && <PlanCaption>{caption}</PlanCaption>}
    </PlanFrame>
  )
}
