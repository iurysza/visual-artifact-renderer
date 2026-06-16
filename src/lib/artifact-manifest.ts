import type { ArtifactNode } from "@/lib/artifact-schema"

export type ArtifactManifestEntry = {
  type: ArtifactNode["type"]
  description: string
  props: Record<string, string>
  children: false | "nodes" | "items"
  data?: string
  requiresData?: boolean
  example: unknown
  limits?: {
    text?: number
    content?: number
    label?: number
    code?: number
    items?: number
    itemStatus?: number
    children?: number
    status?: number
  }
}

export const artifactPatternExamples = {
  architecture: {
    description: "Architecture brief: thesis + stat cards, then Mermaid topology, flow handoff, status-grid, and evidence table.",
    nodes: [
      { type: "text", props: { text: "The runtime is a three-stage ADK pipeline with explicit retrieval and TTS boundaries.", size: "lg" } },
      {
        type: "grid",
        props: { columns: 3 },
        children: [
          { type: "stat-card", props: { label: "Agents", value: 3, caption: "ImageDescriptor → ContentGenerator → JsonFormatter", tone: "accent" } },
          { type: "stat-card", props: { label: "Retrieval", value: "ChromaDB", caption: "Grounding through embedded docs", tone: "success" } },
          { type: "stat-card", props: { label: "Output", value: "JSON + MP3", caption: "Validated response and narration", tone: "default" } },
        ],
      },
      {
        type: "mermaid",
        props: {
          title: "Runtime topology",
          code: "flowchart LR\n  Client[Mobile client] --> API[FastAPI route]\n  API --> ADK[ADK sequential agent]\n  ADK --> Chroma[(ChromaDB)]\n  ADK --> TTS[Cloud TTS]",
        },
      },
      {
        type: "flow",
        props: {
          title: "Request path",
          items: [
            { title: "Client", label: "POST /retrieve" },
            { title: "FastAPI", description: "Validates request" },
            { title: "ADK pipeline", description: "Recognizes, retrieves, formats" },
            { title: "TTS", description: "Synthesizes MP3" },
          ],
        },
      },
    ],
  },
  runbook: {
    description: "Runbook: stat-card readiness band, timeline for phases, code-block for commands, comparison-table for checks.",
    nodes: [
      { type: "timeline", props: { dataKey: "releasePhases", titleKey: "phase", markerKey: "step", descriptionKey: "action", statusKey: "status" } },
      { type: "code-block", props: { title: "Release smoke", language: "bash", code: "pnpm verify:artifacts\npnpm lint\npnpm build" } },
    ],
  },
  dataApi: {
    description: "Data/API brief: flow for ingestion or API path, code-block for contracts, comparison-table for route or schema evidence.",
    nodes: [
      {
        type: "flow",
        props: {
          title: "Data path",
          items: [
            { title: "Source docs" },
            { title: "Chunk + embed" },
            { title: "Chroma collection" },
            { title: "retrieve_documents" },
          ],
        },
      },
      { type: "code-block", props: { title: "Env contract", language: "bash", code: "MODEL_NAME=...\nTEXT_EMBEDDING_MODEL=text-embedding-005\nTOP_K=5" } },
    ],
  },
} as const

