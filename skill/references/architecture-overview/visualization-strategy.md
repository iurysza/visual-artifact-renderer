---
description: "Plan how an architecture report should be rendered as Visualizer nodes."
date created: 2026-06-16T20:50:00
date modified: 2026-06-28T00:00:00
tags: ["visual-artifact", "architecture", "visualization"]
---

# Visualization strategy

Turn the report direction into a visual plan before writing JSON.

## Inputs

- `facts.md`
- `analysis.md`
- `report-direction.md`
- `artifact-contract.json`

## Plan

For each section, decide:

- reader question answered
- best node types
- data keys needed
- diagram shape, if any
- what belongs in the main path vs secondary detail

## Good defaults

- Opening thesis: `text` with `size: "lg"`.
- Summary band: `grid` + `stat-card`.
- System map: `mermaid`.
- Linear path: `flow`.
- Component evidence: `comparison-table` or `data-table`.
- Health/verification: `status-grid`.
- Commands/config: `code-block`.
- Secondary notes: `accordion`.

## Diagram guidance

- Use Mermaid for most architecture diagrams.
- Use `svg-diagram` only for precise layout or interactivity.
- Keep Mermaid diagrams small enough to scan; split when needed.
- Caption diagrams so readers know what to look for.

## Output

Write:

```text
<repoRoot>/ai-artifacts/generated/<slug>/visualization-strategy.md
```

## Next step

Move to [final assembler](./final-assembler.md).
