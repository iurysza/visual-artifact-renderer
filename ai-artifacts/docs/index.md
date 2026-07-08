# Visualizer MOC

> Map of content for Visualizer knowledge. Start with the question you have, then follow the links.

Visualizer is documented as a small knowledge base, not one giant manual. The [`README`](../../README.md) is the public landing page. This index is the map.

## Start here

If you are new to the project, read these in order:

1. [`README`](../../README.md) for what the tool does and the shortest path to a rendered artifact.
2. [`Product`](./PRODUCT.md) for the problem, users, and product stance.
3. [`Architecture`](../ARCHITECTURE.md) for the runtime boundaries between agent, CLI, storage, and renderer.
4. [`Semantic map`](../SEMANTIC_MAP.md) for domain language and filesystem contracts.
5. [`Agent onboarding`](../AGENT_ONBOARDING.md) for the maintainer handoff.

Agents should also read [`AGENTS.md`](../../AGENTS.md), which is the repo operating map.

## Task map

| If you need to | Read |
|---|---|
| install, run, or script the CLI | [`CLI`](./cli.md) |
| create or validate a spec | [`CLI`](./cli.md), then [`node reference`](./nodes.md) |
| understand comments or AI Colab | [`Annotations`](./annotations.md) |
| publish artifacts publicly | [`Publishing`](./publishing.md) |
| add or change node types | [`Node reference`](./nodes.md), [`frontend guide`](./FRONTEND.md), [`reliability`](./RELIABILITY.md) |
| change renderer routes, adapters, or theming | [`Frontend guide`](./FRONTEND.md), [`design`](./DESIGN.md) |
| verify a change before shipping | [`Reliability`](./RELIABILITY.md) |
| cut a release | [`Release`](./RELEASE.md), then [`publishing`](./publishing.md) |
| understand why the product is constrained | [`Core beliefs`](./CORE_BELIEFS.md), [`product`](./PRODUCT.md) |

## Core maps

[`Core beliefs`](./CORE_BELIEFS.md) defines the non-negotiables: JSON, not arbitrary UI code; validation at boundaries; renderer-owned quality.

[`Product`](./PRODUCT.md) explains who Visualizer is for and why constrained generative UI is the product shape.

[`Architecture`](../ARCHITECTURE.md) is the system map. Use it when you need runtime flow, storage, URL contracts, or change hotspots.

[`Semantic map`](../SEMANTIC_MAP.md) gives the vocabulary: artifact, bundle, contract, node, adapter, annotation, and publish profile.

## Working docs

[`CLI`](./cli.md) covers install, commands, runtime paths, server roles, configuration, and contract inspection.

[`Annotations`](./annotations.md) covers persistent comments, AI Colab, local writes, hosted writes, authors, and sharing.

[`Publishing`](./publishing.md) covers Cloudflare setup, Worker deploy, `--publish`, GitHub Actions, hosted comments, and publishing environment variables.

[`Frontend guide`](./FRONTEND.md) covers Next.js routes, render flow, annotation components, AI Colab components, theming, path helpers, and adding node types.

[`Reliability`](./RELIABILITY.md) lists the checks to run for schema, renderer, CLI, theme, Mermaid, and docs-only changes.

[`Design`](./DESIGN.md) records the visual system and node philosophy. Deep dives live under [`design docs`](./design-docs/index.md).

[`Product specs`](./product-specs/index.md) preserve user-journey and node-catalog rationale.

[`Node reference`](./nodes.md) is the public component catalog. It should match `visual-artifact contract`.

## Current facts

- Source renderer lives under `app/`, not repo root.
- CLI lives under `cli/` and is the runtime boundary for create, validate, serve, and publish.
- Default artifact storage is `<skill-root>/artifacts/<project>/<slug>/artifact.json`.
- Public pages are under `/artifacts`; public JSON is under `/artifacts/data/artifacts`.
- The contract source of truth is `shared/src/contract.ts`; `pnpm export:contract` writes `cli/assets/contract.json` for docs and tooling. Inspect it with `visual-artifact contract`.

## Verification quick map

| Check | Command |
|---|---|
| Contract sync | `cd app && pnpm export:contract && pnpm verify:artifacts` |
| Renderer build | `cd app && pnpm build` |
| CLI build | `cd cli && bun run typecheck && bun run build` |
| Node count | `visual-artifact contract` |
| Docs-only sanity | `git diff --check` and link check |

When updating docs, update this index if paths, commands, storage, or architecture responsibilities change.
