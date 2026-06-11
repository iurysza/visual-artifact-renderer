---
title: Visual artifact renderer design walkthrough
status: draft
created: 2026-06-11
---

# Visual artifact renderer design walkthrough

## 1. Core architecture

This should be a renderer, not a code generator.

The LLM gets a manifest of supported visual nodes and emits a JSON artifact spec. The PI tool validates that spec and writes it to `src/artifacts/<slug>.json`. The app has one permanent route, `app/artifacts/[slug]/page.tsx`, which loads the JSON and hands it to a generic renderer.

That keeps the runtime boring:

```txt
JSON spec → schema validation → renderer → component adapters → UI components
```

The important constraint is that the LLM never writes React files, route files, or arbitrary JSX. It only chooses from known node types. This makes artifacts cheap to create and safe to render.

## 2. Schema and manifest

The schema is the contract. The manifest is the LLM-facing version of that contract.

Each node type needs:

- `type`
- allowed `props`
- child rules
- data requirements
- example JSON

The schema should use discriminated unions so invalid nodes fail before they reach the renderer. The manifest should be generated from or colocated with the schema/registry definitions so it does not drift.

MVP node families:

- basics: card, metric, heading, text, badge, button, separator
- data: table, data-table, chart
- organization: grid, section, tabs, accordion

## 3. Rendering model

The renderer recursively walks `spec.nodes`.

It does not know compound component internals. It asks `componentRegistry[node.type]` for an adapter. The adapter owns the details: card headers, tab triggers/content, accordion items, chart wiring, table columns, and similar structure.

This matters because compound components do not map cleanly to arbitrary trees. An artifact-level `tabs` node should have an artifact-specific JSON shape, not expose raw subcomponents as generic building blocks.

## 4. Data model

For MVP, data lives inside the artifact spec.

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

This keeps artifact creation atomic: one tool call writes one file. Later, large artifacts can split data into separate files or fetchers, but that adds cache, auth, loading, and failure states. Not worth paying yet.

## 5. Tool boundary

The first PI tool should be `create_visual_artifact` only.

It should:

1. parse input with Zod
2. validate slug
3. create `src/artifacts/` if needed
4. write pretty JSON
5. return the URL

No update/list/delete yet. Those are useful, but they add overwrite semantics and state-management questions before the renderer proves itself.
