---
description: "Build architecture diagrams: topology, text-heavy overviews, and hybrid layouts."
date created: 2026-06-17
date modified: 2026-06-28
tags: ["visual-artifact", "architecture", "mermaid", "diagrams"]
---

# Architecture diagrams

Use for system topology, module relationships, runtime flows, and container-style diagrams.

## Three sizes

| Size | Element count | Approach |
|---|---:|---|
| Simple topology | < 10 | `mermaid` flowchart |
| Text-heavy overview | < 15 | `flow` + `grid`/`card` detail |
| Complex architecture | 15+ | small Mermaid overview + detailed sections/tables |

## Simple topology

- Use `mermaid` with `flowchart LR` for simple left-to-right handoffs.
- Use `flowchart TD` when the graph branches or labels get long.
- Label edges for protocols, data shapes, or ownership.
- Keep the diagram readable before making it complete.

## Text-heavy overview

- Use `flow` for the main sequence.
- Use `grid` with `card` nodes for modules.
- Each card carries responsibilities, key files, and collaborators.
- Use `section` dividers to separate layers.

## Complex architecture

1. Lead with a small overview diagram.
2. Follow with tables/cards for subsystem detail.
3. Use `tabs` for alternate views: runtime, storage, validation, operations.
4. Never force a full codebase into one giant diagram.

## Node selection

| Content | Node |
|---|---|
| Topology / connections | `mermaid` |
| Linear runtime flow | `flow` |
| Module descriptions | `card` inside `grid` |
| Layered sections | `section` |
| File/function lists | `file-tree` or `data-table` |
| Precise interactive map | `svg-diagram` |
