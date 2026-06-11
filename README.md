# Visualizer

Data-driven visual artifacts for local reports, docs, plans, dashboards, and explainers.

## How it works

```txt
LLM reads supported node manifest
  → calls create_visual_artifact(JSON)
  → Pi extension validates with Zod
  → writes src/artifacts/<slug>.json
  → /artifacts/[slug] renders the spec
  → VisualArtifactRenderer maps nodes to UI adapters
```

The LLM creates JSON specs, not React files or routes.

## Run

```bash
pnpm install
pnpm dev
```

Dev server runs on:

```txt
http://localhost:9999
```

Sample artifacts:

```txt
http://localhost:9999/artifacts/revenue-dashboard
http://localhost:9999/artifacts/implementation-plan
http://localhost:9999/artifacts/agent-stack-report
```

## Verify

```bash
pnpm verify:artifacts
pnpm lint
pnpm build
```

## Pi tool

Project-local extension:

```txt
.pi/extensions/visual-artifact.ts
```

After opening this repo in Pi, run:

```txt
/reload
```

Then the agent can call:

```txt
create_visual_artifact
```

The tool writes:

```txt
src/artifacts/<slug>.json
```

and returns:

```txt
http://localhost:9999/artifacts/<slug>
```

## Supported nodes

Manifest:

```txt
src/lib/artifact-manifest.ts
```

Schema:

```txt
src/lib/artifact-schema.ts
```

Node set:

```txt
heading, text, card, metric, stat-card, badge, button, separator,
table, data-table, comparison-table, chart, status-grid,
grid, section, tabs, accordion
```

## Artifact composition guidance

Prefer dashboard components over generic card soup:

- Use `stat-card` for top summary bands and KPI/state tiles.
- Use `status-grid` for component health, readiness, validation state, and risk boards.
- Use `comparison-table` for risks, checks, runtime surfaces, options, and parity matrices.
- Use `card` for narrative chunks that need child nodes, not for every single fact.
- Pair `chart` with table detail when exact values matter.
- Avoid `file://` links in artifacts; link to app routes or public URLs.
