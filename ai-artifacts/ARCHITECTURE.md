# Visualizer — Architecture

> Senior-engineer overview of the Visualizer codebase: what it is, why it is unusual, and how the pieces fit together.
>
> Updated-at: 5cd8089595230c373ea3cf61628c075b034de031

---

## 1. System Overview

Visualizer is a **local, safe presentation layer for LLMs**. It lets an agent turn structured information into a polished visual page — reports, dashboards, architecture briefs, runbooks, explainers — without the agent ever writing React, routes, JSX, imports, or CSS.

The central idea:

> The LLM emits a constrained JSON artifact spec. A trusted Next.js renderer maps each node in the spec to a known, tested UI adapter.

This is not a generic Next.js application. It is a **JSON-to-UI runtime** whose value is containment: an agent can produce rich output, but it cannot generate arbitrary code, add routes, or change styling.

```text
+--------+     +------------------+     +-----------------+     +-------------+
|  LLM   | --> |  JSON spec       | --> |  Pi extension   | --> |  ~/.pi/...  |
| agent  |     |  (nodes + data)  |     |  validate/write |     |  artifact   |
+--------+     +------------------+     +-----------------+     +------+------+
                                                                       │
                                                                       ▼
+--------+     +------------------+     +-----------------+     +-------------+
| browser| <-- |  Next.js app     | <-- |  serve.mjs      | <-- |  artifact   |
| /artifacts/  |  (adapters)      |     |  static + live  |     |  JSON       |
+--------+     +------------------+     +-----------------+     +-------------+
```

The project has three faces:

1. **Renderer** — Next.js app at `src/`. Reads specs and renders them.
2. **Agent tooling** — Pi extension (`pi-extension/`) and skill (`pi-skill/`) that validate and persist specs.
3. **Codebase artifact pipeline** — `scripts/extract/pipeline/` that turns an arbitrary repo into a visual spec.

---

## 2. Major Components and Responsibilities

### 2.1 Renderer (`src/`)

| Component | Responsibility | Key Files |
|---|---|---|
| **App Router** | Static/dynamic routes under basePath `/artifacts`. | `src/app/[project]/[slug]/page.tsx`, `src/app/page.tsx`, `src/app/[project]/page.tsx`, `src/app/live-artifact/page.tsx` |
| **Client Artifact Loader** | Fetches artifact JSON client-side, handles post-build artifacts and live reload. | `src/components/client-artifact-loader.tsx` |
| **Index Loaders** | Home and project listing pages, populated from live `index.json`. | `src/components/artifact-index-loader.tsx`, `src/components/project-index-loader.tsx` |
| **Visual Artifact Renderer** | Page-level orchestration: hero header, layout, recursive node rendering. | `src/components/visual-artifact-renderer.tsx` |
| **Component Registry** | Type-safe map `nodeType → adapter`. | `src/components/component-registry.tsx` |
| **Adapters** | Node renderers split by responsibility: leaf, data-backed, layout. | `src/components/adapters/*.tsx` |
| **Mermaid module** | Client-rendered, zoomable/pannable Mermaid diagrams. | `src/components/mermaid/*.tsx` |
| **SVG Diagram** | Sandboxed iframe for hand-rolled interactive SVG/HTML diagrams. | `src/components/svg-diagram.tsx` |
| **Schema / Manifest** | Source of truth for valid specs and LLM-facing descriptions. | `src/lib/artifact-schema.ts`, `src/lib/artifact-manifest.ts` |
| **Paths** | Single source of truth for URL and path math. | `src/lib/paths.ts` |
| **Data / Status helpers** | Row lookup, column normalization, cell formatting, status tone mapping. | `src/lib/data.tsx`, `src/lib/status.tsx` |

### 2.2 Agent tooling

| Component | Responsibility | Key Files |
|---|---|---|
| **Pi Extension** | Registers `create_visual_artifact`. Validates spec, derives project, writes file, returns URLs. | `pi-extension/visual-artifact.ts` |
| **Pi Skill** | High-level router + wrapper scripts (`vaz-*`). Decides pipeline vs direct artifact creation. | `pi-skill/visual-artifact/SKILL.md`, `pi-skill/visual-artifact/bin/*` |
| **Install script** | One-shot global install: skill, extension, runtime symlink, wrappers, deps. | `install.sh` |
| **Bootstrap script** | Repair a broken/missing runtime. | `pi-skill/visual-artifact/bootstrap.sh` |

