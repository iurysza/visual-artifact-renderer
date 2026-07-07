"use client"

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChartShell } from "@/components/chart-shell"
import { Figure, PanelCard, columnsClass } from "@/components/artifact-primitives"
import { cn } from "@/lib/utils"
import { formatCell, getRows, MissingData, normalizeColumns } from "@/lib/artifacts/data"
import { StatusChip, statusIsVisible } from "@/lib/artifacts/status"

import type { AdapterArgs } from "@/components/artifact-types"
import type { ArtifactColumn } from "@/lib/contract/artifact-schema"

export function renderTable({ node, context }: AdapterArgs<"table">) {
  return <TableBlock data={getRows(context.data, node.props.dataKey)} {...node.props} />
}

export function renderDataTable({ node, context }: AdapterArgs<"data-table">) {
  return <TableBlock dense data={getRows(context.data, node.props.dataKey)} {...node.props} />
}

export function renderComparisonTable({ node, context }: AdapterArgs<"comparison-table">) {
  return (
    <TableBlock
      comparison
      dense
      data={getRows(context.data, node.props.dataKey)}
      {...node.props}
    />
  )
}

export function renderChart({ node, context }: AdapterArgs<"chart">) {
  const {
    dataKey,
    xKey,
    yKey,
    kind = "line",
    label = yKey,
    color = "var(--chart-2)",
  } = node.props
  const data = getRows(context.data, dataKey)

  if (!data.length) {
    return <MissingData dataKey={dataKey} />
  }

  return (
    <div className="rounded-xl border bg-background/40 p-3">
      <ChartShell data={data} xKey={xKey} yKey={yKey} kind={kind} label={label} color={color} />
    </div>
  )
}

export function renderTimeline({ node, context }: AdapterArgs<"timeline">) {
  const {
    dataKey,
    titleKey = "title",
    markerKey = "marker",
    descriptionKey = "description",
    statusKey = "status",
    caption,
  } = node.props
  const data = getRows(context.data, dataKey)

  if (!data.length) {
    return <MissingData dataKey={dataKey} />
  }

  return (
    <Figure caption={caption}>
      <div className="relative flex flex-col gap-4 before:absolute before:bottom-4 before:left-[1.125rem] before:top-4 before:w-px before:bg-border">
        {data.map((row, index) => {
          const statusVal = row[statusKey]
          const description = row[descriptionKey]

          return (
            <article key={index} className="relative grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3">
              <div className="relative z-10 flex h-10 w-14 items-center justify-center rounded-full border bg-card px-2 font-mono text-[10px] font-medium leading-tight text-muted-foreground">
                {formatCell(row[markerKey] ?? index + 1)}
              </div>
              <PanelCard tone={statusVal} className="min-w-0">
                <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-start sm:gap-3">
                  <p className="min-w-0 flex-1 break-words font-serif text-lg font-medium leading-snug tracking-[-0.015em] text-foreground">
                    {formatCell(row[titleKey])}
                  </p>
                  {statusIsVisible(statusVal, description) && (
                    <StatusChip value={statusVal} className="shrink-0 justify-start" />
                  )}
                </div>
                <p className="mt-2 min-w-0 break-all text-sm leading-6 text-muted-foreground">
                  {formatCell(description)}
                </p>
              </PanelCard>
            </article>
          )
        })}
      </div>
    </Figure>
  )
}

export function renderStatusGrid({ node, context }: AdapterArgs<"status-grid">) {
  const {
    dataKey,
    titleKey = "title",
    statusKey,
    descriptionKey,
    metaKey,
    columns = 3,
    caption,
  } = node.props
  const data = getRows(context.data, dataKey)

  if (!data.length) {
    return <MissingData dataKey={dataKey} />
  }

  return (
    <Figure caption={caption}>
      <div className={cn("grid gap-5", columnsClass(columns))}>
        {data.map((row, index) => {
          const title = row[titleKey] ?? row.component ?? row.name ?? `Item ${index + 1}`
          const description = descriptionKey ? row[descriptionKey] : row.notes ?? row.description
          const meta = metaKey ? row[metaKey] : undefined
          const statusVal = row[statusKey]

          return (
            <PanelCard
              key={index}
              tone={statusVal}
              className="min-h-full rounded-2xl border-[1.5px] bg-card/95 p-4 text-card-foreground shadow-[var(--shadow-card)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-serif text-lg font-medium leading-snug tracking-[-0.015em] text-foreground">
                    {formatCell(title)}
                  </p>
                  {meta !== undefined && (
                    <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                      {formatCell(meta)}
                    </p>
                  )}
                </div>
                {statusIsVisible(statusVal, description) && (
                  <StatusChip value={statusVal} className="max-w-[50%] justify-start" />
                )}
              </div>
              {description !== undefined && (
                <p className="mt-3 break-all text-sm leading-6 text-muted-foreground">
                  {formatCell(description)}
                </p>
              )}
            </PanelCard>
          )
        })}
      </div>
    </Figure>
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
            <TableHead
              key={column.key}
              className={cn(
                dense ? "h-9" : undefined,
                comparison && "font-mono text-[11px] uppercase tracking-[0.12em]"
              )}
            >
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
                  comparison && "break-all align-top whitespace-normal"
                )}
              >
                {statusKey === column.key ? (
                  <StatusChip value={row[column.key]} />
                ) : (
                  formatCell(row[column.key])
                )}
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

function MobileRecord({
  row,
  columns,
  statusKey,
}: {
  row: Record<string, unknown>
  columns: { key: string; label: string }[]
  statusKey?: string
}) {
  const [primary, ...rest] = columns
  const primaryValue = primary ? row[primary.key] : undefined

  return (
    <article className="rounded-2xl border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          {primary && (
            <>
              <p className="break-all font-serif text-lg font-medium leading-snug tracking-[-0.015em] text-foreground">
                {formatCell(primaryValue)}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {primary.label}
              </p>
            </>
          )}
        </div>
        {statusKey && row[statusKey] !== undefined && (
          <StatusChip value={row[statusKey]} className="max-w-[50%] justify-start" />
        )}
      </div>
      <dl className="mt-4 flex flex-col gap-3">
        {rest
          .filter((column) => column.key !== statusKey)
          .map((column) => (
            <div key={column.key} className="grid gap-1 border-t pt-3">
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {column.label}
              </dt>
              <dd className="break-all text-sm leading-6 text-foreground">
                {formatCell(row[column.key])}
              </dd>
            </div>
          ))}
      </dl>
    </article>
  )
}
