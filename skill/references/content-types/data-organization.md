---
description: "Organize structured evidence with tables, comparisons, and inventories."
date created: 2026-06-17
date modified: 2026-06-28
tags: ["visual-artifact", "tables", "comparisons", "data"]
---

# Data organization

Use tables and comparison nodes whenever information naturally has rows and columns.

## When to use

- feature comparisons
- config matrices
- API route inventories
- dependency lists
- status reports
- requirement audits
- evidence summaries

## Node selection

| Content | Node |
|---|---|
| Simple rows/columns | `table` |
| Richer evidence table | `data-table` |
| Feature/option comparison | `comparison-table` |
| Pass/fail/warning board | `status-grid` |
| Multi-level grouping | `accordion` containing tables |

## Spec guidance

- Put rows in `data` and reference them by `dataKey`.
- Use `columns` to control order and labels.
- Use `statusKey` on `comparison-table` and `status-grid` for chips.
- Keep cells compact; long prose belongs in `prose` or detail sections.

## Anti-patterns

- Bullet lists that should be tables.
- Wide prose paragraphs inside cells.
- Emoji-only status indicators.
- Tables that repeat the same sentence in every row.
