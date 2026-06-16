---
name: visual-artifact
description: Use when the user wants a rendered visual artifact from code or data.
---

# visual-artifact

Use this skill when the user wants a rendered visual artifact from code or data.

## When to use this skill

Use it for requests like:

- "generate a visual artifact"
- "diagram this project"
- "visual summary of the repo"
- "create a dashboard"
- "build a component gallery"
- "explain this with a diagram"
- any request that ends with a rendered artifact page

## When NOT to use this skill

- For plain text reports, summaries, or markdown docs that don't need rendering.
- For code generation, tests, or refactors.

## Choose a route

| Request | Route |
|---|---|
| Comprehensive architecture documentation; full codebase architecture overview; system design docs | [[references/architecture-overview/_index\|architecture overview]] |
| Component galleries, feature explainers, dashboards, quick diagrams, visual summaries of a subset | [[references/direct-artifact/_index\|direct artifact]] |

**Default to direct artifact.** Only use the architecture overview flow when the user explicitly wants comprehensive, repo-wide architecture documentation.

## Router: choose the right path

### Architecture overview (full pipeline)

Use ONLY for comprehensive architecture documentation — full system architecture, container diagrams, end-to-end data flows, module relationships across the whole repo.

Start here: [[references/architecture-overview/_index\|architecture overview]].

### Direct artifact (default)

Use for component galleries, feature explainers, dashboards, quick diagrams, visual summaries of a specific area, or any artifact where you can build the spec directly from known data.

Start here: [[references/direct-artifact/_index\|direct artifact]].

## Critical rules

- **Never call `create_visual_artifact` from inside a `pi --print` subprocess.** The assembler writes JSON to disk; the parent agent calls the tool.
- **Always pass the `data` object** when calling `create_visual_artifact`.
- **Before calling `create_visual_artifact`, read `~/.pi/tools/visualizer/artifact-contract.json`** and only use supported node types and props.
- **Keep the renderer running** with `vaz-serve` before calling `create_visual_artifact` if you want the artifact URL to resolve locally.
- **Orientation-first for architecture docs:** answer "what is this project?" before recommendations.

## Design guidelines (required reading)

Read [[references/design-guidelines|design guidelines]] before building any artifact. It covers how to structure content, choose node types, avoid generic output, and keep every artifact focused on its topic.
