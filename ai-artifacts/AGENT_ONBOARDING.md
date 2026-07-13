# Agent Onboarding — Visualizer

> Senior-engineer handoff: what matters, where the dragons are, and how to change this repo safely.

## 1. What this is

Visualizer is a **JSON-to-UI runtime** for LLM-generated reports, dashboards, architecture briefs, runbooks, and explainers.

The load-bearing design decision:

> **The LLM never writes React, routes, JSX, imports, CSS, or full HTML for the renderer.**

The agent emits a constrained `VisualArtifactSpec`. The Pi extension calls the `visual-artifact` CLI. The CLI validates with the shared executable schema, writes an artifact bundle, and starts the renderer if needed. The Next.js app fetches the JSON, parses it with the same schema, and renders each node through trusted adapters.

Key surfaces:

- **Renderer** — `app/`, Next.js static export served from root (`/`).
- **Contract system** — `shared/src/artifact-schema.ts` owns executable validation/resource limits; `shared/src/contract.ts` owns the LLM-facing manifest; app compatibility layers consume both, and `pnpm export:contract` writes tracked `cli/assets/contract.json`. Inspect it with `visual-artifact contract`.
- **CLI** — `cli/`, Bun binary for create/validate/serve/list/open/doctor/bootstrap.
- **Pi extension** — `pi-extension/visual-artifact.ts`, registers `create_visual_artifact` and delegates to the CLI.
- **Skill docs** — `skill/SKILL.md` and `skill/references/*`, model-facing instructions.

## 2. Repository map

```text
visualizer/
├── app/                             # Next.js renderer, contract adapters, QA
├── cli/                             # Bun CLI, generated contract, release scripts
├── shared/                          # executable artifact + annotation contracts
├── worker/                          # Cloudflare Worker + R2 routes
├── skill/                           # installed model-facing skill and references
├── pi-extension/visual-artifact.ts  # Pi tool wrapper
├── artifacts/                       # local generated bundles, gitignored
├── ai-artifacts/docs/               # architecture/product/design/reliability docs
├── scripts/verify.sh                # pinned repository gate
├── assets/                          # README screenshots
└── README.md
```

## 3. Read these first

1. `shared/src/artifact-schema.ts` — executable spec shape, Zod validation, and resource limits.
2. `shared/src/contract.ts` — LLM-facing node descriptions, examples, and exported limits.
3. `app/src/components/component-registry.tsx` — `node.type` → adapter map.
4. `app/src/components/visual-artifact-renderer.tsx` — page-level render flow.
5. `app/src/lib/artifacts/paths.ts` — URL/path conventions.
6. `cli/src/commands/create.ts` — validate/write/start-server flow.
7. `cli/src/commands/serve.ts` — static renderer + live JSON server.
8. `pi-extension/visual-artifact.ts` — Pi boundary and tool parameters.

## 4. Dev setup

Renderer:

```bash
cd app
pnpm install --frozen-lockfile
pnpm dev          # http://localhost:9999/
```

CLI:

```bash
cd cli
bun install --frozen-lockfile
bun test
bun run typecheck
bun run build
bun run install:binary
bun run src/main.ts bootstrap --dry-run  # optional sanity check
```

Bootstrap everything from the source tree:

```bash
cd cli
bun run src/main.ts bootstrap
```

If the installed binary already exists:

```bash
visual-artifact bootstrap
visual-artifact doctor
```

## 5. Common tasks

### Add a node type

1. `shared/src/artifact-schema.ts`
   - Add the TS union member and Zod branch.
   - Add data-key/resource checks if it reads `spec.data`.
2. `shared/src/contract.ts`
   - Add description, props, children mode, data requirements, example, and limits.
3. `app/src/components/adapters/*`
   - Implement the adapter in leaf/data/layout adapters.
4. `app/src/components/component-registry.tsx`
   - Register the node.
5. Verify:

```bash
cd app
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
<artifacts-dir>/<project>/<slug>/artifact.json
```

`<project>` comes from the git root name when available, otherwise the directory name.

### Serve artifacts

```bash
visual-artifact serve --no-open
visual-artifact serve status
visual-artifact open <project>/<slug>
```

The installed server serves static files from `~/.local/share/visual-artifact/app/out` and live JSON from the configured artifacts directory (`~/.local/share/visual-artifact/artifacts` by default).

## 6. Verification

Run the repository contract for implementation changes:

```bash
./scripts/verify.sh
```

Docs-only changes need link/path sanity, representative CLI help comparison, `git diff --check`, and contract drift confirmation.

Optional:

```bash
cd app
pnpm visual:qa
pnpm validate:mermaid path/to/diagram.mmd
```

## 7. Pitfalls

- **Contract drift.** Schema and manifest changes are not done until `cli/assets/contract.json` is regenerated and `visual-artifact contract` reflects them.
- **Wrong working directory.** Renderer commands run in `app/`; CLI commands run in `cli/`.
- **Storage location confusion.** Development defaults to the source repo's `artifacts/`; installed use defaults to the skill's `artifacts/`. Override with `VISUAL_ARTIFACT_ARTIFACTS_DIR`.
- **Base path.** App routes are root-relative (`/<project>/<slug>/`); data routes live under `/data/artifacts/...` and the annotation API under `/api/annotations/...`.
- **Generated artifacts are local output.** Do not commit `artifacts/<project>/<slug>/` unless explicitly asked.
- **Extension delegates.** `pi-extension/visual-artifact.ts` does not implement rendering; it finds the CLI and sends JSON through stdin.
- **Static export + live JSON.** New artifacts work after build because the CLI server falls back to live shells and fetches JSON client-side.
- **SVG diagrams are sandboxed.** They may contain self-contained HTML/SVG, but never leak JSX/CSS into the main renderer.

## 8. Branch/version notes

- `main` is the release branch.
- Use `docs/...`, `feat/...`, `fix/...`, or `refactor/...` branches.
- Contract version lives in `cli/assets/contract.json`.
- Docs-only commits should not touch source code unless correcting docs requires it.
