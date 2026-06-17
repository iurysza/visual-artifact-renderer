# Visualizer node reference

> What node types are available and when to use them.

Visualizer artifacts are built from a constrained set of node types. The LLM never writes React, JSX, or CSS — it picks nodes from this list, fills their props, and optionally embeds data.

The single source of truth for the contract is:

- [`artifact-contract.json`](../artifact-contract.json) — consumed by the Pi extension at runtime
- [`src/lib/artifact-schema.ts`](../src/lib/artifact-schema.ts) — Zod schema and TypeScript types
- [`src/lib/artifact-manifest.ts`](../src/lib/artifact-manifest.ts) — LLM-facing descriptions, examples, and limits

Regenerate `artifact-contract.json` after any schema or manifest change:

```bash
pnpm export:contract
```

## Node set

Visualizer ships **36** node types:

```txt
alert, area-chart, radar-chart, scatter-chart, heatmap, log,
definition-list, diff, donut-chart, file-tree, heading, image,
pie-chart, stepper, prose, text, card, metric, stat-card, badge,
button, separator, table, data-table, comparison-table, chart,
mermaid, svg-diagram, flow, timeline, code-block, status-grid,
grid, section, tabs, accordion
```

## Selection map

| Need | Use |
| --- | --- |
| Page/section structure | `heading`, `section`, `text`, `separator` |
| Narrative container | `card` |
| Compact inline KPI | `metric` |
| Dashboard summary band | `stat-card` inside `grid` |
| Metadata/action | `badge`, `button` |
| Standard data | `table`, `data-table`, `chart` |
| Checks, risks, options, parity | `comparison-table` |
| Architecture/topology | `mermaid`, `svg-diagram` |
| Request, deploy, or data path | `flow` |
| Release/runbook sequence | `timeline` |
| Commands/config/file maps | `code-block`, `file-tree`, `diff` |
| Health/readiness/risk board | `status-grid` |
| Long-form markdown prose | `prose` |
| Callouts/warnings | `alert` |
| Proportional data | `pie-chart`, `donut-chart` |
| Cumulative/trend data | `area-chart` |
| Multi-dimensional comparison | `radar-chart` |
| Correlations | `scatter-chart` |
| Matrix/correlation data | `heatmap` |
| Terminal/log output | `log` |
| Term definitions | `definition-list` |
| Step progress | `stepper` |
| Images | `image` |
| Layout/alternate detail | `grid`, `tabs`, `accordion` |

## Composition guidance

Prefer dashboard components over generic card soup:

- Open with a concise thesis, then a `stat-card` summary band.
- Use `stat-card` for top KPIs, counts, health, and state tiles.
- Use `status-grid` for component health, readiness, validation state, and risk boards.
- Use `comparison-table` for evidence, risks, checks, options, runtime surfaces, and parity matrices.
- Use `flow` for request paths, build/deploy chains, ingestion pipelines, and architecture handoffs.
- Use `mermaid` for lightweight text-defined architecture, sequence, ERD, state, class, or C4 diagrams; the renderer adds wheel/pinch zoom, drag pan, keyboard controls, and fit.
- Use `svg-diagram` for trusted full HTML/SVG interactive diagrams in the html-diagram style.
- Use `timeline` for release phases, lifecycle states, migration steps, and operator runbooks.
- Use `code-block` for commands, config snippets, env contracts, and file maps.
- Use `tabs` when the same report has alternate contexts, e.g. Pi / OpenCode / wrapper / projects.
- Use `accordion` only for secondary detail. Do not hide conclusions there.
- Use `card` for narrative chunks that need child nodes, not for every small fact.
- Use `prose` when you need long-form markdown (lists, links, paragraphs).
- Use `alert` for important callouts, not for routine status.
- Pair `chart` with table detail when exact values matter.
- Avoid `file://` links in artifacts; link to app routes or public URLs.
- For local image assets, place the image file next to the artifact JSON under `~/.pi/artifacts/<project>/` and use a relative `src` like `"hero.png"`. The renderer resolves it to `/artifacts/data/artifacts/<project>/hero.png`.

## Copyable patterns

### Architecture brief

Thesis → stat band → Mermaid topology → flow path → status/evidence.

```json
[
  {
    "type": "text",
    "props": { "text": "The runtime is a three-stage ADK pipeline with explicit retrieval and TTS boundaries.", "size": "lg" }
  },
  {
    "type": "grid",
    "props": { "columns": 3 },
    "children": [
      { "type": "stat-card", "props": { "label": "Agents", "value": 3, "caption": "Sequential ADK pipeline", "tone": "accent" } },
      { "type": "stat-card", "props": { "label": "Retrieval", "value": "ChromaDB", "caption": "Grounded docs", "tone": "success" } },
      { "type": "stat-card", "props": { "label": "Output", "value": "JSON + MP3", "caption": "Validated response", "tone": "default" } }
    ]
  },
  {
    "type": "mermaid",
    "props": {
      "title": "Runtime topology",
      "code": "flowchart LR\n  Client --> API[FastAPI]\n  API --> ADK[ADK sequence]\n  ADK --> Chroma[(ChromaDB)]\n  ADK --> TTS[Cloud TTS]"
    }
  },
  {
    "type": "flow",
    "props": {
      "title": "Request path",
      "items": [
        { "title": "Client", "label": "POST /retrieve" },
        { "title": "FastAPI", "description": "Validates request" },
        { "title": "ADK", "description": "Recognizes, retrieves, formats" },
        { "title": "TTS", "description": "Synthesizes MP3" }
      ]
    }
  }
]
```

### Runbook

Timeline for phases, `code-block` for exact commands, `comparison-table` for checks.

```json
{
  "data": {
    "releasePhases": [
      { "step": "01", "phase": "Verify", "action": "Run local checks", "status": "pass" },
      { "step": "02", "phase": "Build", "action": "Create production bundle", "status": "ready" }
    ],
    "checks": [
      { "check": "Artifacts", "result": "pass", "evidence": "pnpm verify:artifacts" }
    ]
  },
  "nodes": [
    { "type": "timeline", "props": { "dataKey": "releasePhases", "titleKey": "phase", "markerKey": "step", "descriptionKey": "action", "statusKey": "status" } },
    { "type": "code-block", "props": { "title": "Ship checks", "language": "bash", "code": "pnpm verify:artifacts\npnpm lint\npnpm build" } },
    { "type": "comparison-table", "props": { "dataKey": "checks", "columns": ["check", "result", "evidence"], "statusKey": "result" } }
  ]
}
```
