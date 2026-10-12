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

1. In Pi, call `choose_visual_artifact_direction` before source inspection when the user requested an artifact. Offer 2–4 distinct directions; use the selected instruction as a binding constraint and pass it unchanged as `directionInstruction` to `create_visual_artifact`. If the picker is unavailable or cancelled, ask in chat and wait.
2. Inspect the relevant source/data.
3. Get the artifact contract with `visual-artifact contract` before choosing nodes.
4. Build a focused `VisualArtifactSpec`.
5. Validate/create with the CLI or call `create_visual_artifact`.
6. Return the artifact URL.

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
    { "type": "chapter", "props": { "title": "The answer first", "deck": "One plain sentence.", "takeaway": "One line to remember." }, "children": [
      { "type": "prose", "props": { "content": "Evidence in plain words." } }
    ] }
  ]
}
```

Rules:

- Always include exactly one `artifactType` and 2–5 concise lowercase kebab-case `topics` for discovery and search. Runtime validation keeps these optional for unclassified artifacts.
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

Default artifact storage for both installed and development runtimes:

```text
~/.agents/skills/visual-artifact/artifacts/<project>/<slug>/artifact.json
```

Each bundle may also contain `annotations.json`, `publish.json`, and `assets/`. Use `VISUAL_ARTIFACT_ARTIFACTS_DIR` only when an explicit alternate store is required.

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

## Anti-box rules

The renderer is built to look like an editorial page, not a dashboard. The nodes only work if the spec follows these rules.

1. **No boxes.** Do not wrap content in cards, tiles or panels, and do not nest one container in another. The only surfaces are `code`, `mockup` frames and the left rule of a `callout`.
2. **Group, then colour.** Put items in groups by what the reader must do (can break something, waiting on someone, done) and let the group label carry the colour. Never colour each row.
3. **Status is a dot and a word.** Never a pill, a chip or a bordered tag.
4. **At most three colours: new (green), risk (orange), wait (blue).** Mark one or two things per page as `new`. If everything is highlighted, nothing is.
5. **Few numbers.** `figures` holds at most 4. Do not report counts of nodes, files, sections or other facts about the page itself.
6. **Small diagrams.** `map` has at most 6 nodes, `steps` at most 7, `sequence` at most 10. If it does not fit, split it into two diagrams with a sentence between them. `mermaid` and `svg-diagram` are not a way around the `map` and `steps` limits: split instead. Never put a legend of colours in prose; the node generates its own.
7. **Every chapter ends with one quotable line** in `takeaway`. Write it so it still makes sense alone, in 160 characters or fewer.
8. **Plain sentences.** One idea per sentence. Titles are short and say the point ("Memory saves first"), not the topic ("Memory subsystem"). No numbered headings, no emoji.
9. **Lists with labels become ledger rows.** If you are about to write "Role: what it does" three or more times, use `ledger` or a `prose` list where every item starts with `**Label:**`.
10. **Say it once.** The hero description, the opening prose and the first chapter deck must not restate the same point. Put provenance, dates and caveats in `details`. The first useful visual (a `figures`, `map`, `steps` or `story`) must appear within the first mobile screen, about 844px.
11. **Vary the rhythm.** Do not give every chapter a kicker and a takeaway. Keep a kicker only when it adds a category the title lacks. Write a `takeaway` only for a real conclusion, in at most three or four chapters per page. Mix chapter shapes: one exhibit, exhibit plus prose, prose alone.
12. **Recommended first.** In options, put the recommended row first and mark it with `highlightKey` (a boolean field on each row).
13. **Detail goes behind `details`, never the main point.** Evidence, long traces and full tables go in `details`.

## Core nodes

Use these. Read their full props with `visual-artifact contract --node <type>`.

| Need | Node | Notes |
|---|---|---|
| Page structure | `chapter` | kicker, title, deck (one sentence), children, takeaway. The only way to make a heading. |
| Paragraph or labelled list | `prose` | Markdown. `**Label:** text` list items render as rows. |
| Text side by side | `columns` | 2 or 3 text-only columns. Children: `prose`, `figures`, `checklist`, `links`, `quote`. Start a prose child with `### Heading` for a label. |
| Warning or aside | `callout` | tone `note`, `risk`, `new`, `wait`. At most two per chapter. |
| Evidence you can skip | `details` | One summary line, content opens below. |
| Items grouped by what to do | `ledger` | Groups with a signal and rows of title, body and `next`. Put risk first. Data-backed form via `groupKey`. |
| Progress per item | `checklist` | State glyph per line: done, doing, todo, blocked, dropped. |
| 1 to 4 big numbers | `figures` | Value, label, optional sparkline. No tiles. |
| Structured facts | `table` | Data-backed. `statusKey`, `onlyDiffs`, `dense`, `highlightKey`. |
| A process in order | `steps` | 2 to 7 steps. Mark 1 or 2 as `key`. |
| Parts and how they connect | `map` | 2 to 6 nodes. Edges `a -> b : label`. `+ a -> b` for proposed. |
| Data flow that builds up | `story` | A `map` plus beats revealed on scroll. One per page, for the core flow. |
| Who sends what to whom | `sequence` | At most 10 steps. `key` lists steps to emphasise. |
| Dated events | `timeline` | Vertical spine, no cards. |
| Before/after or options | `compare` | Two columns. With `rows`, only differences show. Omit `verdict` when the chapter already has a `takeaway`. |
| A choice for the reader | `decision` | Option rows, one `suggested`. 2 to 5 per plan. |
| Explained excerpt, commands, config, diff | `code` | Use `annotations` by default for explanations. Use `before` + `after` for changes. |
| A metric over time | `trend` | Data-backed line or bar, labelled at the line end, `mark` for events. |

