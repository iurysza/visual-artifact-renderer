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
| Node type reference | [`ai-artifacts/docs/nodes.md`](./ai-artifacts/docs/nodes.md) |

## Core principles

1. **JSON, not code.** The agent surface is the exported contract. Run `visual-artifact contract` to see it. Never generate React, routes, JSX, imports, CSS, or full HTML for the renderer.
2. **The contract is the handshake.** `shared/src/contract.ts` is the shared source of truth; `app/src/lib/contract/artifact-schema.ts` + `app/src/lib/contract/artifact-manifest.ts` consume it and `pnpm export:contract` writes `cli/assets/contract.json`. Run `pnpm export:contract` after schema or manifest changes.
3. **Validate at boundaries.** CLI/Pi tool validates before writing; renderer parses with Zod before rendering.
4. **Single sources of truth.** URL/path math lives in `app/src/lib/artifacts/paths.ts`. Default artifact storage is `<project-root>/artifacts/<project>/<slug>.json` (or `<skill-root>/artifacts/...` when installed).
5. **Small, well-named files.** Prefer scoped adapter files over monolithic registries.
6. **Types are documentation.** Push semantic meaning into names. Use Zod to make illegal specs unrepresentable.

## Before committing renderer/schema changes

```bash
cd app
pnpm lint
pnpm export:contract
pnpm verify:artifacts
pnpm build
```

Run `pnpm visual:qa` if you touched adapters or styling.

## Fast dev environment

### Server roles

| Port | Server | When to use |
|---|---|---|
| `:9999` | `pnpm dev` (Next dev, HMR) | **Default dev server.** Editing renderer code, live mode, viewing artifacts with the latest source. |
| `:9998` | `visual-artifact serve` (CLI static server) | **Static-export preview** of the built `out/`, and what `create` auto-starts to open a created artifact. |
| `:8400` | Impeccable live helper | Live-mode control plane (bar + `/poll`). Independent of the app server. |

`pnpm dev` and `visual-artifact serve` used to share `:9999` and collide. They are now split: dev/HMR on `:9999`, static preview on `:9998`. Live mode needs HMR, so it always targets `:9999` (`pnpm dev`).

```bash
cd app
pnpm dev          # http://localhost:9999/artifacts  (dev + HMR + live mode)

cd ../cli
bun run src/main.ts serve --no-open  # http://localhost:9998/artifacts  (static preview + live JSON)
```

The CLI is self-contained under `cli/`. `visual-artifact bootstrap` builds `app/`, compiles the CLI, and symlinks the binary into `~/.pi/bin/`.

## After landing new features

New components, schema changes, or CLI behavior changes need to be rebuilt and reinstalled before the Pi extension and CLI reflect them. After the build checks pass, prompt the user to run:

```bash
cd app
pnpm lint
pnpm export:contract
pnpm verify:artifacts
pnpm build
cd ..
visual-artifact bootstrap
```

Then tell them to run `/reload` in Pi or restart Pi to load the updated extension.

## Live visual iteration with Impeccable

Use the Impeccable `live` command to iterate on UI in the browser. The helper runs in the background and injects a global bar into the page so the user can pick an element, request a design action, and get generated variants without leaving the browser.

### When to use

Use live mode only when the user wants to iterate on the renderer **in the browser** — pick a specific element they are looking at, request a design action, and get generated variants without leaving the page.

Trigger it on phrases like:
- "live iterate on this UI" / "use live mode" / "let me pick an element and redesign it"
- "make *this* bolder/better/quieter" (pointing at an element they can see but will not describe in text)
- "shape this element" / "redesign the thing I'm clicking"

Do **not** use it for:
- Static design critiques or audits → regular Impeccable skill.
- Building new UI from scratch or reshaping whole pages → Impeccable skill, not live.
- Backend or non-UI work.

**Hard precondition:** this workflow is herdr-based. Only run it when `HERDR_ENV=1`. If you are not inside herdr, do not fake it with tmux — tell the user to launch it from a herdr pane, or fall back to the non-live Impeccable flow.

