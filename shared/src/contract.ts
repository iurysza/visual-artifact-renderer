// Shared, dependency-free source of truth for the visual artifact contract.
// Used by the Next.js renderer export script and by the compiled CLI.

import {
  ARTIFACT_SLUG_MAX_LENGTH,
  ARTIFACT_SPEC_RESOURCE_LIMITS,
  MAX_TOP_LEVEL_NODES,
  type ArtifactSpecResourceLimits,
} from "./artifact-schema.js"

export {
  ARTIFACT_SLUG_MAX_LENGTH,
  ARTIFACT_SPEC_RESOURCE_LIMITS,
  ArtifactNodeSchema,
  ArtifactResourceError,
  ArtifactSizeError,
  ArtifactSlugSchema,
  ArtifactValidationError,
  MAX_AGGREGATE_FILE_SOURCE_BYTES,
  MAX_DATASETS,
  MAX_FILE_SOURCE_BYTES,
  MAX_FILE_TREE_DEPTH,
  MAX_FILE_TREE_ITEMS,
  MAX_NODE_DEPTH,
  MAX_TOP_LEVEL_NODES,
  MAX_TOTAL_NODES,
  RAW_ARTIFACT_MAX_BYTES,
  VisualArtifactSpecSchema,
  parseRawArtifactJson,
  parseVisualArtifactSpec,
  preflightArtifactSpec,
  safeParseVisualArtifactSpec,
  type ArtifactColumn,
  type ArtifactFlowItem,
  type ArtifactNode,
  type ArtifactPreflightResult,
  type ArtifactSpecResourceLimits,
  type ArtifactTone,
  type VisualArtifactSpec,
} from "./artifact-schema.js"

export const ARTIFACT_SPEC_CONSTRAINTS = {
  slug: {
    type: "string",
    format: "kebab-case",
    minLength: 1,
    maxLength: ARTIFACT_SLUG_MAX_LENGTH,
  },
  title: {
    type: "string",
    minLength: 1,
  },
  description: {
    type: "string",
    minLength: 1,
    optional: true,
  },
  createdAt: {
    type: "string",
    minLength: 1,
    optional: true,
  },
  layout: {
    type: {
      enum: ["default", "grid"] as const,
    },
    columns: {
      enum: [1, 2, 3, 4] as const,
    },
  },
  nodes: {
    type: "array",
    minItems: 1,
    maxItems: MAX_TOP_LEVEL_NODES,
  },
} as const

export const ARTIFACT_NODE_TYPES = [
  "alert",
  "annotated-visual",
  "area-chart",
  "radar-chart",
  "scatter-chart",
  "heatmap",
  "log",
  "definition-list",
  "diff",
  "donut-chart",
  "file-tree",
  "heading",
  "image",
  "knowledge-check",
  "pie-chart",
  "stepper",
  "visual-sequence",
  "text",
  "card",
  "metric",
  "stat-card",
  "badge",
  "button",
  "separator",
  "table",
  "data-table",
  "comparison-table",
  "chart",
  "mermaid",
  "svg-diagram",
  "flow",
  "timeline",
  "code-block",
  "status-grid",
  "grid",
  "section",
  "tabs",
  "accordion",
  "prose",
] as const satisfies readonly string[]

export type ArtifactNodeType = (typeof ARTIFACT_NODE_TYPES)[number]

export interface NodeDef {
  description: string
  props: Record<string, string>
  children: false | "nodes" | "items"
  data?: string
  requiresData?: boolean
  example: unknown
}

export interface ArtifactManifestEntry extends NodeDef {
  type: ArtifactNodeType
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
          caption: "Runtime topology",
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
  lesson: {
    description: "Lesson: opening mental model, annotated visual, learner-paced worked sequence, then retrieval with explanatory feedback.",
    nodes: [
      { type: "text", props: { text: "A request crosses three boundaries before the renderer can display it.", size: "lg" } },
      {
        type: "annotated-visual",
        props: {
          src: "request-path.png",
          alt: "Request path from agent to rendered artifact",
          caption: "Select a marker to connect each boundary to its responsibility.",
          aspect: "wide",
          markers: [
            { title: "Contract", description: "The agent emits constrained JSON.", x: 20, y: 50 },
            { title: "Renderer", description: "Trusted adapters turn nodes into UI.", x: 80, y: 50 },
          ],
        },
      },
      {
        type: "visual-sequence",
        props: {
          title: "Follow one request",
          items: [
            { title: "Describe", description: "Express the idea with semantic nodes.", nodes: [{ type: "code-block", props: { language: "json", code: "{ \"type\": \"text\", \"props\": { \"text\": \"Hello\" } }" } }] },
            { title: "Render", description: "The registry chooses a trusted adapter.", nodes: [{ type: "text", props: { text: "No arbitrary JSX crosses the contract boundary." } }] },
          ],
        },
      },
      {
        type: "knowledge-check",
        props: {
          prompt: "Which layer owns visual styling?",
          choices: [
            { id: "agent", label: "The agent", feedback: "The agent chooses semantic nodes, not CSS." },
            { id: "renderer", label: "The renderer" },
          ],
          answerId: "renderer",
          explanation: "The renderer owns component behavior, tokens, layout, and accessibility.",
        },
      },
    ],
  },
}

