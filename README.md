# Visualizer

Visualizer turns JSON into polished, shareable pages — reports, dashboards, architecture briefs, runbooks, and explainers. Agents describe what they want with a constrained spec; the renderer maps each node to a trusted UI adapter.

The key constraint: **agents emit JSON, never React, routes, JSX, imports, or CSS.** That containment gives agents rich output without arbitrary code.

[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

- **JSON-first**: specs, not source code
- **36 node types**: stat cards, tables, charts, mermaid diagrams, timelines, status grids, and more
- **Local-first**: artifacts live in `~/.pi/artifacts` and run on your machine
- **Instant sharing**: built-in Tailscale support for tailnet URLs
- **Static + live**: build once, then load new artifacts without rebuilding

![Visualizer home in light and dark mode](./assets/home-light.png)

## Install

From the repo root:

```bash
./install.sh
```

This installs the Pi skill, extension, runtime wrappers, and dependencies.

Requirements: Node.js 20+, pnpm, macOS/Linux/Windows, and the Pi coding agent.

## Quick start

Run the renderer:

```bash
pnpm dev
```

Open `http://localhost:9999/artifacts/`.

Create an artifact:

```bash
export PATH="$HOME/.pi/bin:$PATH"
vaz-serve
```

Then ask your agent to call:

```text
create_visual_artifact with title "Q2 Revenue", slug "q2-revenue", and a few stat-card nodes.
```

The tool writes `~/.pi/artifacts/<project>/<slug>.json` and returns:

```txt
http://localhost:9999/artifacts/my-project/q2-revenue/
```

For repo overviews or architecture diagrams, use the pipeline:

```bash
vaz-pipeline /path/to/repo [slug]
```

It writes `visual-artifact-spec.json` under `<repoRoot>/ai-artifacts/generated/<slug>/`. Read it and call `create_visual_artifact` with its payload. See [`pi-skill/visual-artifact/SKILL.md`](./pi-skill/visual-artifact/SKILL.md) for routing details.

## How it works

```txt
LLM reads artifact-contract.json
  → calls create_visual_artifact(JSON)
  → Pi extension validates the spec
  → writes ~/.pi/artifacts/<project>/<slug>.json
  → /artifacts/<project>/<slug>/ renders the spec
  → VisualArtifactRenderer maps nodes to UI adapters
```

## Supported nodes

Visualizer ships 36 node types. See the full reference in [`docs/nodes.md`](./docs/nodes.md).

Highlights:

- **Dashboard tiles**: `stat-card`, `metric`, `status-grid`
- **Data**: `table`, `data-table`, `comparison-table`, `chart`, `heatmap`
- **Diagrams**: `mermaid`, `svg-diagram`, `flow`
- **Narrative**: `heading`, `text`, `prose`, `card`, `section`, `tabs`, `accordion`
- **Code**: `code-block`, `diff`, `file-tree`
- **Other**: `alert`, `badge`, `button`, `image`, `log`, `pie-chart`, `donut-chart`, `area-chart`, `radar-chart`, `scatter-chart`, `stepper`, `timeline`, `separator`

## Running locally

### Dev server

```bash
pnpm dev
```

Runs on `http://localhost:9999/artifacts/`. All routes use `basePath: "/artifacts"`.

### Static export + live server

```bash
pnpm build
pnpm serve
```

The server binds to `127.0.0.1:9999` by default and serves the built `out/` directory under `/artifacts/`. Artifact JSON loads live from `~/.pi/artifacts/`, so new artifacts appear without rebuilding.

### Tailscale Serve

Expose the same path on your tailnet:

```bash
vaz-tailscale setup
```

Or manually:

```bash
tailscale serve --yes --bg --https 443 --set-path /artifacts/ http://127.0.0.1:9999/artifacts
```

Open the tailnet URL from:

```bash
vaz-tailscale url <project> <slug>
```

To return tailnet URLs by default:

```bash
export VISUAL_ARTIFACT_BASE_URL="$(vaz-tailscale url)"
```

## Advanced

### Wrapper commands

After `./install.sh`, add `~/.pi/bin` to your PATH:

- `vaz-doctor` — verify runtime, deps, wrappers, tools, and renderer health
- `vaz-serve` — start the renderer on `http://localhost:9999/artifacts/` if not running
- `vaz-status` — check renderer status, returns JSON
- `vaz-pipeline <repoRoot> [slug]` — run the codebase extraction + assembly pipeline
- `vaz-tailscale url [project] [slug]` — return the shareable tailnet URL
- `vaz-tailscale setup` — configure Tailscale Serve proxy

### Environment variables

```bash
VISUALIZER_PORT=9999
VISUALIZER_HOST=127.0.0.1
VISUALIZER_OUT_DIR=./out
VISUALIZER_ARTIFACTS_DIR=~/.pi/artifacts
VISUALIZER_MOUNT_PATH=/artifacts
VISUALIZER_OPEN=1
VISUAL_ARTIFACT_BASE_URL=http://localhost:9999/artifacts
VISUALIZER_CONTRACT_PATH=/path/to/visualizer
```

## Verify & QA

```bash
pnpm lint
pnpm export:contract
pnpm test:contract
pnpm verify:artifacts
pnpm build
```

Visual QA (requires a running dev server):

```bash
pnpm visual:qa
```

Health check (requires a running server):

```bash
pnpm health-check
```

## Examples

Sample artifacts from this repo:

```txt
http://localhost:9999/artifacts/visualizer/revenue-dashboard/
http://localhost:9999/artifacts/visualizer/implementation-plan/
http://localhost:9999/artifacts/visualizer/agent-stack-report/
```

For copyable JSON patterns, see [`docs/nodes.md`](./docs/nodes.md).

## Contributing

For the engineering handoff — repo map, architecture, common tasks, and pitfalls — read [`ai-artifacts/AGENT_ONBOARDING.md`](./ai-artifacts/AGENT_ONBOARDING.md).

For model-facing usage, read [`pi-skill/visual-artifact/SKILL.md`](./pi-skill/visual-artifact/SKILL.md).

## License

[MIT](LICENSE)
