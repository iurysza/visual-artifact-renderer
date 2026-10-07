# Visualizer node reference

> Available node types and when to use them.

Visualizer artifacts are built from a constrained node catalog. Agents never write React, JSX, CSS, routes, imports, or full HTML for the renderer; they choose nodes, fill props, and optionally provide data.

## Sources of truth

- `visual-artifact contract` — inspect the exported runtime contract bundled into the CLI.
- [`shared/src/artifact-schema.ts`](../../shared/src/artifact-schema.ts) — executable Zod schema, TypeScript types, and resource preflight.
- [`shared/src/contract.ts`](../../shared/src/contract.ts) — LLM-facing descriptions, examples, props, and exported limits.
- [`cli/assets/contract.json`](../../cli/assets/contract.json) — tracked generated handshake checked for drift.

Regenerate the contract after schema or manifest changes:

```bash
cd app
pnpm export:contract
pnpm verify:artifacts
```

## Stable node IDs for annotations

Every node can carry an optional `metadata.id` string. Agents can leave it off; the renderer falls back to deterministic node paths such as `nodes.0`, `nodes.1.children.2`, or `nodes.3.props.items.0.nodes.1`. IDs are useful when artifacts need to keep comments anchored to a node across edits or reorders.

Example:

```json
{
  "type": "stat-card",
  "metadata": { "id": "summary-card" },
  "props": { "label": "Summary", "value": "Ready" }
}
```

When rendered, each node is wrapped in a layout-neutral boundary with these attributes:

- `data-va-node-id` — the `metadata.id` value, when present
- `data-va-node-path` — the deterministic path inside the spec
- `data-va-node-type` — the node type, e.g. `stat-card`
- `data-va-node-label` — a short label derived from `title`, `text`, `label`, or `content`

The renderer uses `display: contents` for the boundary so grids, tabs, accordions, and cards keep their existing layout.

## Node set

Visualizer ships **30+** node types:

```txt
alert, area-chart, radar-chart, scatter-chart, heatmap, log,
definition-list, diff, donut-chart, file-tree, heading, image,
pie-chart, stepper, text, card, metric, stat-card, badge,
button, separator, table, data-table, comparison-table, chart,
mermaid, svg-diagram, flow, timeline, execution-trace, code-block, status-grid,
grid, section, tabs, accordion, prose,
claim-tree, claim, decision, call-stack, state-machine, sequence-diagram,
box-diagram, mockup, wireframe, change-stats, quotes
```

## Selection map

| Need | Use |
|---|---|
| Page/section structure | `heading`, `section`, `text`, `separator` |
| Long markdown narrative | `prose` |
| Narrative container | `card` |
| Compact KPI | `metric` |
| Summary band | `stat-card` inside `grid` |
| Metadata/action | `badge`, `button` |
| Standard data | `table`, `data-table`, `chart` |
| Checks, risks, options, parity | `comparison-table` |
| Health/readiness/risk board | `status-grid` |
| Architecture/topology | `mermaid`, `svg-diagram` |
| Request/deploy/data path | `flow` |
| Release/runbook sequence | `timeline`, `stepper` |
| Verified API boundaries and types: interfaces, boundaries, transformations | `execution-trace` |
| What calls what and what changes (plan sketch, optional excerpts) | `call-stack` |
| A plan as a tree of claims, each proved by one exhibit | `claim-tree` + `claim` |
| A fork the reader must choose, placed on the claim it changes | `decision` |
| Lifecycle or UI states, with a screen per state | `state-machine` |
| Messages between components when the plan changes them | `sequence-diagram` (use `mermaid` for generic sequences) |
| Components and connections with grid placement and proposed marks | `box-diagram` (use `flow` for a linear strip) |
| What the user or terminal will see | `mockup` + `wireframe` |
| Size of a change at a glance | `change-stats` |
| The requests or sources behind a plan | `quotes` |
| Commands/config/file maps | `code-block` (with `annotations`, `highlight`, `diff`, `sketch`, `startLine`), `file-tree` (with `notes`, `statusStyle: "marks"`, `gitStatus`, `flattenEmpty`, `searchable`, `density`, `iconSet`, `defaultExpanded`), `diff` (with `content`, `mode`, `showLineNumbers`, `indicators`, `highlightInline`, `hunkSeparator`, `caption`), `log` |
| Proportional data | `pie-chart`, `donut-chart` |
| Cumulative/trend data | `area-chart` |
| Multi-dimensional comparison | `radar-chart` |
| Correlation | `scatter-chart` |
| Matrix/correlation intensity | `heatmap` |
| Term definitions | `definition-list` |
| Images | `image` |
| Callouts with intent | `alert` with `tone`: `info`, `warn`, `risk`, `ok`, `idea` |
| Alternate detail | `tabs`, `accordion` |

