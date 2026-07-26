"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { Figure, PanelCard } from "@/components/artifact-primitives"
import { cn } from "@/lib/utils"
import { formatCell, getRows, MissingData } from "@/lib/artifacts/data"

import type { AdapterArgs } from "@/components/artifact-types"

type TraceArg = {
  name: string
  type?: string
  value: string
}

type TraceStep = {
  kind?: "call" | "return" | "throw" | "note"
  fn: string
  file?: string
  line?: number
  depth: number
  args?: TraceArg[]
  locals?: TraceArg[]
  result?: string
  durationMs?: number
  note?: string
}

type TraceNode = TraceStep & {
  id: string
  children: TraceNode[]
  returnChild?: TraceNode
}

export function renderTraceTree({ node, context }: AdapterArgs<"trace-tree">) {
  const {
    dataKey,
    title,
    caption,
    defaultExpandedDepth = 2,
    showDurations = true,
    showLocations = true,
  } = node.props

  const rows = getRows(context.data, dataKey).map(asTraceStep)

  if (!rows.length) {
    return <MissingData dataKey={dataKey} />
  }

  return (
    <TraceTree
      rows={rows}
      title={title}
      caption={caption}
      defaultExpandedDepth={defaultExpandedDepth}
      showDurations={showDurations}
      showLocations={showLocations}
    />
  )
}

function TraceTree({
  rows,
  title,
  caption,
  defaultExpandedDepth,
  showDurations,
  showLocations,
}: {
  rows: TraceStep[]
  title?: string
  caption?: string
  defaultExpandedDepth: number
  showDurations: boolean
  showLocations: boolean
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const tree = useMemo(() => buildTree(rows), [rows])
  const allIds = useMemo(() => collectNodeIds(tree), [tree])

  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const id of allIds) {
      const node = findNode(tree, id)
      if (
        node &&
        node.children.length > 0 &&
        node.depth >= defaultExpandedDepth
      ) {
        initial.add(id)
      }
    }
    return initial
  })

  const toggle = (id: string, nextOpen: boolean) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (nextOpen) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const expandAll = () => setCollapsed(new Set())
  const collapseAll = () => {
    const next = new Set<string>()
    for (const id of allIds) {
      const node = findNode(tree, id)
      if (node && node.children.length > 0) {
        next.add(id)
      }
    }
    setCollapsed(next)
  }

  const selectedNode = selectedId ? findNode(tree, selectedId) : null

  return (
    <Figure title={title} caption={caption}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="xs" onClick={expandAll}>
            Expand all
          </Button>
          <Button variant="ghost" size="xs" onClick={collapseAll}>
            Collapse all
          </Button>
        </div>

        <div className="flex flex-col gap-1">
          {tree.map((node) => (
            <TreeRow
              key={node.id}
              node={node}
              collapsed={collapsed}
              onToggle={toggle}
              selectedId={selectedId}
              onSelect={setSelectedId}
              showDurations={showDurations}
              showLocations={showLocations}
            />
          ))}
        </div>

        {selectedNode && (
          <PanelCard tone={selectedNode.kind === "throw" ? "danger" : "accent"}>
            <div className="flex flex-col gap-3">
              <p className="font-serif text-lg font-medium leading-snug tracking-[-0.015em] text-foreground">
                {selectedNode.fn}
              </p>
              <div className="grid gap-2 text-sm">
                <DetailRow label="Kind" value={selectedNode.kind ?? "call"} />
                {selectedNode.file && (
                  <DetailRow label="Location" value={`${selectedNode.file}:${selectedNode.line ?? "-"}`} />
                )}
                {selectedNode.durationMs != null && (
                  <DetailRow label="Duration" value={`${selectedNode.durationMs.toFixed(2)}ms`} />
                )}
                {selectedNode.result != null && (
                  <DetailRow label="Result" value={selectedNode.result} />
                )}
                {selectedNode.note && (
                  <DetailRow label="Note" value={selectedNode.note} />
                )}
              </div>
              {selectedNode.args && selectedNode.args.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Arguments</p>
                  <ArgsTable args={selectedNode.args} />
                </div>
              )}
              {selectedNode.locals && selectedNode.locals.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Locals</p>
                  <ArgsTable args={selectedNode.locals} />
                </div>
              )}
            </div>
          </PanelCard>
        )}
      </div>
    </Figure>
  )
}

