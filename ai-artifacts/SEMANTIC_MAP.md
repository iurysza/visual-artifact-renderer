# Visualizer — Semantic Map

> Concise map of domain concepts, layers, and data flow.

## 1. Domain concepts

| Concept | Meaning | Source |
|---|---|---|
| Artifact | A rendered visual page backed by one JSON spec and optional annotation threads. | `artifacts/<project>/<slug>/artifact.json` + `annotations.json` |
| Artifact bundle | The directory holding `artifact.json`, `annotations.json`, and `assets/`. | `artifacts/<project>/<slug>/` |
| VisualArtifactSpec | Agent-facing JSON: `slug`, `title`, `description?`, `artifactType?`, `topics?`, `layout?`, `data?`, `nodes[]`. `artifactType` is one of explainer, dashboard, review, comparison, report, plan, diagram, or idea. | `shared/src/artifact-schema.ts` (re-exported by app) |
| Node | One typed UI unit in `nodes[]`: text, stat-card, chart, Mermaid, etc. | schema + manifest |
| Node type | Discriminated `type` value. The LLM chooses from the contract. | `ARTIFACT_NODE_TYPES` |
| Node identity | `metadata.id` (preferred) or deterministic node path used to anchor comments. | rendered `data-va-node-*` attributes |
| Data key | Name under `spec.data` referenced by data-backed nodes. | `dataKey` props |
| Adapter | Trusted React renderer for one node type. | `app/src/components/adapters/*` |
| Registry | Node dispatch table. | `app/src/components/component-registry.tsx` |
| Contract | Exported JSON handshake used by agents and CLI validation. | `cli/assets/contract.json` (generated build artifact) |
| Project | URL/storage namespace derived from caller git root or directory. | `cli/src/util.ts` |
| Runtime data root | Dedicated installed storage for artifact bundles and renderer files. | `~/.local/share/visual-artifact/` |
| Renderer | Next.js app that renders saved specs. | `app/` |
| CLI | Bun binary that validates, writes, serves, and opens artifacts. | `cli/` |
| Pi extension | Pi tool wrapper that delegates to the CLI. | `pi-extension/visual-artifact.ts` |
| Annotation document | Persisted thread collection for one artifact. | `annotations.json` |
| Annotation thread | Anchored discussion with status and messages. | `@agents/visual-artifact-annotations` |
| Annotation anchor | Node identity (`nodeId` or `nodePath`), type, and optional snippet/coordinates. | `@agents/visual-artifact-annotations` |
| Annotation author | Name/email from git config or local anonymous fallback. | `@agents/visual-artifact-annotations` |

## 2. Layers

```text
┌─────────────────────────────────────────────────────────────┐
│ Agent / LLM                                                  │
│ Emits constrained JSON only.                                 │
├─────────────────────────────────────────────────────────────┤
│ Pi extension                                                 │
│ Tool boundary; sends JSON to the CLI.                        │
├─────────────────────────────────────────────────────────────┤
│ visual-artifact CLI                                          │
│ Validates, derives project, writes bundle, serves, lists,     │
│ opens, and persists annotation mutations.                     │
├─────────────────────────────────────────────────────────────┤
│ Contract                                                     │
│ Shared schema + manifest exported to tracked contract.json.   │
├─────────────────────────────────────────────────────────────┤
│ Shared executable contracts                                  │
│ Artifact/annotation Zod parsers + mutation request policy.    │
├─────────────────────────────────────────────────────────────┤
│ Renderer                                                     │
│ Next.js shell → client loaders → renderer → adapters.         │
├─────────────────────────────────────────────────────────────┤
│ Storage                                                      │
│ ~/.local/share/visual-artifact/artifacts/<project>/<slug>/.   │
└─────────────────────────────────────────────────────────────┘
```

## 3. Data paths

### Direct creation

```text
Agent JSON
  → create_visual_artifact
  → visual-artifact create - --project <cwd> --json
  → validate with the shared executable schema/resource preflight
  → resolve contained or explicitly granted file-tree sources
  → write <artifacts-dir>/<project>/<slug>/artifact.json
  → return /<project>/<slug>/
```

### Browser rendering

```text
/<project>/<slug>/
  → static page shell
  → artifactParamsFromPath()
  → /data/artifacts/<project>/<slug>/artifact.json
  → VisualArtifactSpecSchema.parse()
  → renderNodes()
  → componentRegistry[type]
  → AnnotationProvider loads /data/artifacts/<project>/<slug>/annotations.json
  → render annotation UI
```

### Index rendering

```text
/
  → ArtifactIndexLoader
  → /data/artifacts/index.json
  → projects + recent artifacts

/<project>/
  → ProjectIndexLoader
  → /data/artifacts/<project>/index.json
  → artifacts in one project
```

### Annotation mutation

```text
Browser mutation
  → client serializes whole optimistic transaction
  → POST /api/annotations/<project>/<slug>
  → require existing artifact + POST + application/json + same-origin evidence
  → local: keyed queue → applyMutations() → atomic mode-0600 replace
  → hosted: read etag → applyMutations() → conditional R2 put (max 5 attempts)
  → return authoritative AnnotationDocument
  → client adopts response or rolls back before next transaction
```

## 4. Boundary rules

| Boundary | Rule |
|---|---|
| Agent → CLI | Agent supplies JSON only. |
| CLI → disk | Validate before writing. |
| Disk → renderer | Zod parse before render. |
| Renderer → UI | Only registered adapters render nodes. |
| Images/buttons | No `file://`; use relative sidecar assets or HTTPS URLs. |
| Diagrams | Mermaid is text; `svg-diagram` is sandboxed iframe HTML. |
| Browser → annotation API | Artifact must exist; writes require POST, JSON, and same-origin browser evidence (with loopback dev-proxy exception). |
| Anchor → thread | Identity prefers `nodeId`, falls back to `nodePath`. |

## 5. Single sources of truth

| Concern | File |
|---|---|
| Spec shape/resource envelope | `shared/src/artifact-schema.ts` |
| LLM-facing node descriptions | `shared/src/contract.ts` (consumed by app manifest compatibility layer) |
| Exported runtime contract | `cli/assets/contract.json` (tracked generated artifact) |
| Shared annotation schema | `shared/src/annotations.ts` |
| URL/path math | `app/src/lib/artifacts/paths.ts` |
| CLI defaults and env vars | `cli/src/config.ts` |
| Project-name derivation | `cli/src/util.ts` |
| Node dispatch | `app/src/components/component-registry.tsx` |
| Theme tokens | `app/src/app/globals.css` |

## 6. Invariants

- `slug` and project names are kebab-case URL segments.
- The shared resource envelope allows at most 2 MiB raw/final JSON, 30 top-level nodes, 100 total nodes, 20 datasets, node depth 8, 500 file-tree items, and file-tree depth 12.
- Create-time file sources allow 512 KiB each and 1 MiB aggregate; relative reads stay inside the canonical project unless an explicit `--allow-read` root grants more.
- Data-backed nodes require array datasets.
- Contract must be regenerated after schema or manifest changes.
- Renderer commands run from `app/`; CLI commands run from `cli/` or the installed binary.
- The renderer is served from root (`/`); data and API namespaces remain `/data/artifacts` and `/api/annotations`.
- Annotation JSON is read with the shared Zod schema in both renderer and CLI.
- Local annotation mutations use the CLI's per-artifact atomic queue; published Cloudflare mutations use Worker R2 conditional retries.
- Non-loopback local serving requires explicit remote-write exposure via `--allow-remote` or strict `VISUAL_ARTIFACT_ALLOW_REMOTE=1`.
