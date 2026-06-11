---
title: Visual artifact renderer Plannotator interview
created: 2026-06-11
---

# Interview answers

## Outcome

**Design + implementation plan**

Produce a design walkthrough and a phased implementation plan in `ai-artifacts/goals/visual-artifact-renderer/`.

## Scope correction from Plannotator

The system should be generic. It should create visual artifacts for reports, docs, plans, dashboards, explainers, or similar pages.

It should not be report-specific.

## Tool name

**`create_visual_artifact`**

Chosen after Plannotator flagged `create_report` as too narrow.

## Route and storage

**`/artifacts/[slug]` and `src/artifacts/*.json`**

Chosen after renaming the tool to a generic visual artifact tool.

## Schema scope

**Curated visual artifact DSL**

Use a constrained JSON schema. Only known node types render. No arbitrary JSX, no arbitrary component passthrough.

## Initial component coverage

Selected groups:

- Basics
- Data views
- Navigation / organization

Interpretation:

- MVP adapters: `card`, `metric`, `heading`, `text`, `badge`, `button`, `separator`, `table`, `data-table`, `chart`, `tabs`, `accordion`, `grid`, `section`.
- The pasted component catalog is useful as future manifest inventory.
- Do **not** implement every component in MVP.

## Data model

**Embed data in artifact JSON**

An artifact is one portable file. Nodes can reference datasets inside the same spec.

## Tool surface

**`create_visual_artifact` only**

Validate slug/spec, write JSON, return URL. Add update/list/delete after the first renderer works.
