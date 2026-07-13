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
  "artifactType": "report",
  "topics": ["architecture", "runtime"],
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

- Always include exactly one `artifactType` and 2–5 concise lowercase kebab-case `topics` for discovery and search. Runtime validation keeps these optional only for legacy artifacts.
- Follow `visual-artifact contract` for root spec, node constraints, and resource limits.
- Data-backed nodes need `data.<dataKey>` arrays.
- Keep data values well-formed. The shared executable schema validates the same contract in the CLI and renderer.
- Do not use `file://` URLs. Use HTTPS, app routes, or sidecar image files.
- `file-tree.props.items[].src` is create-time input. Use project-relative paths. Outside-project paths require explicit `create --allow-read <dir>` authority, which the Pi tool does not grant; persisted specs receive inlined `content`, not `src`.

## CLI

The compiled Bun CLI is `visual-artifact`.

```text
visual-artifact [global flags] <command>
```

| Command | What it does |
|---|---|
| `bootstrap` | Build renderer and CLI, then install runtime files. Agent resources stay package-managed. |
| `create [spec.json|-]` | Validate, save, and auto-start renderer unless `--no-serve`. Add `--publish [profile]` to publish to Cloudflare. |
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

Default installed artifact storage:

```text
~/.local/share/visual-artifact/artifacts/<project>/<slug>/artifact.json
```

Development mode uses `<project-root>/artifacts` when the CLI detects the source tree. Each bundle may also contain `annotations.json`, `publish.json`, and `assets/`.

The project name is derived from the caller's git root or directory.

Default URL:

```text
http://127.0.0.1:9998/<project>/<slug>/
```

Set `VISUAL_ARTIFACT_BASE_URL` when serving through a proxy/tunnel/tailnet route.

### Publishing to Cloudflare

When the user wants a shareable public URL and BYO Cloudflare is configured, run `visual-artifact create` with `--publish [profile]`. On success, the CLI JSON `url` field is the remote public page, served from the Worker's root path:

```text
https://<worker>.<subdomain>.workers.dev/<project>/<slug>/
```

The local URL is returned as `localUrl`, and a non-secret `publish.json` sidecar is written beside `artifact.json`.

```bash
visual-artifact create spec.json --publish
```

If no profile exists, the CLI will tell the user to run `visual-artifact setup cloudflare`. Do not attempt to publish without a configured profile and the required environment variables:

- `VISUAL_ARTIFACT_CLOUDFLARE_R2_ACCESS_KEY_ID`
- `VISUAL_ARTIFACT_CLOUDFLARE_R2_SECRET_ACCESS_KEY`

Default bucket name is `visual-artifact-renderer`; override with `--bucket <name>` or `VISUAL_ARTIFACT_CLOUDFLARE_R2_BUCKET`. `setup cloudflare` patches `worker/wrangler.jsonc` so the bucket binding stays in sync with the profile.

For local development these may be placed in a `.env` file in the working directory; the CLI loads it automatically without overriding shell variables. `.env` is gitignored by default.

Published artifacts support remote comment persistence: the Worker requires the artifact to exist, validates JSON/same-origin browser writes, and stores mutations in R2 with bounded conditional-write retries. The author is shown as a local fallback because the Worker has no access to the viewer's git identity.

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

Full reference: `ai-artifacts/docs/nodes.md` in the source repo, or `visual-artifact contract`.

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

Place local image assets in the artifact bundle:

```text
~/.local/share/visual-artifact/artifacts/<project>/<slug>/assets/hero.png
```

Use a relative source:

```json
{ "type": "image", "props": { "src": "assets/hero.png", "alt": "Hero" } }
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
- The enforced envelope is 2 MiB raw/final JSON, 30 top-level nodes, 100 total nodes, 20 datasets, node depth 8, 500 file-tree items, and file-tree depth 12. Sourced files are capped at 512 KiB each and 1 MiB total.
