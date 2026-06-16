"use client"

import * as React from "react"
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RechartsRadarChart,
} from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"

export type RadarChartDataPoint = {
  subject: string
  value: number
}

export interface RadarChartProps
  extends React.ComponentPropsWithoutRef<"div"> {
  data: RadarChartDataPoint[] | Record<string, unknown>[]
  subjectKey?: string
  valueKey?: string
  label?: string
  color?: string
}

function normalizeRadarData(
  data: RadarChartDataPoint[] | Record<string, unknown>[],
  subjectKey: string,
  valueKey: string
): RadarChartDataPoint[] {
  if (!data.length) return []

  const first = data[0]
  const hasShape =
    typeof first === "object" &&
    first !== null &&
    "subject" in first &&
    "value" in first

  if (hasShape && subjectKey === "subject" && valueKey === "value") {
    return (data as RadarChartDataPoint[]).map((d) => ({
      subject: String(d.subject),
      value: Number(d.value),
    }))
  }

  return (data as Record<string, unknown>[]).map((d) => ({
    subject: String(d[subjectKey] ?? ""),
    value: typeof d[valueKey] === "number" ? d[valueKey] : 0,
  }))
}

export function RadarChart({
  data,
  subjectKey = "subject",
  valueKey = "value",
  label = valueKey,
  color = "var(--chart-1)",
  className,
  ...props
}: RadarChartProps) {
  const normalizedData = React.useMemo(
    () => normalizeRadarData(data, subjectKey, valueKey),
    [data, subjectKey, valueKey]
  )

  const config = React.useMemo(
    () => ({
      value: { label, color },
    }),
    [label, color]
  )

  if (normalizedData.length === 0) {
    return (
      <div
        data-slot="radar-chart"
        className={cn(
          "flex aspect-square items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground",
          className
        )}
        {...props}
      >
        No data
      </div>
    )
  }

  return (
    <ChartContainer
      data-slot="radar-chart"
      config={config}
      className={cn("aspect-square", className)}
      {...props}
    >
      <RechartsRadarChart data={normalizedData}>
        <PolarGrid className="stroke-border/50" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, "auto"]}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
          axisLine={false}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              indicator="line"
              hideLabel
              nameKey="value"
            />
          }
        />
        <Radar
          name={label}
          dataKey="value"
          stroke={color}
          fill={color}
          fillOpacity={0.3}
        />
      </RechartsRadarChart>
    </ChartContainer>
  )
}
