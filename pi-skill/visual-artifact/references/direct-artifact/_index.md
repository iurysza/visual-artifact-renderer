---
description: "Use this route for component galleries, feature explainers, dashboards, quick diagrams, and visual summaries of a specific area. Build the artifact spec directly and call create_visual_artifact."
date created: 2026-06-16T20:50:00
date modified: 2026-06-17T20:50:00
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
4. Optionally start the renderer with `visual-artifact serve --no-open` if you want a local URL. The default server binds to `0.0.0.0:9999`, so it is reachable on both localhost and the machine's LAN IP.
5. Call `create_visual_artifact` with the spec, or run `visual-artifact create <spec.json>` to validate and save it via the CLI.
6. Return the artifact URL.

## Output location

Artifacts are saved globally under `~/.pi/artifacts/<project>/<slug>.json`. The project name is derived from the caller's working directory.

## Sidecar image assets

Image nodes support three `src` forms:

- **Relative path** (recommended for local assets): place the image file next to the artifact JSON under `~/.pi/artifacts/<project>/`, then use `"src": "hero.png"`. The renderer resolves it to `/artifacts/data/artifacts/<project>/hero.png`.
- **Absolute HTTPS URL**: use for external or CDN images.
- **`file://` URLs are forbidden**: they are not portable and will be rejected by the renderer and the Pi extension.

## Content-type patterns

Pick a shape before building the spec:
- [[references/content-types/architecture-diagrams|Architecture diagrams]]
- [[references/content-types/dashboards|Dashboards & metrics]]
- [[references/content-types/timelines|Timelines & roadmaps]]
- [[references/content-types/data-organization|Data organization]]

## Next step

For comprehensive architecture documentation instead, use [[references/architecture-overview/_index|architecture overview]].
