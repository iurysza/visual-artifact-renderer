# Visualizer — Semantic Map

> Concise map of the domain, layers, and data flow for the Visualizer codebase.
>
> Updated-at: 5cd8089595230c373ea3cf61628c075b034de031

---

## 1. Domain Concepts

| Concept | Definition | Key Files |
|---|---|---|
| **Artifact** | A rendered visual page produced from a JSON spec. Stored at `~/.pi/artifacts/<project>/<slug>.json`. | `artifact-contract.json`, `src/lib/artifact-schema.ts` |
| **Artifact Spec** | The JSON contract an LLM emits: `slug`, `title`, `description?`, `layout?`, `data?`, `nodes[]`. | `src/lib/artifact-schema.ts` |
| **Node** | One typed UI unit inside an artifact (e.g. `stat-card`, `mermaid`, `comparison-table`). | `src/lib/artifact-schema.ts`, `src/lib/artifact-manifest.ts` |
| **Node Type** | Discriminated union tag (`type`). The only surface the LLM sees. | `src/lib/artifact-schema.ts` |
| **Data Key** | Named dataset referenced by data-backed nodes (`dataKey`). Must resolve to an array in `spec.data`. | `src/lib/artifact-schema.ts` |
| **Adapter** | A function that renders one node type from the spec to React. | `src/components/adapters/*.tsx`, `src/components/component-registry.tsx` |
| **Contract** | Exported JSON handshake between the LLM, Pi extension, and renderer. Source: schema + manifest. | `artifact-contract.json`, `scripts/export-contract.ts` |
| **Project** | Logical grouping derived from the caller's git repo root or directory. Used in URLs and storage. | `pi-extension/visual-artifact.ts` |
| **Renderer** | The Next.js app that turns a saved artifact spec into a visual page. | `src/app`, `src/components/visual-artifact-renderer.tsx` |
| **Pi Extension** | Agent tool `create_visual_artifact` that validates and persists specs. | `pi-extension/visual-artifact.ts` |
| **Pi Skill** | Installable instructions and `vaz-*` wrappers for the codebase-artifact pipeline. | `pi-skill/visual-artifact/SKILL.md`, `pi-skill/visual-artifact/bin/*` |
| **Pipeline** | Multi-pass extractor that turns a codebase into a visual-artifact spec. | `scripts/extract/pipeline/*` |
| **Packet** | Typed deterministic extractor output saved as JSON. | `src/lib/report-packet.ts`, `scripts/extract/pipeline/01-deterministic-extraction/*` |
| **Report Direction** | Director brief that decides what the artifact should say and which nodes to use. | `src/lib/report-direction.ts`, `scripts/extract/pipeline/03-report-director/*` |

---

## 2. Technical Layers

