# Visualizer — Semantic Map

> Concise map of domain concepts, layers, and data flow.

## 1. Domain concepts

| Concept | Meaning | Source |
|---|---|---|
| Artifact | A rendered visual page backed by one JSON spec. | `skill/artifacts/<project>/<slug>.json` by default |
| VisualArtifactSpec | Agent-facing JSON: `slug`, `title`, `description?`, `layout?`, `data?`, `nodes[]`. | `skill/app/src/lib/artifact-schema.ts` |
| Node | One typed UI unit in `nodes[]`: text, stat-card, chart, Mermaid, etc. | schema + manifest |
| Node type | Discriminated `type` value. The LLM chooses from the contract. | `ARTIFACT_NODE_TYPES` |
| Data key | Name under `spec.data` referenced by data-backed nodes. | `dataKey` props |
| Adapter | Trusted React renderer for one node type. | `skill/app/src/components/adapters/*` |
| Registry | Node dispatch table. | `skill/app/src/components/component-registry.tsx` |
| Contract | Exported JSON handshake used by agents and CLI validation. | `skill/artifact-contract.json` |
| Project | URL/storage namespace derived from caller git root or directory. | `skill/cli/src/util.ts` |
| Skill root | Directory containing `SKILL.md`, `app/`, `cli/`, and `artifact-contract.json`. | `skill/cli/src/config.ts` |
| Renderer | Next.js app that renders saved specs. | `skill/app` |
| CLI | Bun binary that validates, writes, serves, and opens artifacts. | `skill/cli` |
| Pi extension | Pi tool wrapper that delegates to the CLI. | `pi-extension/visual-artifact.ts` |

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
│ Validates, derives project, writes, serves, lists, opens.     │
├─────────────────────────────────────────────────────────────┤
│ Contract                                                     │
│ Schema + manifest exported to artifact-contract.json.         │
├─────────────────────────────────────────────────────────────┤
│ Renderer                                                     │
│ Next.js shell → client loaders → renderer → adapters.         │
├─────────────────────────────────────────────────────────────┤
│ Storage                                                      │
│ <skill-root>/artifacts/<project>/<slug>.json by default.      │
└─────────────────────────────────────────────────────────────┘
```

## 3. Data paths

### Direct creation

```text
Agent JSON
  → create_visual_artifact
  → visual-artifact create - --project <cwd> --json
  → validate against artifact-contract.json
  → write <skill-root>/artifacts/<project>/<slug>.json
  → return /artifacts/<project>/<slug>/
```

### Browser rendering

```text
/artifacts/<project>/<slug>/
  → static page shell
  → artifactParamsFromPath()
  → /artifacts/data/artifacts/<project>/<slug>.json
  → VisualArtifactSpecSchema.parse()
  → renderNodes()
  → componentRegistry[type]
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

## 4. Boundary rules

| Boundary | Rule |
|---|---|
| Agent → CLI | Agent supplies JSON only. |
| CLI → disk | Validate before writing. |
| Disk → renderer | Zod parse before render. |
| Renderer → UI | Only registered adapters render nodes. |
| Images/buttons | No `file://`; use relative sidecar assets or HTTPS/app URLs. |
| Diagrams | Mermaid is text; `svg-diagram` is sandboxed iframe HTML. |

## 5. Single sources of truth

| Concern | File |
|---|---|
| Spec shape | `skill/app/src/lib/artifact-schema.ts` |
| LLM-facing node descriptions | `skill/app/src/lib/artifact-manifest.ts` |
| Exported runtime contract | `skill/artifact-contract.json` |
| URL/path math | `skill/app/src/lib/paths.ts` |
| CLI defaults and env vars | `skill/cli/src/config.ts` |
| Project-name derivation | `skill/cli/src/util.ts` |
| Node dispatch | `skill/app/src/components/component-registry.tsx` |
| Theme tokens | `skill/app/src/app/globals.css` |

## 6. Invariants

- `slug` and project names are kebab-case URL segments.
- Top-level `nodes` must be non-empty and max 30 in CLI validation.
- Data-backed nodes require array datasets.
- Contract must be regenerated after schema or manifest changes.
- Renderer commands run from `skill/app`; CLI commands run from `skill/cli` or the installed binary.
- The `/artifacts` base path is part of the public URL contract.
