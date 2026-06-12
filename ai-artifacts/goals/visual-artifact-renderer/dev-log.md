---
title: Visual artifact renderer dev log
created: 2026-06-11
updated: 2026-06-12
---

# Dev log

## 2026-06-11

- Started Plannotator design flow.
- Confirmed goal: design + implementation plan.
- Initial draft used report-specific naming.
- Ran Plannotator gate on `ai-artifacts/goals/report-renderer/goal.md`.
- Plannotator feedback: `create_report` was too narrow; generic visual pages are the actual goal.
- Removed irrelevant MCP/shadcn runtime notes from the goal.
- User chose tool name: `create_visual_artifact`.
- User chose initial route/storage: `/artifacts/[slug]` and `src/artifacts/*.json`.
- User chose package slug: `visual-artifact-renderer`.
- Renamed goal package to `ai-artifacts/goals/visual-artifact-renderer/`.
- Scaffolded Next App Router app with TypeScript, Tailwind, and shadcn.
- Added curated visual artifact schema, loader, renderer, registry, manifest, and samples.
- Added Pi extension tool: `create_visual_artifact`.
- Verified with `pnpm verify:artifacts`, `pnpm lint`, `pnpm build`, and dev-server smoke tests.

## 2026-06-12

- Current storage moved from repo-local `src/artifacts` to global Pi storage: `~/.pi/artifacts/<project>/<slug>.json`.
- Current artifact URL shape is `/artifacts/<project>/<slug>`.
- Current app routes are `src/app/artifacts/[project]/page.tsx` and `src/app/artifacts/[project]/[slug]/page.tsx`.
- Home page now lists projects from `~/.pi/artifacts/`.
- Supported node set expanded to include `stat-card`, `comparison-table`, `mermaid`, `svg-diagram`, `flow`, `timeline`, `code-block`, and `status-grid`.
- Updated README and goal package docs to describe the current global renderer shape and the safer JSON-not-code mental model.
- Updated visual QA default URL to the project-scoped artifact route.