```text
┌─────────────────────────────────────────────────────────────────────┐
│  AGENT / LLM                                                        │
│  Emits constrained JSON specs, never JSX/CSS/routes.                │
├─────────────────────────────────────────────────────────────────────┤
│  PI EXTENSION  (pi-extension/visual-artifact.ts)                     │
│  Tool: create_visual_artifact. Validates against artifact-contract.  │
├─────────────────────────────────────────────────────────────────────┤
│  PI SKILL  (pi-skill/visual-artifact/)                               │
│  SKILL.md router + vaz-* wrappers for codebase artifacts.            │
├─────────────────────────────────────────────────────────────────────┤
│  EXTRACTION PIPELINE  (scripts/extract/pipeline/)                    │
│  Deterministic extractors → agentic reports → director → strategy    │
│  → assembler → visual-artifact-spec.json                             │
├─────────────────────────────────────────────────────────────────────┤
│  CONTRACT  (src/lib/artifact-schema.ts + artifact-manifest.ts        │
│  → artifact-contract.json)                                           │
│  Schema, manifest, exported JSON: shared by renderer + extension.    │
├─────────────────────────────────────────────────────────────────────┤
│  RENDERER  (Next.js app under basePath /artifacts)                   │
│  Routes → ClientArtifactLoader → VisualArtifactRenderer → adapters   │
├─────────────────────────────────────────────────────────────────────┤
│  STORAGE  (~/.pi/artifacts/<project>/<slug>.json)                    │
│  Global artifact store, served live by serve.mjs.                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Layer responsibilities

| Layer | Responsibility | Stable boundaries |
|---|---|---|
| Agent / LLM | Pick valid node types, fill props, embed data. | Never imports renderer code; reads `artifact-contract.json`. |
| Pi Extension | Validate, derive project, write artifact file, return URLs. | No rendering; depends only on `artifact-contract.json`. |
| Pi Skill | Decide route (pipeline vs direct), orchestrate wrappers. | No direct file writes; calls wrappers and tool. |
| Extraction Pipeline | Transform repo → structured packets → reports → spec. | Runs outside the renderer; no Next.js dependency. |
| Contract | Define what a valid spec is. | Schema is source of truth; manifest is LLM-facing; JSON is runtime contract. |
| Renderer | Render spec safely to HTML; serve routes. | Adapters are isolated; no eval of arbitrary code. |
| Storage | Persist artifact JSON globally. | Filesystem only; visualizer does not own project repos. |

---

## 3. Cross-Cutting Concerns

### 3.1 Validation at the boundary

Validation happens twice, against the same contract:

1. **Pi extension** uses plain JS + `artifact-contract.json` to reject bad specs before writing to disk.
2. **Renderer** uses Zod (`VisualArtifactSpecSchema`) when reading and rendering.

```text
LLM JSON ──► Pi extension validator ──► disk ──► renderer Zod parse ──► UI
              (pre-write gate)                     (post-read gate)
```

This is intentional containment: a malicious or confused agent cannot generate arbitrary code, and a malformed spec fails before it reaches a user.

### 3.2 Path consistency

`src/lib/paths.ts` is the single source of truth for:

- `BASE_PATH = "/artifacts"`
- Page paths relative to basePath.
- Public JSON data paths (`/artifacts/data/artifacts/...`).
- Runtime base-path resolution for static/proxied mounts.
- URL → `{ project, slug }` parsing.

No other code should assemble artifact URLs by string concatenation.

### 3.3 Theme handling

- App uses `next-themes` + CSS variables in `src/app/globals.css`.
- `svg-diagram` runs in a sandboxed iframe and must bring its own theme script reading `localStorage` key `visualizer-theme`.
- Mermaid diagrams are client-rendered and theme-aware via CSS classes.

### 3.4 Live reload without rebuild

Static export (`pnpm build`) prerenders known artifacts. After build, `serve.mjs`:

- Serves static files.
- Serves fresh JSON from `~/.pi/artifacts/` under `/artifacts/data/artifacts/`.
- Serves live `index.json` and `<project>/index.json`.
- Falls back to `/live-artifact` shell for unknown artifact URLs.

### 3.5 Tailscale sharing

`pi-extension/visual-artifact.ts` auto-detects `tailscale status --json` and returns a `tailnetUrl` alongside the local URL. The skill documents `vaz-tailscale setup` and `VISUAL_ARTIFACT_BASE_URL` overrides.

---

## 4. Data Flow Paths

### 4.1 Direct artifact creation (agent has data/spec)

```text
Agent builds VisualArtifactSpec
        │
        ▼
create_visual_artifact(tool call)
        │
        ▼
Pi extension loads artifact-contract.json
        │
        ▼
validateSpec() ──► derive project ──► write ~/.pi/artifacts/<project>/<slug>.json
        │
        ▼
Return { url, localUrl, tailnetUrl? }
        │
        ▼
Browser opens /artifacts/<project>/<slug>/
        │
        ▼
ClientArtifactLoader fetches /artifacts/data/artifacts/<project>/<slug>.json
        │
        ▼
