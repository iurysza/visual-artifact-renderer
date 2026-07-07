---
description: "Assemble a validated VisualArtifactSpec from architecture notes and render it."
date created: 2026-06-16T20:50:00
date modified: 2026-06-28T00:00:00
tags: ["visual-artifact", "architecture", "assembly"]
---

# Final assembler

Build the final `VisualArtifactSpec` JSON.

## Inputs

Read:

1. `facts.md`
2. `analysis.md`
3. `report-direction.md`
4. `visualization-strategy.md`
5. source evidence as needed
6. `visual-artifact contract` (current root spec and node constraints)

## Build rules

- Start with the thesis.
- Put reusable rows into `data` and reference them with `dataKey`.
- Use only supported node types.
- Keep the spec focused; split sprawling artifacts into separate sections or artifacts.
- Keep status strings short and put detail in descriptions.
- Do not invent facts.
- Do not output raw HTML except inside `svg-diagram` when necessary.

## Validate

```bash
visual-artifact validate visual-artifact-spec.json
```

Or from the source tree:

```bash
cd cli
bun run src/main.ts validate /path/to/visual-artifact-spec.json
```

## Render

```bash
visual-artifact create visual-artifact-spec.json --project <repoRoot>
```

Inside Pi, call `create_visual_artifact` with the same JSON fields and return the URL.

## SVG reminder

If using `svg-diagram`, `props.html` must be a complete self-contained HTML document for a sandboxed iframe, with its own theme variables and theme bootstrap script.
