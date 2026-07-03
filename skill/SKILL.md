---
name: visual-artifact
description: Use when the user wants a rendered visual artifact from code or data.
---

# visual-artifact

Use this skill when the user wants a rendered artifact page: report, dashboard, diagram, code review, architecture brief, explainer, component gallery, or structured summary.

## Core rule

Agents emit **VisualArtifactSpec JSON**, not React, JSX, routes, imports, CSS, or full HTML for the renderer.

The CLI validates the JSON and the renderer maps each node to a trusted adapter.

## When to use

Use for requests like:

- "generate a visual artifact"
- "diagram this project"
- "make this a dashboard"
- "create a visual summary"
- "explain this with a diagram"
- "turn this data into a page"

Do not use for plain text answers or code changes that do not need rendering.

## Workflow

1. Inspect the relevant source/data.
2. Get the artifact contract with `visual-artifact contract` before choosing nodes.
3. Build a focused `VisualArtifactSpec`.
4. Validate/create with the CLI or call `create_visual_artifact`.
5. Return the artifact URL.

Use `visual-artifact contract` to print the full contract, `visual-artifact contract --format summary` for a quick overview, or `visual-artifact contract --node <type>` to inspect one node.

## Spec shape

```json
{
  "slug": "kebab-case-slug",
  "title": "Artifact title",
  "description": "Optional short description",
  "layout": { "type": "default" },
  "data": {
    "rows": [{ "name": "Example", "status": "ok" }]
  },
  "nodes": [
    { "type": "text", "props": { "text": "One clear opening thesis.", "size": "lg" } }
  ]
}
```

Rules:

- Follow `visual-artifact contract` for root spec and node constraints (slug format/length, required fields, node types, layout type/columns, etc.).
- Data-backed nodes need `data.<dataKey>` arrays.
- Keep data values well-formed. The CLI validates structural correctness from the contract.
- Do not use `file://` URLs. Use HTTPS, app routes, or sidecar image files.

## CLI

The compiled Bun CLI is `visual-artifact`.

```text
visual-artifact [global flags] <command>
```

| Command | What it does |
|---|---|
| `bootstrap` | Build renderer, compile CLI, install the global skill, and copy the optional Pi extension. |
| `create [spec.json|-]` | Validate, save, and auto-start renderer unless `--no-serve`. |
| `validate [spec.json|-]` | Validate without writing. |
| `serve` | Serve static renderer + live artifact JSON. |
| `serve status` | Check renderer server health. |
| `serve stop` | Best-effort stop for tracked server. |
| `list [project]` | List projects or artifacts. |
| `open [project/slug]` | Open index or artifact page. |
| `doctor` | Diagnose install/runtime state. |
| `contract` | Print the artifact contract used for validation. |

Examples:

```bash
visual-artifact validate spec.json
visual-artifact create spec.json --project /path/to/repo
cat spec.json | visual-artifact create -
visual-artifact --json create spec.json --no-serve
visual-artifact serve --no-open
visual-artifact open my-project/my-slug
visual-artifact doctor
visual-artifact contract --format summary
```

## Storage and URLs

Default artifact storage:

```text
<skill-root>/artifacts/<project>/<slug>.json
```

The project name is derived from the caller's git root or directory.

Default URL:

```text
http://127.0.0.1:9999/artifacts/<project>/<slug>/
```

Set `VISUAL_ARTIFACT_BASE_URL` when serving through a proxy/tunnel/tailnet route. Include the `/artifacts` mount path.

## Node choice

Prefer semantic nodes over generic containers:

| Need | Use |
|---|---|
| Opening thesis | `text` with `size: "lg"` |
| KPI band | `grid` + `stat-card` |
| Evidence rows | `data-table` or `comparison-table` |
| Status/risk board | `status-grid` |
| Architecture/data flow | `mermaid` or `flow` |
| Custom interactive diagram | `svg-diagram` |
| Commands/config | `code-block` |
| File structure | `file-tree` |
| Secondary detail | `accordion` |
| Alternate views | `tabs` |

Full reference: `docs/nodes.md` in the source repo, or `visual-artifact contract`.

## Design rules

- Lead with the answer, not metadata.
- Make the most important idea visually dominant.
- Use tables for structured facts.
- Do not pad with node counts or implementation stats unless they answer the user's question.
- Avoid card soup.
- Keep diagrams under control; split if they stop scanning.
- Use `accordion` only for secondary detail.

## References

Flavor guides for specific artifact intents. Read the relevant file before
building:

| Intent | Reference |
|---|---|
| Most artifacts (galleries, explainers, dashboards, quick diagrams) | [`references/direct-artifact/_index.md`](./references/direct-artifact/_index.md) |
| Full codebase architecture overview | [`references/architecture-overview/_index.md`](./references/architecture-overview/_index.md) |
| Dashboards & metrics | [`references/content-types/dashboards.md`](./references/content-types/dashboards.md) |
| Architecture diagrams | [`references/content-types/architecture-diagrams.md`](./references/content-types/architecture-diagrams.md) |
| Timelines & roadmaps | [`references/content-types/timelines.md`](./references/content-types/timelines.md) |
| Data organization (tables, comparisons) | [`references/content-types/data-organization.md`](./references/content-types/data-organization.md) |
| Design principles & anti-patterns | [`references/design-guidelines.md`](./references/design-guidelines.md) |

The architecture overview flow runs five steps: deterministic extraction →
architecture analysis → report direction → visualization strategy → final
assembler. See
[`references/architecture-overview/_index.md`](./references/architecture-overview/_index.md)
for the full run order.

## Sidecar images

Place local image assets next to the artifact JSON:

```text
<skill-root>/artifacts/<project>/hero.png
```

Use a relative source:

```json
{ "type": "image", "props": { "src": "hero.png", "alt": "Hero" } }
```

## Slash commands

When the Pi extension is installed:

| Command | Usage | What it does |
|---|---|---|
| `/visual-diff` | `/visual-diff [branch|commit|range|#PR|HEAD]` | Ask Pi to generate a visual diff review. |
| `/visual-recap` | `/visual-recap [time-window]` | Ask Pi to generate a visual project recap. |

## Critical reminders

- Always include the `data` object when data-backed nodes reference `dataKey`.
- Prefer `create_visual_artifact` inside Pi; prefer `visual-artifact create` from shell.
- The CLI auto-starts the renderer on create unless `--no-serve` is passed.
- Runtime artifacts are local generated output; do not commit them unless explicitly asked.
