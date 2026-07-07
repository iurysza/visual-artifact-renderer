"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  parseUnifiedDiff,
  type DiffFile,
  type DiffLine,
  splitLines,
} from "@/lib/diff-parser"

export type DiffMode = "unified" | "split"
export type DiffIndicator = "bars" | "plus-minus" | "none"
export type HunkSeparatorStyle = "default" | "custom"

export type DiffProps = {
  before?: string
  after?: string
  content?: string
  language?: string
  title?: string
  defaultOpen?: boolean
  mode?: DiffMode
  showLineNumbers?: boolean
  indicators?: DiffIndicator
  highlightInline?: boolean
  hunkSeparator?: HunkSeparatorStyle
  caption?: string
  className?: string
}

function computeDiff(a: string[], b: string[]): DiffFile {
  const n = a.length
  const m = b.length

  if (n === 0 && m === 0) {
    return { oldPath: "", newPath: "", hunks: [] }
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: m + 1 }, () => 0)
  )

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  const ops: {
    type: "context" | "remove" | "add"
    oldIndex: number
    newIndex: number
  }[] = []

  let i = n
  let j = m

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push({ type: "context", oldIndex: i - 1, newIndex: j - 1 })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: "add", oldIndex: -1, newIndex: j - 1 })
      j--
    } else {
      ops.push({ type: "remove", oldIndex: i - 1, newIndex: -1 })
      i--
    }
  }

  ops.reverse()

  const lines: DiffLine[] = ops.map((op) => {
    if (op.type === "context") {
      return {
        type: "context",
        value: a[op.oldIndex],
        oldLine: op.oldIndex + 1,
        newLine: op.newIndex + 1,
      }
    }
    if (op.type === "remove") {
      return { type: "remove", value: a[op.oldIndex], oldLine: op.oldIndex + 1 }
    }
    return { type: "add", value: b[op.newIndex], newLine: op.newIndex + 1 }
  })

  return {
    oldPath: "",
    newPath: "",
    hunks: [
      {
        oldStart: 1,
        oldLines: n,
        newStart: 1,
        newLines: m,
        lines,
      },
    ],
  }
}

function buildHunksFromContentOrDiff(
  content: string | undefined,
  before: string | undefined,
  after: string | undefined
): DiffFile {
  if (content) return parseUnifiedDiff(content)
  if (before !== undefined && after !== undefined) {
    return computeDiff(splitLines(before), splitLines(after))
  }
  return { oldPath: "", newPath: "", hunks: [] }
}

function inlineDiffSegments(oldLine: string, newLine: string): {
  oldSegments: { value: string; changed: boolean }[]
  newSegments: { value: string; changed: boolean }[]
} {
  const a = oldLine.split("")
  const b = newLine.split("")
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: m + 1 }, () => 0)
  )

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  const oldOps: { type: "equal" | "remove"; index: number }[] = []
  const newOps: { type: "equal" | "add"; index: number }[] = []

  let i = n
  let j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      oldOps.unshift({ type: "equal", index: i - 1 })
      newOps.unshift({ type: "equal", index: j - 1 })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      newOps.unshift({ type: "add", index: j - 1 })
      j--
    } else {
      oldOps.unshift({ type: "remove", index: i - 1 })
      i--
    }
  }

  const oldSegments: { value: string; changed: boolean }[] = []
  const newSegments: { value: string; changed: boolean }[] = []

  for (const op of oldOps) {
    const char = a[op.index]
    if (oldSegments.length === 0 || oldSegments[oldSegments.length - 1].changed !== (op.type === "remove")) {
      oldSegments.push({ value: char, changed: op.type === "remove" })
    } else {
      oldSegments[oldSegments.length - 1].value += char
    }
  }

  for (const op of newOps) {
    const char = b[op.index]
    if (newSegments.length === 0 || newSegments[newSegments.length - 1].changed !== (op.type === "add")) {
      newSegments.push({ value: char, changed: op.type === "add" })
    } else {
      newSegments[newSegments.length - 1].value += char
    }
  }

  return { oldSegments, newSegments }
}