### 2.3 Extraction pipeline

| Component | Responsibility | Key Files |
|---|---|---|
| **Pipeline runner** | Orchestrates five passes, supports `--only` and `--from`. | `scripts/extract/pipeline/run.ts`, `scripts/extract/pipeline/steps.ts` |
| **Deterministic extraction** | Repo profile, folder layers, internal imports, package deps. Produces typed packets. | `scripts/extract/pipeline/01-deterministic-extraction/` |
| **Agentic workflows** | `pi --print` subprocesses for orientation, important components, hotspot audit, etc. | `scripts/extract/pipeline/02-agentic-workflows/` |
| **Report director** | Decides thesis, audience, section order, suggested node types. | `scripts/extract/pipeline/03-report-director/`, `src/lib/report-direction.ts` |
| **Visualization strategy** | Art-director pass: composition guidance for the assembler. | `scripts/extract/pipeline/04-visualization-strategy/` |
| **Final assembler** | Writes `visual-artifact-spec.json`. | `scripts/extract/pipeline/05-final-assembler/` |
| **Shared lib** | Packet I/O, prompt rendering, source instructions. | `scripts/extract/lib/*` |

### 2.4 Build / dev / QA tooling

| Component | Responsibility | Key Files |
|---|---|---|
| **Contract exporter** | Generates `artifact-contract.json` from schema + manifest. | `scripts/export-contract.ts` |
| **Contract tests** | Smoke tests for validation logic. | `scripts/test-contract-validation.ts` |
| **Artifact verifier** | Validates all saved artifacts and checks schema/manifest/contract sync. | `scripts/verify-artifacts.ts` |
| **Static server** | Serves static export + live JSON endpoints + live fallback shell. | `scripts/serve.mjs` |
| **Visual QA** | Headless Chrome screenshots + layout metrics. | `scripts/visual-qa.mjs` |
| **Health check** | Dev/prod smoke test. | `scripts/health-check.mjs` |
| **Mermaid validator** | CLI Mermaid syntax validation. | `scripts/validate-mermaid.ts`, `scripts/test-mermaid-validator.ts` |

---

## 3. Integration Points

### 3.1 External APIs and services

| Integration | Purpose | Notes |
|---|---|---|
| **Tailscale** | Share local artifacts on the tailnet. Extension auto-detects DNS name; skill documents proxy setup. | `pi-extension/visual-artifact.ts::getTailscaleBaseUrl()`, `pi-skill/visual-artifact/bin/vaz-tailscale` |
| **Pi CLI** | Agentic pipeline steps shell out to `pi --print`. | `scripts/extract/pipeline/02-agentic-workflows/step.ts` |
| **Recharts** | Line/bar/area/pie/donut/scatter/radar/heatmap charts. | `src/components/adapters/data-adapters.tsx`, `src/components/chart-shell.tsx` |
| **Mermaid** | Client-rendered diagrams. | `src/components/mermaid/*` |
| **Shiki** | Syntax highlighting for code blocks. | `src/components/adapters/leaf-adapters.tsx` |

### 3.2 Filesystem contracts

| Path | Role | Writer | Reader |
|---|---|---|---|
| `~/.pi/artifacts/<project>/<slug>.json` | Artifact storage | `create_visual_artifact` | Renderer, index loaders, `serve.mjs`, `verify-artifacts.ts` |
| `~/.pi/artifacts/<project>/index.json` | Project index | `serve.mjs` | `ProjectIndexLoader` |
| `~/.pi/artifacts/index.json` | Home index | `serve.mjs` | `ArtifactIndexLoader` |
| `artifact-contract.json` | Runtime contract | `scripts/export-contract.ts` | Pi extension, skill, manual reference |
| `ai-artifacts/generated/<slug>/visual-artifact-spec.json` | Pipeline output | Final assembler | Parent agent (then fed to `create_visual_artifact`) |

### 3.3 Environment variables

