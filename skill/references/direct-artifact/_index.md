---
description: "Use this route for component galleries, feature explainers, dashboards, quick diagrams, and visual summaries. Build the artifact spec directly and call create_visual_artifact or visual-artifact create."
date created: 2026-06-16T20:50:00
date modified: 2026-06-28T00:00:00
tags: ["visual-artifact", "direct", "gallery", "dashboard"]
---

# Direct artifact

Use this route for most visual-artifact requests.

Good fits:

- component galleries
- feature explainers
- dashboards
- quick diagrams
- visual summaries of a specific area
- code reviews and recap pages
- anything where you can build the spec from inspected facts

## How to build

1. Inspect the relevant code/data.
2. Get the current contract by running `visual-artifact contract`.
3. Choose node types that match the content.
4. Build a valid `VisualArtifactSpec`.
5. Call `create_visual_artifact`, or run:

```bash
visual-artifact create spec.json --project /path/to/repo
```

The CLI validates, writes, and starts the renderer if needed.

## Output location

Default storage:

```text
~/.agents/skills/visual-artifact/artifacts/<project>/<slug>/artifact.json
```

`<project>` is derived from the caller's git root or directory name.

## Sidecar image assets

Image nodes support:

- Relative sidecar paths, e.g. `"hero.png"` next to the artifact JSON.
- Absolute HTTPS URLs.

Never use `file://` URLs.

## Content-type patterns

Pick a shape before building the spec:

- [Explainers & lessons](../content-types/explainers.md)
- [Architecture diagrams](../content-types/architecture-diagrams.md)
- [Data organization](../content-types/data-organization.md)
- [Timelines & roadmaps](../content-types/timelines.md)

## Quality bar

- First node answers "what am I looking at?"
- Important facts get visual weight.
- Structured evidence goes into data/table nodes.
- Diagrams are readable and captioned.
- Secondary detail goes in tabs/accordion, not the main path.