function InlineDiff({ oldValue, newValue }: { oldValue: string; newValue: string }) {
  const { oldSegments, newSegments } = inlineDiffSegments(oldValue, newValue)
  return (
    <>
      <span className="inline-flex">
        {oldSegments.map((seg, i) => (
          <span
            key={`old-${i}`}
            className={cn(seg.changed && "bg-rust/30 rounded-sm px-0.5")}
          >
            {seg.value}
          </span>
        ))}
      </span>
      <span className="mx-1 text-muted-foreground">→</span>
      <span className="inline-flex">
        {newSegments.map((seg, i) => (
          <span
            key={`new-${i}`}
            className={cn(seg.changed && "bg-olive/30 rounded-sm px-0.5")}
          >
            {seg.value}
          </span>
        ))}
      </span>
    </>
  )
}

function LineContent({
  line,
  highlightInline,
  pair,
}: {
  line: DiffLine
  highlightInline: boolean
  pair?: DiffLine
}) {
  if (highlightInline && line.type === "remove" && pair?.type === "add") {
    return <InlineDiff oldValue={line.value} newValue={pair.value} />
  }
  return <span>{line.value}</span>
}

function UnifiedRow({
  line,
  showLineNumbers,
  indicators,
  highlightInline,
  pair,
}: {
  line: DiffLine
  showLineNumbers: boolean
  indicators: DiffIndicator
  highlightInline: boolean
  pair?: DiffLine
}) {
  const indicator =
    line.type === "remove" ? "−" : line.type === "add" ? "+" : ""
  const rowClass = cn(
    "font-mono text-sm",
    line.type === "remove" && "bg-rust/8 text-rust",
    line.type === "add" && "bg-olive/8 text-olive",
    line.type === "context" && "text-card-foreground"
  )

  const barClass = cn(
    "w-1 shrink-0 self-stretch",
    line.type === "remove" && "bg-rust",
    line.type === "add" && "bg-olive",
    line.type === "context" && "bg-transparent"
  )

  return (
    <tr className={rowClass}>
      {indicators === "bars" && <td className={barClass} />}
      {indicators === "plus-minus" && (
        <td className="w-6 select-none px-1 py-0.5 text-center text-xs font-medium opacity-80">
          {indicator}
        </td>
      )}
      {showLineNumbers && (
        <>
          <td className="w-10 min-w-10 select-none px-2 py-0.5 text-right text-xs text-muted-foreground">
            {line.oldLine ?? ""}
          </td>
          <td className="w-10 min-w-10 select-none px-2 py-0.5 text-right text-xs text-muted-foreground">
            {line.newLine ?? ""}
          </td>
        </>
      )}
      <td className="w-full whitespace-pre px-3 py-0.5">
        <LineContent line={line} highlightInline={highlightInline} pair={pair} />
      </td>
    </tr>
  )
}

function SplitRow({
  oldLine,
  newLine,
  showLineNumbers,
  indicators,
  highlightInline,
}: {
  oldLine?: DiffLine
  newLine?: DiffLine
  showLineNumbers: boolean
  indicators: DiffIndicator
  highlightInline: boolean
}) {
  const oldContent = oldLine ? (
    <LineContent line={oldLine} highlightInline={highlightInline} pair={newLine} />
  ) : null
  const newContent = newLine ? (
    <LineContent line={newLine} highlightInline={highlightInline} pair={oldLine} />
  ) : null

  const cellClass = "w-full whitespace-pre px-3 py-0.5 font-mono text-sm"
  const oldClass = cn(
    cellClass,
    oldLine?.type === "remove" && "bg-rust/8 text-rust"
  )
  const newClass = cn(
    cellClass,
    newLine?.type === "add" && "bg-olive/8 text-olive"
  )

  const oldBar = cn(
    "w-1 shrink-0 self-stretch",
    oldLine?.type === "remove" ? "bg-rust" : "bg-transparent"
  )
  const newBar = cn(
    "w-1 shrink-0 self-stretch",
    newLine?.type === "add" ? "bg-olive" : "bg-transparent"
  )

  return (
    <tr>
      {indicators === "bars" && (
        <>
          <td className={oldBar} />
          <td className={newBar} />
        </>
      )}
      {indicators === "plus-minus" && (
        <>
          <td className="w-6 select-none px-1 py-0.5 text-center text-xs font-medium text-rust">
            {oldLine?.type === "remove" ? "−" : ""}
          </td>
          <td className="w-6 select-none px-1 py-0.5 text-center text-xs font-medium text-olive">
            {newLine?.type === "add" ? "+" : ""}
          </td>
        </>
      )}
      {showLineNumbers && (
        <>
          <td className="w-10 min-w-10 select-none px-2 py-0.5 text-right text-xs text-muted-foreground">
            {oldLine?.oldLine ?? ""}
          </td>
          <td className={cn(oldClass, "border-r border-border")}>{oldContent}</td>
          <td className="w-10 min-w-10 select-none px-2 py-0.5 text-right text-xs text-muted-foreground">
            {newLine?.newLine ?? ""}
          </td>
          <td className={newClass}>{newContent}</td>
        </>
      )}
      {!showLineNumbers && (
        <>
          <td className={cn(oldClass, "border-r border-border")}>{oldContent}</td>
          <td className={newClass}>{newContent}</td>
        </>
      )}
    </tr>
  )
}

