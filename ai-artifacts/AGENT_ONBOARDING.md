# Agent Onboarding — Visualizer

> If you are picking up this codebase to fix, extend, or ship a feature, start here. This doc is the senior-engineer handoff: what matters, where the dragons are, and how to make changes safely.

---

## 1. What this is (and why)

Visualizer is a **JSON-to-UI runtime** for LLM-generated reports, dashboards, architecture briefs, and runbooks. The unusual, load-bearing design decision is:

> **The LLM never writes React, routes, JSX, imports, or CSS.**

It emits a constrained JSON artifact spec. The Pi extension validates the spec, writes it to `~/.pi/artifacts/<project>/<slug>.json`, and the Next.js renderer maps each node to a trusted UI adapter. The value is containment: an agent gets a polished presentation layer without being able to generate arbitrary code or routes.

Key surfaces:

- **Renderer** — Next.js 16 static export under `basePath: "/artifacts"`.
- **Contract system** — `src/lib/artifact-schema.ts` + `src/lib/artifact-manifest.ts` → `artifact-contract.json`.
- **Pi extension** — `pi-extension/visual-artifact.ts` registers `create_visual_artifact`.
- **Skill** — `pi-skill/visual-artifact/SKILL.md` is the model-facing router.
- **Pipeline** — `scripts/extract/pipeline/` generates codebase artifacts deterministically + agentically.

---

## 2. Repository map

```text
/Users/iurysouza/projects/my-repos/vibe-coded/visualizer
├── src/
│   ├── app/                       # Next.js routes
│   │   ├── page.tsx               # Home → ArtifactIndexLoader
│   │   ├── [project]/page.tsx     # Project index → ProjectIndexLoader
│   │   ├── [project]/[slug]/      # Artifact page shell
│   │   ├── live-artifact/page.tsx # Fallback shell for post-build artifacts
│   │   └── components/page.tsx    # Component gallery
│   ├── components/
│   │   ├── adapters/              # Node renderers (leaf, data, layout)
│   │   │   ├── create-adapter.ts  # Type-safe adapter factory
│   │   │   ├── leaf-adapters.tsx  # text, badge, code-block, image, charts, …
│   │   │   ├── data-adapters.tsx  # table, chart, timeline, status-grid, …
│   │   │   └── layout-adapters.tsx# card, grid, section, tabs, accordion, flow
│   │   ├── ui/                    # shadcn/Base UI primitives (~50 components)
│   │   ├── mermaid/               # Interactive Mermaid renderer
│   │   ├── visual-artifact-renderer.tsx   # Page-level orchestrator
│   │   ├── component-registry.tsx         # nodeType → adapter map
│   │   ├── artifact-primitives.tsx        # Figure, PanelCard, TrendPill
│   │   ├── chart-shell.tsx                # Shared Recharts shell
│   │   ├── client-artifact-loader.tsx     # Client JSON fetch for artifact pages
│   │   ├── artifact-index-loader.tsx      # Home page listing
│   │   └── project-index-loader.tsx       # Project page listing
│   └── lib/
│       ├── artifact-schema.ts     # Zod schema + TS types (source of truth)
│       ├── artifact-manifest.ts   # LLM-facing manifest: descriptions, examples, limits
│       ├── schema-helpers.ts      # leafSchema / containerSchema / optionalPropsSchema
│       ├── paths.ts               # Single source of truth for URL/path math
│       ├── data.tsx               # getRows, normalizeColumns, formatCell
│       ├── status.tsx             # status tone helpers + StatusChip
│       ├── artifacts.ts           # FS abstraction over ~/.pi/artifacts
│       ├── report-packet.ts       # Pipeline packet schema
│       └── report-direction.ts    # Director brief schema
├── pi-extension/
│   └── visual-artifact.ts         # Pi tool: create_visual_artifact
├── pi-skill/visual-artifact/      # Global skill install bundle
│   ├── SKILL.md                   # Model router + usage instructions
│   ├── bin/vaz-*                  # Wrapper scripts
│   └── bootstrap.sh               # Repair bootstrap
├── scripts/
│   ├── export-contract.ts         # Generate artifact-contract.json
│   ├── test-contract-validation.ts# Contract validation smoke tests
│   ├── verify-artifacts.ts        # Verify saved specs + contract sync
│   ├── serve.mjs                  # Static export + live JSON server
│   ├── visual-qa.mjs              # Headless screenshot/layout checks
│   ├── health-check.mjs           # Dev/prod smoke test
│   └── extract/pipeline/          # Codebase artifact generator
├── artifact-contract.json         # Exported contract consumed by Pi extension
├── install.sh                     # One-shot skill + runtime installer
├── next.config.ts                 # output: 'export', basePath: '/artifacts'
├── ai-artifacts/                  # Goal packages, generated outputs, debug docs
│   ├── goals/visual-artifact-renderer/
│   └── AGENT_ONBOARDING.md        # this file
└── README.md                      # User-facing docs
```