export const artifactManifest = {
  "alert": {
    type: "alert",
    description: "An alert message to call out important information.",
    props: { title: "string", description: "string?", variant: '"default" | "destructive"?' },
    children: false,
    example: { type: "alert", props: { title: "Heads up", description: "This is important." } },
  },
  "annotated-visual": {
    type: "annotated-visual",
    description: "An image with numbered percentage-positioned hotspots and adjacent explanations. Use for anatomy, screenshots, interfaces, and system diagrams. Keep markers to the few details the learner needs now.",
    props: { src: "string", alt: "string", caption: "string?", aspect: '"square" | "video" | "wide"?', markers: "{ title: string, description: string, x: number 0-100, y: number 0-100 }[] (1-12)" },
    children: false,
    example: { type: "annotated-visual", props: { src: "lesson-diagram.png", alt: "Three-stage request path", aspect: "wide", markers: [{ title: "Boundary", description: "Validation happens before storage.", x: 48, y: 42 }] } },
  },
  "definition-list": {
    type: "definition-list",
    description: "A compact list of terms and descriptions.",
    props: { items: "{ term: string, description: string }[]" },
    children: false,
    example: { type: "definition-list", props: { items: [{ term: "Term", description: "Description" }] } },
  },
  "diff": {
    type: "diff",
    description: "Code or text difference visualization. Accepts either a raw unified diff string (content) or a before/after pair.",
    props: { before: "string?", after: "string?", content: "string?", language: "string?", title: "string?", defaultOpen: "boolean?", mode: '"unified" | "split"?', showLineNumbers: "boolean?", indicators: '"bars" | "plus-minus" | "none"?', highlightInline: "boolean?", hunkSeparator: '"default" | "custom"?', caption: "string?" },
    children: false,
    example: { type: "diff", props: { content: "diff --git a/index.ts b/index.ts\n--- a/index.ts\n+++ b/index.ts\n@@ -1,3 +1,3 @@\n- old\n+ new\n", language: "typescript", title: "Sample diff" } },
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
    description: "A collapsible file explorer tree. Defaults to the enhanced look: empty dirs are flattened, file-type icons (iconSet=standard), default density. Add gitStatus for status badges (rows auto-align), searchable for a filter box. File items may carry `content` + `language` (tapping renders a code-block below the tree) or `src` (a repo-relative or absolute path that `visual-artifact create` reads and inlines into `content` at save time).",
    props: { items: "{ name: string, type?: \"file\" | \"directory\", children?: file-tree[], content?: string, language?: string, src?: string }[]", flattenEmpty: "boolean?", searchable: "boolean?", gitStatus: "Record<string, GitStatus>?", density: '"compact" | "default" | "relaxed"?', iconSet: '"minimal" | "standard" | "complete"?', defaultExpanded: "boolean?" },
    children: false,
    example: { type: "file-tree", props: { items: [{ name: "src", type: "directory", children: [{ name: "index.ts", type: "file" }] }], flattenEmpty: true, searchable: true } },
  },
  "image": {
    type: "image",
    description: "An image with optional caption, aspect ratio, and click-to-zoom modal. Place sidecar image files next to the artifact JSON under ~/.pi/artifacts/<project>/ and use a relative path like \"hero.png\". Use absolute HTTPS URLs for external images. Never use file:// URLs.",
    props: { src: "string", alt: "string", caption: "string?", aspect: '"auto" | "square" | "video" | "wide"?', zoom: "boolean?" },
    children: false,
    example: { type: "image", props: { src: "hero.png", alt: "Placeholder", zoom: true } },
  },
  "knowledge-check": {
    type: "knowledge-check",
    description: "A local-only multiple-choice retrieval check with submit, explanatory feedback, an optional hint, and retry. Use after the learner has encountered the idea; do not leak the answer through choice length or formatting.",
    props: { prompt: "string", choices: "{ id: string, label: string, feedback?: string }[] (2-6, unique ids)", answerId: "string matching a choice id", explanation: "string", hint: "string?" },
    children: false,
    example: { type: "knowledge-check", props: { prompt: "Where is artifact JSON validated first?", choices: [{ id: "cli", label: "At the CLI boundary" }, { id: "adapter", label: "Inside each adapter", feedback: "Adapters receive an already parsed node." }], answerId: "cli", explanation: "The CLI validates before writing; the renderer parses again before rendering." } },
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
    props: { items: "{ title: string, description?: string, status?: \"complete\" | \"current\" | \"pending\" }[]" },
    children: false,
    example: { type: "stepper", props: { items: [{ title: "Step 1", status: "complete" }, { title: "Step 2", status: "current" }] } },
  },
  "visual-sequence": {
    type: "visual-sequence",
    description: "A learner-controlled sequence that reveals one frame at a time. Each frame contains regular artifact nodes. Use for worked examples, procedures, causal changes, or code execution; use stepper only for static progress.",
    props: { title: "string?", caption: "string?", items: "{ title: string, description?: string, nodes: nodes[] }[] (2-12)" },
    children: "items",
    example: { type: "visual-sequence", props: { title: "Trace the request", items: [{ title: "Parse", nodes: [{ type: "text", props: { text: "Validate the JSON contract." } }] }, { title: "Render", nodes: [{ type: "text", props: { text: "Map each node to its adapter." } }] }] } },
  },
  heading: {
    type: "heading",
    description: "Section or page heading. Use sparingly; renderer already supplies the page hero.",
    props: { text: "string", level: "1 | 2 | 3 | 4?", align: "left | center | right?" },
    children: false,
    example: { type: "heading", props: { text: "Quarterly Revenue", level: 2 } },
  },
  prose: {
    type: "prose",
    description: "Markdown text for prose, lists, links, and long-form narrative. Use this instead of 'text' when you need multiple paragraphs or basic markdown formatting.",
    props: { content: "string", tone: "default | muted?" },
    children: false,
    example: { type: "prose", props: { content: "Here is a list of items:\n\n- First item\n- Second item\n\n[Learn more](https://example.com)" } },
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
    description: "Client-rendered zoomable/pannable Mermaid diagram with wheel, pinch, drag, keyboard, and fit controls. Provide a required caption that describes the diagram. Use for quick architecture, sequence, flowchart, ERD, state, class, and C4 diagrams from Mermaid text.",
    props: { code: "string", caption: "string", height: "integer? 240-1600" },
    children: false,
    example: { type: "mermaid", props: { caption: "Request flow", code: "flowchart LR\n  Client --> API\n  API --> DB" } },
  },
  "svg-diagram": {
    type: "svg-diagram",
    description: "Full-screen interactive SVG/HTML architecture diagram embedded in a sandboxed iframe. Use when Mermaid cannot lay out the topology cleanly, when you need animated request paths, clickable nodes, or precise visual control. The html value must be a complete self-contained document with hand-rolled CSS variables for light/dark themes, an apply-before-paint theme script, a theme toggle, and an SVG styled through CSS classes (no hard-coded hex inside SVG). Layout rules: pick a viewBox large enough for all nodes; keep at least 30px between node rectangles and 40px between zones; reserve the bottom-right corner for the detail card overlay; route edges and labels through empty space; verify by inspection that nothing overlaps.",
    props: { html: "string", title: "string?", caption: "string?", height: "integer? 240-1600" },
    children: false,
    example: { type: "svg-diagram", props: { title: "Interactive architecture", height: 720, html: "<!doctype html><html><head><script>(function(){try{const k='visualizer-theme',s=localStorage.getItem(k),d=s?s==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}})();</script><style>:root{--bg:#FAF9F5;--ink:#141413;}html.dark{--bg:#141413;--ink:#FAF9F5;}body{background:var(--bg);}</style></head><body><svg viewBox='0 0 100 40'><text x='5' y='24' fill='var(--ink)'>Architecture</text></svg></body></html>" } },
  },
  flow: {
    type: "flow",
    description: "Inline architecture diagram for ordered handoffs, pipelines, request paths, and deployment chains.",
    props: { title: "string?", caption: "string?", items: "{ title: string, label?: string, description?: string, status?: string }[]" },
    children: false,
    example: { type: "flow", props: { title: "Request path", items: [{ title: "Client", label: "POST /retrieve" }, { title: "FastAPI" }, { title: "ADK pipeline", status: "running" }] } },
  },
  timeline: {
    type: "timeline",
    description: "Data-backed vertical timeline for releases, lifecycle phases, runbooks, or migration sequences.",
    props: { dataKey: "string", titleKey: "string?", markerKey: "string?", descriptionKey: "string?", statusKey: "string?", caption: "string?" },
    children: false,
    requiresData: true,
    data: "data[dataKey] must be an array of row objects. Defaults: title, marker, description, status.",
    example: { type: "timeline", props: { dataKey: "releasePhases", titleKey: "phase", markerKey: "step", descriptionKey: "action", statusKey: "status" } },
  },
  "code-block": {
    type: "code-block",
    description: "Syntax-highlighted code block with a copy button. Use for commands, config snippets, env contracts, file maps, and ASCII trees. Set language for accurate highlighting (bash, typescript, python, yaml, json, etc.).",
    props: { title: "string?", language: "string?", code: "string", caption: "string?" },
    children: false,
    example: { type: "code-block", props: { title: "Smoke release", language: "bash", code: "git tag smoke-v0.0.1\ngit push origin smoke-v0.0.1" } },
  },
  "status-grid": {
    type: "status-grid",
    description: "Data-backed grid of operational states with status chips. Best for health, readiness, validation, component state, and risk boards.",
    props: { dataKey: "string", titleKey: "string?", statusKey: "string", descriptionKey: "string?", metaKey: "string?", columns: "1 | 2 | 3 | 4?", caption: "string?" },
    children: false,
    requiresData: true,
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
    props: { defaultValue: "string?", items: "{ value: string, label: string, nodes: nodes[] }[]" },
    children: "items",
    example: { type: "tabs", props: { items: [{ value: "summary", label: "Summary", nodes: [{ type: "text", props: { text: "Tab content." } }] }] } },
  },
  accordion: {
    type: "accordion",
    description: "Expandable sections for details, FAQs, sharp edges, or lower-priority evidence. Do not hide primary conclusions here.",
    props: { items: "{ title: string, nodes: nodes[] }[]" },
    children: "items",
    example: { type: "accordion", props: { items: [{ title: "Why?", nodes: [{ type: "text", props: { text: "Because it is useful." } }] }] } },
  },
} satisfies Record<ArtifactNodeType, ArtifactManifestEntry>

