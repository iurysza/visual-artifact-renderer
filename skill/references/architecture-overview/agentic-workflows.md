---
description: "Analyze architecture questions after collecting facts."
date created: 2026-06-16T20:50:00
date modified: 2026-06-28T00:00:00
tags: ["visual-artifact", "architecture", "analysis"]
---

# Architecture analysis

After collecting facts, answer the questions a reader needs before changing the codebase.

## Questions to answer

### 1. Codebase orientation

- What is this project?
- What are the main layers?
- What are the entry points?
- Which files/components define the mental model?

### 2. Important components

For each central component:

- responsibility
- collaborators
- why it matters
- what breaks if it changes
- how to verify changes

### 3. Runtime/data flows

Trace the key flows end-to-end:

- request path
- data loading/transformation
- rendering/output
- background jobs or CLIs
- external integrations

### 4. Boundaries

Look for:

- UI vs runtime vs CLI vs extension boundaries
- validation boundaries
- filesystem/network boundaries
- dependency direction

### 5. Changeability

Pick two or three realistic changes and ask:

- where would you start?
- how many areas would change?
- what tests/checks protect it?
- where is context concentrated?

## Output

Write a concise analysis note:

```text
<repoRoot>/ai-artifacts/generated/<slug>/analysis.md
```

Use neutral language. The output is for orientation, not blame.

## Next step

Move to [report direction](./report-director.md).
