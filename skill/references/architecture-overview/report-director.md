---
description: "Run a single scout agent as the Report Director to decide the artifact's thesis, audience, section order, and emphasis from the evidence collected so far."
date created: 2026-06-16T20:50:00
date modified: 2026-06-16T20:50:00
tags: ["visual-artifact", "architecture", "report-director"]
---

# Report Director

The Report Director decides how the final artifact should inform a reader. It does not solve the codebase or produce a remediation backlog.

## When to run

Run after [[references/architecture-overview/agentic-workflows|agentic workflows]] have produced their reports.

## Inputs

Read all of these before writing:

- source instruction files from the target repo (if present):
  - `.agents/plans/000-multipass-visual-artifact-generator/000-multipass-visual-artifact-generator.md`
  - `.agents/plans/000-multipass-visual-artifact-generator/idea.md`
  - `.agents/plans/000-multipass-visual-artifact-generator/mental-model.md`
  - `.agents/plans/000-multipass-visual-artifact-generator/code-base-report-guidelines.md`
  - `.agents/plans/000-multipass-visual-artifact-generator/hotspot-audit-algorithm.md`
- deterministic digest: `extractor-digest.md`
- extractor run manifest: `extractor-run.json`
- packet JSON files in `packets/*.json`
- agentic reports in `reports/*.md`

## Task

Launch exactly one scout agent. Ask it to decide:

- What is this project?
- What are its main moving parts?
- Which components, flows, boundaries, and concepts should a reader understand first?
- Where should attention go when navigating the codebase?
- What evidence supports that orientation?

Hard framing rules:

- Orientation first. Do not lead with issues, fixes, refactors, or "what to do next".
- "Attention area" means "important place to understand", not "bad code".
- Recommendations, if any, are a short trailing section. They must not drive the artifact structure.
- Prefer: purpose, system map, domain concepts, important components, runtime/data flows, boundaries, verification confidence, attention areas.
- Avoid generic code-quality report shape. Use the packets to choose what this specific project needs explained.
- Do not emit a final VisualArtifactSpec. Do not call `create_visual_artifact`.

## Outputs

Write two files to `<repoRoot>/ai-artifacts/generated/<slug>/`:

1. `report-direction.json` — brief with this exact shape:

```json
{
  "id": "report-direction",
  "thesis": "one concrete sentence about what the report teaches",
  "intendedArtifact": "code-architecture",
  "audience": "who this is for",
  "reportMode": "orientation-first",
  "emphasis": ["short emphasis strings"],
  "sectionOrder": ["section-id-in-display-order"],
  "sections": [
    {
      "id": "stable-kebab-id",
      "title": "Reader-facing section title",
      "purpose": "What this section helps the reader understand, not what it fixes",
      "readerQuestion": "Question answered by this section",
      "sourcePacketIds": ["packet-id"],
      "suggestedNodeTypes": ["heading", "text", "stat-card"],
      "dataKeys": ["optional-data-key"],
      "codeSnippetIds": ["optional-snippet-id"]
    }
  ],
  "risksAndCaveats": ["evidence limitations or uncertainty"],
  "unresolvedQuestions": ["optional concise questions"]
}
```

2. `report-direction.md` — human-readable storyboard:

- Start with the thesis.
- Then list the artifact sections in order.
- For each section, explain what the reader learns and which packets support it.
- Keep "what to do next" minimal or absent.
- Use neutral language. No blame, no generic "bad code" framing.

## Next step

After the brief is written, move to [[references/architecture-overview/visualization-strategy|visualization strategy]].
