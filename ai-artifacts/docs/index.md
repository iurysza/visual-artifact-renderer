# Docs Index

> System of record for Visualizer knowledge. `AGENTS.md` is the map; this is the shelf.

## Start here

- [`README.md`](../../README.md) — user-facing problem, setup, CLI, and data flow.
- [`AGENTS.md`](../../AGENTS.md) — agent map and repo conventions.
- [`AGENT_ONBOARDING.md`](../AGENT_ONBOARDING.md) — hands-on maintainer handoff.
- [`ARCHITECTURE.md`](../ARCHITECTURE.md) — component responsibilities and runtime flows.
- [`SEMANTIC_MAP.md`](../SEMANTIC_MAP.md) — domain concepts and boundaries.

## Catalog

| Doc | Purpose | Primary source |
|---|---|---|
| [`CORE_BELIEFS.md`](./CORE_BELIEFS.md) | Non-negotiable product/engineering principles. | schema, CLI, renderer |
| [`PRODUCT.md`](./PRODUCT.md) | Problem, users, product purpose, brand stance. | README, skill, renderer |
| [`DESIGN.md`](./DESIGN.md) | Visual design system and node philosophy. | `app/src/app/globals.css`, manifest |
| [`FRONTEND.md`](./FRONTEND.md) | Next.js renderer, routes, adapters, theming. | `app/src/*` |
| [`RELIABILITY.md`](./RELIABILITY.md) | Validation and verification commands. | app/CLI scripts |
| [`design-docs/`](./design-docs/index.md) | Deep-dives on nodes, themes, diagrams. | schema, adapters, CSS |
| [`product-specs/`](./product-specs/index.md) | User journey and node catalog rationale. | README, contract, skill |
| [`references/`](./references/) | LLM-facing extracts and historical notes. | contract, scripts |
| [`../../ai-artifacts/docs/nodes.md`](../../ai-artifacts/docs/nodes.md) | Public node reference and composition patterns. | `visual-artifact contract` / `cli/assets/contract.json` |

## Current architecture facts

- Source renderer lives under `app/`, not repo root.
- CLI lives under `cli/` and is the runtime boundary for create/validate/serve.
- Default artifact storage is `<skill-root>/artifacts/<project>/<slug>.json`.
- Public pages are under `/artifacts`; public JSON is under `/artifacts/data/artifacts`.
- The contract source of truth is `shared/src/contract.ts`; `pnpm export:contract` writes `cli/assets/contract.json` for docs/tooling. Inspect it with `visual-artifact contract`.

## Verification status

| Check | How to verify | Status |
|---|---|---|
| Contract sync | `cd app && pnpm export:contract && pnpm verify:artifacts` | current command |
| Renderer build | `cd app && pnpm build` | current command |
| CLI build | `cd cli && bun run typecheck && bun run build` | current command |
| Node count | `visual-artifact contract` (or `jq '.["nodeTypes"] | length' cli/assets/contract.json`) | 30+ |

When updating docs, update this index if paths, commands, storage, or architecture responsibilities change.
