---
description: "Build architecture diagrams: topology, text-heavy overviews, and hybrid layouts."
date created: 2026-06-17
date modified: 2026-06-17
tags: ["visual-artifact", "architecture", "mermaid", "diagrams"]
---

# Architecture diagrams

Use for system topology, module relationships, runtime flows, and container diagrams.

## Three sizes

| Size                 | Element count | Approach                                                 |
| -------------------- | ------------- | -------------------------------------------------------- |
| Simple topology      | < 10          | `mermaid` flowchart                                      |
| Text-heavy overview  | < 15          | `grid` of `card` nodes with explicit flow                |
| Complex architecture | 15+           | Hybrid: small `mermaid` overview + detailed `grid` cards |

## Simple topology

- Use `mermaid` with `flowchart LR`.
- Keep TD only for 3–4 node linear flows.
- Label edges for protocols, data shapes, or ownership.
- Let the renderer handle edge routing.

## Text-heavy overview

- Use `grid` with `card` nodes for modules.
- Each card carries a description, key files, tools, or responsibilities.
- Add a `flow` node above or below when the sequence matters.
- Use `section` dividers to separate layers (e.g., client, service, data).

## Complex architecture

1. Lead with a small `mermaid` overview (5–8 nodes).
2. Follow with `grid` cards, one per module.
3. Cards show internals: key functions, new vs. modified, dependencies.
4. Never force 15+ elements into one diagram.

## C4-style diagrams

- Use `mermaid` `flowchart LR` with `subgraph` blocks.
- Represent persons, systems, databases, and boundaries as distinct node shapes.
- Label relationships with protocols or data contracts.

## Node selection

| Content                             | Node                   |
| ----------------------------------- | ---------------------- |
| Topology / connections              | `mermaid`              |
| Module descriptions                 | `card`                 |
| Layered layout                      | `grid` + `section`     |
| Runtime flow                        | `flow`                 |
| File/function lists inside a module | `file-tree` or `table` |
