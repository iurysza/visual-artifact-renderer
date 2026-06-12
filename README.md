# Visualizer

Data-driven visual artifacts for local reports, docs, plans, dashboards, and explainers.

## How it works

```txt
LLM reads supported node manifest
  → calls create_visual_artifact(JSON)
  → Pi extension validates the spec
  → writes ~/.pi/artifacts/<project>/<slug>.json
  → /artifacts/[project]/[slug] renders the spec
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

## Visual QA

With the dev server running, capture light, dark, and mobile screenshots plus layout metrics:

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

## Pi tool

Global extension:

```txt
~/.pi/agent/extensions/visual-artifact.ts
```

Append this path to the `extensions` array in `~/.pi/agent/settings.json`:

```json
{
  "extensions": [
    "/Users/iurysouza/.pi/agent/extensions/visual-artifact.ts"
  ]
}
```

Then run `/reload` in existing Pi sessions, or start a new session.

The agent can call:

```txt
create_visual_artifact
```

The tool writes:

```txt
~/.pi/artifacts/<project>/<slug>.json
```

and returns:

```txt
http://localhost:9999/artifacts/<project>/<slug>
```

Optional overrides:

```bash
export VISUAL_ARTIFACT_BASE_URL=http://localhost:9999
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
table, data-table, comparison-table, chart, mermaid, svg-diagram,
flow, timeline, code-block, status-grid, grid, section, tabs, accordion
```

Selection map:

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
| Commands/config/file maps | `code-block` |
| Health/readiness/risk board | `status-grid` |
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
- Pair `chart` with table detail when exact values matter.
- Avoid `file://` links in artifacts; link to app routes or public URLs.

## Copyable artifact patterns

Architecture brief: stat band → Mermaid topology → flow path → status/evidence.

```json
[
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

Runbook: timeline for phases, code-block for exact commands, comparison-table for checks.

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