### Critical rule

**The agent must be actively polling before the user clicks Go.** The browser queues events on the helper server; if no agent pulls them, the spinner spins forever. Start `live-poll.mjs` first, tell the user "ready", and only then let them use the bar.

### Start a live session

Run inside herdr (`HERDR_ENV=1`). Each long-running process gets its own split pane so you can keep your pane free and monitor siblings via `herdr pane read` / `herdr wait output`. Pane ids compact when panes close, so re-read them from `herdr pane list` or the split response — don't reuse stale ids.

0. Find your focused pane:
   ```bash
   MY_PANE=$(herdr pane list | python3 -c 'import sys,json; ps=json.load(sys.stdin)["result"]["panes"]; print(next(p["pane_id"] for p in ps if p.get("focused")))')
   ```

1. Split a pane for the dev server, run it, and wait until it is ready:
   ```bash
   DEV_PANE=$(herdr pane split "$MY_PANE" --direction right --no-focus | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["pane"]["pane_id"])')
   herdr pane run "$DEV_PANE" "cd app && pnpm dev"
   herdr wait output "$DEV_PANE" --match "ready|Local:.*9999" --regex --timeout 30000
   ```

2. Split a pane for the Impeccable live helper, start it, and verify:
   ```bash
   LIVE_PANE=$(herdr pane split "$MY_PANE" --direction right --no-focus | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["pane"]["pane_id"])')
   herdr pane run "$LIVE_PANE" "node .pi/skills/impeccable/scripts/live-server.mjs start"
   herdr wait output "$LIVE_PANE" --match "ready|listening" --regex --timeout 15000
   node .pi/skills/impeccable/scripts/live-status.mjs
   curl -s http://localhost:9999/artifacts/ | rg 'http://localhost:8400/live\.js'
   ```

3. Open the site in Zen (or the user's browser of choice):
   ```bash
   open -a Zen 'http://localhost:9999/artifacts/'
   ```

4. Start the poll loop in its own pane and wait for it to confirm it is polling. **This must be running before the user clicks Go** — the browser queues events on the helper server and the spinner spins forever if no agent pulls them.
   ```bash
   POLL_PANE=$(herdr pane split "$MY_PANE" --direction down --no-focus | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["pane"]["pane_id"])')
   herdr pane run "$POLL_PANE" "node .pi/skills/impeccable/scripts/live-poll.mjs"
   herdr wait output "$POLL_PANE" --match "polling|ready|waiting" --regex --timeout 15000
   ```

5. Tell the user: "Live mode is ready. Pick an element and click Go."

### Cleanup

```bash
node .pi/skills/impeccable/scripts/live-server.mjs stop
herdr pane close "$LIVE_PANE"   # live-server
herdr pane close "$POLL_PANE"   # live-poll
# Leave $DEV_PANE running only if you want to keep the dev server up; otherwise close it too.
node .pi/skills/impeccable/scripts/live-inject.mjs --remove
```

Re-read pane ids with `herdr pane list` before closing if any split happened after you captured them — ids compact on close.

## Decision defaults

- **Adding a node type?** Follow [`ai-artifacts/docs/design-docs/node-design-principles.md`](./ai-artifacts/docs/design-docs/node-design-principles.md), then update schema, manifest, adapter, registry, and contract.
- **Changing paths?** Update `app/src/lib/artifacts/paths.ts` and check dev + CLI static-server modes.
- **Changing styles/theme?** Read [`ai-artifacts/docs/DESIGN.md`](./ai-artifacts/docs/DESIGN.md) and [`ai-artifacts/docs/design-docs/theme-system.md`](./ai-artifacts/docs/design-docs/theme-system.md).
- **Adding diagram logic?** Respect [`ai-artifacts/docs/design-docs/diagram-sandboxing.md`](./ai-artifacts/docs/design-docs/diagram-sandboxing.md) and test Mermaid separately.
- **Unsure where something belongs?** Read [`ai-artifacts/docs/index.md`](./ai-artifacts/docs/index.md) first.
