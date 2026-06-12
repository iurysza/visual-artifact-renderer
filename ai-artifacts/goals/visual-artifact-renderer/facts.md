---
title: Visual artifact renderer facts
created: 2026-06-11
updated: 2026-06-12
---

# Facts

- Visualizer creates visual artifacts from JSON specs, not generated route files or generated React code.
- The Pi tool is named `create_visual_artifact`.
- The tool writes specs to `~/.pi/artifacts/<project>/<slug>.json`.
- `<project>` is derived from the caller's git repo root or working directory.
- `projectPath` can override the directory used to derive `<project>`.
- A generated artifact is available at `http://localhost:9999/artifacts/<project>/<slug>`.
- The project index is available at `http://localhost:9999/artifacts/<project>`.
- The home page lists projects found under `~/.pi/artifacts/`.
- The artifact page route is `src/app/artifacts/[project]/[slug]/page.tsx`.
- The project listing route is `src/app/artifacts/[project]/page.tsx`.
- `src/lib/artifacts.ts` lists projects, lists artifacts, and loads specs from `~/.pi/artifacts/`.
- Loaded specs are parsed with `VisualArtifactSpecSchema` before rendering.
- The JSON schema is a curated DSL with known node types.
- Unknown node types fail validation before rendering.
- The tool also rejects unsupported node types before writing.
- The LLM cannot provide arbitrary JSX, imports, CSS, or component names.
- Artifact data is embedded in the same JSON file.
- Nodes can reference embedded datasets by key.
- Data-backed nodes require `data[dataKey]` to be an array.
- Supported nodes are `heading`, `text`, `card`, `metric`, `stat-card`, `badge`, `button`, `separator`, `table`, `data-table`, `comparison-table`, `chart`, `mermaid`, `svg-diagram`, `flow`, `timeline`, `code-block`, `status-grid`, `grid`, `section`, `tabs`, and `accordion`.
- The component manifest lives in `src/lib/artifact-manifest.ts`.
- The runtime schema lives in `src/lib/artifact-schema.ts`.
- `VisualArtifactRenderer` maps node specs to trusted UI adapters through the component registry.
- The first tool surface stays intentionally small: create only, no update/list/delete/versioning yet.
- Verification commands are `pnpm verify:artifacts`, `pnpm lint`, and `pnpm build`.
