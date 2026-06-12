"use client"

import type { CSSProperties, ReactNode } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"

import type { ArtifactColumn, ArtifactFlowItem, ArtifactNode, ArtifactTone, VisualArtifactSpec } from "@/lib/artifact-schema"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type ArtifactRenderContext = {
  data: VisualArtifactSpec["data"]
}

type RenderNodes = (nodes: ArtifactNode[] | undefined, context: ArtifactRenderContext) => ReactNode

type AdapterArgs<T extends ArtifactNode["type"]> = {
  node: Extract<ArtifactNode, { type: T }>
  children?: ReactNode
  context: ArtifactRenderContext
  renderNodes: RenderNodes
}

type RegistryAdapter = (args: {
  node: ArtifactNode
  children?: ReactNode
  context: ArtifactRenderContext
  renderNodes: RenderNodes
}) => ReactNode

export const componentRegistry = {
  heading: renderHeading as RegistryAdapter,
  text: renderText as RegistryAdapter,
  card: renderCard as RegistryAdapter,
  metric: renderMetric as RegistryAdapter,
  "stat-card": renderStatCard as RegistryAdapter,
  badge: renderBadge as RegistryAdapter,
  button: renderButton as RegistryAdapter,
  separator: renderSeparator as RegistryAdapter,
  table: renderTable as RegistryAdapter,
  "data-table": renderDataTable as RegistryAdapter,
  "comparison-table": renderComparisonTable as RegistryAdapter,
  chart: renderChart as RegistryAdapter,
  flow: renderFlow as RegistryAdapter,
  timeline: renderTimeline as RegistryAdapter,
  "code-block": renderCodeBlock as RegistryAdapter,
  "status-grid": renderStatusGrid as RegistryAdapter,
  grid: renderGrid as RegistryAdapter,
  section: renderSection as RegistryAdapter,
  tabs: renderTabs as RegistryAdapter,
  accordion: renderAccordion as RegistryAdapter,
} satisfies Record<ArtifactNode["type"], RegistryAdapter>

export type { ArtifactRenderContext, RenderNodes }

function renderHeading({ node }: AdapterArgs<"heading">) {
  const { text, level = 2, align = "left" } = node.props
  const className = cn(
    "font-serif font-medium tracking-[-0.025em] text-foreground",
    level === 1 && "text-4xl leading-tight sm:text-5xl",
    level === 2 && "text-3xl leading-tight",
    level === 3 && "text-2xl leading-snug",
    level === 4 && "text-xl leading-snug",
    align === "center" && "text-center",
    align === "right" && "text-right"
  )

  if (level === 1) return <h1 className={className}>{text}</h1>
  if (level === 3) return <h3 className={className}>{text}</h3>
  if (level === 4) return <h4 className={className}>{text}</h4>

  return <h2 className={className}>{text}</h2>
}

function renderText({ node }: AdapterArgs<"text">) {
  const { text, tone = "default", size = "base", align = "left" } = node.props

  return (
    <p
      className={cn(
        "max-w-4xl leading-7",
        tone === "muted" && "text-muted-foreground",
        size === "sm" && "text-sm leading-6",
        size === "lg" && "text-lg leading-8",
        align === "center" && "mx-auto text-center",
        align === "right" && "ml-auto text-right"
      )}
    >
      {text}
    </p>
  )
}

function renderCard({ node, children }: AdapterArgs<"card">) {
  const props = node.props ?? {}

  return (
    <Card size={props.size} className={tonePanelClass(props.tone)}>
      {(props.title || props.description) && (
        <CardHeader>
          {props.title && <CardTitle>{props.title}</CardTitle>}
          {props.description && <CardDescription>{props.description}</CardDescription>}
        </CardHeader>
      )}
      {children && <CardContent className="space-y-4">{children}</CardContent>}
    </Card>
  )
}

function renderMetric({ node }: AdapterArgs<"metric">) {
  const { label, value, delta, trend = "neutral" } = node.props

  return (
    <div className="space-y-2">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="flex flex-wrap items-end gap-2">
        <p className="font-serif text-4xl font-medium leading-none tracking-[-0.035em] text-foreground">{value}</p>
        {delta && <TrendPill trend={trend}>{delta}</TrendPill>}
      </div>
    </div>
  )
}