## Composition guidance

Prefer visual structure over card soup:

- Open with a concise thesis.
- Follow with `stat-card` summary tiles when there are key facts.
- Use `status-grid` for health, readiness, validation state, and risk.
- Use `comparison-table` for evidence, options, tradeoffs, and parity.
- Use `flow` for linear handoffs and `mermaid` for richer diagrams.
- Use `svg-diagram` only when Mermaid cannot express the layout or interaction.
- Use `timeline` or `stepper` for phases and runbooks.
- Use `code-block` for exact commands/config, not whole source files.
- Use `tabs` for alternate views of the same subject.
- Use `accordion` for secondary detail, never for conclusions.
- Avoid `file://` links. Use app routes, HTTPS URLs, or relative sidecar assets.

## Data-backed nodes

Data-backed nodes read arrays from `spec.data` using `dataKey`.

Example:

```json
{
  "data": {
    "checks": [
      { "check": "Contract", "status": "pass", "evidence": "pnpm verify:artifacts" },
      { "check": "Build", "status": "ready", "evidence": "pnpm build" }
    ]
  },
  "nodes": [
    {
      "type": "comparison-table",
      "props": {
        "dataKey": "checks",
        "columns": ["check", "status", "evidence"],
        "statusKey": "status"
      }
    }
  ]
}
```

Keep data values well-formed. The CLI and renderer call the same shared executable schema. The enforced envelope is 2 MiB raw/final JSON, 30 top-level/100 total nodes, 20 datasets, node depth 8, 500 file-tree items, and file-tree depth 12.

## File-tree source reads

A file item may supply `content` directly or use `src` as create-time input. Prefer project-relative `src` paths. They must resolve inside the canonical project root; raw `..` segments and symlink escapes are rejected. Absolute or outside-project reads require a matching repeatable `visual-artifact create --allow-read <dir>` grant. The Pi tool never grants external reads.

The CLI reads the canonical regular file, caps each source at 512 KiB and all sourced content at 1 MiB, inlines it as `content`, and strips `src` from newly saved/published artifacts. Explicit `content` wins without reading disk.

## Local images

For local assets, place the file inside the artifact's `assets` directory:

```text
~/.agents/skills/visual-artifact/artifacts/<project>/<slug>/assets/hero.png
```

Then reference it with a relative path:

```json
{ "type": "image", "props": { "src": "assets/hero.png", "alt": "Artifact hero" } }
```

The renderer serves it as:

```text
/data/artifacts/<project>/<slug>/assets/hero.png
```

## Copyable pattern: architecture brief

```json
[
  {
    "type": "text",
    "props": {
      "text": "The runtime is a three-stage pipeline: JSON contract, CLI validation/storage, renderer adapters.",
      "size": "lg"
    }
  },
  {
    "type": "grid",
    "props": { "columns": 3 },
    "children": [
      { "type": "stat-card", "props": { "label": "Surface", "value": "JSON", "caption": "Agent contract", "tone": "accent" } },
      { "type": "stat-card", "props": { "label": "Boundary", "value": "CLI", "caption": "Validation + storage", "tone": "success" } },
      { "type": "stat-card", "props": { "label": "Output", "value": "UI", "caption": "Trusted adapters", "tone": "default" } }
    ]
  },
  {
    "type": "mermaid",
    "props": {
      "title": "Runtime flow",
      "code": "flowchart LR\n  Agent --> Spec[JSON spec]\n  Spec --> CLI[visual-artifact CLI]\n  CLI --> Store[(artifacts)]\n  Store --> App[Next.js renderer]\n  App --> Page[artifact page]"
    }
  }
]
```

