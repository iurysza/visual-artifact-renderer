---
name: 000-improve-maintainability
description: >
  Make the visualizer easier to reason about, extend, and evolve by modularizing
  the monolithic component registry, eliminating duplication, and introducing a
  small, typed registry-builder so new node types and pipelines require minimal
  boilerplate.
steps:
  - phase: audit-and-contract
    steps:
      - "- [x] step 1: read jscpd report and identify duplication hotspots"
      - "- [x] step 2: read component-registry.tsx and map responsibilities"
      - "- [x] step 3: confirm build/lint/contract validation commands work"
      - "- [x] step 4: record the intended module boundaries before moving code"
  - phase: shared-primitives
    steps:
      - "- [x] step 1: extract reusable Figure wrapper (title/caption/error/loading)"
      - "- [x] step 2: extract PanelCard wrapper for bordered card panels"
      - "- [x] step 3: extract status helpers (statusTone, statusBadgeVariant, statusPanelClass, StatusChip)"
      - "- [x] step 4: extract data helpers (getRows, normalizeColumns, formatCell, toTitle)"
      - "- [x] step 5: extract chart shell component to remove BarChart/LineChart duplication"
  - phase: modularize-registry
    steps:
      - "- [x] step 1: move simple leaf adapters (alert, badge, button, separator, heading, text, prose, metric, stat-card, definition-list, diff, file-tree, image, stepper, code-block) to src/components/adapters/"
      - "- [x] step 2: move data-driven adapters (table, data-table, comparison-table, chart, pie-chart, donut-chart, area-chart, radar-chart, scatter-chart, heatmap, timeline, status-grid, log) to src/components/adapters/"
      - "- [x] step 3: move layout adapters (card, grid, section, tabs, accordion, flow) to src/components/adapters/"
      - "- [x] step 4: keep component-registry.tsx as a thin registry map only"
      - "- [x] step 5: update all imports and verify types"
  - phase: extract-mermaid
    steps:
      - "- [x] step 1: move MermaidDiagram and viewport logic to src/components/mermaid/"
      - "- [x] step 2: split zoom/pan hooks and math utilities into focused helpers"
      - "- [x] step 3: replace old renderMermaid with new component import"
      - "- [x] step 4: keep public API unchanged (VisualArtifactRenderer still works)"
  - phase: dry-schema-and-css
    steps:
      - "- [x] step 1: introduce zod schema builders for repeated node shapes"
      - "- [x] step 2: consolidate light/dark theme variable declarations in globals.css"
      - "- [x] step 3: export contract and run contract tests"
  - phase: registry-builder
    steps:
      - "- [x] step 1: add createAdapter helper that binds node type to render function"
      - "- [x] step 2: refactor registry to use builder while preserving type safety"
      - "- [x] step 3: document one-line pattern for adding a new node type"
  - phase: validation
    steps:
      - "- [x] step 1: run pnpm lint"
      - "- [x] step 2: run pnpm test:contract"
      - "- [x] step 3: run pnpm build"
      - "- [x] step 4: run pnpm verify:artifacts"
      - "- [x] step 5: re-run jscpd and confirm duplication dropped"
      - "- [x] step 6: commit all changes"
---

# 000 — Improve Visualizer Maintainability

## Goals

1. **Easier to reason about.** No single file should mix simple adapters, data
   formatting, chart rendering, SVG math, and gesture logic. Each file should
   have one reason to change.
2. **Easier to extend.** Adding a new artifact node type should be one adapter
   file + one line in the registry. Adding a new pipeline step should not
   require touching renderer internals.
3. **No duplication.** Shared wrappers (Figure, PanelCard, status chips, chart
   shell) should exist once and be reused by every adapter that needs them.
4. **Cohesive styling.** Visual treatment for cards, figures, status panels, and
   typography should come from shared components/tokens, not copied class
   strings.
5. **Pragmatic.** Keep the public schema, contract, and page behavior unchanged.
   Do not rewrite the data model or introduce new abstractions unless they
   remove duplication or simplify extension.

## Current pain points

- `src/components/component-registry.tsx` is ~1500 lines and contains:
  - 35+ adapter functions
  - Mermaid render queue + zoom/pan/drag + SVG math (~350 lines)
  - table rendering + mobile record layout
  - status/formatting helpers used across many renderers
- Duplication in `src/app/globals.css`: light and dark theme blocks repeat the
  same semantic variable mapping.
- Duplication in `src/lib/artifact-schema.ts`: zod discriminated-union entries
  repeat the same `.strict()` wrappers and prop shapes.
- JSCPD report flags duplicate fragments in CSS, the registry, and the schema.

## Phase 1 — Audit and contract