| Variable | Effect |
|---|---|
| `VISUALIZER_PORT` / `VISUALIZER_HOST` | Static server bind address. |
| `VISUALIZER_OUT_DIR` | Static export directory. |
| `VISUALIZER_ARTIFACTS_DIR` | Artifact storage directory. |
| `VISUALIZER_MOUNT_PATH` | Static server mount path. |
| `VISUALIZER_CONTRACT_PATH` | Directory containing `artifact-contract.json` for the extension. |
| `VISUAL_ARTIFACT_BASE_URL` | Base URL returned by `create_visual_artifact`. |

---

## 4. Runtime Flow

### 4.1 Creating an artifact (direct)

```text
1. Agent builds a VisualArtifactSpec (reads artifact-contract.json first).
2. Agent calls create_visual_artifact(params).
3. Pi extension loads artifact-contract.json.
4. validateSpec(params, contract) checks slug, layout, dataKeys, node types,
   children limits, item limits, and global data limits.
5. deriveProjectName(ctx.cwd | params.projectPath) sanitizes git root/dir name.
6. withFileMutationQueue writes ~/.pi/artifacts/<project>/<slug>.json.
7. Extension computes localUrl, tailnetUrl (if Tailscale running), and url
   (VISUAL_ARTIFACT_BASE_URL > tailnetUrl > localUrl).
8. Agent receives URL and shares it.
```

### 4.2 Rendering an artifact

```text
Browser requests /artifacts/<project>/<slug>/
        │
        ├──► Known slug? Next.js serves prerendered shell.
        └──► Unknown slug? serve.mjs serves /live-artifact shell.
        │
        ▼
ClientArtifactLoader parses project/slug from window.location.
        │
        ▼
fetch /artifacts/data/artifacts/<project>/<slug>.json
        │
        ▼
setSpec(spec) → <VisualArtifactRenderer spec={spec} />
        │
        ▼
Renderer builds hero header (title, description, data/node/component counts).
        │
        ▼
renderNodes(spec.nodes, context) recurses:
        │
        ├──► leaf node → componentRegistry[type]({ node, context })
        ├──► container node → render children, pass result as children prop
        ├──► tabs/accordion → render each item.nodes
        └──► data-backed node → look up spec.data[dataKey], normalize columns,
                                 render table/chart/timeline/status-grid
```

### 4.3 Creating a codebase artifact (pipeline)

```text
vaz-pipeline <repoRoot> [slug]
        │
        ├──► Step 1: deterministic extraction
        │      repo-profile, folder-layers, internal-imports, package-deps
        │      → packets/*.json, reports/*.md
        │
        ├──► Step 2: agentic workflows
        │      pi --print subprocesses
        │      → reports/codebase-orientation.md, reports/important-components.md, ...
        │
        ├──► Step 3: report director
        │      → report-direction.json / .md
        │
        ├──► Step 4: visualization strategy
        │      → visualization-strategy.md
        │
        └──► Step 5: final assembler
               → visual-artifact-spec.json (validated against Zod schema)
        │
        ▼
Parent agent reads visual-artifact-spec.json and calls create_visual_artifact.
```

Important: the pipeline writes JSON to disk; the parent agent calls the tool. Do not call `create_visual_artifact` from inside a `pi --print` subprocess.

### 4.4 Static export + live server

```text
pnpm build
   │
   ├──► Next.js exports static site to out/
   ├──► generateStaticParams() reads ~/.pi/artifacts/**/*.json
   │    and creates out/artifacts/<project>/<slug>/index.html for known artifacts
   └──► out/artifacts/live-artifact/index.html created as generic fallback

pnpm serve
   │
   ├──► Static files served from out/ under /artifacts/
   ├──► /artifacts/data/artifacts/<project>/<slug>.json served from ~/.pi/artifacts/
   ├──► /artifacts/data/artifacts/index.json and /<project>/index.json built live
   ├──► Any unknown /artifacts/<project>/<slug>/ falls through to live-artifact shell,
   │    which fetches the JSON client-side
   └──► Any unknown /artifacts/<project>/ falls through to live-project shell,
        which resolves the project slug and fetches its live index JSON
```

This design means new artifacts are instantly viewable without rebuilding, while known artifacts are still prerendered for fast first loads.

---

## 5. Key Tradeoffs and Constraints

### 5.1 JSON-not-code constraint

**Tradeoff:** LLMs lose expressiveness (no custom components, no CSS) in exchange for safety and consistency.