VisualArtifactRenderer → componentRegistry → adapters → React DOM
```

### 4.2 Codebase artifact creation (vaz-pipeline)

```text
vaz-pipeline <repoRoot> [slug]
        │
        ├──► 01 deterministic extraction ──► packets/*.json + reports/*.md
        │
        ├──► 02 agentic workflows ──► reports/codebase-orientation.md, ...
        │
        ├──► 03 report director ──► report-direction.json
        │
        ├──► 04 visualization strategy ──► visualization-strategy.md
        │
        └──► 05 final assembler ──► visual-artifact-spec.json
                              │
                              ▼
                   Agent reads spec and calls create_visual_artifact
                              │
                              ▼
                   Renderer serves page as in Path 4.1
```

### 4.3 Static export + live server

```text
pnpm build
   │
   ├──► generateStaticParams() reads ~/.pi/artifacts/**/*.json
   │
   └──► out/artifacts/<project>/<slug>/index.html created for known artifacts

pnpm serve
   │
   ├──► serves out/ as static files
   │
   ├──► serves ~/.pi/artifacts/ as /artifacts/data/artifacts/
   │
   └──► unknown URLs fall through to /live-artifact shell (client fetches JSON)
```

---

## 5. Data Boundaries and Transformations

### 5.1 Spec → UI transformations

| Boundary | Input | Output | Where |
|---|---|---|---|
| Schema parse | raw JSON | `VisualArtifactSpec` | `src/lib/artifact-schema.ts` (Zod) |
| Extension validate | tool params | validated spec + file path | `pi-extension/visual-artifact.ts` |
| Route parse | URL path | `{ project, slug }` | `src/lib/paths.ts` |
| Client fetch | `{ project, slug }` | `VisualArtifactSpec` | `src/components/client-artifact-loader.tsx` |
| Render tree | `spec.nodes` + `spec.data` | React elements | `src/components/visual-artifact-renderer.tsx` |
| Node dispatch | `ArtifactNode` | ReactNode | `src/components/component-registry.tsx` |
| Data lookup | `dataKey` | row array | `src/lib/data.tsx` (`getRows`) |
| Column normalization | `string \| { key, label? }` | `{ key, label }` | `src/lib/data.tsx` (`normalizeColumns`) |
| Status mapping | status string | badge variant / panel tone | `src/lib/status.tsx` |
| Chart data | row array + xKey/yKey | Recharts props | `src/components/adapters/data-adapters.tsx` |
| Mermaid text | `code` string | rendered SVG | `src/components/mermaid/*` |
| SVG html | `html` string | sandboxed iframe document | `src/components/svg-diagram.tsx` |

### 5.2 Contract → code boundaries

| Boundary | From | To | Trigger |
|---|---|---|---|
| Schema/manifest → contract | `artifact-schema.ts` + `artifact-manifest.ts` | `artifact-contract.json` | `pnpm export:contract` |
| Contract → extension validation rules | `artifact-contract.json` | runtime plain-JS validator | `create_visual_artifact` executes |
| Contract → renderer validation | `artifact-contract.json` (derived) + `src/lib/artifact-schema.ts` | Zod parse | render time / `pnpm verify:artifacts` |

### 5.3 File boundaries

- `artifact-contract.json` is the **only** file the Pi extension reads from the visualizer repo at runtime.
- `~/.pi/artifacts/` is the **only** write target for `create_visual_artifact`.
- `ai-artifacts/generated/<slug>/` is the **only** write target for the extraction pipeline.
- `src/lib/paths.ts` is the **only** place URL/path math should live.

---

## 6. Conceptual snapshot (ASCII)

```text
+------------+     +----------------+     +----------------------+
|   Agent    | --> | create_visual_ | --> | ~/.pi/artifacts/...  |
|  (LLM)     |     | artifact tool  |     |  <project>/<slug>.json|
+------------+     +----------------+     +----------------------+
                                                 │
                                                 ▼
+------------+     +----------------+     +----------------------+
|  Browser   | <-- |   Next.js app  | <-- | serve.mjs / dev JSON |
|   /artifacts/<project>/<slug>/    |     |  /data/artifacts/... |
+------------+     +----------------+     +----------------------+
                          │
                          ▼
                   +----------------+
                   | VisualArtifact |
                   |   Renderer     |
                   +----------------+
                          │
          +---------------+---------------+
          ▼               ▼               ▼
    component      data adapters     layout adapters
    registry         (tables,          (card, grid,
    (dispatch)       charts, ...)       tabs, ...)
```

Updated-at: 5cd8089595230c373ea3cf61628c075b034de031
