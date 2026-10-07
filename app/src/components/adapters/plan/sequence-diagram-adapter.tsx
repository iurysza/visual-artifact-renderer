// sequence-diagram: participants as lifelines, steps top to bottom.
import { useId } from "react"

import type { AdapterArgs } from "@/components/artifact-types"
import { normalizeSequenceSteps } from "@/lib/contract/artifact-manifest"

import { ArrowDefs, markerFor } from "./diagram-svg"
import { PlanCaption, PlanFrame, PlanHeader, markStroke } from "./plan-ui"

const COL = 168
const PAD = 24
const HEAD = 52
const ROW = 40

const KIND_GLYPH: Record<string, string> = { actor: "◉", service: "▣", store: "⛁", external: "◌" }

export function renderSequenceDiagram({ node }: AdapterArgs<"sequence-diagram">) {
  return <SequenceDiagram node={node} />
}

function SequenceDiagram({ node }: Pick<AdapterArgs<"sequence-diagram">, "node">) {
  const { title, caption, participants } = node.props
  const markerId = useId().replace(/:/g, "")
  const { steps } = normalizeSequenceSteps(node.props.steps)
  // Mono 12px ≈ 7.3px per glyph: each participant gets a box that fits its label,
  // and lifelines sit at cumulative centres so long labels don't widen every column.
  const boxW = new Map(participants.map((p) => [p.id, Math.max(112, Math.ceil(((p.label ?? p.id).length + (p.kind ? 2 : 0)) * 7.3) + 24)]))
  const x = new Map<string, number>()
  let cursor = PAD
  participants.forEach((p, i) => {
    const w = Math.max(boxW.get(p.id)!, i === 0 ? 0 : COL - 32)
    x.set(p.id, cursor + w / 2)
    cursor += w + 32
  })
  const width = cursor - 32 + PAD
  const height = HEAD + steps.length * ROW + 24
  const anyProposed = participants.some((p) => p.mark === "proposed" || p.mark === "added") || steps.some((s) => s.kind === "message" && (s.mark === "proposed" || s.mark === "added"))

  return (
    <PlanFrame data-sequence-diagram="">
      <PlanHeader chip="sequence" title={title} right={<span>{participants.length} participants · {steps.length} steps</span>} />
      <div className="va-scroll-fade va-dot-grid" tabIndex={0} role="region" aria-label={`${title ?? caption} (scrolls horizontally)`}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="mx-auto block max-w-none" role="img" aria-label={caption}>
          <ArrowDefs id={markerId} />
          {participants.map((p) => {
            const cx = x.get(p.id)!
            const stroke = p.mark && p.mark !== "context" ? markStroke(p.mark) : "var(--foreground)"
            return (
              <g key={p.id} data-participant={p.id}>
                <line x1={cx} y1={HEAD} x2={cx} y2={height - 8} stroke="var(--border)" strokeWidth={1.2} strokeDasharray="4 4" />
                <rect x={cx - boxW.get(p.id)! / 2} y={10} width={boxW.get(p.id)!} height={30} rx={6} fill="var(--card)" stroke={stroke} strokeWidth={1.4} strokeDasharray={p.mark === "proposed" || p.mark === "added" ? "8 5" : undefined} />
                <text x={cx} y={30} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--foreground)" fontFamily="var(--font-mono)">
                  {p.kind ? `${KIND_GLYPH[p.kind]} ` : ""}
                  {p.label ?? p.id}
                </text>
              </g>
            )
          })}
          {steps.map((step, index) => {
            const y = HEAD + index * ROW + ROW / 2 + 6
            if (step.kind === "divider") {
              return (
                <g key={index}>
                  <line x1={PAD} y1={y} x2={width - PAD} y2={y} stroke="var(--border)" strokeDasharray="2 3" />
                  <rect x={width / 2 - step.text.length * 3.4 - 8} y={y - 9} width={step.text.length * 6.8 + 16} height={18} rx={9} fill="var(--muted)" />
                  <text x={width / 2} y={y + 4} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)" fontFamily="var(--font-mono)">{step.text}</text>
                </g>
              )
            }
            if (step.kind === "note") {
              const xs = step.over.map((id) => x.get(id) ?? PAD)
              const left = Math.min(...xs) - 70
              const right = Math.max(...xs) + 70
              return (
                <g key={index}>
                  <rect x={left} y={y - 13} width={right - left} height={24} rx={4} fill="color-mix(in oklch, var(--change-changed), transparent 85%)" stroke="var(--change-changed)" strokeWidth={0.8} />
                  <text x={(left + right) / 2} y={y + 3} textAnchor="middle" fontSize={11.5} fill="var(--foreground)">{step.text}</text>
                </g>
              )
            }
            const x1 = x.get(step.from) ?? PAD
            const x2 = x.get(step.to) ?? PAD
            const self = step.from === step.to
            const stroke = step.mark && step.mark !== "context" ? markStroke(step.mark) : "var(--foreground)"
            const dash = step.mark === "proposed" || step.mark === "added" ? "8 5" : step.style === "reply" ? "4 3" : undefined
            const end = step.style === "lost" ? x1 + (x2 - x1) * 0.7 : x2 + (x2 > x1 ? -4 : 4)
            const path = self ? `M${x1},${y - 6} h28 v14 h-26` : `M${x1},${y} L${end},${y}`
            return (
              <g key={index} data-step={index}>
                <path d={path} fill="none" stroke={stroke} strokeWidth={1.4} strokeDasharray={dash} markerEnd={step.style === "lost" ? undefined : markerFor(markerId, step.mark)} />
                {step.style === "lost" && <text x={end + 2} y={y + 4} fontSize={13} fill="var(--change-removed)">✕</text>}
                <text x={self ? x1 + 34 : (x1 + x2) / 2} y={self ? y + 4 : y - 6} textAnchor={self ? "start" : "middle"} fontSize={11.5} fill="var(--foreground)" fontFamily="var(--font-mono)">
                  {step.text}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      {anyProposed && (
        <ul className="flex gap-4 border-t px-4 py-2 text-xs text-muted-foreground" aria-label="Legend">
          <li className="flex items-center gap-2">
            <svg width="28" height="8" aria-hidden="true"><line x1="0" y1="4" x2="28" y2="4" stroke="var(--change-added)" strokeWidth="1.5" strokeDasharray="8 5" /></svg>
            proposed
          </li>
        </ul>
      )}
      <PlanCaption>{caption}</PlanCaption>
    </PlanFrame>
  )
}
