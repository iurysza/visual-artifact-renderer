"use client"

import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

export function ChartShell({
  data,
  xKey,
  yKey,
  color = "var(--chart-2)",
  kind = "line",
  label = yKey,
}: {
  data: Record<string, unknown>[]
  xKey: string
  yKey: string
  color?: string
  kind?: "line" | "bar"
  label?: string
}) {
  const config = {
    [yKey]: { label, color },
  } satisfies ChartConfig

  return (
    <ChartContainer config={config} className="min-h-[300px] w-full">
      {kind === "bar" ? (
        <BarChart
          accessibilityLayer
          data={data}
          margin={{ top: 12, right: 16, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="4 4" />
          <XAxis
            dataKey={xKey}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            fontSize={12}
          />
          <YAxis tickLine={false} axisLine={false} width={44} fontSize={12} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar
            dataKey={yKey}
            fill={color}
            radius={[8, 8, 0, 0]}
            barSize={42}
            isAnimationActive={false}
          />
        </BarChart>
      ) : (
        <LineChart
          accessibilityLayer
          data={data}
          margin={{ top: 12, right: 16, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="4 4" />
          <XAxis
            dataKey={xKey}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            fontSize={12}
          />
          <YAxis tickLine={false} axisLine={false} width={44} fontSize={12} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line
            dataKey={yKey}
            type="monotone"
            stroke={color}
            strokeWidth={3}
            dot={{ r: 3, fill: color }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      )}
    </ChartContainer>
  )
}