---

## 3. Read these files first

1. `src/lib/artifact-schema.ts` — the spec shape. Everything else is downstream.
2. `src/components/component-registry.tsx` — how node types become UI.
3. `src/components/visual-artifact-renderer.tsx` — page-level render flow.
4. `src/lib/paths.ts` — URL/path conventions. Never assemble artifact paths by hand elsewhere.
5. `pi-extension/visual-artifact.ts` — tool boundary, validation, URL logic.
6. `pi-skill/visual-artifact/SKILL.md` — high-level model/user flow.
7. `scripts/extract/pipeline/steps.ts` + `run.ts` — pipeline orchestration.
8. `src/lib/artifact-manifest.ts` — LLM-facing component descriptions.

---

## 4. Dev environment setup

Prerequisites: Node.js 20+, pnpm.

```bash
# 1. Install deps
pnpm install

# 2. Start the dev server
pnpm dev          # http://localhost:9999/artifacts

# 3. (Optional) Install the Pi extension + skill globally
./install.sh      # copies skill, extension, and vaz-* wrappers
```

If you only touch renderer/schema code, you do not need the Pi extension. If you change the extension or skill, reinstall with `./install.sh` and reload Pi (`/reload`).

The extension is excluded from TypeScript compilation (`tsconfig.json` excludes `pi-extension`) because it imports Pi-specific packages not present in the renderer's dependency tree.

---

## 5. Common tasks

### Add a new node type

1. `src/lib/artifact-schema.ts`
   - Add the TS type to the `ArtifactNode` union.
   - Add a `leafSchema`, `containerSchema`, or `optionalPropsSchema` branch to `ArtifactNodeSchema`.
   - If the node uses embedded data, add the `dataKey` existence check in `VisualArtifactSpecSchema.superRefine`.

2. `src/lib/artifact-manifest.ts`
   - Add an entry to `artifactManifest` with `description`, `props`, `children`, `data`, `requiresData`, `example`, `limits`.

3. `src/components/adapters/`
   - Implement the adapter in the appropriate file (`leaf-adapters.tsx`, `data-adapters.tsx`, or `layout-adapters.tsx`).
   - Use `getRows()` for data-backed nodes, `Figure` / `PanelCard` for wrappers, `StatusChip` for status values.

4. `src/components/component-registry.tsx`
   - Register `myNode: createAdapter(adapters.renderMyNode)`.
   - Special cases like `mermaid` and `svg-diagram` are registered inline.

5. Regenerate and verify the contract:

   ```bash
   pnpm export:contract
   pnpm test:contract
   pnpm verify:artifacts
   pnpm lint
   pnpm build
   ```

### Run the codebase artifact pipeline

```bash
# Wrapper (preferred)
vaz-pipeline /path/to/repo [slug]

# Or directly from the repo
pnpm extract:pipeline /path/to/repo [slug]
```

Outputs land in `<repoRoot>/ai-artifacts/generated/<slug>/`:

- `extractor-digest.md`, `extractor-run.json`
- `packets/*.json`
- `reports/*.md`
- `report-direction.json`, `report-direction.md`
- `visualization-strategy.md`
- `visual-artifact-spec.json` ← final input to `create_visual_artifact`

The **parent agent** (not the pipeline) calls `create_visual_artifact` with that JSON.

### Run or debug a single pipeline step

```bash
pnpm extract:pipeline /path/to/repo slug --only deterministic-extraction
pnpm extract:pipeline /path/to/repo slug --from report-director
```

### Verify existing artifacts and contract sync

