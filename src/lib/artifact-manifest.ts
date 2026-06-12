import type { ArtifactNode } from "@/lib/artifact-schema"

export type ArtifactManifestEntry = {
  type: ArtifactNode["type"]
  description: string
  props: Record<string, string>
  children: false | "nodes" | "items"
  data?: string
  example: unknown
}

export const artifactCompositionGuidance = [
  "Open with a concise thesis and a stat-card summary band.",
  "Use stat-card for KPI, count, health, and state summaries.",
  "Use status-grid for component health, readiness, validation, and risk boards.",
  "Use comparison-table for evidence, options, risks, checks, and runtime matrices.",
  "Use flow for pipelines, request paths, and architecture handoffs.",
  "Use timeline for release phases, lifecycle steps, and operator runbooks.",
  "Use code-block for commands, config snippets, and file/path maps.",
  "Use tabs for alternate contexts; use accordion only for secondary detail.",
  "Avoid generic card soup and avoid file:// links in shareable artifacts.",
] as const

export const artifactManifest = {
  heading: {
    type: "heading",
    description: "Section or page heading. Use sparingly; renderer already supplies the page hero.",
    props: { text: "string", level: "1 | 2 | 3 | 4?", align: "left | center | right?" },
    children: false,
    example: { type: "heading", props: { text: "Quarterly Revenue", level: 2 } },
  },
  text: {
    type: "text",
    description: "Paragraph text for narrative. Keep copy compact; use tables/status grids for structured facts.",
    props: { text: "string", tone: "default | muted?", size: "sm | base | lg?", align: "left | center | right?" },
    children: false,
    example: { type: "text", props: { text: "Revenue grew across enterprise accounts.", tone: "muted" } },
  },
  card: {
    type: "card",
    description: "General content container. Use tone for a subtle left accent; do not wrap every tiny fact in a card when stat-card/status-grid fits better.",
    props: { title: "string?", description: "string?", size: "default | sm?", tone: "default | accent | success | warning | danger?" },
    children: "nodes",
    example: { type: "card", props: { title: "Summary", tone: "accent" }, children: [{ type: "text", props: { text: "One clear idea." } }] },
  },
  metric: {
    type: "metric",
    description: "Compact KPI display inside another container. Prefer stat-card for top-level dashboard KPI tiles.",
    props: { label: "string", value: "string | number", delta: "string?", trend: "up | down | neutral?" },
    children: false,
    example: { type: "metric", props: { label: "Revenue", value: "$128,400", delta: "+12.5%", trend: "up" } },
  },
  "stat-card": {
    type: "stat-card",
    description: "Standalone dashboard KPI tile. Best for summary bands: counts, state, health, totals, deltas.",
    props: { label: "string", value: "string | number", delta: "string?", trend: "up | down | neutral?", caption: "string?", tone: "default | accent | success | warning | danger?" },
    children: false,
    example: { type: "stat-card", props: { label: "Install state", value: "linked", delta: "healthy", trend: "up", caption: "Tracked targets already linked.", tone: "success" } },
  },
  badge: {
    type: "badge",
    description: "Small passive label. Use for metadata, not primary status summaries.",
    props: { label: "string", variant: "default | secondary | destructive | outline | ghost | link?" },
    children: false,
    example: { type: "badge", props: { label: "On track", variant: "secondary" } },
  },
  button: {
    type: "button",
    description: "Action link or button-looking link. Avoid file:// links in shareable artifacts.",
    props: { label: "string", href: "string?", variant: "default | outline | secondary | ghost | destructive | link?", size: "default | xs | sm | lg?" },
    children: false,
    example: { type: "button", props: { label: "Open source", href: "https://example.com", variant: "outline" } },
  },
  separator: {
    type: "separator",
    description: "Visual separator between sections.",
    props: {},
    children: false,
    example: { type: "separator" },
  },
  table: {
    type: "table",
    description: "Readable table backed by embedded data. Use for fewer rows or narrative tables.",
    props: { dataKey: "string", columns: "(string | { key, label? })[]?", caption: "string?" },
    children: false,
    data: "data[dataKey] must be an array of row objects.",
    example: { type: "table", props: { dataKey: "revenueByMonth", columns: ["month", "revenue"] } },
  },
  "data-table": {
    type: "data-table",
    description: "Dense table variant for operational data, logs, inventories, and evidence lists.",
    props: { dataKey: "string", columns: "(string | { key, label? })[]?", caption: "string?" },
    children: false,
    data: "data[dataKey] must be an array of row objects.",
    example: { type: "data-table", props: { dataKey: "accounts", columns: [{ key: "name", label: "Account" }] } },
  },
  "comparison-table": {
    type: "comparison-table",
    description: "Dashboard comparison table with stronger first column and optional status chips. Use for options, risks, validations, runtimes, and parity checks.",
    props: { dataKey: "string", columns: "(string | { key, label? })[]?", statusKey: "string?", caption: "string?" },
    children: false,
    data: "data[dataKey] must be an array of row objects. statusKey values are rendered as status chips.",
    example: { type: "comparison-table", props: { dataKey: "checks", columns: ["check", "result", "evidence"], statusKey: "result" } },
  },
  chart: {
    type: "chart",
    description: "Line or bar chart backed by embedded data. Pair charts with table detail when exact values matter.",
    props: { dataKey: "string", xKey: "string", yKey: "string", kind: "line | bar?", label: "string?", color: "string?" },
    children: false,
    data: "data[dataKey] must be an array of row objects containing xKey and yKey.",
    example: { type: "chart", props: { dataKey: "revenueByMonth", xKey: "month", yKey: "revenue", kind: "line" } },
  },
  flow: {
    type: "flow",
    description: "Inline architecture diagram for ordered handoffs, pipelines, request paths, and deployment chains.",
    props: { title: "string?", caption: "string?", items: "{ title, label?, description?, status? }[]" },
    children: false,
    example: { type: "flow", props: { title: "Request path", items: [{ title: "Client", label: "POST /retrieve" }, { title: "FastAPI" }, { title: "ADK pipeline", status: "running" }] } },
  },
  timeline: {
    type: "timeline",
    description: "Data-backed vertical timeline for releases, lifecycle phases, runbooks, or migration sequences.",
    props: { dataKey: "string", titleKey: "string?", markerKey: "string?", descriptionKey: "string?", statusKey: "string?", caption: "string?" },
    children: false,
    data: "data[dataKey] must be an array of row objects. Defaults: title, marker, description, status.",
    example: { type: "timeline", props: { dataKey: "releasePhases", titleKey: "phase", markerKey: "step", descriptionKey: "action", statusKey: "status" } },
  },
  "code-block": {
    type: "code-block",
    description: "Formatted command/config/path block. Use for commands, env vars, YAML fragments, file maps, and ASCII trees.",
    props: { title: "string?", language: "string?", code: "string", caption: "string?" },
    children: false,
    example: { type: "code-block", props: { title: "Smoke release", language: "bash", code: "git tag smoke-v0.0.1\ngit push origin smoke-v0.0.1" } },
  },
  "status-grid": {
    type: "status-grid",
    description: "Data-backed grid of operational states with status chips. Best for health, readiness, validation, component state, and risk boards.",
    props: { dataKey: "string", titleKey: "string?", statusKey: "string", descriptionKey: "string?", metaKey: "string?", columns: "1 | 2 | 3 | 4?", caption: "string?" },
    children: false,
    data: "data[dataKey] must be an array of row objects. statusKey chooses chip tone from values like pass/ok/healthy/warn/fail/risk.",
    example: { type: "status-grid", props: { dataKey: "runtimeStatus", titleKey: "component", statusKey: "status", descriptionKey: "notes", columns: 3 } },
  },
  grid: {
    type: "grid",
    description: "Responsive grid layout for child nodes. Use with stat-card, card, badge groups, and mixed dashboard sections.",
    props: { columns: "1 | 2 | 3 | 4?" },
    children: "nodes",
    example: { type: "grid", props: { columns: 2 }, children: [{ type: "card", props: { title: "A" } }] },
  },
  section: {
    type: "section",
    description: "Named content section with optional description. Use sections to create scan rhythm before dense components.",
    props: { title: "string?", description: "string?" },
    children: "nodes",
    example: { type: "section", props: { title: "Findings" }, children: [{ type: "text", props: { text: "One finding." } }] },
  },
  tabs: {
    type: "tabs",
    description: "Tabbed organization for alternate views. Good for Pi/OpenCode/wrapper splits or monthly/segment detail.",
    props: { defaultValue: "string?", items: "{ value, label, nodes }[]" },
    children: "items",
    example: { type: "tabs", props: { items: [{ value: "summary", label: "Summary", nodes: [{ type: "text", props: { text: "Tab content." } }] }] } },
  },
  accordion: {
    type: "accordion",
    description: "Expandable sections for details, FAQs, sharp edges, or lower-priority evidence. Do not hide primary conclusions here.",
    props: { items: "{ title, nodes }[]" },
    children: "items",
    example: { type: "accordion", props: { items: [{ title: "Why?", nodes: [{ type: "text", props: { text: "Because it is useful." } }] }] } },
  },
} satisfies Record<ArtifactNode["type"], ArtifactManifestEntry>

export const artifactComponentManifest = Object.values(artifactManifest)
