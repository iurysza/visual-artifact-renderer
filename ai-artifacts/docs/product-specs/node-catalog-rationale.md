# Node Catalog Rationale

> Why Visualizer has 36 nodes and how they are grouped.

## Groups

| Group | Nodes | Purpose |
|---|---|---|
| Narrative | `heading`, `text`, `prose`, `card`, `section`, `separator` | Structure the page and tell the story. |
| Inline | `badge`, `button`, `metric`, `stat-card` | Compact facts and actions. |
| Data | `table`, `data-table`, `comparison-table`, `chart`, `status-grid` | Present structured data. |
| Charts | `pie-chart`, `donut-chart`, `area-chart`, `radar-chart`, `scatter-chart`, `heatmap` | Specific chart types with dedicated props. |
| Diagrams | `mermaid`, `svg-diagram`, `flow` | Architecture, sequence, topology. |
| Code | `code-block`, `diff`, `file-tree`, `log` | Developer-facing content. |
| Layout | `grid`, `tabs`, `accordion` | Composition without custom CSS. |
| Other | `alert`, `image`, `timeline`, `stepper`, `definition-list` | Specialized callouts and sequences. |

## Rationale

The catalog is small enough to keep the contract manageable, but diverse enough to cover reports, dashboards, architecture briefs, runbooks, and explainers. New nodes are added only when an existing node cannot express the concept safely.

## Reference

Full node reference: [`docs/nodes.md`](../../../docs/nodes.md).
