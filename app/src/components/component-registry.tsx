import { SvgDiagram } from "@/components/svg-diagram"
import { MermaidDiagram } from "@/components/mermaid/mermaid-diagram"

import { createAdapter } from "@/components/adapters/create-adapter"
import * as adapters from "@/components/adapters"

import type { ArtifactNode } from "@/lib/contract/artifact-schema"
import type { AdapterArgs, RegistryAdapter } from "@/components/artifact-types"

export type { ArtifactRenderContext, RenderNodes, AdapterArgs } from "@/components/artifact-types"

function renderSvgDiagram({ node }: AdapterArgs<"svg-diagram">) {
  return <SvgDiagram {...node.props} />
}

function renderMermaid({ node }: AdapterArgs<"mermaid">) {
  return <MermaidDiagram {...node.props} />
}

export const componentRegistry = {
  alert: createAdapter(adapters.renderAlert),
  "area-chart": createAdapter(adapters.renderAreaChart),
  "radar-chart": createAdapter(adapters.renderRadarChart),
  "scatter-chart": createAdapter(adapters.renderScatterChart),
  heatmap: createAdapter(adapters.renderHeatmap),
  log: createAdapter(adapters.renderLog),
  "definition-list": createAdapter(adapters.renderDefinitionList),
  diff: createAdapter(adapters.renderDiff),
  "donut-chart": createAdapter(adapters.renderDonutChart),
  "file-tree": createAdapter(adapters.renderFileTree),
  heading: createAdapter(adapters.renderHeading),
  image: createAdapter(adapters.renderImage),
  "pie-chart": createAdapter(adapters.renderPieChart),
  stepper: createAdapter(adapters.renderStepper),
  text: createAdapter(adapters.renderText),
  card: createAdapter(adapters.renderCard),
  metric: createAdapter(adapters.renderMetric),
  "stat-card": createAdapter(adapters.renderStatCard),
  badge: createAdapter(adapters.renderBadge),
  button: createAdapter(adapters.renderButton),
  separator: createAdapter(adapters.renderSeparator),
  table: createAdapter(adapters.renderTable),
  "data-table": createAdapter(adapters.renderDataTable),
  "comparison-table": createAdapter(adapters.renderComparisonTable),
  chart: createAdapter(adapters.renderChart),
  mermaid: createAdapter(renderMermaid),
  "svg-diagram": createAdapter(renderSvgDiagram),
  flow: createAdapter(adapters.renderFlow),
  timeline: createAdapter(adapters.renderTimeline),
  "code-block": createAdapter(adapters.renderCodeBlock),
  "status-grid": createAdapter(adapters.renderStatusGrid),
  grid: createAdapter(adapters.renderGrid),
  section: createAdapter(adapters.renderSection),
  tabs: createAdapter(adapters.renderTabs),
  accordion: createAdapter(adapters.renderAccordion),
  prose: createAdapter(adapters.renderProse),
} satisfies Record<ArtifactNode["type"], RegistryAdapter>