## Copyable pattern: runbook

```json
{
  "data": {
    "releasePhases": [
      { "step": "01", "phase": "Verify", "action": "Run local checks", "status": "pass" },
      { "step": "02", "phase": "Build", "action": "Create static export", "status": "ready" }
    ]
  },
  "nodes": [
    {
      "type": "timeline",
      "props": {
        "dataKey": "releasePhases",
        "titleKey": "phase",
        "markerKey": "step",
        "descriptionKey": "action",
        "statusKey": "status"
      }
    },
    {
      "type": "code-block",
      "props": {
        "title": "Ship checks",
        "language": "bash",
        "code": "cd app\npnpm verify:artifacts\npnpm lint\npnpm build"
      }
    }
  ]
}
```

## Copyable pattern: file tree with git status

```json
{
  "type": "file-tree",
  "props": {
    "items": [
      {
        "name": "src",
        "type": "directory",
        "children": [
          { "name": "index.ts", "type": "file" },
          { "name": "button.tsx", "type": "file" }
        ]
      }
    ],
    "flattenEmpty": true,
    "searchable": true,
    "density": "default",
    "iconSet": "standard",
    "defaultExpanded": true,
    "gitStatus": {
      "src/index.ts": { "status": "modified" },
      "src/button.tsx": { "status": "added" },
      "src": { "status": "modified", "descendant": true }
    }
  }
}
```

## Copyable pattern: diff from a unified diff string

```json
{
  "type": "diff",
  "props": {
    "title": "utils.ts",
    "language": "typescript",
    "mode": "unified",
    "indicators": "plus-minus",
    "highlightInline": true,
    "content": "diff --git a/utils.ts b/utils.ts\n--- a/utils.ts\n+++ b/utils.ts\n@@ -1,3 +1,3 @@\n export function greet(name: string) {\n-  return `Hello, ${name}`;\n+  return `Hello, ${name}!`;\n }\n"
  }
}
```

## Copyable pattern: diff from before/after (split mode)

```json
{
  "type": "diff",
  "props": {
    "title": "cache.go",
    "language": "go",
    "mode": "split",
    "indicators": "bars",
    "before": "func Get(key string) (*Item, bool) {\n    return item.Value, true\n}",
    "after": "func Get(key string) (*Item, bool) {\n    delete(c.items, key)\n    return item.Value, true\n}"
  }
}
```

## Copyable pattern: source-backed call stack

Source-backed frames support TypeScript/TSX, JavaScript/JSX, and Ruby. The CLI selects a small source-analysis adapter for the file extension and normalizes its ast-grep calls, declarations, scopes, assignments, returns, and branches into the same renderer contract. Unsupported source must stay in non-trace nodes; never use a fake file in a supported language to manufacture verified facts.

First inspect the ordered span:

```bash
visual-artifact --json trace inspect \
  --project . \
  --anchor shared/src/artifact-schema.ts:1626
```

Copy the resolved `.sources[0].source` object unchanged into the event:

