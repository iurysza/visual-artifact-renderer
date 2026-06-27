---
description: "Organize structured evidence with tables, comparisons, and inventories."
date created: 2026-06-17
date modified: 2026-06-17
tags: ["visual-artifact", "tables", "comparisons", "data"]
---

# Data organization

Use tables, comparisons, and inventories whenever information has rows and columns. Tables are the default for structured evidence.

## When to use a table

- Feature comparisons
- Configuration matrices
- API route inventories
- Dependency lists
- Status reports
- Requirement audits

## Node selection

| Content | Node |
|---|---|
| Simple rows/columns | `table` |
| Sortable, filterable evidence | `data-table` |
| Feature or option comparison | `comparison-table` |
| Pass/fail/warning grid | `status-grid` |
| Multi-level grouping | `accordion` of tables |

## Table design at the spec level

- Sticky headers for long tables.
- First column sticky when horizontal scrolling is likely.
- Right-align numbers; use `tabular-nums`.
- Status values as chips via `statusKey`.
- Keep rows scannable: one idea per cell, code references inline.

## Comparison tables

- Use `comparison-table` with `statusKey` for pass/fail/partial states.
- Lead with the criterion, then one column per option.
- Avoid turning prose into wide paragraphs inside cells.

## Anti-patterns

- Bullet lists that should be tables.
- Truncated text in cells.
- Tables wider than the viewport without horizontal scroll.
- Emoji-only status indicators.