**Consequence:** every new visual primitive must be added to schema, manifest, adapters, registry, and contract. The node set grows slowly and deliberately.

### 5.2 Double validation

**Tradeoff:** Contract logic is implemented twice — Zod in the renderer, plain JS in the extension — to fail fast at the agent boundary.

**Consequence:** Changes to limits or node rules must be reflected in both `src/lib/artifact-schema.ts` and `pi-extension/visual-artifact.ts` (which reads `artifact-contract.json`). `pnpm export:contract` and `pnpm verify:artifacts` catch drift.

### 5.3 Global artifact storage

**Tradeoff:** Artifacts live outside the visualizer repo (`~/.pi/artifacts/`) so any Pi session can create pages without repo mutation.

**Consequence:** The renderer cannot assume artifacts are in source control. URLs must be stable; project names are derived from caller context.

### 5.4 Static export + live reload

**Tradeoff:** Static export gives fast, hostable pages; live JSON endpoints keep artifact creation instant.

**Consequence:** The app has two runtime modes (Next.js dev vs. static server) and `src/lib/paths.ts` must resolve base paths correctly for both, plus Tailscale/blog proxies.

### 5.5 Pipeline depends on Pi CLI

**Tradeoff:** Agentic workflow steps use `pi --print` for interpretation, giving high-quality reports at the cost of coupling to the local Pi installation.

**Consequence:** The pipeline is hard to run in CI or parallelize. Deterministic extractors are fast; agentic steps are the bottleneck.

### 5.6 No automated renderer tests

**Tradeoff:** Visual correctness is currently checked by `pnpm visual:qa` (screenshots) and `pnpm verify:artifacts` (schema), not component-level tests.

**Consequence:** Regression risk for adapters is managed manually. Adding characterization tests per node type would be the fastest way to improve safety.

### 5.7 Containment vs. flexibility in diagrams

**Tradeoff:** Mermaid is constrained but safe; `svg-diagram` allows arbitrary HTML/SVG inside a sandboxed iframe, but agents must follow strict theme/layout rules encoded in the manifest description.

**Consequence:** `svg-diagram` is powerful but easy to misuse. The manifest description is effectively a mini-spec for diagram authors.

---

## 6. Unusual things to know

1. **The LLM prompt surface is the manifest.** `src/lib/artifact-manifest.ts` is not just documentation — it shapes what node types the model knows about and how it composes them.
2. **The extension only reads `artifact-contract.json`.** It does not import TypeScript schema code. Keep the exported contract in sync.
3. **Project names are derived, not chosen.** The extension sanitizes the caller's git root or directory name. This affects URLs and storage.
4. **`/artifacts` is everywhere.** Dev, static server, Tailscale, and blog all use the same base path. Only the origin changes.
5. **The live-artifact shell exists for post-build artifacts.** Without it, every new artifact would require `pnpm build`.
6. **The pipeline is orientation-first, not fix-first.** For codebase artifacts, the goal is "what is this project?" before "what should we change?".
7. **`svg-diagram` has its own theme contract.** It must include a before-paint script reading `localStorage['visualizer-theme']` and CSS-variable-driven SVG colors.
8. **Status chips are heuristic.** `src/lib/status.tsx` maps words like "pass", "ok", "healthy", "warn", "fail", "risk" to badge variants; consistency in data values matters.

---

## 7. Quick orientation for agents

Open these files in this order:

1. `src/lib/artifact-schema.ts` — what a valid spec looks like.
2. `src/components/component-registry.tsx` — how node types map to UI.
3. `src/components/visual-artifact-renderer.tsx` — page-level render flow.
4. `src/lib/paths.ts` — URL/path conventions.
5. `pi-extension/visual-artifact.ts` — tool boundary and validation.
6. `pi-skill/visual-artifact/SKILL.md` — high-level model/user flow.
7. `scripts/extract/pipeline/steps.ts` + `run.ts` — codebase artifact pipeline.
8. `src/lib/artifact-manifest.ts` — LLM-facing component descriptions.

Run these before committing changes:

```bash
pnpm lint
pnpm export:contract
pnpm test:contract
pnpm verify:artifacts
pnpm build
```

Updated-at: 5cd8089595230c373ea3cf61628c075b034de031