## Specialised nodes

Use only when the content needs them. They are not for layout.

| Node | Use when |
|---|---|
| `claim-tree` + `claim` | A plain implementation outline: one sentence and exhibit per claim. No claim-specific commenting model. |
| `walkthrough` | Follow an ordered route through source files. Narrow screens show each excerpt. |
| `execution-trace` | Verified API boundaries and types (see Code reviews). |
| `state-machine` | UI or lifecycle states, with a screen per state. |
| `mockup` + `wireframe` | What the user or terminal will see. |
| `file-tree` | Where files live. Keep it for repository orientation, as in `agents/visual-artifact-cli-implementation`. Use `walkthrough` for a source flow and `code` with annotations for one explained excerpt. |
| `links` | A plain row of underlined source links. |
| `quote` | One pull-quote with a source line. |
| `image` | A screenshot or asset. |
| `mermaid` | ERD, class or other diagram types `map` and `sequence` cannot draw. Never use it to avoid the `map` or `steps` limits; split instead. |
| `svg-diagram` | Full control when nothing else can. Last resort, and never a way around the size limits. |

## Removed nodes (contract 3.0.0)

Removed node types do not parse or render. The table below is a writing guide, not automatic conversion. Use only the 31 surviving types returned by `visual-artifact contract`.

| Do not use | Use instead |
|---|---|
| `section`, `heading`, `separator` | `chapter` |
| `text` | `prose` (or the chapter `deck`) |
| `card`, `grid`, `tabs` | `columns`, `compare`, or `chapter` + `prose` |
| `stat-card`, `metric`, `change-stats`, `pie-chart`, `donut-chart` | `figures` |
| `status-grid`, `definition-list`, `badge` | `ledger` |
| `data-table`, `comparison-table` | `table` |
| `flow`, `stepper` | `steps` (or `checklist` for status) |
| `box-diagram` | `map` |
| `sequence-diagram` | `sequence` |
| `chart`, `area-chart`, `scatter-chart` | `trend` |
| `radar-chart`, `heatmap` | `table` |
| `alert` | `callout` |
| `accordion` | `details` |
| `code-block`, `diff`, `log` | `code`, with `before` + `after` for diffs |
| `call-stack` | `walkthrough` for source steps, `execution-trace` for verified boundaries |
| `quotes` | `quote` or `ledger` with `meta` |
| `button` | `links` |

The CLI rejects removed types. Older bundles containing them must be rewritten before opening with this runtime. There is no `visual-artifact migrate` command. From `cli/`, `bun run scripts/port-contract-3.ts --from <dir> --to <artifacts-dir>` rewrites a saved spec onto these nodes.

## Code explanations

Use `code` with `file`, `startLine` and `annotations` for an explained excerpt. Each annotation has `line`, optional inclusive `end`, `title`, optional inline Markdown `body`, `tone` and a `text` substring to underline. Ranges must not overlap on the same side.

Use `before` and `after` instead of writing a separate diff node. `diffMode: "split"` falls back below 720px container width or when p90 line length exceeds 70 columns. Diff notes use only `info`, `risk` and `idea`. Green means added.

Use `walkthrough` for a sequence through source. Declare 1 to 4 files with inline `code` or project-contained `src`, then 2 to 8 steps with `lines`, `title` and optional `body`, `text`, `tone` and diff `side`. With multiple files, every step names its `file`. Keep each side below 400 lines and 24 KB. Do not emit `code-block`, `diff`, `log` or `call-stack` in major 3.

## Shape recipes

Pick the shape first. Each recipe is a page skeleton. Full copyable specs are in [`references/content-types/recipes.md`](./references/content-types/recipes.md).

### 1. Weekly report

One `chapter` per theme, each with a kicker, a deck, one main exhibit, plus at most one supporting prose, details or callout, and a takeaway. Close with open loops as one `ledger`.

