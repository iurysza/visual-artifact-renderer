# Docs Index

> System of record for Visualizer knowledge. AGENTS.md is the map; this is the shelf.

## How to use these docs

- Start with [`AGENTS.md`](../AGENTS.md) for orientation.
- Read [`CORE_BELIEFS.md`](./CORE_BELIEFS.md) before making architectural decisions.
- Look up domain concepts in [`SEMANTIC_MAP.md`](../SEMANTIC_MAP.md).
- Check [`ARCHITECTURE.md`](../ARCHITECTURE.md) for component responsibilities and tradeoffs.
- Use [`AGENT_ONBOARDING.md`](../AGENT_ONBOARDING.md) for hands-on tasks and gotchas.

## Catalog

| Doc | Purpose | Verified against |
|---|---|---|
| [`CORE_BELIEFS.md`](./CORE_BELIEFS.md) | Agent-first operating principles | source code, agent-md-creation.md |
| [`DESIGN.md`](./DESIGN.md) | Visual design system and node philosophy | globals.css, components.json, manifest |
| [`FRONTEND.md`](./FRONTEND.md) | Next.js renderer, adapters, theming | src/app, src/components, src/lib |
| [`RELIABILITY.md`](./RELIABILITY.md) | Tests, validation, verification | package.json, scripts/ |
| [`design-docs/`](./design-docs/index.md) | Deep-dives on nodes, themes, diagrams | schema, adapters |
| [`product-specs/`](./product-specs/index.md) | Product rationale and user journey | README, extension, skill |
| [`references/`](./references/) | LLM-facing extracts (contract, pipeline, proxy) | artifact-contract.json, scripts/ |

## Verification status

| Check | How to verify | Last known |
|---|---|---|
| Cross-links work | `rg "\.\./"` + manual spot checks | pending |
| Claims match code | `pnpm verify:artifacts`, `pnpm lint`, `pnpm build` | pending |
| No stale node counts | `src/lib/artifact-manifest.ts` | pending |

When you update a doc, update this index if the catalog or status changes.
