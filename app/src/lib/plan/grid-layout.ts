// Pure layout for grid-placed diagrams (box-diagram, state-machine).
// Cells are fixed-size boxes; edges are orthogonal polylines between box sides.
import type { GridCells } from "@/lib/contract/artifact-manifest"

export type Box = { id: string; row: number; col: number; x: number; y: number; w: number; h: number; cx: number; cy: number }
export type Point = { x: number; y: number }
export type RouteKind = "row" | "column" | "elbow" | "loop" | "back"
export type Route = { kind: RouteKind; points: Point[]; label: Point }

export type GridMetrics = { cellW: number; cellH: number; boxW: number; boxH: number; pad: number }

export const DEFAULT_METRICS: GridMetrics = { cellW: 200, cellH: 112, boxW: 148, boxH: 44, pad: 24 }

export function layoutGrid(cells: GridCells, metrics: GridMetrics = DEFAULT_METRICS) {
  const boxes = new Map<string, Box>()
  const columns = Math.max(1, ...cells.map((row) => row.length))
  cells.forEach((row, r) =>
    row.forEach((id, c) => {
      if (!id) return
      const cx = metrics.pad + c * metrics.cellW + metrics.cellW / 2
      const cy = metrics.pad + r * metrics.cellH + metrics.cellH / 2
      boxes.set(id, { id, row: r, col: c, w: metrics.boxW, h: metrics.boxH, x: cx - metrics.boxW / 2, y: cy - metrics.boxH / 2, cx, cy })
    }),
  )
  return {
    boxes,
    width: metrics.pad * 2 + columns * metrics.cellW,
    height: metrics.pad * 2 + cells.length * metrics.cellH,
  }
}

/** Places ids without a grid: one row, in order. */
export function autoCells(ids: readonly string[], perRow = 3): GridCells {
  const rows: (string | null)[][] = []
  ids.forEach((id, index) => {
    if (index % perRow === 0) rows.push([])
    rows[rows.length - 1].push(id)
  })
  return rows
}

/**
 * Routes from box a to box b. `offset` shifts parallel edges (two-way pairs) apart.
 * Same row → straight horizontal; same column → straight vertical; otherwise an L
 * that leaves horizontally and enters vertically. Self-loop → small arc above.
 */
export function routeEdge(a: Box, b: Box, offset = 0, options: { backUnder?: boolean } = {}): Route {
  if (a.id === b.id) {
    const x = a.cx + a.w / 2 - 18
    const top = a.y
    return {
      kind: "loop",
      points: [{ x: x - 14, y: top }, { x: x - 14, y: top - 22 }, { x: x + 14, y: top - 22 }, { x: x + 14, y: top }],
      label: { x, y: top - 28 },
    }
  }
  if (a.row === b.row) {
    if (options.backUnder && b.col < a.col) {
      const under = a.y + a.h + 18 + Math.abs(offset)
      const points = [
        { x: a.cx, y: a.y + a.h },
        { x: a.cx, y: under },
        { x: b.cx, y: under },
        { x: b.cx, y: b.y + b.h },
      ]
      return { kind: "back", points, label: { x: (a.cx + b.cx) / 2, y: under + 12 } }
    }
    const dir = b.cx > a.cx ? 1 : -1
    const y = a.cy + offset
    const points = [{ x: a.cx + (dir * a.w) / 2, y }, { x: b.cx - (dir * b.w) / 2, y }]
    return { kind: "row", points, label: { x: (points[0].x + points[1].x) / 2, y: y - 8 } }
  }
  if (a.col === b.col) {
    const dir = b.cy > a.cy ? 1 : -1
    const x = a.cx + offset
    const points = [{ x, y: a.cy + (dir * a.h) / 2 }, { x, y: b.cy - (dir * b.h) / 2 }]
    return { kind: "column", points, label: { x: x + 8, y: (points[0].y + points[1].y) / 2 } }
  }
  const dirX = b.cx > a.cx ? 1 : -1
  const dirY = b.cy > a.cy ? 1 : -1
  const start = { x: a.cx + (dirX * a.w) / 2, y: a.cy + offset }
  const corner = { x: b.cx + offset, y: start.y }
  const end = { x: corner.x, y: b.cy - (dirY * b.h) / 2 }
  return { kind: "elbow", points: [start, corner, end], label: { x: (start.x + corner.x) / 2, y: start.y - 8 } }
}

export function pointsToPath(points: readonly Point[], kind: RouteKind): string {
  if (kind === "loop") {
    const [p0, p1, p2, p3] = points
    return `M${p0.x},${p0.y} C${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`
  }
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ")
}

/** Offsets for edges sharing the same unordered pair, so two-way pairs separate by ±6px. */
export function pairOffsets(edges: readonly { from: string; to: string }[]): number[] {
  const counts = new Map<string, number>()
  const key = (edge: { from: string; to: string }) => [edge.from, edge.to].sort().join("\u0000")
  edges.forEach((edge) => counts.set(key(edge), (counts.get(key(edge)) ?? 0) + 1))
  return edges.map((edge) => {
    if ((counts.get(key(edge)) ?? 0) < 2 || edge.from === edge.to) return 0
    return edge.from < edge.to ? -6 : 6
  })
}
