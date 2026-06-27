---
description: "Run this flow when the user wants comprehensive architecture documentation of a codebase: system maps, dependency direction, important components, runtime flows, and changeability notes rendered as a visual artifact."
date created: 2026-06-16T20:50:00
date modified: 2026-06-16T20:50:00
tags: ["visual-artifact", "architecture", "codebase-overview"]
---

# Architecture overview

Use this flow when a user asks for a full codebase architecture report: layers, entry points, external systems, important components, dependency direction, runtime flows, and where attention should go when navigating the code.

This is **not** a quick diagram or a feature explainer. For those, use [[references/direct-artifact/_index|direct artifact]] instead.

## What this flow produces

1. Deterministic repo probes: profile, folder tree, imports, dependencies.
2. Six focused agentic reports: codebase orientation, important components, hotspot audit, change-scenario trace, boundary audit, testability audit.
3. A report director brief that decides thesis, audience, section order, and emphasis.
4. A visualization strategy that decides how each section is presented.
5. A final `visual-artifact-spec.json` that another tool renders.

## Run order

Follow these steps in order. Do not skip ahead.

1. Run [[references/architecture-overview/deterministic-extraction|deterministic extraction]] to build the fact base.
2. Run the six [[references/architecture-overview/agentic-workflows|agentic workflows]] in parallel or sequence.
3. Run the [[references/architecture-overview/report-director|report director]] to decide what the artifact should say.
4. Run the [[references/architecture-overview/visualization-strategy|visualization strategy]] pass to decide how to say it.
5. Run the [[references/architecture-overview/final-assembler|final assembler]] to generate the spec JSON.
6. Read the generated `visual-artifact-spec.json` and either:
   - call `create_visual_artifact` with the spec, or
   - run `visual-artifact create visual-artifact-spec.json --project <repoRoot>` to validate and save it via the CLI.

## Output location

All files land in `<repoRoot>/ai-artifacts/generated/<slug>/`.

## Framing rules

- Orientation first. The artifact answers "what is this project?" before anything else.
- "Attention area" means "important place to understand", not "bad code".
- Recommendations, if any, are a short trailing section.
- Use neutral language. Never say "this code is bad." Say "this component is central because it coordinates X; changes here require broad context."
