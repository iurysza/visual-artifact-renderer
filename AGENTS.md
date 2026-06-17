# AGENTS.md — Visualizer

> Map, not manual. Start here, then follow pointers. Keep this file short so the task stays in context.

Visualizer is a **JSON-to-UI runtime**: agents emit a constrained artifact spec, the Pi extension validates and writes it, and a Next.js renderer maps each node to a trusted adapter. The LLM never writes React, routes, JSX, imports, or CSS.

## Where knowledge lives

| Need | Read |
|---|---|
| Map of all docs | [`ai-artifacts/docs/index.md`](./ai-artifacts/docs/index.md) |
| Agent-first principles | [`ai-artifacts/docs/CORE_BELIEFS.md`](./ai-artifacts/docs/CORE_BELIEFS.md) |
| Senior-engineer handoff | [`ai-artifacts/AGENT_ONBOARDING.md`](./ai-artifacts/AGENT_ONBOARDING.md) |
| System architecture and tradeoffs | [`ai-artifacts/ARCHITECTURE.md`](./ai-artifacts/ARCHITECTURE.md) |
| Domain concepts, layers, data flow | [`ai-artifacts/SEMANTIC_MAP.md`](./ai-artifacts/SEMANTIC_MAP.md) |
| Design system and node philosophy | [`ai-artifacts/docs/DESIGN.md`](./ai-artifacts/docs/DESIGN.md) |
| Frontend/renderer guide | [`ai-artifacts/docs/FRONTEND.md`](./ai-artifacts/docs/FRONTEND.md) |
| Testing and verification | [`ai-artifacts/docs/RELIABILITY.md`](./ai-artifacts/docs/RELIABILITY.md) |
| Why this knowledge layout exists | [`ai-artifacts/agent-md-creation.md`](./ai-artifacts/agent-md-creation.md) |
| User-facing setup and usage | [`README.md`](./README.md) |
| Model-facing routing and tool usage | [`pi-skill/visual-artifact/SKILL.md`](./pi-skill/visual-artifact/SKILL.md) |
| Node type reference | [`docs/nodes.md`](./docs/nodes.md) |

## Core principles

1. **JSON, not code.** The agent surface is `artifact-contract.json`. Never generate React, routes, JSX, imports, or CSS for the renderer.
2. **The contract is the handshake.** `src/lib/artifact-schema.ts` + `src/lib/artifact-manifest.ts` → `artifact-contract.json`. Run `pnpm export:contract` after any schema or manifest change.
3. **Validate at boundaries.** The Pi extension validates specs before writing; the renderer parses with Zod before rendering. Parse, don't shotgun-validate.
4. **Single sources of truth.** Paths live in `src/lib/paths.ts`. Artifact storage is `~/.pi/artifacts/<project>/<slug>.json`. Project names are derived, not chosen.
5. **Small, well-named files.** Prefer scoped adapter files over monolithic registries. A path should telegraph its purpose.
6. **Types are documentation.** Push semantic meaning into names. Use Zod to make illegal specs unrepresentable.

## Before committing renderer/schema changes

```bash
pnpm lint
pnpm export:contract
pnpm test:contract
pnpm verify:artifacts
pnpm build
```

Run `pnpm visual:qa` if you touched adapters or styling.

## Fast dev environment

```bash
pnpm dev          # http://localhost:9999/artifacts
pnpm serve        # static export + live JSON
```

The pipeline and skill are global-install friendly; `./install.sh` syncs wrappers, extension, and skill.

## Decision defaults

- **Adding a node type?** Follow [`ai-artifacts/docs/design-docs/node-design-principles.md`](./ai-artifacts/docs/design-docs/node-design-principles.md), then update schema, manifest, adapter, registry, and contract.
- **Changing paths?** Update `src/lib/paths.ts` and check both dev and static-server modes.
- **Changing styles/theme?** Read [`ai-artifacts/docs/DESIGN.md`](./ai-artifacts/docs/DESIGN.md) and [`ai-artifacts/docs/design-docs/theme-system.md`](./ai-artifacts/docs/design-docs/theme-system.md).
- **Adding diagram logic?** Respect [`ai-artifacts/docs/design-docs/diagram-sandboxing.md`](./ai-artifacts/docs/design-docs/diagram-sandboxing.md) and test Mermaid separately.
- **Unsure where something belongs?** Read [`ai-artifacts/docs/index.md`](./ai-artifacts/docs/index.md) first.
