---
description: "Build timelines and roadmaps: phases, milestones, and chronological narratives."
date created: 2026-06-17
date modified: 2026-06-17
tags: ["visual-artifact", "timeline", "roadmap", "phases"]
---

# Timelines & roadmaps

Use for chronological narratives, release plans, migration phases, and event sequences.

## Structure

- Central timeline with phase markers.
- Cards branch left/right or stack to one side.
- Past phases muted, current phase emphasized, future phases tentative.
- Each card contains date, label, status, and a one-line outcome.

## Node selection

| Content | Node |
|---|---|
| Linear sequence | `timeline` |
| Phase grouping | `section` |
| Milestone details | `card` |
| Status per milestone | `status-grid` alongside the timeline |

## Patterns

| Pattern | Use when |
|---|---|
| Vertical timeline | Roadmaps, release plans |
| Horizontal timeline | Short event sequences |
| Phase lanes | Multiple parallel tracks (e.g., backend + frontend + QA) |

## Anti-patterns

- Timelines with no outcomes.
- Every phase styled identically.
- Future work that looks already done.