function renderStatCard({ node }: AdapterArgs<"stat-card">) {
  const { label, value, delta, trend = "neutral", caption, tone = "default" } = node.props

  return (
    <div className={cn("min-h-full rounded-2xl border-[1.5px] bg-card/95 p-5 text-card-foreground shadow-[0_10px_34px_rgba(20,20,19,0.06)] dark:shadow-black/20", tonePanelClass(tone))}>
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <p className="font-serif text-4xl font-medium leading-none tracking-[-0.04em] text-foreground">{value}</p>
        {delta && <TrendPill trend={trend}>{delta}</TrendPill>}
      </div>
      {caption && <p className="mt-3 text-sm leading-6 text-muted-foreground">{caption}</p>}
    </div>
  )
}

function renderBadge({ node }: AdapterArgs<"badge">) {
  return <Badge variant={node.props.variant}>{node.props.label}</Badge>
}

function renderButton({ node }: AdapterArgs<"button">) {
  const { label, href, variant, size } = node.props

  if (href) {
    return (
      <a className={buttonVariants({ variant, size })} href={href}>
        {label}
      </a>
    )
  }

  return (
    <Button variant={variant} size={size}>
      {label}
    </Button>
  )
}

function renderSeparator() {
  return <Separator />
}

function renderTable({ node, context }: AdapterArgs<"table">) {
  return <TableBlock data={getRows(context.data, node.props.dataKey)} {...node.props} />
}

function renderDataTable({ node, context }: AdapterArgs<"data-table">) {
  return <TableBlock dense data={getRows(context.data, node.props.dataKey)} {...node.props} />
}

function renderComparisonTable({ node, context }: AdapterArgs<"comparison-table">) {
  return <TableBlock comparison dense data={getRows(context.data, node.props.dataKey)} {...node.props} />
}

function renderChart({ node, context }: AdapterArgs<"chart">) {
  const { dataKey, xKey, yKey, kind = "line", label = yKey, color = "var(--chart-2)" } = node.props
  const data = getRows(context.data, dataKey)
  const config = {
    [yKey]: { label, color },
  } satisfies ChartConfig

  if (!data.length) {
    return <MissingData dataKey={dataKey} />
  }

  return (
    <div className="rounded-xl border bg-background/40 p-3">
      <ChartContainer config={config} className="min-h-[300px] w-full">
        {kind === "bar" ? (
          <BarChart accessibilityLayer data={data} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="4 4" />
            <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={10} fontSize={12} />
            <YAxis tickLine={false} axisLine={false} width={44} fontSize={12} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey={yKey} fill={color} radius={[8, 8, 0, 0]} barSize={42} isAnimationActive={false} />
          </BarChart>
        ) : (
          <LineChart accessibilityLayer data={data} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="4 4" />
            <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={10} fontSize={12} />
            <YAxis tickLine={false} axisLine={false} width={44} fontSize={12} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey={yKey} type="monotone" stroke={color} strokeWidth={3} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} isAnimationActive={false} />
          </LineChart>
        )}
      </ChartContainer>
    </div>
  )
}

function renderFlow({ node }: AdapterArgs<"flow">) {
  const { title, caption, items } = node.props

  return (
    <div className="space-y-3 rounded-2xl border bg-card/80 p-4 shadow-sm">
      {(title || caption) && (
        <div className="space-y-1">
          {title && <h3 className="font-serif text-2xl font-medium tracking-[-0.02em] text-foreground">{title}</h3>}
          {caption && <p className="text-sm leading-6 text-muted-foreground">{caption}</p>}
        </div>
      )}
      <div className="grid gap-3 lg:grid-cols-[repeat(var(--flow-columns),minmax(0,1fr))]" style={{ "--flow-columns": items.length } as CSSProperties}>
        {items.map((item, index) => (
          <FlowStep key={`${item.title}-${index}`} item={item} index={index} isLast={index === items.length - 1} />
        ))}
      </div>
    </div>
  )
}

