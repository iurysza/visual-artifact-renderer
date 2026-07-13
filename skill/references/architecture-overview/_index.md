---
description: "Manual flow for comprehensive codebase architecture artifacts: inspect facts, decide a thesis, plan visuals, assemble a VisualArtifactSpec, then render it."
date created: 2026-06-16T20:50:00
date modified: 2026-06-28T00:00:00
tags: ["visual-artifact", "architecture", "codebase-overview"]
---

# Architecture overview

Use this flow when the user wants a full codebase architecture artifact: layers, entry points, important components, runtime flows, data boundaries, and change implications.

For a quick feature explainer or diagram, use [direct artifact](../direct-artifact/_index.md).

## What this flow produces

A validated `VisualArtifactSpec` that opens with orientation, then shows the system map, key flows, important components, boundaries, and verification/attention areas.

## Run order

1. [Collect deterministic facts](./deterministic-extraction.md).
2. [Analyze architecture questions](./agentic-workflows.md).
3. [Decide the report direction](./report-director.md).
4. [Plan the visual treatment](./visualization-strategy.md).
5. [Assemble and render the spec](./final-assembler.md).

## Output location

For working notes, use the target repo:

```text
<repoRoot>/ai-artifacts/generated/<slug>/
```

For the rendered artifact, the CLI writes:

```text
~/.agents/skills/visual-artifact/artifacts/<project>/<slug>/artifact.json
```

## Framing rules

- Orientation first: answer "what is this project?"
- Evidence before opinion.
- "Attention area" means "important to understand", not "bad code".
- Recommendations, if any, are short and trailing.
- Do not invent facts beyond inspected code/docs.
