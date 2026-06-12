---
title: Data-driven visual artifact renderer
status: current
created: 2026-06-11
updated: 2026-06-12
launch: /goal ai-artifacts/goals/visual-artifact-renderer/goal.md
---

# Data-driven visual artifact renderer

## Goal

Visualizer is a local web app plus Pi extension for turning AI-generated JSON into polished visual pages: reports, plans, dashboards, docs, and explainers. It gives agents a safe presentation layer: choose known nodes, embed data, call one tool, get a local URL.

The important trick: the LLM never writes React, routes, JSX, imports, or CSS. It emits a constrained artifact spec; the extension validates it, saves it under `~/.pi/artifacts/<project>/<slug>.json`, and the Next renderer maps each node to trusted UI adapters.

## Current contract

The LLM calls one Pi tool:

```ts
create_visual_artifact(input)
```

The tool validates the input, derives a project name from the caller's working directory, writes:

```txt
~/.pi/artifacts/<project>/<slug>.json
```

and returns:

```txt
http://localhost:9999/artifacts/<project>/<slug>
```

The app renders artifacts through:

```txt
src/app/artifacts/[project]/[slug]/page.tsx
```

A project index lives at:

```txt
src/app/artifacts/[project]/page.tsx
```

## Non-goals

- Do not generate `app/artifacts/<slug>/page.tsx` files.
- Do not support arbitrary React/JSX from the LLM.
- Do not let the LLM import components, CSS, or runtime code.
- Do not add update/list/delete/versioning before the create-and-render path stays boring.

## Mental model

```txt
component manifest
  → LLM chooses artifact structure
  → create_visual_artifact(JSON)
  → tool validation
  → ~/.pi/artifacts/<project>/<slug>.json
  → /artifacts/<project>/<slug>
  → VisualArtifactRenderer
  → componentRegistry adapters
  → UI components
```

## Artifact spec shape

```ts
type VisualArtifactSpec = {
  slug: string
  title: string
  description?: string
  layout?: ArtifactLayout
  data?: Record<string, unknown>
  nodes: ArtifactNode[]
}
```

`projectPath` is a tool-only override. It is used to derive `<project>` and is not stored in the artifact spec.

## Supported node set

Current nodes:

```txt
heading, text, card, metric, stat-card, badge, button, separator,
table, data-table, comparison-table, chart, mermaid, svg-diagram,
flow, timeline, code-block, status-grid, grid, section, tabs, accordion
```

Use the strongest component that fits: `stat-card` for top-line state, `status-grid` for readiness/risk boards, `comparison-table` for evidence, `flow` for paths, `timeline` for runbooks, and `mermaid` or `svg-diagram` for architecture.

## Renderer design

The renderer has three layers:

1. `src/lib/artifacts.ts`
   - lists projects from `~/.pi/artifacts/`
   - lists artifacts inside a project
   - reads `~/.pi/artifacts/<project>/<slug>.json`
   - parses specs with `VisualArtifactSpecSchema`
   - returns `null` for missing artifacts

2. `src/app/artifacts/[project]/[slug]/page.tsx`
   - loads the artifact by project and slug
   - passes build-time data to `ClientArtifactLoader` when available
   - lets the client fetch the latest JSON so local updates appear without rebuilding

3. `VisualArtifactRenderer` + `componentRegistry`
   - renders title and description
   - applies page-level layout
   - recursively renders nodes
   - maps node types to trusted adapters
   - keeps compound component details out of the JSON DSL

## Data model

Artifact data is embedded in the same JSON file:

```json
{
  "slug": "revenue-dashboard",
  "title": "Revenue Dashboard",
  "data": {
    "revenueByMonth": [
      { "month": "Apr", "revenue": 42000 },
      { "month": "May", "revenue": 39000 },
      { "month": "Jun", "revenue": 47400 }
    ]
  },
  "nodes": [
    {
      "type": "chart",
      "props": {
        "dataKey": "revenueByMonth",
        "xKey": "month",
        "yKey": "revenue"
      }
    }
  ]
}
```

Nodes reference embedded datasets by key. Large files, external fetchers, cache policy, and auth stay out of scope until needed.

## Tool behavior

`create_visual_artifact` should:

1. Validate slug, title, layout, nodes, child nodes, and required `dataKey` datasets.
2. Derive `<project>` from `projectPath` or the caller's cwd.
3. Ensure `~/.pi/artifacts/<project>/` exists.
4. Write pretty JSON to `~/.pi/artifacts/<project>/<slug>.json`.
5. Return the local artifact URL.

## Manifest contract

The LLM-facing manifest lives in:

```txt
src/lib/artifact-manifest.ts
```

The runtime schema lives in:

```txt
src/lib/artifact-schema.ts
```

Manifest entries include node `type`, human description, allowed props, child rules, data requirements, and examples. The manifest should stay aligned with the schema and registry; a fake component list is worse than no list.

## Success criteria

- A visual artifact can be created by one tool call.
- The file lands in `~/.pi/artifacts/<project>/<slug>.json`.
- `/artifacts/<project>/<slug>` renders it without adding a route file.
- Unknown or invalid nodes fail validation.
- The same schema can render reports, docs, plans, dashboards, and explainers.
