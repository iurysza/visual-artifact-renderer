---
description: "Build dashboards and metric summaries with constrained Visualizer nodes."
date created: 2026-06-28
date modified: 2026-06-28
tags: ["visual-artifact", "dashboard", "metrics", "status"]
---

# Dashboards & metrics

Use for KPI summaries, readiness boards, health overviews, and compact operational reports.

## Structure

1. Lead with one thesis sentence.
2. Show 3–4 `stat-card` tiles for the most important numbers.
3. Use `status-grid` for health/readiness/risk.
4. Use charts only when trend or proportion matters.
5. Put exact evidence in a table below.

## Node selection

| Content | Node |
|---|---|
| Hero number | `stat-card` |
| Inline metric | `metric` |
| Status board | `status-grid` |
| Trend | `chart` or `area-chart` |
| Proportion | `pie-chart` or `donut-chart` |
| Correlation | `scatter-chart` |
| Matrix/intensity | `heatmap` |
| Evidence | `data-table` or `comparison-table` |

## Anti-patterns

- Too many equally weighted cards.
- Charts without a decision or comparison to support.
- Status labels longer than a couple words.
- Dashboard metrics about the artifact itself instead of the user's topic.
