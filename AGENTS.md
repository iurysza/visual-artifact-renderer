# AGENTS.md — Visualizer

> Map, not manual. Start here, then follow pointers. Keep this file short so the task stays in context.

Visualizer is a **JSON-to-UI runtime**: agents emit a constrained artifact spec, the Pi extension delegates validation/storage to the CLI, and a Next.js renderer maps each node to a trusted adapter. The LLM never writes React, routes, JSX, imports, CSS, or full HTML for the renderer.

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
| User-facing setup and usage | [`README.md`](./README.md) |
| Model-facing routing and tool usage | [`skill/SKILL.md`](./skill/SKILL.md) |
| Node type reference | [`docs/nodes.md`](./docs/nodes.md) |

## Core principles

1. **JSON, not code.** The agent surface is the exported contract. Run `visual-artifact contract` to see it. Never generate React, routes, JSX, imports, CSS, or full HTML for the renderer.
2. **The contract is the handshake.** `skill/app/src/lib/artifact-schema.ts` + `skill/app/src/lib/artifact-manifest.ts` → `skill/artifact-contract.json`. Run `pnpm export:contract` after schema or manifest changes.
3. **Validate at boundaries.** CLI/Pi tool validates before writing; renderer parses with Zod before rendering.
4. **Single sources of truth.** URL/path math lives in `skill/app/src/lib/paths.ts`. Default artifact storage is `<skill-root>/artifacts/<project>/<slug>.json`.
5. **Small, well-named files.** Prefer scoped adapter files over monolithic registries.
6. **Types are documentation.** Push semantic meaning into names. Use Zod to make illegal specs unrepresentable.

## Before committing renderer/schema changes

```bash
cd skill/app
pnpm lint
pnpm export:contract
pnpm verify:artifacts
pnpm build
```

Run `pnpm visual:qa` if you touched adapters or styling.

## Fast dev environment

```bash
cd skill/app
pnpm dev          # http://localhost:9999/artifacts

cd ../cli
bun run src/main.ts serve --no-open  # static export + live JSON after pnpm build
```

The CLI is self-contained under `skill/cli`. `visual-artifact bootstrap` builds `skill/app`, compiles the CLI, and symlinks the binary into `~/.pi/bin/`.

## Live visual iteration with Impeccable

Use the Impeccable `live` command to iterate on UI in the browser. The helper runs in the background and injects a global bar into the page so the user can pick an element, request a design action, and get generated variants without leaving the browser.

### Critical rule

**The agent must be actively polling before the user clicks Go.** The browser queues events on the helper server; if no agent pulls them, the spinner spins forever. Start `live-poll.mjs` first, tell the user "ready", and only then let them use the bar.

### Start a live session

1. Ensure the dev server is running:
   ```bash
   tmux new-session -d -s visualizer-dev 'cd skill/app && pnpm dev'
   ```
2. Start the Impeccable live helper in the background:
   ```bash
   tmux new-session -d -s live-server 'node .pi/skills/impeccable/scripts/live-server.mjs start'
   ```
3. Verify it is running:
   ```bash
   node .pi/skills/impeccable/scripts/live-status.mjs
   curl -s http://localhost:9999/artifacts/ | rg 'http://localhost:8400/live\.js'
   ```
4. Open the site in Zen (or the user's browser of choice):
   ```bash
   open -a Zen 'http://localhost:9999/artifacts/'
   ```
5. **Run the poll loop in the foreground** and keep it running:
   ```bash
   node .pi/skills/impeccable/scripts/live-poll.mjs
   ```
6. Tell the user: "Live mode is ready. Pick an element and click Go."

### Cleanup

```bash
node .pi/skills/impeccable/scripts/live-server.mjs stop
tmux kill-session -t live-server
node .pi/skills/impeccable/scripts/live-inject.mjs --remove
```

## Decision defaults

- **Adding a node type?** Follow [`ai-artifacts/docs/design-docs/node-design-principles.md`](./ai-artifacts/docs/design-docs/node-design-principles.md), then update schema, manifest, adapter, registry, and contract.
- **Changing paths?** Update `skill/app/src/lib/paths.ts` and check dev + CLI static-server modes.
- **Changing styles/theme?** Read [`ai-artifacts/docs/DESIGN.md`](./ai-artifacts/docs/DESIGN.md) and [`ai-artifacts/docs/design-docs/theme-system.md`](./ai-artifacts/docs/design-docs/theme-system.md).
- **Adding diagram logic?** Respect [`ai-artifacts/docs/design-docs/diagram-sandboxing.md`](./ai-artifacts/docs/design-docs/diagram-sandboxing.md) and test Mermaid separately.
- **Unsure where something belongs?** Read [`ai-artifacts/docs/index.md`](./ai-artifacts/docs/index.md) first.
