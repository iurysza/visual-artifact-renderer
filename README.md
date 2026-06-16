# Visualizer

Data-driven visual artifacts for local reports, docs, plans, dashboards, and explainers.

Visualizer is a local JSON-to-UI runtime plus Pi extension. An agent emits a constrained artifact spec; the extension validates it, saves it under `~/.pi/artifacts/<project>/<slug>.json`, and the Next.js renderer maps each node to trusted UI adapters.

The important trick: **the LLM never writes React, routes, JSX, imports, or CSS.** It picks node types from a fixed manifest and fills props/data. That containment is the point — agents get a polished presentation layer without generating arbitrary code.

> For the engineering handoff (repo map, architecture, common tasks, pitfalls), read [`ai-artifacts/AGENT_ONBOARDING.md`](./ai-artifacts/AGENT_ONBOARDING.md).
> For the model-facing usage router, read [`pi-skill/visual-artifact/SKILL.md`](./pi-skill/visual-artifact/SKILL.md).

## How it works

```txt
LLM reads artifact-contract.json
  → calls create_visual_artifact(JSON)
  → Pi extension validates the spec
  → writes ~/.pi/artifacts/<project>/<slug>.json
  → /artifacts/<project>/<slug>/ renders the spec
  → VisualArtifactRenderer maps nodes to UI adapters
```

The LLM creates JSON specs, not React files or routes.

## Quick start

```bash
pnpm install
pnpm dev
```

Open:

```txt
http://localhost:9999/artifacts/
```

Sample artifacts:

```txt
http://localhost:9999/artifacts/visualizer/revenue-dashboard/
http://localhost:9999/artifacts/visualizer/implementation-plan/
http://localhost:9999/artifacts/visualizer/agent-stack-report/
```

## Repository map / For contributors

```text
src/lib/artifact-schema.ts         # Zod schema + TS types (source of truth)
src/lib/artifact-manifest.ts       # LLM-facing manifest: descriptions, examples, limits
artifact-contract.json             # Exported JSON consumed by the Pi extension
src/components/component-registry.tsx   # nodeType → adapter map
src/components/visual-artifact-renderer.tsx  # Page-level render flow
src/lib/paths.ts                   # Single source of truth for URL/path math
pi-extension/visual-artifact.ts    # create_visual_artifact tool
pi-skill/visual-artifact/SKILL.md  # Model-facing router + wrapper commands
scripts/extract/pipeline/          # Codebase artifact generator
```

See [`ai-artifacts/AGENT_ONBOARDING.md`](./ai-artifacts/AGENT_ONBOARDING.md) for the full walkthrough: adding a node type, running the pipeline, testing changes, and the gotchas that will save you time.

## Running locally

### Dev server

```bash
pnpm dev
```

Runs on `http://localhost:9999`. All routes are under `basePath: "/artifacts"`.

### Static export + live server

Build once, then run the tiny static server (no Next.js dev overhead):

```bash
pnpm build
pnpm serve
```

The server binds to `127.0.0.1:9999` by default and serves the built `out/` directory under a single mount path:

```txt
http://localhost:9999/artifacts/
```

This same `/artifacts/` path is used everywhere — local dev, the static server, Tailscale, and the blog — only the base URL changes.

Fresh artifact JSON is read from `~/.pi/artifacts/` at `/artifacts/data/artifacts/<project>/<slug>.json`. The home page and project index pages also load live from `~/.pi/artifacts/` via `/artifacts/data/artifacts/index.json` and `/artifacts/data/artifacts/<project>/index.json`, so new artifacts appear immediately without rebuilding. If a new artifact was created after the last build, `pnpm serve` serves a generic live shell at `/artifacts/<project>/<slug>/` and loads that JSON client-side, so direct tool-returned URLs open without rebuilding.

### Environment variables

```bash
VISUALIZER_PORT=9999
VISUALIZER_HOST=127.0.0.1
VISUALIZER_OUT_DIR=./out
VISUALIZER_ARTIFACTS_DIR=~/.pi/artifacts
VISUALIZER_MOUNT_PATH=/artifacts
VISUALIZER_OPEN=1
```

### Tailscale Serve

Expose it on your tailnet using the same `/artifacts/` path:

```bash
tailscale serve --yes --bg --https 443 --set-path /artifacts/ http://127.0.0.1:9999/artifacts
```

Then open:

```txt
https://iurys-macbook-pro.taila5dafe.ts.net/artifacts/
```

The backend URL includes `/artifacts` so Tailscale preserves the prefix instead of stripping it. This keeps one consistent route shape everywhere.