function UnifiedTable({
  diff,
  showLineNumbers,
  indicators,
  highlightInline,
  hunkSeparator,
}: {
  diff: DiffFile
  showLineNumbers: boolean
  indicators: DiffIndicator
  highlightInline: boolean
  hunkSeparator: HunkSeparatorStyle
}) {
  const rows: React.ReactNode[] = []
  let rowIndex = 0

  for (const hunk of diff.hunks) {
    if (rows.length > 0) {
      rows.push(
        <tr
          key={`sep-${rowIndex++}`}
          className={cn(
            "h-px",
            hunkSeparator === "default"
              ? "border-t border-dashed border-border"
              : "bg-muted"
          )}
        >
          <td
            colSpan={
              (indicators === "bars" ? 1 : 0) +
              (indicators === "plus-minus" ? 1 : 0) +
              (showLineNumbers ? 2 : 0) +
              1
            }
            className="px-3 py-1 text-center text-xs text-muted-foreground"
          >
            {hunkSeparator === "custom" && hunk.header
              ? `@@ ${hunk.header} @@`
              : ""}
          </td>
        </tr>
      )
    }

    for (let i = 0; i < hunk.lines.length; i++) {
      const line = hunk.lines[i]
      const pair =
        line.type === "remove" && hunk.lines[i + 1]?.type === "add"
          ? hunk.lines[i + 1]
          : undefined
      rows.push(
        <UnifiedRow
          key={rowIndex++}
          line={line}
          showLineNumbers={showLineNumbers}
          indicators={indicators}
          highlightInline={highlightInline}
          pair={pair}
        />
      )
    }
  }

  return (
    <table className="w-full border-collapse">
      <tbody>{rows}</tbody>
    </table>
  )
}

