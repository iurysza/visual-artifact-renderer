"use client"

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Prose } from "@/components/ui/prose"
import { CodeBlock } from "@/components/ui/code-block"
import { DefinitionList } from "@/components/ui/definition-list"
import { Diff } from "@/components/ui/diff"
import { FileTree } from "@/components/ui/file-tree"
import { ArtifactImage } from "@/components/ui/artifact-image"
import { PieChart as PieChartComponent } from "@/components/ui/pie-chart"
import { Stepper } from "@/components/ui/stepper"
import { AreaChart } from "@/components/ui/area-chart"
import { RadarChart } from "@/components/ui/radar-chart"
import { ScatterChart } from "@/components/ui/scatter-chart"
import { Heatmap } from "@/components/ui/heatmap"
import { Log } from "@/components/ui/log"
import { PanelCard, TrendPill } from "@/components/artifact-primitives"
import { cn } from "@/lib/utils"
import { getRows, MissingData } from "@/lib/data"
import { resolveArtifactImageSrc } from "@/lib/image-src"

import type { AdapterArgs } from "@/components/artifact-types"

export function renderAlert({ node }: AdapterArgs<"alert">) {
  const { title, description, variant } = node.props
  return (
    <Alert variant={variant}>
      <AlertTitle>{title}</AlertTitle>
      {description && <AlertDescription>{description}</AlertDescription>}
    </Alert>
  )
}

export function renderAreaChart({ node, context }: AdapterArgs<"area-chart">) {
  const { dataKey, xKey, yKey, label, color } = node.props
  const data = getRows(context.data, dataKey)
  if (!data.length) return <MissingData dataKey={dataKey} />
  return (
    <AreaChart
      data={data as Record<string, unknown>[]}
      xKey={xKey}
      yKey={yKey}
      label={label}
      color={color}
    />
  )
}

export function renderRadarChart({ node, context }: AdapterArgs<"radar-chart">) {
  const { dataKey, subjectKey, valueKey, label, color } = node.props
  const data = getRows(context.data, dataKey)
  if (!data.length) return <MissingData dataKey={dataKey} />
  return (
    <RadarChart
      data={data as Record<string, unknown>[]}
      subjectKey={subjectKey}
      valueKey={valueKey}
      label={label}
      color={color}
    />
  )
}

export function renderScatterChart({ node, context }: AdapterArgs<"scatter-chart">) {
  const { dataKey, xKey, yKey, label, color } = node.props
  const data = getRows(context.data, dataKey)
  if (!data.length) return <MissingData dataKey={dataKey} />
  return (
    <ScatterChart
      data={data as Record<string, unknown>[]}
      xKey={xKey}
      yKey={yKey}
      label={label}
      color={color}
    />
  )
}

export function renderHeatmap({ node, context }: AdapterArgs<"heatmap">) {
  const { dataKey, xKey, yKey, valueKey, caption } = node.props
  const data = getRows(context.data, dataKey)
  if (!data.length) return <MissingData dataKey={dataKey} />
  return (
    <Heatmap
      data={data as Record<string, unknown>[]}
      xKey={xKey}
      yKey={yKey}
      valueKey={valueKey}
      caption={caption}
    />
  )
}

export function renderLog({ node, context }: AdapterArgs<"log">) {
  const { lines, dataKey } = node.props
  if (lines) return <Log lines={lines} />
  if (dataKey) {
    const data = getRows(context.data, dataKey)
    if (!data.length) return <MissingData dataKey={dataKey} />
    return <Log data={context.data} dataKey={dataKey} />
  }
  return <Log lines={[]} />
}

export function renderDefinitionList({ node }: AdapterArgs<"definition-list">) {
  const { items } = node.props
  return <DefinitionList items={items} />
}

export function renderDiff({ node }: AdapterArgs<"diff">) {
  const { before, after, language, title, defaultOpen } = node.props
  return (
    <Diff
      before={before}
      after={after}
      language={language}
      title={title}
      defaultOpen={defaultOpen}
    />
  )
}

export function renderFileTree({ node }: AdapterArgs<"file-tree">) {
  const { items } = node.props
  return <FileTree items={items} />
}

export function renderImage({ node, context }: AdapterArgs<"image">) {
  const { src, alt, caption, aspect } = node.props
  return <ArtifactImage src={resolveArtifactImageSrc(src, context.project)} alt={alt} caption={caption} aspect={aspect} />
}

export function renderPieChart({ node, context }: AdapterArgs<"pie-chart">) {
  const { dataKey, categoryKey, valueKey } = node.props
  const data = getRows(context.data, dataKey)
  if (!data.length) return <MissingData dataKey={dataKey} />
  return (
    <PieChartComponent
      data={data as Record<string, unknown>[]}
      categoryKey={categoryKey}
      valueKey={valueKey}
      kind="pie"
    />
  )
}

export function renderDonutChart({ node, context }: AdapterArgs<"donut-chart">) {
  const { dataKey, categoryKey, valueKey } = node.props
  const data = getRows(context.data, dataKey)
  if (!data.length) return <MissingData dataKey={dataKey} />
  return (
    <PieChartComponent
      data={data as Record<string, unknown>[]}
      categoryKey={categoryKey}
      valueKey={valueKey}
      kind="donut"
    />
  )
}

export function renderStepper({ node }: AdapterArgs<"stepper">) {
  const { items } = node.props
  return <Stepper items={items} />
}

export function renderHeading({ node }: AdapterArgs<"heading">) {
  const { text, level = 2, align = "left" } = node.props
  const className = cn(
    "break-words font-serif font-medium tracking-[-0.025em] text-foreground",
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

export function renderText({ node }: AdapterArgs<"text">) {
  const { text, tone = "default", size = "base", align = "left" } = node.props

  return (
    <p
      className={cn(
        "max-w-4xl break-words leading-7",
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

export function renderProse({ node }: AdapterArgs<"prose">) {
  const className = node.props.tone === "muted" ? "text-muted-foreground" : undefined
  return <Prose className={className}>{node.props.content}</Prose>
}

export function renderMetric({ node }: AdapterArgs<"metric">) {
  const { label, value, delta, trend = "neutral" } = node.props

  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <p className="min-w-0 max-w-full break-words font-serif text-4xl font-medium leading-none tracking-[-0.035em] text-foreground">
          {value}
        </p>
        {delta && <TrendPill trend={trend}>{delta}</TrendPill>}
      </div>
    </div>
  )
}

export function renderStatCard({ node }: AdapterArgs<"stat-card">) {
  const {
    label,
    value,
    delta,
    trend = "neutral",
    caption,
    tone = "default",
  } = node.props

  return (
    <PanelCard
      tone={tone}
      className="min-h-full rounded-2xl border-[1.5px] bg-card/95 p-5 text-card-foreground shadow-[var(--shadow-card)]"
    >
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <p className="min-w-0 max-w-full break-words font-serif text-4xl font-medium leading-none tracking-[-0.04em] text-foreground">
          {value}
        </p>
        {delta && <TrendPill trend={trend}>{delta}</TrendPill>}
      </div>
      {caption && (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{caption}</p>
      )}
    </PanelCard>
  )
}

export function renderBadge({ node }: AdapterArgs<"badge">) {
  return <Badge variant={node.props.variant}>{node.props.label}</Badge>
}

export function renderButton({ node }: AdapterArgs<"button">) {
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

export function renderSeparator() {
  return <Separator />
}

export function renderCodeBlock({ node }: AdapterArgs<"code-block">) {
  return <CodeBlock {...node.props} />
}
