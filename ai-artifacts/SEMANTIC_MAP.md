# Visualizer — Semantic Map

> Concise map of domain concepts, layers, and data flow.

## 1. Domain concepts

| Concept | Meaning | Source |
|---|---|---|
| Artifact | A rendered visual page backed by one JSON spec and optional annotation threads. | `artifacts/<project>/<slug>/artifact.json` + `annotations.json` |
| Artifact bundle | The directory holding `artifact.json`, `annotations.json`, and `assets/`. | `artifacts/<project>/<slug>/` |
| VisualArtifactSpec | Agent-facing JSON: `slug`, `title`, `description?`, `layout?`, `data?`, `nodes[]`. | `app/src/lib/contract/artifact-schema.ts` |
| Node | One typed UI unit in `nodes[]`: text, stat-card, chart, Mermaid, etc. | schema + manifest |
| Node type | Discriminated `type` value. The LLM chooses from the contract. | `ARTIFACT_NODE_TYPES` |
| Node identity | `metadata.id` (preferred) or deterministic node path used to anchor comments. | rendered `data-va-node-*` attributes |
| Data key | Name under `spec.data` referenced by data-backed nodes. | `dataKey` props |
| Adapter | Trusted React renderer for one node type. | `app/src/components/adapters/*` |
| Registry | Node dispatch table. | `app/src/components/component-registry.tsx` |
| Contract | Exported JSON handshake used by agents and CLI validation. | `cli/assets/contract.json` (generated build artifact) |
| Project | URL/storage namespace derived from caller git root or directory. | `cli/src/util.ts` |
| Skill root | Directory containing `SKILL.md` and `artifacts/` when installed. | `cli/src/config.ts` |
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
│ Schema + manifest exported to artifact-contract.json.         │
├─────────────────────────────────────────────────────────────┤
│ Shared annotation schema                                     │
│ Zod parsers shared by renderer and CLI.                       │
├─────────────────────────────────────────────────────────────┤
│ Renderer                                                     │
│ Next.js shell → client loaders → renderer → adapters.         │
├─────────────────────────────────────────────────────────────┤
│ Storage                                                      │
│ <skill-root>/artifacts/<project>/<slug>/ by default.          │
└─────────────────────────────────────────────────────────────┘
```

## 3. Data paths

### Direct creation

```text
Agent JSON
  → create_visual_artifact
  → visual-artifact create - --project <cwd> --json
  → validate against the exported contract
  → write <skill-root>/artifacts/<project>/<slug>/artifact.json
  → return /artifacts/<project>/<slug>/
```

### Browser rendering

```text
/artifacts/<project>/<slug>/
  → static page shell
  → artifactParamsFromPath()
  → /artifacts/data/artifacts/<project>/<slug>/artifact.json
  → VisualArtifactSpecSchema.parse()
  → renderNodes()
  → componentRegistry[type]
  → AnnotationProvider loads /artifacts/data/artifacts/<project>/<slug>/annotations.json
  → render annotation UI
```

### Index rendering

```text
/artifacts/
  → ArtifactIndexLoader
  → /artifacts/data/artifacts/index.json
  → projects + recent artifacts

/artifacts/<project>/
  → ProjectIndexLoader
  → /artifacts/data/artifacts/<project>/index.json
  → artifacts in one project
```

### Annotation mutation

```text
Browser mutation
  → /artifacts/api/annotations/<project>/<slug>
  → CLI validates with shared annotation schema
  → applyMutations()
  → write <skill-root>/artifacts/<project>/<slug>/annotations.json
  → return updated AnnotationDocument
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
| Browser → CLI annotations | Mutations must validate against shared annotation schema. |
| Anchor → thread | Identity prefers `nodeId`, falls back to `nodePath`. |

## 5. Single sources of truth

| Concern | File |
|---|---|
| Spec shape | `app/src/lib/contract/artifact-schema.ts` |
| LLM-facing node descriptions | `app/src/lib/contract/artifact-manifest.ts` |
| Exported runtime contract | `cli/assets/contract.json` (generated build artifact) |
| Shared annotation schema | `shared/src/annotations.ts` |
| URL/path math | `app/src/lib/artifacts/paths.ts` |
| CLI defaults and env vars | `cli/src/config.ts` |
| Project-name derivation | `cli/src/util.ts` |
| Node dispatch | `app/src/components/component-registry.tsx` |
| Theme tokens | `app/src/app/globals.css` |

## 6. Invariants

- `slug` and project names are kebab-case URL segments.
- Top-level `nodes` must be non-empty and max 30 in CLI validation.
- Data-backed nodes require array datasets.
- Contract must be regenerated after schema or manifest changes.
- Renderer commands run from `app/`; CLI commands run from `cli/` or the installed binary.
- The `/artifacts` base path is part of the public URL contract.
- Annotation JSON is read with the shared Zod schema in both renderer and CLI.
- Annotation mutations are written only by the local CLI server; static hosts cannot accept browser edits.
