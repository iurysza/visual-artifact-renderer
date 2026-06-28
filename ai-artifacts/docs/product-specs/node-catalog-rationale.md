# Node Catalog Rationale

> Why Visualizer has 36 nodes and how they are grouped.

## Groups

| Group | Nodes | Purpose |
|---|---|---|
| Narrative | `heading`, `text`, `prose`, `card`, `section`, `separator`, `alert` | Structure the story and call out important context. |
| Inline facts/actions | `badge`, `button`, `metric`, `stat-card` | Compact facts, status, and links. |
| Data | `table`, `data-table`, `comparison-table`, `status-grid` | Structured evidence and status boards. |
| Charts | `chart`, `pie-chart`, `donut-chart`, `area-chart`, `radar-chart`, `scatter-chart`, `heatmap` | Quantitative views with constrained props. |
| Diagrams/flows | `mermaid`, `svg-diagram`, `flow` | Architecture, sequence, topology, and handoff maps. |
| Code/dev content | `code-block`, `diff`, `file-tree`, `log` | Developer-facing evidence and examples. |
| Sequencing | `timeline`, `stepper` | Phases, runbooks, progress, and lifecycle states. |
| Layout/disclosure | `grid`, `tabs`, `accordion` | Composition and secondary detail without custom CSS. |
| Reference | `definition-list`, `image` | Glossaries and visual assets. |

## Rationale

The catalog is small enough to keep the contract learnable and validateable, but broad enough for reports, dashboards, architecture briefs, runbooks, and explainers.

New nodes should be added only when composition cannot express the concept safely. The goal is not to recreate HTML. The goal is to give agents semantic building blocks that render consistently.

## Reference

- Public reference: [`docs/nodes.md`](../../../docs/nodes.md)
- Contract: [`skill/artifact-contract.json`](../../../skill/artifact-contract.json)
- Source manifest: [`skill/app/src/lib/artifact-manifest.ts`](../../../skill/app/src/lib/artifact-manifest.ts)