If `tailscale serve status` still shows `/artifacts/` proxying to an old port like `127.0.0.1:9998`, rerun the command above to update it to `127.0.0.1:9999/artifacts`.

Direct `http://<tailscale-ip>:9999/artifacts/` access uses the same path and only needs the server to listen on a non-loopback interface:

```bash
VISUALIZER_HOST=0.0.0.0 pnpm serve
```

## Pi extension & skill

### Install

Run from the repo root:

```bash
./install.sh
```

This copies the skill to `~/.pi/skills/visual-artifact`, the extension to `~/.pi/agent/extensions/visual-artifact.ts`, links the runtime to `~/.pi/tools/visualizer`, installs wrapper scripts to `~/.pi/bin`, and runs `pnpm install`.

### Register the extension

Append this path to the `extensions` array in `~/.pi/agent/settings.json`:

```json
{
  "extensions": [
    "/Users/iurysouza/.pi/agent/extensions/visual-artifact.ts"
  ]
}
```

Then run `/reload` in existing Pi sessions, or start a new session.

### Usage

The agent calls:

```txt
create_visual_artifact
```

The tool writes:

```txt
~/.pi/artifacts/<project>/<slug>.json
```

and returns:

```txt
http://localhost:9999/artifacts/<project>/<slug>/
```

Optional base-URL override:

```bash
export VISUAL_ARTIFACT_BASE_URL=http://localhost:9999/artifacts
```

`VISUAL_ARTIFACT_BASE_URL` is the visualizer deployment root. The tool appends `<project>/<slug>/`.

### Wrapper commands

After `./install.sh`, these are available in `~/.pi/bin/` (add it to your PATH):

| Command | Purpose |
|---------|---------|
| `vaz-doctor` | Verify runtime, deps, wrappers, tools, and renderer health. |
| `vaz-serve` | Start the renderer on `http://localhost:9999` if not running. |
| `vaz-status` | Check if the renderer is running. Returns JSON. |
| `vaz-pipeline <repoRoot> [slug]` | Run the full codebase extraction + assembly pipeline. |
| `vaz-tailscale url [project] [slug]` | Return the shareable tailnet URL. |
| `vaz-tailscale setup` | Configure Tailscale Serve proxy. |

Run `vaz-tailscale setup` once, then `vaz-tailscale url <project> <slug>` after creating an artifact. If you want `create_visual_artifact` to return tailnet URLs by default, set:

```bash
export VISUAL_ARTIFACT_BASE_URL="$(vaz-tailscale url)"
```

### Codebase artifacts

For repo overviews or architecture diagrams, use the pipeline instead of building the spec by hand:

```bash
vaz-pipeline /path/to/repo [slug]
```

It writes a `visual-artifact-spec.json` under `<repoRoot>/ai-artifacts/generated/<slug>/`. Read that file and call `create_visual_artifact` with its payload. See [`pi-skill/visual-artifact/SKILL.md`](./pi-skill/visual-artifact/SKILL.md) for the full routing logic.

## Supported nodes

The contract is the single source of truth for both the LLM and the Pi extension:

```txt
artifact-contract.json
```

Schema source of truth:

```txt
src/lib/artifact-schema.ts
```

Manifest source of truth:

```txt
src/lib/artifact-manifest.ts
```

Regenerate the contract after changing the schema or manifest:

```bash
pnpm export:contract
```

### Node set (36)

```txt
alert, area-chart, radar-chart, scatter-chart, heatmap, log,
definition-list, diff, donut-chart, file-tree, heading, image,
pie-chart, stepper, prose, text, card, metric, stat-card, badge,
button, separator, table, data-table, comparison-table, chart,
mermaid, svg-diagram, flow, timeline, code-block, status-grid,
grid, section, tabs, accordion
```

### Selection map

| Need | Use |
| --- | --- |
| Page/section structure | `heading`, `section`, `text`, `separator` |
| Narrative container | `card` |
| Compact inline KPI | `metric` |
| Dashboard summary band | `stat-card` inside `grid` |
| Metadata/action | `badge`, `button` |
| Standard data | `table`, `data-table`, `chart` |
| Checks, risks, options, parity | `comparison-table` |
| Architecture/topology | `mermaid`, `svg-diagram` |
| Request, deploy, or data path | `flow` |
| Release/runbook sequence | `timeline` |
| Commands/config/file maps | `code-block`, `file-tree`, `diff` |
| Health/readiness/risk board | `status-grid` |
| Long-form markdown prose | `prose` |
| Callouts/warnings | `alert` |
| Proportional data | `pie-chart`, `donut-chart` |
| Cumulative/trend data | `area-chart` |
| Multi-dimensional comparison | `radar-chart` |
| Correlations | `scatter-chart` |
| Matrix/correlation data | `heatmap` |
| Terminal/log output | `log` |
| Term definitions | `definition-list` |
| Step progress | `stepper` |
| Images | `image` |
| Layout/alternate detail | `grid`, `tabs`, `accordion` |