function TreeRow({
  node,
  collapsed,
  onToggle,
  selectedId,
  onSelect,
  showDurations,
  showLocations,
}: {
  node: TraceNode
  collapsed: Set<string>
  onToggle: (id: string, open: boolean) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  showDurations: boolean
  showLocations: boolean
}) {
  const hasChildren = node.children.length > 0
  const isOpen = !collapsed.has(node.id)
  const isSelected = selectedId === node.id

  return (
    <Collapsible open={isOpen} onOpenChange={(open) => onToggle(node.id, open)}>
      <div
        className={cn(
          "group rounded-lg border border-transparent transition-colors",
          isSelected && "border-ring/50 bg-accent/40",
          !isSelected && "hover:bg-accent/30"
        )}
      >
        <div
          className="flex items-start gap-1 py-1.5"
          style={{ paddingLeft: `${node.depth * 1.25}rem` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => onToggle(node.id, !isOpen)}
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-xs" }),
                "mt-0.5 shrink-0"
              )}
              aria-label={isOpen ? "Collapse" : "Expand"}
            >
              {isOpen ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
            </button>
          ) : (
            <span className="mt-0.5 size-6 shrink-0" />
          )}

          <button
            type="button"
            onClick={() => onSelect(isSelected ? null : node.id)}
            className="flex min-w-0 flex-1 items-start gap-2 py-1 text-left"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span
                  className={cn(
                    "font-mono text-sm font-semibold",
                    node.kind === "throw" ? "text-destructive" : "text-foreground"
                  )}
                >
                  {node.fn}
                </span>

                {node.args && node.args.length > 0 && (
                  <span className="font-mono text-xs text-muted-foreground">
                    ({node.args.map((a) => `${a.name}: ${formatArgValue(a)}`).join(", ")})
                  </span>
                )}

                {node.returnChild && (
                  <span className="font-mono text-xs text-muted-foreground">
                    →{" "}
                    <span className="text-foreground">
                      {node.returnChild.result ?? "void"}
                    </span>
                  </span>
                )}

                {node.kind === "throw" && node.result && (
                  <span className="font-mono text-xs text-destructive">
                    throws {node.result}
                  </span>
                )}

                {showDurations && node.durationMs != null && (
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {node.durationMs.toFixed(1)}ms
                  </Badge>
                )}
              </div>

              {node.note && (
                <p className="text-xs italic text-muted-foreground">{node.note}</p>
              )}
            </div>

            {showLocations && node.file && (
              <span className="hidden shrink-0 pl-2 font-mono text-[10px] text-muted-foreground sm:block">
                {node.file}:{node.line ?? "-"}
              </span>
            )}
          </button>
        </div>
      </div>

      {hasChildren && (
        <CollapsibleContent>
          <div className="flex flex-col gap-1">
            {node.children.map((child) => (
              <TreeRow
                key={child.id}
                node={child}
                collapsed={collapsed}
                onToggle={onToggle}
                selectedId={selectedId}
                onSelect={onSelect}
                showDurations={showDurations}
                showLocations={showLocations}
              />
            ))}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}

function DetailRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-20 shrink-0 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 break-all font-mono text-xs text-foreground">
        {formatCell(value)}
      </span>
    </div>
  )
}

function ArgsTable({ args }: { args: TraceArg[] }) {
  return (
    <div className="grid grid-cols-[minmax(0,0.35fr)_minmax(0,0.65fr)] gap-x-3 gap-y-1 text-xs">
      {args.map((arg) => (
        <div key={arg.name} className="contents">
          <span className="truncate font-mono text-muted-foreground">
            {arg.name}
            {arg.type && <span className="ml-1 opacity-70">:{arg.type}</span>}
          </span>
          <span className="break-all font-mono text-foreground">{arg.value}</span>
        </div>
      ))}
    </div>
  )
}

function formatArgValue(arg: TraceArg): string {
  const preview =
    typeof arg.value === "string" && arg.value.length > 24
      ? `${arg.value.slice(0, 24)}…`
      : arg.value
  return preview
}

function asTraceArg(value: unknown): TraceArg | undefined {
  if (typeof value !== "object" || value === null) return undefined
  const obj = value as Record<string, unknown>
  if (typeof obj.name !== "string" || typeof obj.value !== "string") return undefined
  return {
    name: obj.name,
    type: typeof obj.type === "string" ? obj.type : undefined,
    value: obj.value,
  }
}

function asTraceArgs(value: unknown): TraceArg[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.map(asTraceArg).filter((a): a is TraceArg => a !== undefined)
}

function asTraceStep(row: Record<string, unknown>): TraceStep {
  const kind =
    row.kind === "call" || row.kind === "return" || row.kind === "throw" || row.kind === "note"
      ? row.kind
      : "call"

  return {
    kind,
    fn: typeof row.fn === "string" ? row.fn : "(anonymous)",
    file: typeof row.file === "string" ? row.file : undefined,
    line: typeof row.line === "number" ? row.line : undefined,
    depth: typeof row.depth === "number" ? row.depth : 0,
    args: asTraceArgs(row.args),
    locals: asTraceArgs(row.locals),
    result: typeof row.result === "string" ? row.result : undefined,
    durationMs: typeof row.durationMs === "number" ? row.durationMs : undefined,
    note: typeof row.note === "string" ? row.note : undefined,
  }
}

function buildTree(rows: TraceStep[]): TraceNode[] {
  const root: TraceNode[] = []
  const stack: TraceNode[] = []

  rows.forEach((row, index) => {
    const node: TraceNode = { ...row, id: String(index), children: [] }

    while (stack.length) {
      const top = stack[stack.length - 1]
      if (
        node.kind === "return" &&
        top.depth === node.depth &&
        top.kind === "call"
      ) {
        break
      }
      if (top.depth >= node.depth) {
        stack.pop()
      } else {
        break
      }
    }

    const parent = stack[stack.length - 1]

    if (
      node.kind === "return" &&
      parent &&
      parent.depth === node.depth &&
      parent.kind === "call"
    ) {
      parent.returnChild = node
      return
    }

    if (parent) {
      parent.children.push(node)
    } else {
      root.push(node)
    }

    if (node.kind === "call") {
      stack.push(node)
    }
  })

  return root
}

function collectNodeIds(nodes: TraceNode[]): string[] {
  return nodes.flatMap((node) => [node.id, ...collectNodeIds(node.children)])
}

function findNode(nodes: TraceNode[], id: string): TraceNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = findNode(node.children, id)
    if (found) return found
  }
  return null
}