export const artifactManifest = {
  "alert": {
    type: "alert",
    description: "An alert message to call out important information.",
    props: { title: "string", description: "string?", variant: '"default" | "destructive"' },
    children: false,
    example: { type: "alert", props: { title: "Heads up", description: "This is important." } },
  },
  "definition-list": {
    type: "definition-list",
    description: "A compact list of terms and descriptions.",
    props: { items: "{ term, description }[]" },
    children: false,
    limits: { items: 20 },
    example: { type: "definition-list", props: { items: [{ term: "Term", description: "Description" }] } },
  },
  "diff": {
    type: "diff",
    description: "Code or text difference visualization.",
    props: { before: "string", after: "string", language: "string?", title: "string?", defaultOpen: "boolean?" },
    children: false,
    limits: { text: 5000 },
    example: { type: "diff", props: { before: "a", after: "b", language: "typescript" } },
  },
  "donut-chart": {
    type: "donut-chart",
    description: "A donut chart for proportional data.",
    props: { dataKey: "string", categoryKey: "string", valueKey: "string" },
    children: false,
    requiresData: true,
    example: { type: "donut-chart", props: { dataKey: "browserStats", categoryKey: "browser", valueKey: "visitors" } },
  },
  "area-chart": {
    type: "area-chart",
    description: "An area chart for cumulative trends.",
    props: { dataKey: "string", xKey: "string?", yKey: "string?", label: "string?", color: "string?" },
    children: false,
    requiresData: true,
    example: { type: "area-chart", props: { dataKey: "monthlyRevenue", xKey: "month", yKey: "revenue" } },
  },
  "radar-chart": {
    type: "radar-chart",
    description: "A radar chart for multi-dimensional comparisons.",
    props: { dataKey: "string", subjectKey: "string?", valueKey: "string?", label: "string?", color: "string?" },
    children: false,
    requiresData: true,
    example: { type: "radar-chart", props: { dataKey: "skillScores", subjectKey: "skill", valueKey: "score" } },
  },
  "scatter-chart": {
    type: "scatter-chart",
    description: "A scatter chart for correlations.",
    props: { dataKey: "string", xKey: "string?", yKey: "string?", label: "string?", color: "string?" },
    children: false,
    requiresData: true,
    example: { type: "scatter-chart", props: { dataKey: "experienceVsSalary", xKey: "years", yKey: "salary" } },
  },
  "heatmap": {
    type: "heatmap",
    description: "A heatmap for matrix data and correlations.",
    props: { dataKey: "string", xKey: "string?", yKey: "string?", valueKey: "string?", caption: "string?" },
    children: false,
    requiresData: true,
    example: { type: "heatmap", props: { dataKey: "riskMatrix", xKey: "category", yKey: "quarter", valueKey: "score" } },
  },
  "log": {
    type: "log",
    description: "A scrollable terminal-like log output.",
    props: { lines: "string[]?", dataKey: "string?" },
    children: false,
    requiresData: true,
    example: { type: "log", props: { dataKey: "deploymentLogs" } },
  },
  "file-tree": {
    type: "file-tree",
    description: "A collapsible file explorer tree.",
    props: { items: "{ name, type, children }[]" },
    children: false,
    limits: { items: 50 },
    example: { type: "file-tree", props: { items: [{ name: "src", type: "directory", children: [{ name: "index.ts", type: "file" }] }] } },
  },
  "image": {
    type: "image",
    description: "An image with optional caption and aspect ratio.",
    props: { src: "string", alt: "string", caption: "string?", aspect: '"auto" | "square" | "video" | "wide"' },
    children: false,
    example: { type: "image", props: { src: "/placeholder.png", alt: "Placeholder" } },
  },
  "pie-chart": {
    type: "pie-chart",
    description: "A pie chart for proportional data.",
    props: { dataKey: "string", categoryKey: "string", valueKey: "string" },
    children: false,
    requiresData: true,
    example: { type: "pie-chart", props: { dataKey: "browserStats", categoryKey: "browser", valueKey: "visitors" } },
  },
  "stepper": {
    type: "stepper",
    description: "A step-by-step progress indicator.",
    props: { items: "{ title, description?, status? }[]" },
    children: false,
    limits: { items: 10 },
    example: { type: "stepper", props: { items: [{ title: "Step 1", status: "complete" }, { title: "Step 2", status: "current" }] } },
  },
  heading: {
    type: "heading",
    description: "Section or page heading. Use sparingly; renderer already supplies the page hero.",
    props: { text: "string", level: "1 | 2 | 3 | 4?", align: "left | center | right?" },
    children: false,
    limits: { text: 120 },
    example: { type: "heading", props: { text: "Quarterly Revenue", level: 2 } },
  },
  prose: {
    type: "prose",
    description: "Markdown text for prose, lists, links, and long-form narrative. Use this instead of 'text' when you need multiple paragraphs or basic markdown formatting.",
    props: { content: "string" },
    children: false,
    limits: { content: 3000 },
    example: { type: "prose", props: { content: "Here is a list of items:\n\n- First item\n- Second item\n\n[Learn more](https://example.com)" } },
  },
  text: {
    type: "text",
    description: "Paragraph text for narrative. Keep copy compact; use tables/status grids for structured facts.",
    props: { text: "string", tone: "default | muted?", size: "sm | base | lg?", align: "left | center | right?" },
    children: false,
    limits: { text: 800 },
    example: { type: "text", props: { text: "Revenue grew across enterprise accounts.", tone: "muted" } },
  },
  card: {
    type: "card",
    description: "General content container. Use tone for a subtle left accent; do not wrap every tiny fact in a card when stat-card/status-grid fits better.",
    props: { title: "string?", description: "string?", size: "default | sm?", tone: "default | accent | success | warning | danger?" },
    children: "nodes",
    limits: { children: 10 },
    example: { type: "card", props: { title: "Summary", tone: "accent" }, children: [{ type: "text", props: { text: "One clear idea." } }] },
  },
  metric: {
    type: "metric",
    description: "Compact KPI display inside another container. Prefer stat-card for top-level dashboard KPI tiles.",
    props: { label: "string", value: "string | number", delta: "string?", trend: "up | down | neutral?" },
    children: false,
    limits: { label: 40 },
    example: { type: "metric", props: { label: "Revenue", value: "$128,400", delta: "+12.5%", trend: "up" } },
  },
  "stat-card": {
    type: "stat-card",
    description: "Standalone dashboard KPI tile. Best for summary bands: counts, state, health, totals, deltas.",
    props: { label: "string", value: "string | number", delta: "string?", trend: "up | down | neutral?", caption: "string?", tone: "default | accent | success | warning | danger?" },
    children: false,
    limits: { label: 40 },
    example: { type: "stat-card", props: { label: "Install state", value: "linked", delta: "healthy", trend: "up", caption: "Tracked targets already linked.", tone: "success" } },
  },
  badge: {
    type: "badge",
    description: "Small passive label. Use for metadata, not primary status summaries.",
    props: { label: "string", variant: "default | secondary | destructive | outline | ghost | link?" },
    children: false,
    limits: { label: 40 },
    example: { type: "badge", props: { label: "On track", variant: "secondary" } },
  },
  button: {
    type: "button",
    description: "Action link or button-looking link. Avoid file:// links in shareable artifacts.",
    props: { label: "string", href: "string?", variant: "default | outline | secondary | ghost | destructive | link?", size: "default | xs | sm | lg?" },
    children: false,
    limits: { label: 40 },
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
    requiresData: true,
    data: "data[dataKey] must be an array of row objects.",
    example: { type: "table", props: { dataKey: "revenueByMonth", columns: ["month", "revenue"] } },
  },
  "data-table": {
    type: "data-table",
    description: "Dense table variant for operational data, logs, inventories, and evidence lists.",
    props: { dataKey: "string", columns: "(string | { key, label? })[]?", caption: "string?" },
    children: false,
    requiresData: true,
    data: "data[dataKey] must be an array of row objects.",
    example: { type: "data-table", props: { dataKey: "accounts", columns: [{ key: "name", label: "Account" }] } },
  },
  "comparison-table": {
    type: "comparison-table",
    description: "Dashboard comparison table with stronger first column and optional status chips. Use for options, risks, validations, runtimes, and parity checks.",
    props: { dataKey: "string", columns: "(string | { key, label? })[]?", statusKey: "string?", caption: "string?" },
    children: false,
    requiresData: true,
    data: "data[dataKey] must be an array of row objects. statusKey values are rendered as status chips.",
    example: { type: "comparison-table", props: { dataKey: "checks", columns: ["check", "result", "evidence"], statusKey: "result" } },
  },
  chart: {
    type: "chart",
    description: "Line or bar chart backed by embedded data. Pair charts with table detail when exact values matter.",
    props: { dataKey: "string", xKey: "string", yKey: "string", kind: "line | bar?", label: "string?", color: "string?" },
    children: false,
    requiresData: true,
    data: "data[dataKey] must be an array of row objects containing xKey and yKey.",
    example: { type: "chart", props: { dataKey: "revenueByMonth", xKey: "month", yKey: "revenue", kind: "line" } },
  },
  mermaid: {
    type: "mermaid",
    description: "Client-rendered zoomable/pannable Mermaid diagram with wheel, pinch, drag, keyboard, and fit controls. Use for quick architecture, sequence, flowchart, ERD, state, class, and C4 diagrams from Mermaid text.",
    props: { code: "string", title: "string?", caption: "string?", height: "number? 240-1600" },
    children: false,
    limits: { code: 5000 },
    example: { type: "mermaid", props: { title: "Request flow", code: "flowchart LR\n  Client --> API\n  API --> DB" } },
  },
  "svg-diagram": {
    type: "svg-diagram",
    description: "Full-screen interactive SVG/HTML architecture diagram embedded in a sandboxed iframe. Use when Mermaid cannot lay out the topology cleanly, when you need animated request paths, clickable nodes, or precise visual control. The html value must be a complete self-contained document with hand-rolled CSS variables for light/dark themes, an apply-before-paint theme script, a theme toggle, and an SVG styled through CSS classes (no hard-coded hex inside SVG). Layout rules: pick a viewBox large enough for all nodes; keep at least 30px between node rectangles and 40px between zones; reserve the bottom-right corner for the detail card overlay; route edges and labels through empty space; verify by inspection that nothing overlaps.",
    props: { html: "string", title: "string?", caption: "string?", height: "number? 240-1600" },
    children: false,
    example: { type: "svg-diagram", props: { title: "Interactive architecture", height: 720, html: "<!doctype html><html><head><script>(function(){try{const k='visualizer-theme',s=localStorage.getItem(k),d=s?s==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}})();</script><style>:root{--bg:#FAF9F5;--ink:#141413;}html.dark{--bg:#141413;--ink:#FAF9F5;}body{background:var(--bg);}</style></head><body><svg viewBox='0 0 100 40'><text x='5' y='24' fill='var(--ink)'>Architecture</text></svg></body></html>" } },
  },
  flow: {
    type: "flow",
    description: "Inline architecture diagram for ordered handoffs, pipelines, request paths, and deployment chains.",
    props: { title: "string?", caption: "string?", items: "{ title, label?, description?, status? }[]" },
    children: false,
    limits: { items: 6, itemStatus: 16 },
    example: { type: "flow", props: { title: "Request path", items: [{ title: "Client", label: "POST /retrieve" }, { title: "FastAPI" }, { title: "ADK pipeline", status: "running" }] } },
  },
  timeline: {
    type: "timeline",
    description: "Data-backed vertical timeline for releases, lifecycle phases, runbooks, or migration sequences.",
    props: { dataKey: "string", titleKey: "string?", markerKey: "string?", descriptionKey: "string?", statusKey: "string?", caption: "string?" },
    children: false,
    requiresData: true,
    limits: { status: 16 },
    data: "data[dataKey] must be an array of row objects. Defaults: title, marker, description, status.",
    example: { type: "timeline", props: { dataKey: "releasePhases", titleKey: "phase", markerKey: "step", descriptionKey: "action", statusKey: "status" } },
  },
  "code-block": {
    type: "code-block",
    description: "Syntax-highlighted code block with a copy button. Use for commands, config snippets, env contracts, file maps, and ASCII trees. Set language for accurate highlighting (bash, typescript, python, yaml, json, etc.).",
    props: { title: "string?", language: "string?", code: "string", caption: "string?" },
    children: false,
    limits: { code: 3000 },
    example: { type: "code-block", props: { title: "Smoke release", language: "bash", code: "git tag smoke-v0.0.1\ngit push origin smoke-v0.0.1" } },
  },
  "status-grid": {
    type: "status-grid",
    description: "Data-backed grid of operational states with status chips. Best for health, readiness, validation, component state, and risk boards.",
    props: { dataKey: "string", titleKey: "string?", statusKey: "string", descriptionKey: "string?", metaKey: "string?", columns: "1 | 2 | 3 | 4?", caption: "string?" },
    children: false,
    requiresData: true,
    limits: { status: 16 },
    data: "data[dataKey] must be an array of row objects. statusKey chooses chip tone from values like pass/ok/healthy/warn/fail/risk.",
    example: { type: "status-grid", props: { dataKey: "runtimeStatus", titleKey: "component", statusKey: "status", descriptionKey: "notes", columns: 3 } },
  },
  grid: {
    type: "grid",
    description: "Responsive grid layout for child nodes. Use with stat-card, card, badge groups, and mixed dashboard sections.",
    props: { columns: "1 | 2 | 3 | 4?" },
    children: "nodes",
    limits: { children: 12 },
    example: { type: "grid", props: { columns: 2 }, children: [{ type: "card", props: { title: "A" } }] },
  },
  section: {
    type: "section",
    description: "Named content section with optional description. Use sections to create scan rhythm before dense components.",
    props: { title: "string?", description: "string?" },
    children: "nodes",
    limits: { children: 10 },
    example: { type: "section", props: { title: "Findings" }, children: [{ type: "text", props: { text: "One finding." } }] },
  },
  tabs: {
    type: "tabs",
    description: "Tabbed organization for alternate views. Good for Pi/OpenCode/wrapper splits or monthly/segment detail.",
    props: { defaultValue: "string?", items: "{ value, label, nodes }[]" },
    children: "items",
    limits: { items: 5 },
    example: { type: "tabs", props: { items: [{ value: "summary", label: "Summary", nodes: [{ type: "text", props: { text: "Tab content." } }] }] } },
  },
  accordion: {
    type: "accordion",
    description: "Expandable sections for details, FAQs, sharp edges, or lower-priority evidence. Do not hide primary conclusions here.",
    props: { items: "{ title, nodes }[]" },
    children: "items",
    limits: { items: 8 },
    example: { type: "accordion", props: { items: [{ title: "Why?", nodes: [{ type: "text", props: { text: "Because it is useful." } }] }] } },
  },
} satisfies Record<ArtifactNode["type"], ArtifactManifestEntry>

export const artifactComponentManifest: ArtifactManifestEntry[] = Object.values(artifactManifest)
