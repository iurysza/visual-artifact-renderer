---
description: "Run the Final Artifact Assembler to turn the report direction, visualization strategy, packets, and reports into a validated VisualArtifactSpec JSON file."
date created: 2026-06-16T20:50:00
date modified: 2026-06-16T20:50:00
tags: ["visual-artifact", "architecture", "assembly"]
---

# Final assembler

The Final Artifact Assembler produces the `visual-artifact-spec.json` file that another tool renders.

## When to run

Run after the [[references/architecture-overview/visualization-strategy|visualization strategy]] brief is written.

## Inputs

Read all of these before generating the JSON:

1. Report direction: `report-direction.json` and `report-direction.md`
2. Visualization strategy: `visualization-strategy.md`
3. Deterministic digest: `extractor-digest.md`
4. Extractor run manifest: `extractor-run.json`
5. Packet JSON files in `packets/*.json`
6. Agentic reports in `reports/*.md`
7. Source instruction files from the target repo (if present)
8. Artifact component palette and schema constraints from the visualizer runtime

## Task

Launch exactly one scout agent. Ask it to:

- Produce the final VisualArtifactSpec JSON.
- Write it to `visual-artifact-spec.json` inside `<repoRoot>/ai-artifacts/generated/<slug>/`.
- Use only node types from the Artifact Component Palette.
- Put lists/tables of data into the `data` object and reference them using `dataKey`.
- Keep the narrative orientation-first. Do not build a remediation backlog.
- If unsure about a value, use evidence from the packets/reports.

## Output rules

- Do not output raw JSON in chat.
- Do not call `create_visual_artifact`. The parent agent does that.
- Validate the JSON against the VisualArtifactSpec schema before finishing.

## SVG diagram rules

When generating an `svg-diagram` node, the `html` value must be a complete self-contained HTML document:

- Hand-rolled CSS variables on `:root` for light theme and `html.dark` for dark theme.
- An apply-before-paint script in `<head>` that reads `localStorage` key `visualizer-theme` (fallback to `prefers-color-scheme`) and toggles the `dark` class on `<html>`.
- A small theme toggle button that persists the choice back to `localStorage`.
- Full-screen inside the iframe: `html, body { height: 100%; overflow: hidden; }` with a flex top-bar + SVG stage.
- SVG styled through CSS classes using those variables; never put hard-coded hex colors inside SVG elements.
- Include interactive touches when useful: clickable nodes with a detail card, flow chips that light up edges/nodes and animate request paths.
- Keep prose minimal; the diagram itself should explain the stack.

Layout checks before emitting an svg-diagram:

- The viewBox must be large enough for every node, zone, edge label, and the bottom-right detail card overlay. Increase dimensions instead of squeezing.
- Every node rectangle must have at least 30px of empty space between it and any adjacent node in both x and y.
- Dashed zones must have at least 40px of empty space between adjacent zones.
- Edges and edge labels must run through blank canvas, never across nodes or other labels.
- Reserve the bottom-right corner for the detail card overlay; do not place nodes under it.
- Do a final overlap audit: no intersecting rectangles, no clipped text.

## Next step

After `visual-artifact-spec.json` is validated, read it and call `create_visual_artifact` with the JSON payload, including the `data` object. If validation fails, fix the JSON and retry until the tool succeeds.
