---
title: Visual artifact renderer Plannotator interview
created: 2026-06-11
updated: 2026-06-12
---

# Interview answers

## Outcome

**Design + implementation plan**

Produce a design walkthrough and a phased implementation plan in `ai-artifacts/goals/visual-artifact-renderer/`.

## Scope correction from Plannotator

The system should be generic. It should create visual artifacts for reports, docs, plans, dashboards, explainers, or similar pages.

It should not be report-specific.

## Current summary

Visualizer is a local web app plus Pi extension for turning AI-generated JSON into polished visual pages. The LLM chooses from a supported node manifest, embeds any needed data, calls `create_visual_artifact`, and gets a local URL.

The important constraint: the LLM never writes React, routes, JSX, imports, or CSS. It emits a constrained artifact spec; the extension validates it, saves it under `~/.pi/artifacts/<project>/<slug>.json`, and the Next renderer maps each node to trusted UI adapters.

## Tool name

**`create_visual_artifact`**

Chosen after Plannotator flagged `create_report` as too narrow.

## Route and storage

**Current:** `/artifacts/[project]/[slug]` and `~/.pi/artifacts/<project>/<slug>.json`

The original interview picked `/artifacts/[slug]` and `src/artifacts/*.json`. That was right for the first local MVP, but the implemented shape moved artifacts into Pi's global artifact directory so any session can create pages without mutating this repo.

## Schema scope

**Curated visual artifact DSL**

Use a constrained JSON schema. Only known node types render. No arbitrary JSX, no arbitrary imports, no arbitrary component passthrough.

## Current component coverage

Supported nodes:

```txt
heading, text, card, metric, stat-card, badge, button, separator,
table, data-table, comparison-table, chart, mermaid, svg-diagram,
flow, timeline, code-block, status-grid, grid, section, tabs, accordion
```

The component catalog is useful only when represented in the manifest. Unsupported components should not leak into prompts.

## Data model

**Embed data in artifact JSON**

An artifact is one portable file. Nodes reference datasets inside the same spec through `dataKey`.

## Tool surface

**`create_visual_artifact` only**

Validate slug/spec, write JSON, return URL. Add update/list/delete only after create-and-render remains boring.