export const artifactComponentManifest: ArtifactManifestEntry[] = Object.values(artifactManifest)

export interface SpecConstraints {
  slug: {
    type: string
    format: string
    minLength: number
    maxLength: number
  }
  title: {
    type: string
    minLength: number
  }
  description: {
    type: string
    minLength: number
    optional: boolean
  }
  createdAt: {
    type: string
    minLength: number
    optional: boolean
  }
  layout: {
    type: {
      enum: string[]
    }
    columns: {
      enum: number[]
    }
  }
  nodes: {
    type: string
    minItems: number
    maxItems: number
  }
}

export interface ArtifactContract {
  version: string
  spec: SpecConstraints
  limits: ArtifactSpecResourceLimits
  nodeTypes: readonly string[]
  nodes: Record<string, NodeDef>
  dataNodes: readonly string[]
  patternExamples: Record<string, { description: string; nodes: unknown[] }>
}

export function createArtifactContract(): ArtifactContract {
  return {
    version: "1.0.0",
    limits: ARTIFACT_SPEC_RESOURCE_LIMITS,
    spec: {
      slug: ARTIFACT_SPEC_CONSTRAINTS.slug,
      title: ARTIFACT_SPEC_CONSTRAINTS.title,
      description: ARTIFACT_SPEC_CONSTRAINTS.description,
      createdAt: ARTIFACT_SPEC_CONSTRAINTS.createdAt,
      layout: {
        type: {
          enum: Array.from(ARTIFACT_SPEC_CONSTRAINTS.layout.type.enum),
        },
        columns: {
          enum: Array.from(ARTIFACT_SPEC_CONSTRAINTS.layout.columns.enum),
        },
      },
      nodes: {
        type: ARTIFACT_SPEC_CONSTRAINTS.nodes.type,
        minItems: ARTIFACT_SPEC_CONSTRAINTS.nodes.minItems,
        maxItems: ARTIFACT_SPEC_CONSTRAINTS.nodes.maxItems,
      },
    },
    nodeTypes: ARTIFACT_NODE_TYPES,
    nodes: Object.fromEntries(
      artifactComponentManifest.map((entry) => [
        entry.type,
        {
          description: entry.description,
          props: entry.props,
          children: entry.children,
          data: entry.data,
          requiresData: entry.requiresData,
          metadata: { id: "string?" },
          example: entry.example,
        },
      ])
    ),
    dataNodes: artifactComponentManifest.filter((e) => e.requiresData).map((e) => e.type),
    patternExamples: artifactPatternExamples,
  }
}
