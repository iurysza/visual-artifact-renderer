---
title: Data-driven visual artifact renderer
status: draft
created: 2026-06-11
launch: /goal ai-artifacts/goals/visual-artifact-renderer/goal.md
---

# Data-driven visual artifact renderer

## Goal

Build a local visual artifact system where the LLM creates **JSON specs**, not route files or React code.

The LLM calls one PI tool:

```ts
create_visual_artifact(input)
```

The tool validates the input, writes a JSON spec to `src/artifacts/<slug>.json`, and returns:

```txt
http://localhost:9999/artifacts/<slug>
```

A single Next route renders every artifact:

```txt
app/artifacts/[slug]/page.tsx
```

Artifacts can be reports, docs, plans, dashboards, explainers, or other visual pages.

## Non-goals

- Do not generate `app/artifacts/<slug>/page.tsx` files.
- Do not support arbitrary React/JSX from the LLM.
- Do not implement the full component catalog in the first pass.
- Do not add update/list/delete/versioning before the first renderer works.

## Mental model

```txt
component manifest
  → LLM chooses artifact structure
  → create_visual_artifact(JSON)
  → Zod validation
  → src/artifacts/<slug>.json
  → /artifacts/[slug]
  → VisualArtifactRenderer
  → componentRegistry adapters
  → UI components
```

## Artifact spec shape

MVP shape:

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

Nodes are discriminated by `type`:

```ts
type ArtifactNode =
  | CardNode
  | MetricNode
  | HeadingNode
  | TextNode
  | BadgeNode
  | ButtonNode
  | SeparatorNode
  | TableNode
  | DataTableNode
  | ChartNode
  | TabsNode
  | AccordionNode
  | GridNode
  | SectionNode
```

The schema should be strict enough that bad LLM output fails before a file is written.

## Renderer design

The renderer has three layers:

1. `getVisualArtifactSpec(slug)`
   - reads `src/artifacts/<slug>.json`
   - parses with Zod
   - returns `null` for missing artifacts

2. `VisualArtifactRenderer`
   - renders artifact title/description
   - applies page-level layout
   - recursively renders nodes

3. `componentRegistry`
   - maps artifact node types to React adapters
   - adapters own compound component details
   - no node renders by importing arbitrary components from LLM input

## Initial adapter set

Basics:

- `heading`
- `text`
- `card`
- `metric`
- `badge`
- `button`
- `separator`

Data views:

- `table`
- `data-table`
- `chart`

Navigation / organization:

- `grid`
- `section`
- `tabs`
- `accordion`

## Data model

Data is embedded in the artifact file:

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

Nodes reference embedded datasets by key. Large/external data can come later.

## Tool contract

MVP tool:

```ts
type CreateVisualArtifactInput = VisualArtifactSpec
```

Behavior:

1. Validate input with Zod.
2. Validate slug.
3. Ensure `src/artifacts/` exists.
4. Write `src/artifacts/<slug>.json`.
5. Return the local URL.

Return shape:

```ts
type CreateVisualArtifactResult = {
  slug: string
  path: string
  url: string
}
```

## Manifest contract

The LLM should receive a manifest generated from the same schema/registry source, not a hand-maintained fantasy list.

Manifest entries should include:

- node `type`
- human description
- allowed props
- child rules
- data requirements
- tiny example

Example:

```json
{
  "type": "metric",
  "description": "Compact KPI display with optional delta",
  "props": {
    "label": "string",
    "value": "string | number",
    "delta": "string?",
    "trend": "up | down | neutral?"
  },
  "children": false
}
```

## Success criteria

- A visual artifact can be created by writing one JSON spec.
- `/artifacts/<slug>` renders it without adding a route file.
- Unknown or invalid nodes fail validation.
- The LLM has enough manifest detail to produce valid artifacts.
- The first implementation can render a useful report, doc, or plan from the same schema.
