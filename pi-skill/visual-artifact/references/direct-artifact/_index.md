---
description: "Use this route for component galleries, feature explainers, dashboards, quick diagrams, and visual summaries of a specific area. Build the artifact spec directly and call create_visual_artifact."
date created: 2026-06-16T20:50:00
date modified: 2026-06-16T20:50:00
tags: ["visual-artifact", "direct", "gallery", "dashboard"]
---

# Direct artifact

Use this route when the user wants a rendered visual artifact that is not a full codebase architecture doc.

Good fits:

- component galleries
- feature explainers
- dashboards
- quick diagrams
- visual summaries of a specific area
- anything where you can build the spec directly from known data

## How to build

1. Inspect the relevant code or data to understand what to visualize.
2. Read `~/.pi/tools/visualizer/artifact-contract.json` to confirm supported node types and props.
3. Build a `VisualArtifactSpec` directly, valid against the schema.
4. Optionally start the renderer with `vaz-serve` if you want a local URL.
5. Call `create_visual_artifact` with the spec.
6. Return the artifact URL.

## Output location

Artifacts are saved globally under `~/.pi/artifacts/<project>/<slug>.json`. The project name is derived from the caller's working directory.

## Next step

For comprehensive architecture documentation instead, use [[references/architecture-overview/_index|architecture overview]].
