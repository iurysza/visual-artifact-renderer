import type { ReactNode } from "react"

import type { ArtifactNode, VisualArtifactSpec } from "@/lib/artifact-schema"

import { SvgDiagram } from "@/components/svg-diagram"
import { MermaidDiagram } from "@/components/mermaid/mermaid-diagram"
import * as adapters from "@/components/adapters"

export type ArtifactRenderContext = {
  data: VisualArtifactSpec["data"]
}

export type RenderNodes = (
  nodes: ArtifactNode[] | undefined,
  context: ArtifactRenderContext
) => ReactNode

export type AdapterArgs<T extends ArtifactNode["type"]> = {
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

function renderSvgDiagram({ node }: AdapterArgs<"svg-diagram">) {
  return <SvgDiagram {...node.props} />
}

function renderMermaid({ node }: AdapterArgs<"mermaid">) {
  return <MermaidDiagram {...node.props} />
}

export const componentRegistry = {
  alert: adapters.renderAlert as RegistryAdapter,
  "area-chart": adapters.renderAreaChart as RegistryAdapter,
  "radar-chart": adapters.renderRadarChart as RegistryAdapter,
  "scatter-chart": adapters.renderScatterChart as RegistryAdapter,
  heatmap: adapters.renderHeatmap as RegistryAdapter,
  log: adapters.renderLog as RegistryAdapter,
  "definition-list": adapters.renderDefinitionList as RegistryAdapter,
  diff: adapters.renderDiff as RegistryAdapter,
  "donut-chart": adapters.renderDonutChart as RegistryAdapter,
  "file-tree": adapters.renderFileTree as RegistryAdapter,
  heading: adapters.renderHeading as RegistryAdapter,
  image: adapters.renderImage as RegistryAdapter,
  "pie-chart": adapters.renderPieChart as RegistryAdapter,
  stepper: adapters.renderStepper as RegistryAdapter,
  text: adapters.renderText as RegistryAdapter,
  card: adapters.renderCard as RegistryAdapter,
  metric: adapters.renderMetric as RegistryAdapter,
  "stat-card": adapters.renderStatCard as RegistryAdapter,
  badge: adapters.renderBadge as RegistryAdapter,
  button: adapters.renderButton as RegistryAdapter,
  separator: adapters.renderSeparator as RegistryAdapter,
  table: adapters.renderTable as RegistryAdapter,
  "data-table": adapters.renderDataTable as RegistryAdapter,
  "comparison-table": adapters.renderComparisonTable as RegistryAdapter,
  chart: adapters.renderChart as RegistryAdapter,
  mermaid: renderMermaid as RegistryAdapter,
  "svg-diagram": renderSvgDiagram as RegistryAdapter,
  flow: adapters.renderFlow as RegistryAdapter,
  timeline: adapters.renderTimeline as RegistryAdapter,
  "code-block": adapters.renderCodeBlock as RegistryAdapter,
  "status-grid": adapters.renderStatusGrid as RegistryAdapter,
  grid: adapters.renderGrid as RegistryAdapter,
  section: adapters.renderSection as RegistryAdapter,
  tabs: adapters.renderTabs as RegistryAdapter,
  accordion: adapters.renderAccordion as RegistryAdapter,
  prose: adapters.renderProse as RegistryAdapter,
} satisfies Record<ArtifactNode["type"], RegistryAdapter>
