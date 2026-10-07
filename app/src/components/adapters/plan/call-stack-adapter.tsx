"use client"

// call-stack: an indented trace with a change-mark rail. Selecting a row shows
// its excerpt (structured code-block) below the list.
import { useMemo, useState, type KeyboardEvent } from "react"

import type { AdapterArgs } from "@/components/artifact-types"
import { StructuredCodeBlock } from "@/components/ui/code-block-structured"
import { countEntrypoints, normalizeCallStackRows, type CallKind, type CallRow } from "@/lib/contract/artifact-manifest"
import { cn } from "@/lib/utils"

import { InlineBold, MARK_GLYPH, MARK_LABEL, PlanCaption, PlanFrame, PlanHeader, markRowClass, markTextClass } from "./plan-ui"

const KIND_GLYPH: Record<CallKind, string> = { call: "ƒ", ui: "◧", net: "⇄", cond: "◇", io: "▤", gap: "⋯" }
const KIND_LABEL: Record<CallKind, string> = { call: "call", ui: "UI", net: "network", cond: "branch", io: "I/O", gap: "elided" }

export function sourceHref(at: string | undefined, repo: { baseUrl?: string; ref?: string } | undefined): string | undefined {
  if (!at || !repo?.baseUrl) return undefined
  const match = /^(.+?):(\d+)(?:-(\d+))?$/.exec(at)
  if (!match) return undefined
  const [, file, start, end] = match
  return `${repo.baseUrl.replace(/\/$/, "")}/blob/${repo.ref ?? "main"}/${file}#L${start}${end ? `-L${end}` : ""}`
}

export function renderCallStack(args: AdapterArgs<"call-stack">) {
  return <CallStack {...args} />
}

function CallStack({ node, nodePath }: AdapterArgs<"call-stack">) {
  const { title, caption, repo, initialRow } = node.props
  const rows = useMemo(() => normalizeCallStackRows(node.props.rows).rows, [node.props.rows])
  const firstExcerpt = rows.findIndex((row) => row.excerpt)
  const [selected, setSelected] = useState<number>(initialRow ?? (firstExcerpt >= 0 ? firstExcerpt : -1))
  const entrypoints = countEntrypoints(rows)
  const changed = rows.filter((row) => row.mark !== "context").length
  const panelId = `${nodePath.replace(/\W+/g, "-")}-excerpt`
  const current: CallRow | undefined = rows[selected]

  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0
    if (!delta) return
    event.preventDefault()
    const next = Math.max(0, Math.min(rows.length - 1, index + delta))
    const list = event.currentTarget.closest("[data-call-rows]")
    list?.querySelectorAll<HTMLButtonElement>("button[data-row]")[next]?.focus()
  }

  return (
    <PlanFrame data-call-stack="">
      <PlanHeader
        chip="calls"
        title={title}
        right={
          <>
            <span>{rows.length} frames</span>
            {entrypoints > 1 && <span>· {entrypoints} entrypoints</span>}
            {changed > 0 && <span>· {changed} touched</span>}
          </>
        }
      />
      <ol className="overflow-x-auto py-1 font-mono text-[13px] leading-6" data-call-rows aria-label={title ?? "Call stack"}>
        {rows.map((row, index) => {
          const isEntry = row.depth === 0 && index > 0
          const isSelected = index === selected
          const href = sourceHref(row.at, repo)
          return (
            <li
              key={index}
              id={row.id ? `cs-row-${row.id}` : undefined}
              className={cn("min-w-max scroll-mt-24", isEntry && "mt-1 border-t border-dashed pt-1", markRowClass(row.mark))}
            >
              <div className={cn("flex items-baseline", isSelected && row.excerpt && "bg-accent/50 shadow-[inset_2px_0_0_var(--clay)]")}>
                <span className={cn("w-6 shrink-0 select-none text-center font-semibold", markTextClass(row.mark))} aria-label={row.mark === "context" ? undefined : MARK_LABEL[row.mark]}>
                  {MARK_GLYPH[row.mark]}
                </span>
                <button
                  type="button"
                  data-row={index}
                  disabled={!row.excerpt}
                  aria-pressed={row.excerpt ? isSelected : undefined}
                  aria-controls={row.excerpt ? panelId : undefined}
                  onClick={() => setSelected(index)}
                  onKeyDown={(event) => onKey(event, index)}
                  className={cn(
                    "flex min-w-0 items-baseline gap-2 rounded-sm pr-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    row.excerpt ? "cursor-pointer hover:underline hover:decoration-dotted" : "cursor-default",
                  )}
                  style={{ paddingLeft: `${row.depth * 1.25}rem` }}
                >
                  <span className="w-4 shrink-0 text-center text-muted-foreground" title={KIND_LABEL[row.kind]} aria-hidden="true">
                    {KIND_GLYPH[row.kind]}
                  </span>
                  <span className={cn("whitespace-nowrap text-foreground", row.kind === "gap" && "text-muted-foreground", row.mark === "removed" && "line-through decoration-change-removed/70")}>
                    <InlineBold text={row.call} />
                  </span>
                  {row.note && <span className="whitespace-nowrap font-sans text-[13px] text-muted-foreground">— {row.note}</span>}
                </button>
                {row.at &&
                  (href ? (
                    <a href={href} target="_blank" rel="noreferrer" className="ml-auto whitespace-nowrap pl-4 pr-4 text-xs text-muted-foreground underline-offset-2 hover:underline">
                      {row.at}
                    </a>
                  ) : (
                    <span className="ml-auto whitespace-nowrap pl-4 pr-4 text-xs text-muted-foreground">{row.at}</span>
                  ))}
              </div>
            </li>
          )
        })}
      </ol>
      {current?.excerpt && (
        <div id={panelId} className="border-t bg-muted/30 p-3" aria-live="polite">
          <StructuredCodeBlock
            code={current.excerpt.code}
            language={current.excerpt.language ?? "typescript"}
            startLine={current.excerpt.startLine ?? (Number(/:(\d+)/.exec(current.at ?? "")?.[1]) || 1)}
            title={current.at ?? current.call.replace(/\*\*/g, "")}
          />
        </div>
      )}
      {caption && <PlanCaption>{caption}</PlanCaption>}
    </PlanFrame>
  )
}
