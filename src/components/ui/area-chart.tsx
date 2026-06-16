"use client"

import * as React from "react"
import {
  Area,
  AreaChart as RechartsAreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"

export type AreaChartDataPoint = {
  x: string | number
  y: number
}

export interface AreaChartProps
  extends React.ComponentPropsWithoutRef<"div"> {
  data: AreaChartDataPoint[] | Record<string, unknown>[]
  xKey?: string
  yKey?: string
  label?: string
  color?: string
}

export function AreaChart({
  data,
  xKey = "x",
  yKey = "y",
  label = yKey,
  color = "var(--chart-1)",
  className,
  ...props
}: AreaChartProps) {
  const id = React.useId().replace(/:/g, "")
  const gradientId = `area-fill-${id}`

  const config = React.useMemo(
    () => ({
      [yKey]: { label, color },
    }),
    [yKey, label, color]
  )

  return (
    <ChartContainer config={config} className={cn(className)} {...props}>
      <RechartsAreaChart
        accessibilityLayer
        data={data}
        margin={{ top: 12, right: 16, bottom: 0, left: 0 }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="4 4" />
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          fontSize={12}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={44}
          fontSize={12}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          dataKey={yKey}
          type="monotone"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4 }}
          isAnimationActive={false}
        />
      </RechartsAreaChart>
    </ChartContainer>
  )
}
