"use client"

import * as React from "react"
import { Pie, PieChart } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

type NamedDataPoint = { name: string; value: number }

type PieChartBaseProps = {
  kind?: "pie" | "donut"
  className?: string
}

type PieChartNamedDataProps = PieChartBaseProps & {
  data: NamedDataPoint[]
  categoryKey?: never
  valueKey?: never
}

type PieChartKeyedDataProps = PieChartBaseProps & {
  data: Record<string, unknown>[]
  categoryKey: string
  valueKey: string
}

type PieChartProps = PieChartNamedDataProps | PieChartKeyedDataProps

function buildConfig(items: { name: string; color: string }[]): ChartConfig {
  return items.reduce<ChartConfig>((acc, item) => {
    acc[item.name] = { label: item.name, color: item.color }
    return acc
  }, {})
}

function normalizeData(
  data: Record<string, unknown>[] | NamedDataPoint[],
  categoryKey: string,
  valueKey: string
): NamedDataPoint[] {
  return data.map((entry, index) => {
    if (
      categoryKey === "name" &&
      valueKey === "value" &&
      typeof entry === "object" &&
      entry !== null &&
      "name" in entry &&
      "value" in entry
    ) {
      return entry as NamedDataPoint
    }

    const name = String(entry[categoryKey] ?? `Item ${index + 1}`)
    const rawValue = entry[valueKey]
    const value = typeof rawValue === "number" ? rawValue : 0

    return { name, value }
  })
}

function PieChartComponent({
  data,
  categoryKey = "name",
  valueKey = "value",
  kind = "pie",
  className,
}: PieChartProps) {
  const normalized = normalizeData(data, categoryKey, valueKey)

  const items = React.useMemo(
    () =>
      normalized.map((item, index) => ({
        ...item,
        fill: CHART_COLORS[index % CHART_COLORS.length],
      })),
    [normalized]
  )

  const config = React.useMemo(() => buildConfig(items), [items])

  return (
    <ChartContainer
      config={config}
      className={cn("aspect-square", className)}
      initialDimension={{ width: 320, height: 320 }}
    >
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideLabel
              nameKey="name"
            />
          }
        />
        <Pie
          data={items}
          dataKey="value"
          nameKey="name"
          outerRadius="80%"
          innerRadius={kind === "donut" ? "60%" : 0}
          strokeWidth={2}
          stroke="var(--background)"
        />
      </PieChart>
    </ChartContainer>
  )
}

export { PieChartComponent as PieChart }
export type { PieChartProps }
