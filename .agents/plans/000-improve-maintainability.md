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
      - "- [ ] step 4: record the intended module boundaries before moving code"
  - phase: shared-primitives
    steps:
      - "- [ ] step 1: extract reusable Figure wrapper (title/caption/error/loading)"
      - "- [ ] step 2: extract PanelCard wrapper for bordered card panels"
      - "- [ ] step 3: extract status helpers (statusTone, statusBadgeVariant, statusPanelClass, StatusChip)"
      - "- [ ] step 4: extract data helpers (getRows, normalizeColumns, formatCell, toTitle)"
      - "- [ ] step 5: extract chart shell component to remove BarChart/LineChart duplication"
  - phase: modularize-registry
    steps:
      - "- [ ] step 1: move simple leaf adapters (alert, badge, button, separator, heading, text, prose, metric, stat-card, definition-list, diff, file-tree, image, stepper, code-block) to src/components/adapters/"
      - "- [ ] step 2: move data-driven adapters (table, data-table, comparison-table, chart, pie-chart, donut-chart, area-chart, radar-chart, scatter-chart, heatmap, timeline, status-grid, log) to src/components/adapters/"
      - "- [ ] step 3: move layout adapters (card, grid, section, tabs, accordion, flow) to src/components/adapters/"
      - "- [ ] step 4: keep component-registry.tsx as a thin registry map only"
      - "- [ ] step 5: update all imports and verify types"
  - phase: extract-mermaid
    steps:
      - "- [ ] step 1: move MermaidDiagram and viewport logic to src/components/mermaid/"
      - "- [ ] step 2: split zoom/pan hooks and math utilities into focused helpers"
      - "- [ ] step 3: replace old renderMermaid with new component import"
      - "- [ ] step 4: keep public API unchanged (VisualArtifactRenderer still works)"
  - phase: dry-schema-and-css
    steps:
      - "- [ ] step 1: introduce zod schema builders for repeated node shapes"
      - "- [ ] step 2: consolidate light/dark theme variable declarations in globals.css"
      - "- [ ] step 3: export contract and run contract tests"
  - phase: registry-builder
    steps:
      - "- [ ] step 1: add createAdapter helper that binds node type to render function"
      - "- [ ] step 2: refactor registry to use builder while preserving type safety"
      - "- [ ] step 3: document one-line pattern for adding a new node type"
  - phase: validation
    steps:
      - "- [ ] step 1: run pnpm lint"
      - "- [ ] step 2: run pnpm test:contract"
      - "- [ ] step 3: run pnpm build"
      - "- [ ] step 4: run pnpm verify:artifacts"
      - "- [ ] step 5: re-run jscpd and confirm duplication dropped"
      - "- [ ] step 6: commit all changes"
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
- [ ] Record the module boundaries (this plan) before moving code.

## Phase 2 — Shared primitives

Extract small reusable components and helpers so adapters stay declarative.

- [ ] `src/components/artifact-primitives.tsx`:
  - `<Figure title? caption? error? loading? height?>`
  - `<PanelCard tone? className?>`
- [ ] `src/lib/status.ts`:
  - `statusTone`, `statusBadgeVariant`, `statusPanelClass`, `StatusChip`
- [ ] `src/lib/data.ts`:
  - `getRows`, `normalizeColumns`, `formatCell`, `toTitle`, `MissingData`
- [ ] `src/components/chart-shell.tsx`:
  - Shared `CartesianGrid`, `XAxis`, `YAxis`, tooltip, and margin config for
    bar/line charts.

## Phase 3 — Modularize the registry

Split adapters by responsibility. Keep `component-registry.tsx` as a thin map.

- [ ] `src/components/adapters/leaf-adapters.tsx` — alert, badge, button,
      separator, heading, text, prose, metric, stat-card, definition-list,
      diff, file-tree, image, stepper, code-block.
- [ ] `src/components/adapters/data-adapters.tsx` — table, data-table,
      comparison-table, chart, pie-chart, donut-chart, area-chart, radar-chart,
      scatter-chart, heatmap, timeline, status-grid, log.
- [ ] `src/components/adapters/layout-adapters.tsx` — card, grid, section, tabs,
      accordion, flow.
- [ ] `src/components/component-registry.tsx` only imports and registers
      adapters.

## Phase 4 — Extract Mermaid

Move the complex interactive diagram into its own module tree.

- [ ] `src/components/mermaid/mermaid-diagram.tsx` — render queue, theme sync,
      error/loading states.
- [ ] `src/components/mermaid/mermaid-viewport.tsx` — zoom/pan/drag viewport.
- [ ] `src/components/mermaid/use-mermaid-viewbox.ts` — viewBox state and
      keyboard handlers.
- [ ] `src/components/mermaid/mermaid-math.ts` — SVG math helpers.

## Phase 5 — DRY schema and CSS

Reduce repetition without changing the public contract.

- [ ] Add schema builder helpers in `src/lib/schema-helpers.ts`:
  - `nodeSchema(type, props)` for the common `.object({ type, props }).strict()`
    shape.
  - `dataNodeProps(dataKey, extra)` for table/chart/timeline/status-grid props.
- [ ] Refactor `artifact-schema.ts` to use the helpers.
- [ ] Consolidate `globals.css` theme variables by scoping shared semantic
  mappings to `:root, html.dark` and only overriding values that differ.

## Phase 6 — Registry builder

Make registering a new node type trivial and type-safe.

- [ ] Add `createAdapter<T>(type, render)` in
  `src/components/adapters/create-adapter.ts`.
- [ ] Rewrite `componentRegistry` object to use `createAdapter` entries.
- [ ] Verify `ArtifactNode["type"]` still drives the registry keys.

## Phase 7 — Validation

- [ ] `pnpm lint`
- [ ] `pnpm test:contract`
- [ ] `pnpm build`
- [ ] `pnpm verify:artifacts`
- [ ] Re-run jscpd and confirm the duplication percentage dropped.
- [ ] Commit all changes with a concise message.
