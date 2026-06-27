---
description: "Run deterministic repo probes to build a fact base before any interpretation: repo profile, folder layers, internal imports, and package dependencies."
date created: 2026-06-16T20:50:00
date modified: 2026-06-16T20:50:00
tags: ["visual-artifact", "architecture", "extraction"]
---

# Deterministic extraction

Run these four probes before any interpretation. They are cheap, factual, and give later agentic steps the evidence they need.

## When to run

Always run this first in the [[references/architecture-overview/_index|architecture overview]] flow.

## Output files

All files are written to `<repoRoot>/ai-artifacts/generated/<slug>/`.

- `extractor-digest.md` — human-readable index of all probes, findings, assets, and unresolved questions.
- `extractor-run.json` — machine-readable manifest with packet paths and summaries.
- `packets/*.json` — raw structured data from each probe.
- `reports/*.md` — human-readable reports for each probe.

## Probes

### 1. Repo profile

Collect:

- package manager
- frameworks detected from dependencies
- npm scripts
- declared dependencies and devDependencies
- entry points (`src/index.ts`, `src/main.ts`, etc.)
- test commands
- routes (Next.js, React Router, etc.)
- TypeScript presence, lint presence, test presence

### 2. Folder layers

Collect:

- pruned folder tree to depth 6
- file and directory counts
- ignored dirs: `.git`, `.next`, `node_modules`, `out`, `dist`, `build`, `coverage`, `.cache`, `.turbo`, `.vercel`, `.netlify`, `storybook-static`

### 3. Internal imports

Collect:

- all source files (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`)
- internal import edges between source files
- package import counts
- a Mermaid dependency graph asset

### 4. Package deps

Collect:

- declared dependencies grouped by purpose (framework, ui, data-viz, forms, testing, styling, validation, highlighting, themes)
- usage counts derived from imports

## How to run

From the visualizer runtime directory (`~/.pi/tools/visualizer`):

```bash
npx tsx scripts/extract/pipeline/01-deterministic-extraction/step.ts <repoRoot> <slug> <outputBase>
```

`<outputBase>` is typically `<repoRoot>/ai-artifacts/generated`.

## Next step

After this completes, read `extractor-digest.md` and move to [[references/architecture-overview/agentic-workflows|agentic workflows]].