## Artifact composition guidance

Prefer dashboard components over generic card soup:

- Open with a concise thesis, then a `stat-card` summary band.
- Use `stat-card` for top KPIs, counts, health, and state tiles.
- Use `status-grid` for component health, readiness, validation state, and risk boards.
- Use `comparison-table` for evidence, risks, checks, options, runtime surfaces, and parity matrices.
- Use `flow` for request paths, build/deploy chains, ingestion pipelines, and architecture handoffs.
- Use `mermaid` for lightweight text-defined architecture, sequence, ERD, state, class, or C4 diagrams; renderer adds wheel/pinch zoom, drag pan, keyboard controls, and Fit.
- Use `svg-diagram` for trusted full HTML/SVG interactive diagrams in the html-diagram style.
- Use `timeline` for release phases, lifecycle states, migration steps, and operator runbooks.
- Use `code-block` for commands, config snippets, env contracts, and file maps.
- Use `tabs` when the same report has alternate contexts, e.g. Pi / OpenCode / wrapper / projects.
- Use `accordion` only for secondary detail. Do not hide conclusions there.
- Use `card` for narrative chunks that need child nodes, not for every small fact.
- Use `prose` when you need long-form markdown (lists, links, paragraphs).
- Use `alert` for important callouts, not for routine status.
- Pair `chart` with table detail when exact values matter.
- Avoid `file://` links in artifacts; link to app routes or public URLs.

## Copyable artifact patterns

### Architecture brief

Thesis → stat band → Mermaid topology → flow path → status/evidence.

```json
[
  {
    "type": "text",
    "props": { "text": "The runtime is a three-stage ADK pipeline with explicit retrieval and TTS boundaries.", "size": "lg" }
  },
  {
    "type": "grid",
    "props": { "columns": 3 },
    "children": [
      { "type": "stat-card", "props": { "label": "Agents", "value": 3, "caption": "Sequential ADK pipeline", "tone": "accent" } },
      { "type": "stat-card", "props": { "label": "Retrieval", "value": "ChromaDB", "caption": "Grounded docs", "tone": "success" } },
      { "type": "stat-card", "props": { "label": "Output", "value": "JSON + MP3", "caption": "Validated response", "tone": "default" } }
    ]
  },
  {
    "type": "mermaid",
    "props": {
      "title": "Runtime topology",
      "code": "flowchart LR\n  Client --> API[FastAPI]\n  API --> ADK[ADK sequence]\n  ADK --> Chroma[(ChromaDB)]\n  ADK --> TTS[Cloud TTS]"
    }
  },
  {
    "type": "flow",
    "props": {
      "title": "Request path",
      "items": [
        { "title": "Client", "label": "POST /retrieve" },
        { "title": "FastAPI", "description": "Validates request" },
        { "title": "ADK", "description": "Recognizes, retrieves, formats" },
        { "title": "TTS", "description": "Synthesizes MP3" }
      ]
    }
  }
]
```

### Runbook

Timeline for phases, `code-block` for exact commands, `comparison-table` for checks.

```json
{
  "data": {
    "releasePhases": [
      { "step": "01", "phase": "Verify", "action": "Run local checks", "status": "pass" },
      { "step": "02", "phase": "Build", "action": "Create production bundle", "status": "ready" }
    ],
    "checks": [
      { "check": "Artifacts", "result": "pass", "evidence": "pnpm verify:artifacts" }
    ]
  },
  "nodes": [
    { "type": "timeline", "props": { "dataKey": "releasePhases", "titleKey": "phase", "markerKey": "step", "descriptionKey": "action", "statusKey": "status" } },
    { "type": "code-block", "props": { "title": "Ship checks", "language": "bash", "code": "pnpm verify:artifacts\npnpm lint\npnpm build" } },
    { "type": "comparison-table", "props": { "dataKey": "checks", "columns": ["check", "result", "evidence"], "statusKey": "result" } }
  ]
}
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

Default outputs:

```txt
ai-artifacts/visual-qa/agent-stack-light.png
ai-artifacts/visual-qa/agent-stack-dark.png
ai-artifacts/visual-qa/agent-stack-mobile-light.png
ai-artifacts/visual-qa/agent-stack-qa.json
```

Health check (requires a running server):

```bash
pnpm health-check
```