function FlowStep({ item, index, isLast }: { item: ArtifactFlowItem; index: number; isLast: boolean }) {
  return (
    <div className="relative">
      <div className={cn("min-h-full rounded-xl border bg-background/70 p-4", item.status && statusPanelClass(item.status))}>
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border bg-card font-mono text-[11px] font-medium text-muted-foreground">
            {index + 1}
          </span>
          {item.status && <StatusChip value={item.status} />}
        </div>
        {item.label && <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--clay)]">{item.label}</p>}
        <p className="mt-1 font-serif text-lg font-medium leading-snug tracking-[-0.015em] text-foreground">{item.title}</p>
        {item.description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>}
      </div>
      {!isLast && <div className="mx-auto hidden h-px w-full translate-x-1/2 bg-border lg:absolute lg:left-1/2 lg:top-7 lg:block" />}
    </div>
  )
}

function renderTimeline({ node, context }: AdapterArgs<"timeline">) {
  const { dataKey, titleKey = "title", markerKey = "marker", descriptionKey = "description", statusKey = "status", caption } = node.props
  const data = getRows(context.data, dataKey)

  if (!data.length) {
    return <MissingData dataKey={dataKey} />
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-card/80 p-4 shadow-sm">
      {caption && <p className="text-sm text-muted-foreground">{caption}</p>}
      <div className="relative space-y-4 before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-px before:bg-border">
        {data.map((row, index) => (
          <article key={index} className="relative grid grid-cols-[2rem_1fr] gap-3">
            <div className="relative z-10 flex size-8 items-center justify-center rounded-full border bg-card font-mono text-[10px] font-medium text-muted-foreground">
              {formatCell(row[markerKey] ?? index + 1)}
            </div>
            <div className={cn("rounded-xl border bg-background/70 p-4", statusPanelClass(row[statusKey]))}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="font-serif text-lg font-medium leading-snug tracking-[-0.015em] text-foreground">{formatCell(row[titleKey])}</p>
                {row[statusKey] !== undefined && <StatusChip value={row[statusKey]} />}
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{formatCell(row[descriptionKey])}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function renderCodeBlock({ node }: AdapterArgs<"code-block">) {
  const { title, language, code, caption } = node.props

  return (
    <figure className="overflow-hidden rounded-2xl border bg-zinc-950 text-zinc-50 shadow-sm dark:bg-black">
      {(title || language) && (
        <figcaption className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-400">
          <span>{title ?? "Snippet"}</span>
          {language && <span>{language}</span>}
        </figcaption>
      )}
      <pre className="overflow-x-auto p-4 text-sm leading-6"><code>{code}</code></pre>
      {caption && <p className="border-t border-white/10 px-4 py-2 text-sm text-zinc-400">{caption}</p>}
    </figure>
  )
}

function renderStatusGrid({ node, context }: AdapterArgs<"status-grid">) {
  const { dataKey, titleKey = "title", statusKey, descriptionKey, metaKey, columns = 3, caption } = node.props
  const data = getRows(context.data, dataKey)

  if (!data.length) {
    return <MissingData dataKey={dataKey} />
  }

  return (
    <div className="space-y-3">
      {caption && <p className="text-sm text-muted-foreground">{caption}</p>}
      <div className={cn("grid gap-5", columnsClass(columns))}>
        {data.map((row, index) => {
          const title = row[titleKey] ?? row.component ?? row.name ?? `Item ${index + 1}`
          const description = descriptionKey ? row[descriptionKey] : row.notes ?? row.description
          const meta = metaKey ? row[metaKey] : undefined

          return (
            <div key={index} className={cn("min-h-full rounded-2xl border-[1.5px] bg-card/95 p-4 text-card-foreground shadow-[0_10px_34px_rgba(20,20,19,0.06)] dark:shadow-black/20", statusPanelClass(row[statusKey]))}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-serif text-lg font-medium leading-snug tracking-[-0.015em] text-foreground">{formatCell(title)}</p>
                  {meta !== undefined && <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{formatCell(meta)}</p>}
                </div>
                <StatusChip value={row[statusKey]} />
              </div>
              {description !== undefined && <p className="mt-3 text-sm leading-6 text-muted-foreground">{formatCell(description)}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function renderGrid({ node, children }: AdapterArgs<"grid">) {
  const columns = node.props?.columns ?? 2

  return <div className={cn("grid gap-5", columnsClass(columns))}>{children}</div>
}

function renderSection({ node, children }: AdapterArgs<"section">) {
  const props = node.props ?? {}

  return (
    <section className="space-y-5 scroll-mt-8">
      <div className="h-px w-full bg-border/80" />
      {(props.title || props.description) && (
        <div className="pb-1">
          {props.title && <h2 className="font-serif text-3xl font-medium tracking-[-0.025em] text-foreground">{props.title}</h2>}
          {props.description && <p className="mt-2 max-w-3xl text-muted-foreground">{props.description}</p>}
        </div>
      )}
      <div className="space-y-5">{children}</div>
    </section>
  )
}

function renderTabs({ node, context, renderNodes }: AdapterArgs<"tabs">) {
  const defaultValue = node.props.defaultValue ?? node.props.items[0]?.value

  return (
    <Tabs defaultValue={defaultValue}>
      <TabsList>
        {node.props.items.map((item) => (
          <TabsTrigger key={item.value} value={item.value}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {node.props.items.map((item) => (
        <TabsContent key={item.value} value={item.value} className="space-y-5 pt-1">
          {renderNodes(item.nodes, context)}
        </TabsContent>
      ))}
    </Tabs>
  )
}

function renderAccordion({ node, context, renderNodes }: AdapterArgs<"accordion">) {
  return (
    <Accordion>
      {node.props.items.map((item, index) => (
        <AccordionItem key={item.title} value={`item-${index}`}>
          <AccordionTrigger>{item.title}</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">{renderNodes(item.nodes, context)}</div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

function TableBlock({
  data,
  columns,
  caption,
  dense = false,
  comparison = false,
  statusKey,
  dataKey,
}: {
  data: Record<string, unknown>[]
  columns?: ArtifactColumn[]
  caption?: string
  dense?: boolean
  comparison?: boolean
  statusKey?: string
  dataKey: string
}) {
  if (!data.length) {
    return <MissingData dataKey={dataKey} />
  }

  const normalizedColumns = normalizeColumns(columns, data)

  const table = (
    <Table>
      {caption && <TableCaption>{caption}</TableCaption>}
      <TableHeader>
        <TableRow>
          {normalizedColumns.map((column) => (
            <TableHead key={column.key} className={cn(dense ? "h-9" : undefined, comparison && "font-mono text-[11px] uppercase tracking-[0.12em]")}>
              {column.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row, index) => (
          <TableRow key={index}>
            {normalizedColumns.map((column, columnIndex) => (
              <TableCell
                key={column.key}
                className={cn(
                  dense ? "py-2.5" : undefined,
                  columnIndex === 0 && "font-medium text-foreground",
                  comparison && "align-top whitespace-normal"
                )}
              >
                {statusKey === column.key ? <StatusChip value={row[column.key]} /> : formatCell(row[column.key])}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )

  if (!comparison) return table

  return (
    <>
      {caption && <p className="text-sm text-muted-foreground md:hidden">{caption}</p>}
      <div className="grid gap-3 md:hidden">
        {data.map((row, index) => (
          <MobileRecord key={index} row={row} columns={normalizedColumns} statusKey={statusKey} />
        ))}
      </div>
      <div className="hidden md:block">{table}</div>
    </>
  )
}

function MobileRecord({ row, columns, statusKey }: { row: Record<string, unknown>; columns: { key: string; label: string }[]; statusKey?: string }) {
  const [primary, ...rest] = columns
  const primaryValue = primary ? row[primary.key] : undefined

  return (
    <article className="rounded-2xl border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          {primary && <p className="font-serif text-lg font-medium leading-snug tracking-[-0.015em] text-foreground">{formatCell(primaryValue)}</p>}
          {primary && <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{primary.label}</p>}
        </div>
        {statusKey && row[statusKey] !== undefined && <StatusChip value={row[statusKey]} />}
      </div>
      <dl className="mt-4 space-y-3">
        {rest
          .filter((column) => column.key !== statusKey)
          .map((column) => (
            <div key={column.key} className="grid gap-1 border-t pt-3">
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{column.label}</dt>
              <dd className="text-sm leading-6 text-muted-foreground">{formatCell(row[column.key])}</dd>
            </div>
          ))}
      </dl>
    </article>
  )
}

function MissingData({ dataKey }: { dataKey: string }) {
  return <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">Missing dataset: {dataKey}</p>
}

function TrendPill({ trend, children }: { trend: "up" | "down" | "neutral"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "mb-0.5 rounded-full border px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em]",
        trend === "up" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        trend === "down" && "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
        trend === "neutral" && "border-border bg-muted text-muted-foreground"
      )}
    >
      {children}
    </span>
  )
}

function StatusChip({ value }: { value: unknown }) {
  const text = formatCell(value)
  const tone = statusTone(text)

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em]",
        tone === "success" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        tone === "warning" && "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        tone === "danger" && "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
        tone === "accent" && "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
        tone === "neutral" && "border-border bg-muted text-muted-foreground"
      )}
    >
      {text}
    </span>
  )
}

function statusTone(value: string) {
  const normalized = value.toLowerCase()

  if (["pass", "passed", "ok", "healthy", "linked", "running", "configured", "done", "yes", "success", "guarded", "checked", "loaded", "shared", "attached", "rendered", "manifested", "enforced"].some((word) => normalized.includes(word))) {
    return "success"
  }

  if (["warn", "warning", "risk", "attention", "partial", "degraded", "drift", "medium"].some((word) => normalized.includes(word))) {
    return "warning"
  }

  if (["fail", "failed", "error", "blocked", "danger", "critical", "high", "leak", "down"].some((word) => normalized.includes(word))) {
    return "danger"
  }

  if (["info", "pending", "next", "review", "neutral", "optional", "preview", "check"].some((word) => normalized.includes(word))) {
    return "accent"
  }

  return "neutral"
}

function statusPanelClass(value: unknown) {
  const tone = statusTone(formatCell(value))

  return cn(
    tone === "success" && "border-l-4 border-l-[var(--olive)]",
    tone === "warning" && "border-l-4 border-l-[var(--clay)]",
    tone === "danger" && "border-l-4 border-l-[var(--rust)]",
    tone === "accent" && "border-l-4 border-l-[var(--clay)]"
  )
}

function tonePanelClass(tone: ArtifactTone | undefined) {
  return cn(
    tone && tone !== "default" && "border-l-4",
    tone === "accent" && "border-l-orange-500",
    tone === "success" && "border-l-emerald-500",
    tone === "warning" && "border-l-amber-500",
    tone === "danger" && "border-l-red-500"
  )
}

function columnsClass(columns: 1 | 2 | 3 | 4) {
  if (columns === 1) return "grid-cols-1"
  if (columns === 3) return "md:grid-cols-3"
  if (columns === 4) return "md:grid-cols-2 xl:grid-cols-4"

  return "md:grid-cols-2"
}

function getRows(data: VisualArtifactSpec["data"], dataKey: string): Record<string, unknown>[] {
  const dataset = data?.[dataKey]

  if (!Array.isArray(dataset)) {
    return []
  }

  return dataset.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null && !Array.isArray(row))
}

function normalizeColumns(columns: ArtifactColumn[] | undefined, data: Record<string, unknown>[]) {
  const source = columns?.length ? columns : Object.keys(data[0] ?? {})

  return source.map((column) => {
    if (typeof column === "string") {
      return { key: column, label: toTitle(column) }
    }

    return { key: column.key, label: column.label ?? toTitle(column.key) }
  })
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return "—"
  if (typeof value === "number") return value.toLocaleString()
  if (typeof value === "string") return value
  if (typeof value === "boolean") return value ? "Yes" : "No"

  return JSON.stringify(value)
}

function toTitle(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}
