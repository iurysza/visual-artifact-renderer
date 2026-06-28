---
description: "Decide the thesis, audience, and section order for an architecture artifact."
date created: 2026-06-16T20:50:00
date modified: 2026-06-28T00:00:00
tags: ["visual-artifact", "architecture", "report-director"]
---

# Report direction

The report direction decides what the artifact should teach. It does not produce the final JSON.

## Inputs

Read:

- `<repoRoot>/ai-artifacts/generated/<slug>/facts.md`
- `<repoRoot>/ai-artifacts/generated/<slug>/analysis.md`
- relevant source files and project docs
- the Visualizer contract for available node types

## Decide

- thesis: one concrete sentence about what the artifact teaches
- audience: who needs this page
- section order: high-level first, details later
- evidence: which facts support each section
- caveats: uncertainty or missing evidence

## Recommended section shape

1. Purpose and system map
2. Main runtime/data flow
3. Important components
4. Boundaries and contracts
5. Verification and operational notes
6. Attention areas / next questions

## Output

Write:

```text
<repoRoot>/ai-artifacts/generated/<slug>/report-direction.md
```

Keep it short and practical. The next step turns it into visual structure.

## Next step

Move to [visualization strategy](./visualization-strategy.md).
