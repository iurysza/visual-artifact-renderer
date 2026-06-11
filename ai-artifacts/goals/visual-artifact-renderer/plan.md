---
title: Visual artifact renderer implementation plan
status: draft
created: 2026-06-11
---

# Implementation plan

## Solution approach

Create a data-driven visual artifact renderer. The LLM writes JSON through `create_visual_artifact`; the app renders that JSON through one dynamic route and a curated component registry.

## Phase 0 — Scaffold check

- [ ] Confirm app framework and directory layout.
- [ ] Confirm Next app router exists or scaffold it.
- [ ] Confirm TypeScript config/path aliases.
- [ ] Confirm the UI component library exists.
- [ ] Install only required UI components for MVP.

Verification:

- [ ] `pnpm lint` or project equivalent runs.
- [ ] `src/app` and route conventions are confirmed.

## Phase 1 — Schema

- [ ] Add `src/lib/artifact-schema.ts`.
- [ ] Define `VisualArtifactSpecSchema`.
- [ ] Define discriminated node schemas.
- [ ] Validate slug format.
- [ ] Add inferred TypeScript types.
- [ ] Add a sample valid artifact fixture.

Verification:

- [ ] Schema accepts the sample artifact.
- [ ] Schema rejects an unknown node type.

## Phase 2 — Artifact loading

- [ ] Add `src/lib/artifacts.ts`.
- [ ] Implement `getVisualArtifactSpec(slug)`.
- [ ] Read `src/artifacts/<slug>.json`.
- [ ] Parse JSON with schema.
- [ ] Return `null` for missing artifact.
- [ ] Throw/log clearly for invalid artifact specs.

Verification:

- [ ] Missing slug returns `null`.
- [ ] Valid JSON returns a parsed spec.
- [ ] Invalid JSON fails clearly.

## Phase 3 — Dynamic route

- [ ] Add `src/app/artifacts/[slug]/page.tsx`.
- [ ] Await route params.
- [ ] Load spec via `getVisualArtifactSpec`.
- [ ] Call `notFound()` when missing.
- [ ] Render `<VisualArtifactRenderer spec={spec} />`.

Verification:

- [ ] `/artifacts/<missing>` shows 404.
- [ ] `/artifacts/<valid-slug>` renders the sample artifact.

## Phase 4 — Renderer + registry

- [ ] Add `src/components/visual-artifact-renderer.tsx`.
- [ ] Add `src/components/component-registry.tsx`.
- [ ] Implement recursive node renderer.
- [ ] Implement page-level title/description.
- [ ] Implement layout nodes: `grid`, `section`.
- [ ] Implement basics: `heading`, `text`, `card`, `metric`, `badge`, `button`, `separator`.
- [ ] Implement data views: `table`, `data-table`, `chart`.
- [ ] Implement organization: `tabs`, `accordion`.

Verification:

- [ ] Sample artifact renders at least one basic node, one data view, and one organization node.
- [ ] Unknown node types cannot reach the renderer through a valid spec.

## Phase 5 — Manifest

- [ ] Add `src/lib/artifact-manifest.ts`.
- [ ] Generate manifest from node definitions or colocated metadata.
- [ ] Include type, props, children rules, data rules, examples.
- [ ] Expose manifest to the PI tool/agent context.

Verification:

- [ ] Manifest includes every registry node type.
- [ ] Manifest examples parse with `VisualArtifactSpecSchema` when wrapped in a spec.

## Phase 6 — PI tool

- [ ] Add `create_visual_artifact` tool implementation.
- [ ] Reuse `VisualArtifactSpecSchema` or a mirrored schema.
- [ ] Validate slug and spec.
- [ ] Ensure `src/artifacts` exists.
- [ ] Write pretty JSON.
- [ ] Return `{ slug, path, url }`.

Verification:

- [ ] Tool writes `src/artifacts/<slug>.json`.
- [ ] Tool returns `http://localhost:9999/artifacts/<slug>`.
- [ ] Tool rejects invalid specs before writing.

## Phase 7 — Test path

- [ ] Create `src/artifacts/revenue-dashboard.json`.
- [ ] Start dev server on port `9999`.
- [ ] Open `/artifacts/revenue-dashboard`.
- [ ] Confirm cards, metrics, chart/table, tabs/accordion render.
- [ ] Create or adapt a non-report artifact, such as a plan explainer.
- [ ] Confirm the same schema renders it.

Verification:

- [ ] Browser renders the sample report artifact.
- [ ] Browser renders one non-report artifact.

## Phase 8 — Follow-ups, not MVP

- [ ] `update_visual_artifact`.
- [ ] `list_visual_artifacts`.
- [ ] `delete_visual_artifact`.
- [ ] artifact versioning.
- [ ] separate data files.
- [ ] external data fetchers.
- [ ] preview/draft mode.
- [ ] broader adapter catalog.

## Risks / open questions

- The repo currently appears empty except `.git`; implementation path depends on the scaffold that gets added.
- Reading JSON from `src/artifacts` at request time needs verification in the final Next runtime mode.
- Tool schema reuse may be easy or annoying depending on where PI extension code lives.
