// box-diagram: boxes placed on an explicit grid, joined by orthogonal edges.
import { useId } from "react"

import type { AdapterArgs } from "@/components/artifact-types"
import { normalizeBoxEdges, parseGridRows, type BoxEdge } from "@/lib/contract/artifact-manifest"
import { layoutGrid, pairOffsets, pointsToPath, routeEdge, type Box } from "@/lib/plan/grid-layout"

import { ArrowDefs, DiagramCanvas, EdgeLabel, markerFor } from "./diagram-svg"
import { PlanCaption, PlanFrame, PlanHeader, markStroke } from "./plan-ui"

type Tone = "default" | "accent" | "green" | "amber" | "red" | "blue" | "muted"
const TONE: Record<Tone, { fill: string; stroke: string; meaning?: string }> = {
  default: { fill: "var(--card)", stroke: "var(--foreground)" },
  accent: { fill: "color-mix(in oklch, var(--clay), transparent 86%)", stroke: "var(--clay)" },
  green: { fill: "color-mix(in oklch, var(--change-added), transparent 88%)", stroke: "var(--change-added)" },
  amber: { fill: "color-mix(in oklch, var(--change-changed), transparent 88%)", stroke: "var(--change-changed)" },
  red: { fill: "color-mix(in oklch, var(--change-removed), transparent 88%)", stroke: "var(--change-removed)" },
  blue: { fill: "color-mix(in oklch, var(--chart-2, #3b82f6), transparent 86%)", stroke: "var(--chart-2, #3b82f6)" },
  muted: { fill: "var(--muted)", stroke: "var(--muted-foreground)" },
}

const DASH_PROPOSED = "8 5"
const DASH_DASHED = "3 4"

function edgeDash(edge: BoxEdge) {
  if (edge.mark === "proposed" || edge.mark === "added") return DASH_PROPOSED
  if (edge.style === "dashed") return DASH_DASHED
  return undefined
}

function Shape({ box, shape, tone, mark }: { box: Box; shape: string; tone: Tone; mark?: string }) {
  const { fill } = TONE[tone]
  const stroke = mark && mark !== "context" ? markStroke(mark as never) : TONE[tone].stroke
  const dash = mark === "proposed" || mark === "added" ? DASH_PROPOSED : undefined
  const common = { fill, stroke, strokeWidth: 1.5, strokeDasharray: dash }
  const { x, y, w, h, cx, cy } = box
  switch (shape) {
    case "pill":
      return <rect x={x} y={y} width={w} height={h} rx={h / 2} {...common} />
    case "circle":
      return <ellipse cx={cx} cy={cy} rx={w / 2} ry={h / 2 + 6} {...common} />
    case "diamond":
      return <polygon points={`${cx},${y - 8} ${x + w},${cy} ${cx},${y + h + 8} ${x},${cy}`} {...common} />
    case "db":
      return (
        <g>
          <path d={`M${x},${y + 6} L${x},${y + h - 6} A${w / 2},6 0 0 0 ${x + w},${y + h - 6} L${x + w},${y + 6}`} {...common} />
          <ellipse cx={cx} cy={y + 6} rx={w / 2} ry={6} {...common} />
        </g>
      )
    case "note":
      return <path d={`M${x},${y} L${x + w - 12},${y} L${x + w},${y + 12} L${x + w},${y + h} L${x},${y + h} Z`} {...common} />
    case "actor":
      return (
        <g {...common} fill="none">
          <circle cx={x + 16} cy={cy - 8} r={6} />
          <path d={`M${x + 16},${cy - 2} L${x + 16},${cy + 10} M${x + 8},${cy + 2} L${x + 24},${cy + 2} M${x + 16},${cy + 10} L${x + 10},${cy + 18} M${x + 16},${cy + 10} L${x + 22},${cy + 18}`} />
        </g>
      )
    default:
      return <rect x={x} y={y} width={w} height={h} rx={6} {...common} />
  }
}

export function renderBoxDiagram({ node }: AdapterArgs<"box-diagram">) {
  return <BoxDiagram node={node} />
}