- Main exhibit by content: a process is `steps` (mark the new step `key`), parts are `map`, a before/after is `compare`, three short points are `columns`, a table of defects is `table` with `onlyDiffs`.
- Open loops: one `ledger`, groups "Can break something" (risk) then "Waiting on you" (wait). Never a status grid.
- Do not repeat a theme's takeaway in the loops.
- Put a "still open" note about a theme in a `callout` with tone `risk`, not in a second takeaway or a `compare` verdict.

### 2. Design explainer with data flow

One chapter per question the reader has. Make the data flow a single `story` (or `steps` for a linear flow), then the few numbers that matter in `figures`, and the one thing that can go wrong in a `callout` with tone `risk`.

- Keep the stage-by-stage data table in `details` as a `table`.
- Do not draw a second diagram of the same flow.

### 3. Implementation plan

Chapters for the problem, the rules, and each phase. Each phase is a `checklist` of its slices, plus `code` only where a command or contract matters. Put open questions as `decision` nodes. Put what not to do in a `ledger` with groups "Do now", "Do later", "Do not".

- For code-change plans with exhibits use a `claim-tree`; see Plans below.
- State acceptance as the last line of each phase in `prose`, not as a box.

### 4. Decision or comparison

`chapter` "What we face" (problems, ranked, as `ledger` rows or `prose`). Then `compare` with `mode: "options"` (or `table` with `onlyDiffs` for more than two options). Then the recommendation as the chapter `takeaway`, the steps as `checklist`, and open questions as `decision` nodes.

- Name what was rejected and why in one line each.
- The verdict is one sentence, not a table cell.

### 5. Status or open-loops board

`figures` (3 or 4 numbers at most), then a `ledger` grouped by what to do: blocked or risky first, then waiting, then done. Put the full inventory in `details` as a dense `table` with `statusKey`.

- Do not make a tile or a card per item.
- State "not verified" explicitly in a `callout` when the source says nothing was tested.

## Design rules

- Lead with the answer, not metadata. The page title and the first chapter deck say the conclusion.
- Make the most important idea visually dominant: a `key` step, a `risk` group, a `takeaway`.
- Use a table only for facts with columns. Use `ledger` for items with a sentence each.
- Do not pad with node counts or implementation stats unless they answer the user's question.
- For `execution-trace`, first choose the ordered source spans, then run `visual-artifact --json trace inspect --project <root> --anchor <file:start[-end]> ...`. Copy each resolved `.sources[].source` into its event unchanged; `create` re-extracts and rejects stale or edited code identity. The call-stack primary label comes from verified `source.facts.focus`, while `event.label` remains narrative. Keep static/runtime types explicit, add `typeDefinitions` for important custom `staticType` names, and add minimal `event.impacts` only when inspected evidence establishes an observable effect or possible error. Omit uncertain facts rather than speculate. For code-change plans and reviews, prefer this node when the main concern is API shape: interfaces, types and boundaries. Follow the code-review reference.
- Run the check below before you create anything.

### Self-check

- Is any node a box inside a box, a tile, a pill or a card grid? Replace it.
- Does any page have more than 3 colours, more than 4 numbers in a band, or a diagram over its limit?
- Does every chapter have a deck of one sentence and a takeaway that stands alone?
- Can someone skim the chapter titles and takeaways alone and know the point?

### Plans

- Use a `claim-tree` as the page structure when each step needs an exhibit. Each `claim` says one thing.
- One exhibit per claim (`walkthrough`, `state-machine`, `sequence`, `map`, `mockup` or `code`). A second exhibit means a second claim.
- Put a `decision` after the exhibit and before child claims, on the claim it changes. Ask 2 to 5 per plan, and mark the option you would pick `suggested`.
- Keep captions to one sentence. Read [`references/content-types/plans.md`](./references/content-types/plans.md) first.
- Use `details` only for secondary detail.

## References

Flavor guides for specific artifact intents. Read the relevant file before
building:

| Intent | Reference |
|---|---|
| Most artifacts (galleries, explainers, dashboards, quick diagrams) | [`references/direct-artifact/_index.md`](./references/direct-artifact/_index.md) |
| Full codebase architecture overview | [`references/architecture-overview/_index.md`](./references/architecture-overview/_index.md) |
| Dashboards & metrics | [`references/content-types/dashboards.md`](./references/content-types/dashboards.md) |
| Implementation plans and RFCs | [`references/content-types/plans.md`](./references/content-types/plans.md) |
| Code reviews and `/visual-diff` | [`references/content-types/code-reviews.md`](./references/content-types/code-reviews.md) |
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
~/.agents/skills/visual-artifact/artifacts/<project>/<slug>/assets/hero.png
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
