---
title: Visual artifact renderer facts
created: 2026-06-11
---

# Facts

- The system creates visual artifacts from JSON specs, not generated route files or generated React code.
- The PI tool is named `create_visual_artifact`.
- `create_visual_artifact` writes specs to `src/artifacts/<slug>.json`.
- A generated artifact is available at `http://localhost:9999/artifacts/<slug>`.
- The app has one dynamic route at `app/artifacts/[slug]/page.tsx`.
- The dynamic route reads the matching JSON spec and renders it through `VisualArtifactRenderer`.
- The JSON schema is a curated DSL with known node types.
- Unknown node types fail validation before the artifact is written.
- The LLM cannot provide arbitrary JSX or arbitrary component imports.
- Artifact data is embedded in the same JSON file for MVP.
- Nodes can reference embedded datasets by key.
- The first adapter set covers basics, data views, and organization nodes.
- Basics include `heading`, `text`, `card`, `metric`, `badge`, `button`, and `separator`.
- Data views include `table`, `data-table`, and `chart`.
- Organization nodes include `grid`, `section`, `tabs`, and `accordion`.
- The component manifest describes every supported node type, allowed props, child rules, data requirements, and examples.
- The manifest is generated from or colocated with schema/registry definitions to avoid drift.
- The first implementation proves the generic shape by rendering at least one report artifact and one non-report artifact.
