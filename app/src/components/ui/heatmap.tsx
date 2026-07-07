"use client"

import * as React from "react"

import { Card, CardContent } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type HeatmapDataPoint = Record<string, unknown>

type HeatmapValue = {
  x: string
  y: string
  value: number
}

interface HeatmapProps extends Omit<React.ComponentProps<typeof Card>, "data"> {
  data: HeatmapValue[] | HeatmapDataPoint[]
  xKey?: string
  yKey?: string
  valueKey?: string
  showValues?: boolean
  color?: string
  formatValue?: (value: number) => string
  emptyValue?: React.ReactNode
  caption?: string
}

function getKey(item: HeatmapDataPoint, key: string | undefined, fallback: string): string {
  if (key === undefined) return fallback
  const value = item[key]
  return typeof value === "string" ? value : String(value)
}

function getValue(item: HeatmapDataPoint, key: string | undefined, fallback: string): number {
  if (key === undefined) return fallback in item ? Number(item[fallback]) : NaN
  return Number(item[key])
}

function normalizeData(
  data: HeatmapValue[] | HeatmapDataPoint[],
  xKey: string | undefined,
  yKey: string | undefined,
  valueKey: string | undefined
): HeatmapValue[] {
  if (!data.length) return []

  const first = data[0]
  const hasShape =
    typeof first === "object" &&
    first !== null &&
    "x" in first &&
    "y" in first &&
    "value" in first

  if (hasShape) {
    return (data as HeatmapValue[]).map((d) => ({
      x: String(d.x),
      y: String(d.y),
      value: Number(d.value),
    }))
  }

  return (data as HeatmapDataPoint[]).map((d) => ({
    x: getKey(d, xKey, "x"),
    y: getKey(d, yKey, "y"),
    value: getValue(d, valueKey, "value"),
  }))
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "—"
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function Heatmap({
  data,
  xKey,
  yKey,
  valueKey,
  showValues = false,
  color = "var(--primary)",
  formatValue = formatNumber,
  emptyValue = "—",
  caption,
  className,
  ...props
}: HeatmapProps) {
  const {
    xCategories,
    yCategories,
    values,
    normalized,
  } = React.useMemo(() => {
    const normalizedData = normalizeData(data, xKey, yKey, valueKey)
    const xSet = new Set<string>()
    const ySet = new Set<string>()
    const values = new Map<string, number>()
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY

    for (const point of normalizedData) {
      xSet.add(point.x)
      ySet.add(point.y)
      values.set(`${point.x}-${point.y}`, point.value)
      if (Number.isFinite(point.value)) {
        min = Math.min(min, point.value)
        max = Math.max(max, point.value)
      }
    }

    const xCategories = Array.from(xSet)
    const yCategories = Array.from(ySet)

    if (!Number.isFinite(min)) min = 0
    if (!Number.isFinite(max)) max = 0
    if (min === max) max = min + 1

    const range = max - min
    const normalized = new Map<string, number>()
    for (const [key, value] of values) {
      normalized.set(key, (value - min) / range)
    }

    return { xCategories, yCategories, values, normalized }
  }, [data, xKey, yKey, valueKey])

  if (xCategories.length === 0 || yCategories.length === 0) {
    return (
      <Card
        data-slot="heatmap"
        className={cn("text-sm", className)}
        {...props}
      >
        <CardContent>
          <div className="text-muted-foreground">No data</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      data-slot="heatmap"
      className={cn("text-sm", className)}
      {...props}
    >
      <CardContent className="overflow-x-auto">
        <TooltipProvider delay={0}>
          <div
            className="grid min-w-fit gap-1"
            style={{
              gridTemplateColumns: `auto repeat(${xCategories.length}, minmax(2.5rem, 1fr))`,
            }}
          >
            {yCategories.map((y) => (
              <React.Fragment key={y}>
                <div
                  className="flex items-center justify-end pr-2 text-xs text-muted-foreground"
                  title={y}
                >
                  <span className="max-w-[8rem] truncate">{y}</span>
                </div>
                {xCategories.map((x) => {
                  const key = `${x}-${y}`
                  const value = values.get(key)
                  const intensity = value === undefined ? 0 : (normalized.get(key) ?? 0)
                  const isEmpty = !values.has(key)

                  return (
                    <Tooltip key={key}>
                      <TooltipTrigger
                        render={
                          <div
                            tabIndex={0}
                            className={cn(
                              "flex aspect-square min-h-8 cursor-default items-center justify-center rounded-md border text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              isEmpty
                                ? "border-dashed border-border bg-muted/30 text-muted-foreground"
                                : "border-transparent",
                              !isEmpty && intensity > 0.5 && "text-primary-foreground",
                              !isEmpty && intensity <= 0.5 && "text-foreground"
                            )}
                            style={
                              isEmpty
                                ? undefined
                                : {
                                    backgroundColor: `color-mix(in oklch, ${color} ${intensity * 100}%, transparent)`,
                                  }
                            }
                          >
                            {showValues ? (
                              isEmpty ? (
                                emptyValue
                              ) : (
                                formatValue(value as number)
                              )
                            ) : null}
                          </div>
                        }
                      />
                      <TooltipContent side="top" align="center">
                        <div className="grid gap-0.5">
                          <div className="font-medium">
                            {y} × {x}
                          </div>
                          <div className="text-background/80">
                            {isEmpty ? "No data" : formatValue(value as number)}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </React.Fragment>
            ))}
            <div />
            {xCategories.map((x) => (
              <div
                key={x}
                className="flex items-start justify-center pt-1 text-xs text-muted-foreground"
                title={x}
              >
                <span className="max-w-[6rem] truncate text-center">{x}</span>
              </div>
            ))}
          </div>
        </TooltipProvider>
        {caption && (
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{caption}</p>
        )}
      </CardContent>
    </Card>
  )
}

export { Heatmap, type HeatmapProps }
