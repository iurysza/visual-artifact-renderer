---
title: Visual artifact renderer implementation plan
status: current
created: 2026-06-11
updated: 2026-06-12
---

# Implementation plan

## Solution approach

Create a data-driven visual artifact renderer. The LLM writes JSON through `create_visual_artifact`; the app renders that JSON through project-scoped artifact routes and a curated component registry.

## Phase 0 — Scaffold check

- [x] Confirm Next App Router app.
- [x] Confirm TypeScript config and path aliases.
- [x] Confirm Tailwind/shadcn UI base.
- [x] Install required UI/runtime packages.

Verification:

- [x] `pnpm lint`
- [x] `src/app` route conventions confirmed.

## Phase 1 — Schema

- [x] Add `src/lib/artifact-schema.ts`.
- [x] Define `VisualArtifactSpecSchema`.
- [x] Define discriminated node schemas.
- [x] Validate kebab-case slugs.
- [x] Add inferred TypeScript types.
- [x] Cover the current node set: basics, data, diagrams, paths, code, health boards, and layout.

Verification:

- [x] Schema accepts valid artifact specs.
- [x] Schema rejects unknown node types.

## Phase 2 — Global artifact loading

- [x] Add `src/lib/artifacts.ts`.
- [x] Read artifacts from `~/.pi/artifacts/<project>/<slug>.json`.
- [x] Implement `listProjects()`.
- [x] Implement `listArtifactsInProject(projectName)`.
- [x] Implement `getVisualArtifactSpec(projectName, slug)`.
- [x] Parse JSON with `VisualArtifactSpecSchema`.
- [x] Return `null` for missing artifacts.

Verification:

- [x] Missing slug returns `null`.
- [x] Valid JSON returns a parsed spec.
- [x] Invalid specs fail clearly during verification/render loading.

## Phase 3 — Routes

- [x] Add project index: `src/app/artifacts/[project]/page.tsx`.
- [x] Add artifact route: `src/app/artifacts/[project]/[slug]/page.tsx`.
- [x] Await route params.
- [x] Load specs by project and slug.
- [x] Render through `ClientArtifactLoader` and `VisualArtifactRenderer`.
- [x] Keep the home page as a project index for `~/.pi/artifacts/`.

Verification:

- [x] `/artifacts/<project>` lists artifacts.
- [x] `/artifacts/<project>/<slug>` renders an artifact.

## Phase 4 — Renderer + registry

- [x] Add `src/components/visual-artifact-renderer.tsx`.
- [x] Add `src/components/component-registry.tsx`.
- [x] Implement recursive node rendering.
- [x] Implement page-level title/description/layout.
- [x] Implement basics: `heading`, `text`, `card`, `metric`, `stat-card`, `badge`, `button`, `separator`.
- [x] Implement data views: `table`, `data-table`, `comparison-table`, `chart`.
- [x] Implement diagrams/paths: `mermaid`, `svg-diagram`, `flow`, `timeline`, `code-block`.
- [x] Implement organization and health: `status-grid`, `grid`, `section`, `tabs`, `accordion`.

Verification:

- [x] Sample artifacts render mixed node families.
- [x] Unknown node types cannot reach the renderer through a valid spec.

## Phase 5 — Manifest

- [x] Add `src/lib/artifact-manifest.ts`.
- [x] Include type, props, child rules, data rules, and examples.
- [x] Add artifact composition guidance.
- [x] Add copyable artifact patterns.
- [x] Keep manifest entries aligned with schema node types.

Verification:

- [x] `pnpm verify:artifacts` checks manifest coverage.

## Phase 6 — Pi tool

- [x] Add global Pi extension at `~/.pi/agent/extensions/visual-artifact.ts`.
- [x] Register `create_visual_artifact`.
- [x] Validate slug, layout, node types, child nodes, and `dataKey` arrays.
- [x] Derive project from caller cwd or `projectPath`.
- [x] Write pretty JSON to `~/.pi/artifacts/<project>/<slug>.json`.
- [x] Return `http://localhost:9999/artifacts/<project>/<slug>`.

Verification:

- [x] Tool writes into the global Pi artifact directory.
- [x] Tool returns a project-scoped artifact URL.
- [x] Tool rejects invalid specs before writing.

## Phase 7 — Test path

- [x] Create sample artifacts under `~/.pi/artifacts/visualizer/`.
- [x] Start dev server on port `9999`.
- [x] Open `/artifacts/visualizer/revenue-dashboard`.
- [x] Open `/artifacts/visualizer/implementation-plan`.
- [x] Open `/artifacts/visualizer/agent-stack-report`.
- [x] Confirm reports, plans, dashboards, diagrams, and runbook-style pages render from the same schema.

Verification:

- [x] `pnpm verify:artifacts`
- [x] `pnpm lint`
- [x] `pnpm build`
- [x] Dev-server smoke tests.

## Phase 8 — Follow-ups, not MVP

- [ ] `update_visual_artifact`.
- [ ] `list_visual_artifacts`.
- [ ] `delete_visual_artifact`.
- [ ] Artifact versioning.
- [ ] Separate data files.
- [ ] External data fetchers.
- [ ] Preview/draft mode.
- [ ] Broader adapter catalog.

## Notes / open cleanup

- Removed stale `src/lib/create-visual-artifact.ts`; `create_visual_artifact` is intentionally global Pi state, not repo-local state.