- [x] Read the jscpd report and map hotspots.
- [x] Read `component-registry.tsx` and list responsibilities.
- [x] Confirm `pnpm lint`, `pnpm build`, `pnpm test:contract`, and
      `pnpm verify:artifacts` run.
- [x] Record the module boundaries (this plan) before moving code.

## Phase 2 — Shared primitives

Extract small reusable components and helpers so adapters stay declarative.

- [x] `src/components/artifact-primitives.tsx`:
  - `<Figure title? caption? error? loading? height?>`
  - `<PanelCard tone? className?>`
- [x] `src/lib/status.tsx`:
  - `statusTone`, `statusBadgeVariant`, `statusPanelClass`, `StatusChip`
- [x] `src/lib/data.tsx`:
  - `getRows`, `normalizeColumns`, `formatCell`, `toTitle`, `MissingData`
- [x] `src/components/chart-shell.tsx`:
  - Shared `CartesianGrid`, `XAxis`, `YAxis`, tooltip, and margin config for
    bar/line charts.

## Phase 3 — Modularize the registry

Split adapters by responsibility. Keep `component-registry.tsx` as a thin map.

- [x] `src/components/adapters/leaf-adapters.tsx` — alert, badge, button,
      separator, heading, text, prose, metric, stat-card, definition-list,
      diff, file-tree, image, stepper, code-block.
- [x] `src/components/adapters/data-adapters.tsx` — table, data-table,
      comparison-table, chart, pie-chart, donut-chart, area-chart, radar-chart,
      scatter-chart, heatmap, timeline, status-grid, log.
- [x] `src/components/adapters/layout-adapters.tsx` — card, grid, section, tabs,
      accordion, flow.
- [x] `src/components/component-registry.tsx` only imports and registers
      adapters.

## Phase 4 — Extract Mermaid

Move the complex interactive diagram into its own module tree.

- [x] `src/components/mermaid/mermaid-diagram.tsx` — render queue, theme sync,
      error/loading states.
- [x] `src/components/mermaid/mermaid-viewport.tsx` — zoom/pan/drag viewport.
- [x] `src/components/mermaid/use-mermaid-viewbox.ts` — viewBox state and
      keyboard handlers.
- [x] `src/components/mermaid/mermaid-math.ts` — SVG math helpers.

## Phase 5 — DRY schema and CSS

Reduce repetition without changing the public contract.

- [x] Add schema builder helpers in `src/lib/schema-helpers.ts`:
  - `leafSchema(type, shape)` for leaf nodes.
  - `containerSchema(type, shape, children)` for nodes with children.
  - `optionalPropsSchema(type, shape)` for nodes with optional empty props.
- [x] Refactor `artifact-schema.ts` to use the helpers.
- [x] Consolidate `globals.css` theme variables by scoping shared semantic
  mappings to `:root` and only overriding the few values that differ in
  `html.dark`.

## Phase 6 — Registry builder

Make registering a new node type trivial and type-safe.

- [x] Add `createAdapter<T>(render)` in
  `src/components/adapters/create-adapter.ts`.
- [x] Move shared types to `src/components/artifact-types.ts` to avoid circular
      imports.
- [x] Rewrite `componentRegistry` object to use `createAdapter` entries.
- [x] Verify `ArtifactNode["type"]` still drives the registry keys.

## Phase 7 — Validation

- [x] `pnpm lint` — no issues.
- [x] `pnpm test:contract` — all tests pass.
- [x] `pnpm build` — static export succeeds.
- [x] `pnpm verify:artifacts` — 21 artifact specs verified.
- [x] Re-run jscpd — total duplication dropped from ~1.7% lines to ~0.63%
      lines; CSS duplication eliminated (0%).
- [x] Commit all changes with concise messages.

## How to add a new node type

1. Add the TypeScript type to `src/lib/artifact-schema.ts` using
   `leafSchema("my-node", { ... })` or `containerSchema(...)`.
2. Add the manifest entry to `src/lib/artifact-manifest.ts`.
3. Add the adapter to the appropriate file in `src/components/adapters/`.
4. Register it in `src/components/component-registry.tsx`:
   ```ts
   "my-node": createAdapter(adapters.renderMyNode),
   ```
5. Run `pnpm export:contract` and `pnpm test:contract`.

## Outcome

- `component-registry.tsx` went from ~1,500 lines to ~60 lines.
- Adapters are grouped by responsibility: leaf, data, layout.
- Shared presentation primitives (`Figure`, `PanelCard`, `ChartShell`) are used
  across adapters.
- Mermaid interactivity lives in a focused module tree.
- Status and data formatting helpers are reusable.
- The artifact contract and all rendered output remain unchanged.
