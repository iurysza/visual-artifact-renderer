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
| [`DESIGN.md`](./DESIGN.md) | Visual design system and node philosophy. | `skill/app/src/app/globals.css`, manifest |
| [`FRONTEND.md`](./FRONTEND.md) | Next.js renderer, routes, adapters, theming. | `skill/app/src/*` |
| [`RELIABILITY.md`](./RELIABILITY.md) | Validation and verification commands. | app/CLI scripts |
| [`design-docs/`](./design-docs/index.md) | Deep-dives on nodes, themes, diagrams. | schema, adapters, CSS |
| [`product-specs/`](./product-specs/index.md) | User journey and node catalog rationale. | README, contract, skill |
| [`references/`](./references/) | LLM-facing extracts and historical notes. | contract, scripts |
| [`../../docs/nodes.md`](../../docs/nodes.md) | Public node reference and composition patterns. | `skill/artifact-contract.json` |

## Current architecture facts

- Source renderer lives under `skill/app`, not repo root.
- CLI lives under `skill/cli` and is the runtime boundary for create/validate/serve.
- Default artifact storage is `<skill-root>/artifacts/<project>/<slug>.json`.
- Public pages are under `/artifacts`; public JSON is under `/artifacts/data/artifacts`.
- The contract is `skill/artifact-contract.json`, generated from schema + manifest.

## Verification status

| Check | How to verify | Status |
|---|---|---|
| Contract sync | `cd skill/app && pnpm export:contract && pnpm verify:artifacts` | current command |
| Renderer build | `cd skill/app && pnpm build` | current command |
| CLI build | `cd skill/cli && bun run typecheck && bun run build` | current command |
| Node count | `jq '.["nodeTypes"] | length' skill/artifact-contract.json` | 36 |

When updating docs, update this index if paths, commands, storage, or architecture responsibilities change.
