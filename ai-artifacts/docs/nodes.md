# Visualizer node reference

> Available node types and when to use them.

Visualizer artifacts are built from a constrained node catalog. Agents never write React, JSX, CSS, routes, imports, or full HTML for the renderer; they choose nodes, fill props, and optionally provide data.

## Sources of truth

- `visual-artifact contract` — inspect the exported runtime contract bundled into the CLI.
- [`shared/src/artifact-schema.ts`](../../shared/src/artifact-schema.ts) — executable Zod schema, TypeScript types, and resource preflight.
- [`shared/src/contract.ts`](../../shared/src/contract.ts) — LLM-facing descriptions, examples, props, and exported limits.
- [`cli/assets/contract.json`](../../cli/assets/contract.json) — tracked generated handshake checked for drift.

Regenerate the contract after schema or manifest changes:

```bash
cd app
pnpm export:contract
pnpm verify:artifacts
```

## Stable node IDs for annotations

Every node can carry an optional `metadata.id` string. Agents can leave it off; the renderer falls back to deterministic node paths such as `nodes.0`, `nodes.1.children.2`, or `nodes.3.props.items.0.nodes.1`. IDs are useful when artifacts need to keep comments anchored to a node across edits or reorders.

Example:

```json
{
  "type": "stat-card",
  "metadata": { "id": "summary-card" },
  "props": { "label": "Summary", "value": "Ready" }
}
```

When rendered, each node is wrapped in a layout-neutral boundary with these attributes:

- `data-va-node-id` — the `metadata.id` value, when present
- `data-va-node-path` — the deterministic path inside the spec
- `data-va-node-type` — the node type, e.g. `stat-card`
- `data-va-node-label` — a short label derived from `title`, `text`, `label`, or `content`

The renderer uses `display: contents` for the boundary so grids, tabs, accordions, and cards keep their existing layout.

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
| Commands/config/file maps | `code-block`, `file-tree` (with `gitStatus`, `flattenEmpty`, `searchable`, `density`, `iconSet`, `defaultExpanded`), `diff` (with `content`, `mode`, `showLineNumbers`, `indicators`, `highlightInline`, `hunkSeparator`, `caption`), `log` |
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

Keep data values well-formed. The CLI and renderer call the same shared executable schema. The enforced envelope is 2 MiB raw/final JSON, 30 top-level/100 total nodes, 20 datasets, node depth 8, 500 file-tree items, and file-tree depth 12.

## File-tree source reads

A file item may supply `content` directly or use `src` as create-time input. Prefer project-relative `src` paths. They must resolve inside the canonical project root; raw `..` segments and symlink escapes are rejected. Absolute or outside-project reads require a matching repeatable `visual-artifact create --allow-read <dir>` grant. The Pi tool never grants external reads.

The CLI reads the canonical regular file, caps each source at 512 KiB and all sourced content at 1 MiB, inlines it as `content`, and strips `src` from newly saved/published artifacts. Explicit `content` wins without reading disk.

## Local images

For local assets, place the file inside the artifact's `assets` directory:

```text
~/.local/share/visual-artifact/artifacts/<project>/<slug>/assets/hero.png
```

Then reference it with a relative path:

```json
{ "type": "image", "props": { "src": "assets/hero.png", "alt": "Artifact hero" } }
```

The renderer serves it as:

```text
/data/artifacts/<project>/<slug>/assets/hero.png
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
        "code": "cd app\npnpm verify:artifacts\npnpm lint\npnpm build"
      }
    }
  ]
}
```

## Copyable pattern: file tree with git status

```json
{
  "type": "file-tree",
  "props": {
    "items": [
      {
        "name": "src",
        "type": "directory",
        "children": [
          { "name": "index.ts", "type": "file" },
          { "name": "button.tsx", "type": "file" }
        ]
      }
    ],
    "flattenEmpty": true,
    "searchable": true,
    "density": "default",
    "iconSet": "standard",
    "defaultExpanded": true,
    "gitStatus": {
      "src/index.ts": { "status": "modified" },
      "src/button.tsx": { "status": "added" },
      "src": { "status": "modified", "descendant": true }
    }
  }
}
```

## Copyable pattern: diff from a unified diff string

```json
{
  "type": "diff",
  "props": {
    "title": "utils.ts",
    "language": "typescript",
    "mode": "unified",
    "indicators": "plus-minus",
    "highlightInline": true,
    "content": "diff --git a/utils.ts b/utils.ts\n--- a/utils.ts\n+++ b/utils.ts\n@@ -1,3 +1,3 @@\n export function greet(name: string) {\n-  return `Hello, ${name}`;\n+  return `Hello, ${name}!`;\n }\n"
  }
}
```

## Copyable pattern: diff from before/after (split mode)

```json
{
  "type": "diff",
  "props": {
    "title": "cache.go",
    "language": "go",
    "mode": "split",
    "indicators": "bars",
    "before": "func Get(key string) (*Item, bool) {\n    return item.Value, true\n}",
    "after": "func Get(key string) (*Item, bool) {\n    delete(c.items, key)\n    return item.Value, true\n}"
  }
}
```