function SplitTable({
  diff,
  showLineNumbers,
  indicators,
  highlightInline,
  hunkSeparator,
}: {
  diff: DiffFile
  showLineNumbers: boolean
  indicators: DiffIndicator
  highlightInline: boolean
  hunkSeparator: HunkSeparatorStyle
}) {
  const rows: React.ReactNode[] = []
  let rowIndex = 0

  for (const hunk of diff.hunks) {
    if (rows.length > 0) {
      rows.push(
        <tr
          key={`sep-${rowIndex++}`}
          className={cn(
            "h-px",
            hunkSeparator === "default"
              ? "border-t border-dashed border-border"
              : "bg-muted"
          )}
        >
          <td
            colSpan={
              (indicators === "bars" ? 2 : 0) +
              (indicators === "plus-minus" ? 2 : 0) +
              (showLineNumbers ? 4 : 2)
            }
            className="px-3 py-1 text-center text-xs text-muted-foreground"
          >
            {hunkSeparator === "custom" && hunk.header
              ? `@@ ${hunk.header} @@`
              : ""}
          </td>
        </tr>
      )
    }

    for (let i = 0; i < hunk.lines.length; i++) {
      const line = hunk.lines[i]
      if (line.type === "remove") {
        const next = hunk.lines[i + 1]
        if (next?.type === "add") {
          rows.push(
            <SplitRow
              key={rowIndex++}
              oldLine={line}
              newLine={next}
              showLineNumbers={showLineNumbers}
              indicators={indicators}
              highlightInline={highlightInline}
            />
          )
          i++
        } else {
          rows.push(
            <SplitRow
              key={rowIndex++}
              oldLine={line}
              showLineNumbers={showLineNumbers}
              indicators={indicators}
              highlightInline={highlightInline}
            />
          )
        }
      } else if (line.type === "add") {
        rows.push(
          <SplitRow
            key={rowIndex++}
            newLine={line}
            showLineNumbers={showLineNumbers}
            indicators={indicators}
            highlightInline={highlightInline}
          />
        )
      } else {
        rows.push(
          <SplitRow
            key={rowIndex++}
            oldLine={line}
            newLine={line}
            showLineNumbers={showLineNumbers}
            indicators={indicators}
            highlightInline={highlightInline}
          />
        )
      }
    }
  }

  return (
    <table className="w-full border-collapse">
      <tbody>{rows}</tbody>
    </table>
  )
}

export function Diff({
  before,
  after,
  content,
  language,
  title,
  defaultOpen = true,
  mode = "unified",
  showLineNumbers = true,
  indicators = "plus-minus",
  highlightInline = false,
  hunkSeparator = "default",
  caption,
  className,
}: DiffProps) {
  const diff = React.useMemo(
    () => buildHunksFromContentOrDiff(content, before, after),
    [content, before, after]
  )

  const added = React.useMemo(
    () =>
      diff.hunks.reduce(
        (acc, hunk) => acc + hunk.lines.filter((l) => l.type === "add").length,
        0
      ),
    [diff]
  )
  const removed = React.useMemo(
    () =>
      diff.hunks.reduce(
        (acc, hunk) =>
          acc + hunk.lines.filter((l) => l.type === "remove").length,
        0
      ),
    [diff]
  )

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <Card data-slot="diff" className={cn("overflow-hidden", className)}>
        <CollapsibleTrigger
          render={
            <CardHeader className="flex cursor-pointer flex-row items-center justify-between gap-3 px-(--card-spacing) py-3 hover:bg-muted/30">
              <div className="flex min-w-0 items-center gap-3">
                <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
                <CardTitle className="text-base font-medium">
                  {title ?? diff.newPath ?? diff.oldPath ?? "Diff"}
                </CardTitle>
                <div className="flex items-center gap-1.5">
                  {added > 0 && (
                    <Badge
                      variant="outline"
                      className="border-olive/30 bg-olive/10 text-olive"
                    >
                      +{added}
                    </Badge>
                  )}
                  {removed > 0 && (
                    <Badge
                      variant="outline"
                      className="border-rust/30 bg-rust/10 text-rust"
                    >
                      −{removed}
                    </Badge>
                  )}
                </div>
              </div>
              {language && (
                <Badge variant="outline" className="uppercase">
                  {language}
                </Badge>
              )}
            </CardHeader>
          }
        />
        <CollapsibleContent>
          <CardContent className="p-0">
            {diff.hunks.length === 0 ||
            diff.hunks.every((h) => h.lines.length === 0) ? (
              <div className="px-(--card-spacing) py-6 text-sm text-muted-foreground">
                No differences
              </div>
            ) : (
              <div className="overflow-x-auto">
                {mode === "unified" ? (
                  <UnifiedTable
                    diff={diff}
                    showLineNumbers={showLineNumbers}
                    indicators={indicators}
                    highlightInline={highlightInline}
                    hunkSeparator={hunkSeparator}
                  />
                ) : (
                  <SplitTable
                    diff={diff}
                    showLineNumbers={showLineNumbers}
                    indicators={indicators}
                    highlightInline={highlightInline}
                    hunkSeparator={hunkSeparator}
                  />
                )}
              </div>
            )}
            {caption && (
              <div className="border-t border-border px-(--card-spacing) py-2 text-xs text-muted-foreground">
                {caption}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