function BoxDiagram({ node }: Pick<AdapterArgs<"box-diagram">, "node">) {
  const { title, caption, grid, groups, dashed } = node.props
  const markerId = useId().replace(/:/g, "")
  const { edges } = normalizeBoxEdges(node.props.edges)
  const layout = layoutGrid(parseGridRows(grid).cells)
  const offsets = pairOffsets(edges)
  const byId = new Map(node.props.nodes.map((n) => [n.id, n]))
  const tonesUsed = new Set(node.props.nodes.map((n) => n.tone ?? "default"))
  const anyProposed = node.props.nodes.some((n) => n.mark === "proposed" || n.mark === "added") || edges.some((e) => e.mark === "proposed" || e.mark === "added")
  const anyDashed = edges.some((e) => e.style === "dashed")
  const label = title ?? caption ?? "Box diagram"

  return (
    <PlanFrame data-box-diagram="">
      <PlanHeader chip="diagram" title={title} />
      <DiagramCanvas width={layout.width} height={layout.height} label={label}>
        <ArrowDefs id={markerId} />
        {groups?.map((group, gi) => {
          const boxes = group.ids.map((id) => layout.boxes.get(id)).filter((b): b is Box => !!b)
          if (!boxes.length) return null
          const x = Math.min(...boxes.map((b) => b.x)) - 14
          const y = Math.min(...boxes.map((b) => b.y)) - 26
          const r = Math.max(...boxes.map((b) => b.x + b.w)) + 14
          const bottom = Math.max(...boxes.map((b) => b.y + b.h)) + 14
          return (
            <g key={gi}>
              <rect x={x} y={y} width={r - x} height={bottom - y} rx={10} fill="none" stroke="var(--border)" strokeDasharray="2 4" />
              <text x={x + 10} y={y + 14} fontSize={10} fill="var(--muted-foreground)" fontFamily="var(--font-mono)" style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {group.label}
              </text>
            </g>
          )
        })}
        {edges.map((edge, index) => {
          const a = layout.boxes.get(edge.from)
          const b = layout.boxes.get(edge.to)
          if (!a || !b) return null
          const route = routeEdge(a, b, offsets[index])
          const stroke = edge.mark && edge.mark !== "context" ? markStroke(edge.mark) : "var(--muted-foreground)"
          const marker = markerFor(markerId, edge.mark)
          return (
            <g key={index} data-edge={`${edge.from}-${edge.to}`}>
              <path
                d={pointsToPath(route.points, route.kind)}
                fill="none"
                stroke={stroke}
                strokeWidth={edge.style === "bold" ? 2.5 : 1.5}
                strokeDasharray={edgeDash(edge)}
                markerEnd={marker}
                markerStart={edge.both ? marker : undefined}
              />
              {edge.label && <EdgeLabel x={route.label.x} y={route.label.y} text={edge.label} />}
            </g>
          )
        })}
        {[...layout.boxes.values()].map((box) => {
          const spec = byId.get(box.id)
          if (!spec) return null
          const shape = spec.shape ?? "box"
          const textX = shape === "actor" ? box.x + 32 : box.cx
          const anchor = shape === "actor" ? "start" : "middle"
          const body = (
            <g data-box={box.id}>
              <title>{[spec.label, spec.sub].filter(Boolean).join(" — ")}</title>
              <Shape box={box} shape={shape} tone={spec.tone ?? "default"} mark={spec.mark} />
              <text x={textX} y={spec.sub ? box.cy - 3 : box.cy + 4} textAnchor={anchor} fontSize={12.5} fontWeight={600} fill="var(--foreground)" style={spec.mark === "removed" ? { textDecoration: "line-through" } : undefined}>
                {spec.label}
              </text>
              {spec.sub && (
                <text x={textX} y={box.cy + 12} textAnchor={anchor} fontSize={10.5} fill="var(--muted-foreground)" fontFamily="var(--font-mono)">
                  {spec.sub}
                </text>
              )}
            </g>
          )
          return spec.href ? (
            <a key={box.id} href={spec.href} aria-label={`${spec.label}: go to ${spec.href.slice(1)}`}>
              {body}
            </a>
          ) : (
            <g key={box.id}>{body}</g>
          )
        })}
      </DiagramCanvas>
      {(anyProposed || anyDashed || [...tonesUsed].some((t) => t !== "default")) && (
        <ul className="flex flex-wrap gap-x-5 gap-y-1 border-t px-4 py-2 text-xs text-muted-foreground" aria-label="Legend">
          {anyProposed && (
            <li className="flex items-center gap-2">
              <svg width="28" height="8" aria-hidden="true"><line x1="0" y1="4" x2="28" y2="4" stroke="var(--change-added)" strokeWidth="1.5" strokeDasharray={DASH_PROPOSED} /></svg>
              proposed
            </li>
          )}
          {anyDashed && (
            <li className="flex items-center gap-2">
              <svg width="28" height="8" aria-hidden="true"><line x1="0" y1="4" x2="28" y2="4" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeDasharray={DASH_DASHED} /></svg>
              {dashed ?? "dashed"}
            </li>
          )}
        </ul>
      )}
      {caption && <PlanCaption>{caption}</PlanCaption>}
    </PlanFrame>
  )
}