```bash
pnpm verify:artifacts   # all ~/.pi/artifacts/**/*.json + manifest/contract sync
pnpm test:contract      # contract-based validation smoke tests
```

### Serve the static export with live JSON reload

```bash
pnpm build
pnpm serve              # http://localhost:9999/artifacts
```

New artifacts and projects created after the build are served via generic `live-artifact` and `live-project` shells that fetch JSON client-side, so tool URLs work without rebuilding.

### Visual QA

```bash
pnpm visual:qa          # screenshots + layout metrics in ai-artifacts/visual-qa/
```

---

## 6. How to test changes

Run this sequence before pushing:

```bash
pnpm lint
pnpm export:contract
pnpm test:contract
pnpm verify:artifacts
pnpm build
pnpm health-check       # optional, requires running server
pnpm visual:qa          # optional, requires Chrome
```

What each checks:

| Command | Checks |
|---------|--------|
| `pnpm lint` | ESLint + TypeScript. |
| `pnpm export:contract` | Regenerates `artifact-contract.json` from schema/manifest. |
| `pnpm test:contract` | Smoke tests for unknown types, length limits, missing `dataKey`, row/children limits. |
| `pnpm verify:artifacts` | All saved specs parse, filenames match slugs, manifest/contract node sets match. |
| `pnpm build` | Next.js static export under `/artifacts`. |
| `pnpm health-check` | Home + components pages return expected text. |
| `pnpm visual:qa` | Screenshots across light/dark/mobile + horizontal-scroll audit. |

There are **no automated renderer unit tests** today. `visual:qa` is the primary visual regression safety net.

---

## 7. Pitfalls and gotchas

- **The contract is the handshake.** Schema, manifest, and `artifact-contract.json` must stay in sync. Always run `pnpm export:contract` after schema/manifest changes. The Pi extension validates against the exported JSON, not the TS source.

- **Data-backed nodes need `data.<dataKey>` arrays.** The schema's `superRefine` enforces this, but the error message is path-specific. Check `src/lib/artifact-schema.ts` if you see `Missing data.<key>` failures.

- **Do not call `create_visual_artifact` inside a `pi --print` subprocess.** The pipeline's agentic workflows spawn Pi subprocesses to write reports; the final assembler writes JSON to disk. The parent agent calls the tool.

- **Artifacts live outside the repo.** They are written to `~/.pi/artifacts/<project>/<slug>.json`. The project name is derived from the caller's git root or current directory. This lets any Pi session create pages without mutating the visualizer repo.

- **`src/lib/paths.ts` is the single source of truth.** Don't hardcode `/artifacts/...` or assemble URLs elsewhere.

- **`next.config.ts` hardcodes `basePath: "/artifacts"`.** This path is reused locally, via Tailscale Serve, and on the blog. Tailscale should proxy `/artifacts/` to `/artifacts/` on the backend so the prefix is preserved.

- **`pi-extension` is excluded from `tsconfig.json`.** It imports Pi runtime packages. Edit it with care and test by reinstalling `./install.sh` + reloading Pi.

- **Static export + live JSON is the deployment model.** `pnpm build` prerenders known artifacts. `pnpm serve` serves fresh JSON from `~/.pi/artifacts/` and falls back to `live-artifact` for unknown routes.

- **SVG diagrams are sandboxed iframes.** They need their own before-paint theme script that reads the `visualizer-theme` localStorage key. See the `svg-diagram` manifest entry for the exact rules.

- **Mermaid is client-rendered and can time out on large diagrams.** The validator exists (`pnpm validate:mermaid`) but is not yet enforced in the extension.

- **Status values are short by design.** Keep them under ~16 chars; use descriptions for longer text. Tone mapping lives in `src/lib/status.tsx`.

- **Clean untracked noise before committing.** Generated artifact side-effects sometimes create oddly named untracked files. Check `git status`.

---

## 8. Branch / version conventions

- `main` is the release branch.
- Feature/docs branches use prefixes like `feat/...`, `refactor/...`, `docs/...`.
- The contract version lives in `artifact-contract.json` (`version: "1.0.0"`). Bump it when you make a breaking change to node types, props, or limits, and reinstall the extension so clients pick it up.
- A docs-only branch (like this one) should not touch source code unless the docs change requires a code change.
- Before merging any renderer/schema change, run the full verification sequence from §6.