```json
{
  "type": "execution-trace",
  "props": {
    "title": "Artifact validation path",
    "provenance": {
      "mode": "inferred",
      "method": "static-analysis",
      "summary": "Control flow and types derived from reviewed source.",
      "confidence": "high"
    },
    "typeDefinitions": [
      {
        "name": "VisualArtifactSpec",
        "definition": "export type VisualArtifactSpec = z.infer<typeof VisualArtifactSpecShapeSchema>",
        "language": "typescript",
        "file": "shared/src/artifact-schema.ts",
        "line": 1583,
        "provenance": "derived"
      }
    ],
    "events": [
      {
        "id": "validate-spec",
        "order": 0,
        "phase": "validate",
        "kind": "boundary",
        "label": "Validate renderer contract",
        "source": {
          "src": "shared/src/artifact-schema.ts",
          "facts": {
            "span": { "file": "shared/src/artifact-schema.ts", "startLine": 1626, "endLine": 1626 },
            "excerpt": "  return VisualArtifactSpecSchema.safeParse(value)",
            "sourceHash": "390afc310771efa486c14e4145034df19dda460ff5595f92d2e4137957c66b3f",
            "revision": "041a7a318091c47359a64e6d86bb7d62c2f0e625",
            "worktree": "clean",
            "language": "typescript",
            "syntaxKind": "call_expression",
            "focus": {
              "kind": "call",
              "text": "VisualArtifactSpecSchema.safeParse(value)",
              "symbol": "VisualArtifactSpecSchema.safeParse"
            },
            "scope": {
              "kind": "function",
              "symbol": "safeParseVisualArtifactSpec",
              "startLine": 1621,
              "endLine": 1627
            },
            "resolution": "resolved"
          }
        },
        "boundary": {
          "kind": "validation",
          "from": { "label": "Untrusted JSON", "system": "runtime" },
          "to": { "label": "Renderer contract", "system": "renderer" },
          "outcome": "passed"
        },
        "inputs": [
          {
            "id": "data",
            "name": "data",
            "staticType": "unknown",
            "runtimeType": "object",
            "preview": { "kind": "object", "text": "{ slug, nodes, data }" },
            "provenance": "inferred"
          }
        ],
        "outputs": [
          {
            "id": "spec",
            "name": "spec",
            "staticType": "VisualArtifactSpec",
            "runtimeType": "object",
            "preview": { "kind": "object", "text": "validated artifact spec" },
            "provenance": "inferred"
          }
        ],
        "transformation": {
          "summary": "Unknown external data becomes a trusted renderer contract.",
          "mappings": [{ "from": "data", "to": "spec", "operation": "validate" }]
        },
        "impacts": [
          {
            "kind": "error",
            "title": "Rejects invalid artifact data",
            "description": "Validation failure prevents the renderer from accepting the external value.",
            "codeRef": { "file": "shared/src/artifact-schema.ts", "line": 1626 }
          }
        ],
        "evidence": { "origin": "inferred", "confidence": "high" }
      }
    ]
  }
}
```

Render events as one persistent call stack; previous/next moves the current step instead of replacing the list. The agent chooses ordered spans, but the call-stack primary identity, enclosing scope, excerpt, location, and hash come only from `trace inspect`. `visual-artifact create` re-runs extraction, rejects stale or edited code identity, and refreshes revision/worktree provenance before inlining source. If inspection returns `ambiguous`, narrow the span rather than choosing a candidate by prose. `event.label` remains the human narrative and never substitutes for verified code identity. Boundary `from`/`to` describe the conceptual handoff; there is no freeform code operation. Always model static/runtime types and provenance separately. Add `typeDefinitions` for important custom `staticType` names so their declarations appear transiently. Use `event.impacts` only for concise, source-established behavior besides the returned value: `effect` for observable work and `error` for possible failure. Omit timings unless they are real monotonic runtime measurements.

For code-change plans and reviews, use this node when the main concern is API shape: interfaces, types, and boundaries. Prioritize boundary events and `typeDefinitions` over a long call transcript. Static analysis is the default: follow changed entrypoints, callers, imports, types, boundaries, and relevant tests without executing the program. Use `mode: "inferred"` with `method: "static-analysis"`; keep unknown values symbolic, label test/fixture examples as derived with a source note, and never claim captured runtime evidence or branch outcomes that source alone cannot prove. Source-backed frames may describe only code that exists; keep proposed target APIs in clearly labeled narrative or comparison content.

## Copyable pattern: html-plan style plan

A plan is one `claim-tree`. Each `claim` states one thing and proves it with one exhibit. A `decision` sits on the claim it changes, after the exhibit and before child claims. Keep 2 to 5 decisions per plan. The full worked example is `artifacts/visualizer/call-stack-excerpts/artifact.json`.

