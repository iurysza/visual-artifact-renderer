# Visualizer node reference

> Available node types and when to use them.

Visualizer artifacts are built from a constrained node catalog. Agents never write React, JSX, CSS, routes, imports, or full HTML for the renderer; they choose nodes, fill props, and optionally provide data.

## Sources of truth

- `visual-artifact contract` — get the exported runtime contract used by the CLI and agents.
- [`skill/artifact-contract.json`](../skill/artifact-contract.json) — exported runtime contract (source of truth on disk).
- [`skill/app/src/lib/artifact-schema.ts`](../skill/app/src/lib/artifact-schema.ts) — Zod schema and TypeScript types.
- [`skill/app/src/lib/artifact-manifest.ts`](../skill/app/src/lib/artifact-manifest.ts) — LLM-facing descriptions, examples, limits.

Regenerate the contract after schema or manifest changes:

```bash
cd skill/app
pnpm export:contract
pnpm verify:artifacts
```

## Node set

Visualizer ships **30+** node types:

```txt
alert, area-chart, radar-chart, scatter-chart, heatmap, log,
definition-list, diff, donut-chart, file-tree, heading, image,
pie-chart, stepper, text, card, metric, stat-card, badge,
button, separator, table, data-table, comparison-table, chart,
mermaid, svg-diagram, flow, timeline, code-block, status-grid,
grid, section, tabs, accordion, prose
```

## Selection map

| Need | Use |
|---|---|
| Page/section structure | `heading`, `section`, `text`, `separator` |
| Long markdown narrative | `prose` |
| Narrative container | `card` |
| Compact KPI | `metric` |
| Summary band | `stat-card` inside `grid` |
| Metadata/action | `badge`, `button` |
| Standard data | `table`, `data-table`, `chart` |
| Checks, risks, options, parity | `comparison-table` |
| Health/readiness/risk board | `status-grid` |
| Architecture/topology | `mermaid`, `svg-diagram` |
| Request/deploy/data path | `flow` |
| Release/runbook sequence | `timeline`, `stepper` |
| Commands/config/file maps | `code-block`, `file-tree`, `diff`, `log` |
| Proportional data | `pie-chart`, `donut-chart` |
| Cumulative/trend data | `area-chart` |
| Multi-dimensional comparison | `radar-chart` |
| Correlation | `scatter-chart` |
| Matrix/correlation intensity | `heatmap` |
| Term definitions | `definition-list` |
| Images | `image` |
| Alternate detail | `tabs`, `accordion` |

## Composition guidance

Prefer visual structure over card soup:

- Open with a concise thesis.
- Follow with `stat-card` summary tiles when there are key facts.
- Use `status-grid` for health, readiness, validation state, and risk.
- Use `comparison-table` for evidence, options, tradeoffs, and parity.
- Use `flow` for linear handoffs and `mermaid` for richer diagrams.
- Use `svg-diagram` only when Mermaid cannot express the layout or interaction.
- Use `timeline` or `stepper` for phases and runbooks.
- Use `code-block` for exact commands/config, not whole source files.
- Use `tabs` for alternate views of the same subject.
- Use `accordion` for secondary detail, never for conclusions.
- Avoid `file://` links. Use app routes, HTTPS URLs, or relative sidecar assets.

## Data-backed nodes

Data-backed nodes read arrays from `spec.data` using `dataKey`.

Example:

```json
{
  "data": {
    "checks": [
      { "check": "Contract", "status": "pass", "evidence": "pnpm verify:artifacts" },
      { "check": "Build", "status": "ready", "evidence": "pnpm build" }
    ]
  },
  "nodes": [
    {
      "type": "comparison-table",
      "props": {
        "dataKey": "checks",
        "columns": ["check", "status", "evidence"],
        "statusKey": "status"
      }
    }
  ]
}
```

Keep data values compact. The CLI enforces row/string limits from the contract.

## Local images

For local assets, place the file next to the artifact JSON under:

```text
<skill-root>/artifacts/<project>/hero.png
```

Then reference it with a relative path:

```json
{ "type": "image", "props": { "src": "hero.png", "alt": "Artifact hero" } }
```

The renderer serves it as:

```text
/artifacts/data/artifacts/<project>/hero.png
```

## Copyable pattern: architecture brief

```json
[
  {
    "type": "text",
    "props": {
      "text": "The runtime is a three-stage pipeline: JSON contract, CLI validation/storage, renderer adapters.",
      "size": "lg"
    }
  },
  {
    "type": "grid",
    "props": { "columns": 3 },
    "children": [
      { "type": "stat-card", "props": { "label": "Surface", "value": "JSON", "caption": "Agent contract", "tone": "accent" } },
      { "type": "stat-card", "props": { "label": "Boundary", "value": "CLI", "caption": "Validation + storage", "tone": "success" } },
      { "type": "stat-card", "props": { "label": "Output", "value": "UI", "caption": "Trusted adapters", "tone": "default" } }
    ]
  },
  {
    "type": "mermaid",
    "props": {
      "title": "Runtime flow",
      "code": "flowchart LR\n  Agent --> Spec[JSON spec]\n  Spec --> CLI[visual-artifact CLI]\n  CLI --> Store[(artifacts)]\n  Store --> App[Next.js renderer]\n  App --> Page[artifact page]"
    }
  }
]
```

## Copyable pattern: runbook

```json
{
  "data": {
    "releasePhases": [
      { "step": "01", "phase": "Verify", "action": "Run local checks", "status": "pass" },
      { "step": "02", "phase": "Build", "action": "Create static export", "status": "ready" }
    ]
  },
  "nodes": [
    {
      "type": "timeline",
      "props": {
        "dataKey": "releasePhases",
        "titleKey": "phase",
        "markerKey": "step",
        "descriptionKey": "action",
        "statusKey": "status"
      }
    },
    {
      "type": "code-block",
      "props": {
        "title": "Ship checks",
        "language": "bash",
        "code": "cd skill/app\npnpm verify:artifacts\npnpm lint\npnpm build"
      }
    }
  ]
}
```
