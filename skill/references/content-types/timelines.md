---
description: "Build timelines and roadmaps: phases, milestones, and chronological narratives."
date created: 2026-06-17
date modified: 2026-06-28
tags: ["visual-artifact", "timeline", "roadmap", "phases"]
---

# Timelines & roadmaps

Use for chronological narratives, release plans, migrations, and event sequences.

## Structure

- Start with the outcome or current state.
- Use `timeline` for dated or phased records.
- Use `stepper` for process/progress states.
- Use `code-block` for exact commands when the timeline is a runbook.
- Use `status-grid` beside the timeline when each phase has readiness checks.

## Node selection

| Content | Node |
|---|---|
| Chronological sequence | `timeline` |
| Step-by-step progress | `stepper` |
| Phase grouping | `section` |
| Milestone details | `card` |
| Status per phase | `status-grid` |
| Commands | `code-block` |

## Data shape

A timeline usually needs rows like:

```json
{
  "phase": "Verify",
  "step": "01",
  "action": "Run local checks",
  "status": "pass"
}
```

Then map fields with `titleKey`, `markerKey`, `descriptionKey`, and `statusKey`.

## Anti-patterns

- Timelines with no outcomes.
- Every phase styled as equally important.
- Future work that looks already complete.
- Long paragraphs inside timeline rows.
