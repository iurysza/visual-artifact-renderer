"use client"

import * as React from "react"
import {
  CartesianGrid,
  Scatter,
  ScatterChart as RechartsScatterChart,
  XAxis,
  YAxis,
} from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"

export type ScatterChartDataPoint = {
  x: number
  y: number
}

export interface ScatterChartProps
  extends React.ComponentPropsWithoutRef<"div"> {
  data: ScatterChartDataPoint[] | Record<string, unknown>[]
  xKey?: string
  yKey?: string
  label?: string
  color?: string
}

export function ScatterChart({
  data,
  xKey = "x",
  yKey = "y",
  label = yKey,
  color = "var(--chart-1)",
  className,
  ...props
}: ScatterChartProps) {
  const normalized = React.useMemo(() => {
    if (!data.length) return []

    return (data as Record<string, unknown>[]).map((d) => ({
      x: Number(d[xKey]),
      y: Number(d[yKey]),
    }))
  }, [data, xKey, yKey])

  const config = React.useMemo(
    () => ({
      [yKey]: { label, color },
    }),
    [yKey, label, color]
  )

  return (
    <ChartContainer config={config} className={cn(className)} {...props}>
      <RechartsScatterChart
        margin={{ top: 12, right: 16, bottom: 0, left: 0 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="4 4" />
        <XAxis
          type="number"
          dataKey="x"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          fontSize={12}
        />
        <YAxis
          type="number"
          dataKey="y"
          tickLine={false}
          axisLine={false}
          width={44}
          fontSize={12}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Scatter
          name={label}
          data={normalized}
          dataKey="y"
          fill={color}
          stroke={color}
          isAnimationActive={false}
        />
      </RechartsScatterChart>
    </ChartContainer>
  )
}
