# Agent Onboarding — Visualizer

> Senior-engineer handoff: what matters, where the dragons are, and how to change this repo safely.

## 1. What this is

Visualizer is a **JSON-to-UI runtime** for LLM-generated reports, dashboards, architecture briefs, runbooks, and explainers.

The load-bearing design decision:

> **The LLM never writes React, routes, JSX, imports, CSS, or full HTML for the renderer.**

The agent emits a constrained `VisualArtifactSpec`. The Pi extension calls the `visual-artifact` CLI. The CLI validates against `artifact-contract.json`, writes the spec to the skill artifact store, and starts the renderer if needed. The Next.js app fetches the JSON and renders each node through trusted adapters.

Key surfaces:

- **Renderer** — `skill/app`, Next.js static export under `basePath: "/artifacts"`.
- **Contract system** — `skill/app/src/lib/artifact-schema.ts` + `skill/app/src/lib/artifact-manifest.ts` → `skill/artifact-contract.json`.
- **CLI** — `skill/cli`, Bun binary for create/validate/serve/list/open/doctor/bootstrap.
- **Pi extension** — `pi-extension/visual-artifact.ts`, registers `create_visual_artifact` and delegates to the CLI.
- **Skill docs** — `skill/SKILL.md` and `skill/references/*`, model-facing instructions.

## 2. Repository map

```text
visualizer/
├── skill/
│   ├── SKILL.md
│   ├── artifact-contract.json
│   ├── app/
│   │   ├── src/app/                 # Next.js routes
│   │   ├── src/components/          # renderer, adapters, UI primitives
│   │   ├── src/lib/                 # schema, manifest, paths, helpers
│   │   ├── scripts/                 # contract export, verification, QA
│   │   └── package.json
│   ├── cli/
│   │   ├── src/commands/            # bootstrap/create/validate/serve/list/open/doctor
│   │   ├── scripts/                 # build + binary install
│   │   └── package.json
│   ├── artifacts/                   # local generated specs, gitignored
│   └── references/                  # model-facing usage notes
├── pi-extension/
│   └── visual-artifact.ts           # Pi tool wrapper
├── docs/
│   └── nodes.md                     # node catalog
├── ai-artifacts/docs/               # architecture/product/design/reliability docs
├── assets/                          # README screenshots
└── README.md
```

## 3. Read these first

1. `skill/app/src/lib/artifact-schema.ts` — spec shape and Zod validation.
2. `skill/app/src/lib/artifact-manifest.ts` — LLM-facing node descriptions and limits.
3. `skill/app/src/components/component-registry.tsx` — `node.type` → adapter map.
4. `skill/app/src/components/visual-artifact-renderer.tsx` — page-level render flow.
5. `skill/app/src/lib/paths.ts` — URL/path conventions.
6. `skill/cli/src/commands/create.ts` — validate/write/start-server flow.
7. `skill/cli/src/commands/serve.ts` — static renderer + live JSON server.
8. `pi-extension/visual-artifact.ts` — Pi boundary and tool parameters.

## 4. Dev setup

Renderer:

```bash
cd skill/app
pnpm install
pnpm dev          # http://localhost:9999/artifacts
```

CLI:

```bash
cd skill/cli
bun install
bun run typecheck
bun run build
bun run install:binary
```

Bootstrap everything from the source tree:

```bash
cd skill/cli
bun run src/main.ts bootstrap
```

If the installed binary already exists:

```bash
visual-artifact bootstrap
visual-artifact doctor
```

## 5. Common tasks

### Add a node type

1. `skill/app/src/lib/artifact-schema.ts`
   - Add the TS union member.
   - Add the Zod branch.
   - Add data-key checks if it reads `spec.data`.
2. `skill/app/src/lib/artifact-manifest.ts`
   - Add description, props, children mode, data requirements, example, and limits.
3. `skill/app/src/components/adapters/*`
   - Implement the adapter in leaf/data/layout adapters.
4. `skill/app/src/components/component-registry.tsx`
   - Register the node.
5. Verify:

```bash
cd skill/app
pnpm export:contract
pnpm verify:artifacts
pnpm lint
pnpm build
```

### Create an artifact manually

```bash
visual-artifact validate spec.json
visual-artifact create spec.json --project /path/to/source-repo
```

Output defaults to:

```text
<skill-root>/artifacts/<project>/<slug>.json
```

`<project>` comes from the git root name when available, otherwise the directory name.

### Serve artifacts

```bash
visual-artifact serve --no-open
visual-artifact serve status
visual-artifact open <project>/<slug>
```

The server serves static files from `<skill-root>/app/out` and live JSON from `<skill-root>/artifacts`.

## 6. Verification

Docs-only changes need link/path sanity. Renderer/schema/CLI changes need:

```bash
cd skill/app
pnpm lint
pnpm export:contract
pnpm verify:artifacts
pnpm build

cd ../cli
bun run typecheck
bun run build
```

Optional:

```bash
cd skill/app
pnpm visual:qa
pnpm validate:mermaid path/to/diagram.mmd
```

## 7. Pitfalls

- **Contract drift.** Schema and manifest changes are not done until `skill/artifact-contract.json` is regenerated.
- **Wrong working directory.** Renderer commands run in `skill/app`; CLI commands run in `skill/cli`.
- **Storage location confusion.** Current default is `<skill-root>/artifacts`, not a repo under the caller project. Override with `VISUAL_ARTIFACT_ARTIFACTS_DIR`.
- **Base path.** App routes live under `/artifacts`; data routes live under `/artifacts/data/artifacts/...`.
- **Generated artifacts are local output.** Do not commit `skill/artifacts/<project>/*.json` unless explicitly asked.
- **Extension delegates.** `pi-extension/visual-artifact.ts` does not implement rendering; it finds the CLI and sends JSON through stdin.
- **Static export + live JSON.** New artifacts work after build because the CLI server falls back to live shells and fetches JSON client-side.
- **SVG diagrams are sandboxed.** They may contain self-contained HTML/SVG, but never leak JSX/CSS into the main renderer.

## 8. Branch/version notes

- `main` is the release branch.
- Use `docs/...`, `feat/...`, `fix/...`, or `refactor/...` branches.
- Contract version lives in `skill/artifact-contract.json`.
- Docs-only commits should not touch source code unless correcting docs requires it.