```json
{
  "type": "claim-tree",
  "props": { "open": "needs" },
  "children": [
    { "type": "claim", "props": { "text": "Inlining hooks into the existing source walker." }, "children": [
      { "type": "call-stack", "props": { "title": "create → resolveDiskSources", "rows": [
        "  **create(specArg, options)** @ cli/src/commands/create.ts:295",
        "~   resolveDiskSources(specJson, ctx) @ cli/src/commands/create.ts:358",
        "+     **sliceLines(content, start, end)** -- new, pure"
      ] } },
      { "type": "decision", "props": { "id": "walker-shape", "question": "Where does the call-stack branch go?", "options": [
        { "id": "inline-branch", "label": "Another if in visit", "suggested": true },
        { "id": "registry", "label": "A table of node → source props", "consequence": "Refactors two existing branches" }
      ] } }
    ] }
  ]
}
```

- `open: "needs"` opens claims that hold a decision, plus their ancestors. `"all"` and `"none"` also work.
- Decisions keep local, unsaved answers. The tree ends with a "Copy decisions as Markdown" button.
- `claim.ref` links a claim to a call-stack row id. `claim.aux` (for example `"scope"`) adds an unnumbered side claim.
- Keyboard: `[` collapses all claims, `]` expands all, arrow keys move through call-stack rows and state-machine states.

## Terse forms

Structured JSON is canonical. Some array props also accept string items in a short form, and strings and objects can mix in one array. The same shared parser runs at `create`/`validate` time and in the renderer. A bad string fails with its JSON path and line, for example:

```txt
nodes.0.props.steps.1 → step 2: couldn't parse "a >> b" — expected "a -> b : text", "a --> b", "a -x-> b", "note over a: text" or "--- label ---"
```

Mark prefixes are shared: `+` added or proposed, `-` removed, `~` changed, `?` uncertain (call-stack only), nothing for context.

| Prop | Form |
|---|---|
| `call-stack.rows` | Indented lines: `"  + **sendLater()** @ app/x.ts:12 -- note"`. Indent is depth, `**…**` marks the focus call, `@` is the location, `--` starts a note. |
| `sequence-diagram.steps` | `"a -> b : msg"`, `"b --> a : reply"`, `"a -x-> b : lost"`, `"--- label"`, `"note over a,b: text"`, `"+ a -> b : new"` |
| `box-diagram.edges` | `"a -> b : label"`, `"a --> b"` (dashed), `"a => b"` (bold), `"a <-> b"`, `"+ a -> b"` |
| `box-diagram.grid`, `state-machine.grid` | Row strings `"| a | b | . |"` or arrays `["a", "b", null]`. `.` is an empty cell. |
| `state-machine.events` | `"queued -review-> reviewing : /feedback"`, `"+ a -retry-> b"` |

Nodes, states, decisions, claims, mockups, quotes and change-stats take objects only.

## Mockups and wireframes

`mockup` draws a frame (`none`, `browser`, `phone`, `desktop`, `terminal`) around ordinary child nodes. It never takes HTML. Child content is inert for the reader, but comment picking still works.

- **Pins.** `pins: [{ "target": "<metadata.id>", "text": "…" }]` puts a numbered badge on the child with that `metadata.id` and lists the text under the frame. `x`/`y` fractions also work when there is no target.
- **Wireframe vocabulary.** `wireframe.element` is one of `navbar`, `sidebar`, `input`, `textarea`, `select`, `toggle`, `checkbox`, `avatar`, `placeholder`, `skeleton-lines`, `toast`, `modal-scrim`, `divider`, `prompt`, `output`, `spinner`.
- **Banned inside a mockup:** `claim-tree`, `claim`, `decision`, `mockup` and `state-machine`. Validation rejects them.
- A `state-machine` state can name a mockup as its `screen` by `metadata.id`. The mockup must be a child of that state machine.

## Credits

The plan nodes (`claim-tree`, `claim`, `decision`, `call-stack`, `state-machine`, `sequence-diagram`, `box-diagram`, `mockup`, `wireframe`, `change-stats`, `quotes`) and the code-block, file-tree and alert improvements port ideas and the documented block grammar from Thariq Shihipar's [html-plan](https://github.com/anthropics/claude-plugins-community/tree/main/html-plan) skill (commit `f60f0454df3045f724c43c6346ec80bdcc3472b2`). The call-stack idea is credited to @dillon_mulroy. We wrote our own code; no html-plan JavaScript or CSS is copied. See `NOTICE` for the licence note.
