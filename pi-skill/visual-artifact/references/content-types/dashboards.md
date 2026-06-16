---
description: "Build dashboards and metric overviews: KPI cards, status grids, and supporting tables."
date created: 2026-06-17
date modified: 2026-06-17
tags: ["visual-artifact", "dashboard", "metrics", "kpi"]
---

# Dashboards & metrics

Use for health overviews, status boards, KPI snapshots, and progress trackers.

## Layout principles

- Hero numbers dominate the top of the artifact.
- Supporting metrics sit below in a denser grid.
- Statuses belong in a `status-grid` with chips.
- Trends and deltas appear next to numbers, not as separate prose.

## Primary nodes

| Purpose | Node |
|---|---|
| Hero metric | `stat-card` with large value + caption |
| Group of related metrics | `grid` of `stat-card` |
| Pass/fail/warning states | `status-grid` |
| Detailed evidence | `table` or `data-table` |
| Segmentation | `tabs` or `grid` sections |

## Information hierarchy

1. **Lead number** — the one metric that answers the user's question.
2. **Supporting KPIs** — 2–4 numbers that give context.
3. **Status board** — what's healthy, degraded, or blocked.
4. **Drill-down tables** — raw evidence for anyone who wants it.

## Common anti-patterns

- Equal weight for every metric.
- Emoji status indicators.
- Dashboards that are only counts with no comparison or target.
- Hiding the most important number behind a scroll.
