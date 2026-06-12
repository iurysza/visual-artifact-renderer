---
title: Visual artifact renderer design walkthrough
status: current
created: 2026-06-11
updated: 2026-06-12
---

# Visual artifact renderer design walkthrough

## 1. Core architecture

This is a renderer, not a code generator.

Visualizer is a local web app plus Pi extension for turning AI-generated JSON into polished visual pages: reports, plans, dashboards, docs, and explainers. The LLM gets a manifest of supported nodes, emits one JSON spec, and calls `create_visual_artifact`.

The important constraint is still the whole point: the LLM never writes React files, route files, JSX, imports, or CSS. It only chooses from known node types. The Pi extension validates the spec, writes it under `~/.pi/artifacts/<project>/<slug>.json`, and the Next app renders it at `/artifacts/<project>/<slug>`.

```txt
JSON spec
  → Pi tool validation
  → ~/.pi/artifacts/<project>/<slug>.json
  → /artifacts/<project>/<slug>
  → VisualArtifactRenderer
  → component adapters
  → UI components
```

## 2. Schema and manifest

The schema is the runtime contract. The manifest is the LLM-facing version of that contract.

Each node type needs:

- `type`
- allowed `props`
- child rules
- data requirements
- example JSON

The app schema uses discriminated unions so invalid nodes fail before rendering. The extension uses lightweight mirrored validation so bad specs fail before writing. The manifest lives beside the schema and registry so the agent does not hallucinate unsupported components.

Current node families:

- basics: `heading`, `text`, `card`, `metric`, `stat-card`, `badge`, `button`, `separator`
- data: `table`, `data-table`, `comparison-table`, `chart`
- diagrams and paths: `mermaid`, `svg-diagram`, `flow`, `timeline`, `code-block`
- health and structure: `status-grid`, `grid`, `section`, `tabs`, `accordion`

## 3. Rendering model

The renderer recursively walks `spec.nodes`.

It does not expose raw component internals to the JSON DSL. It asks `componentRegistry[node.type]` for an adapter. The adapter owns the details: card headers, tab triggers/content, accordion items, chart wiring, table columns, Mermaid mounting, and status styles.

This keeps compound components sane. An artifact-level `tabs` node has an artifact-specific JSON shape; it does not expose arbitrary subcomponents as generic building blocks.

## 4. Storage and routing

Artifacts are global to Pi, grouped by project:

```txt
~/.pi/artifacts/<project>/<slug>.json
```

The project name comes from the caller's git repo root or working directory. That lets any Pi session create artifacts without writing into this repo.

Routes:

```txt
/                         project index
/artifacts/<project>      artifact list for one project
/artifacts/<project>/<slug> artifact page
```

Implementation files:

```txt
src/lib/artifacts.ts
src/app/artifacts/[project]/page.tsx
src/app/artifacts/[project]/[slug]/page.tsx
src/components/visual-artifact-renderer.tsx
src/components/component-registry.tsx
```

## 5. Data model

Data lives inside the artifact spec.

Nodes reference embedded datasets by key:

```json
{
  "type": "chart",
  "props": {
    "dataKey": "revenueByMonth",
    "xKey": "month",
    "yKey": "revenue"
  }
}
```

This keeps artifact creation atomic: one tool call writes one portable file. Separate data files, fetchers, auth, cache policy, and loading states can wait.

## 6. Tool boundary

The only Pi tool is `create_visual_artifact`.

It should:

1. validate the input
2. validate the kebab-case slug
3. derive the project name
4. create `~/.pi/artifacts/<project>/` if needed
5. write pretty JSON
6. return the local URL

No update/list/delete tool yet. Those are useful, but they add overwrite semantics and state questions before the core path needs them.
