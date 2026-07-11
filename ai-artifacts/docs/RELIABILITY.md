# Reliability

> How Visualizer stays correct and how to verify changes.

## Validation layers

1. **Shared executable schema** — `shared/src/artifact-schema.ts` owns Zod validation and the iterative resource preflight.
2. **CLI pre-write** — `cli/src/validate.ts` calls that shared schema before writing.
3. **Renderer post-read** — `app/src/lib/contract/artifact-schema.ts` re-exports and applies the same shared schema before render.
4. **Contract sync** — `app/scripts/verify/verify-artifacts.ts` checks schema, manifest, saved artifacts, and tracked `cli/assets/contract.json`.
5. **Pi boundary** — `pi-extension/visual-artifact.ts` delegates to the CLI instead of duplicating validation.

## Core checks

The repository-wide executable gate uses exact Node 22.22.3, Bun 1.1.34, and pnpm 11.5.2 pins:

```bash
./scripts/verify.sh
```

It performs frozen installs, shared/CLI/app/Worker tests and typechecks, native CLI build smoke, lint, contract export/drift detection, 82-spec verification, static build, and a random-port current-route health smoke with bounded cleanup.

Renderer/schema changes:

```bash
cd app
pnpm test
pnpm lint
pnpm export:contract
pnpm verify:artifacts
pnpm build
```

CLI changes:

```bash
cd cli
bun install
bun test
bun run typecheck
bun run build
```

Install/runtime checks:

```bash
visual-artifact doctor
visual-artifact validate spec.json
visual-artifact create spec.json --no-serve
```

## Command meanings

| Command | Checks |
|---|---|
| `pnpm test` | Complete Node + `tsx` suite for both `.test.ts` and `.test.tsx`. |
| `pnpm lint` | ESLint over renderer source. |
| `pnpm export:contract` | Regenerates `cli/assets/contract.json` from schema + manifest. |
| `pnpm verify:artifacts` | Saved specs parse, filenames match slugs, manifest/contract node sets match. |
| `pnpm build` | Next.js static export to `app/out`. |
| `bun test` | Package tests; the full gate runs CLI and Worker suites separately. |
| `bun run typecheck` | CLI TypeScript compile check. |
| `bun run build` | Bundles contract/static assets and compiles CLI binary. |
| `visual-artifact bootstrap` | Builds renderer and CLI, installs shared dependencies, and installs runtime files only. |
| `visual-artifact doctor` | Binary/deps/contract/out-dir/artifacts-dir/server health. |

## Visual QA

```bash
cd app
pnpm visual:qa
```

Use after adapter, layout, theme, or typography changes. It captures light/dark/mobile screenshots and audits layout issues.

## Mermaid checks

```bash
cd app
pnpm validate:mermaid path/to/diagram.mmd
pnpm test:mermaid-validator
```

Run when changing Mermaid rendering or authoring complex diagrams.

## When to run what

| Change type | Required | Optional |
|---|---|---|
| Docs only | path/link sanity, representative help comparison, `git diff --check` | contract export/drift check |
| Schema/manifest | app full sequence | CLI build if bundled fallback matters |
| Adapter/rendering | `pnpm lint`, `pnpm build` | `pnpm visual:qa` |
| Theme/CSS | `pnpm lint`, `pnpm build` | `pnpm visual:qa` |
| CLI | CLI typecheck/build, `visual-artifact doctor` | create/validate smoke |
| Pi extension | install/reload Pi, tool smoke | none |
| Mermaid/SVG | build + Mermaid validation | visual QA |

## Known gaps

- Visual regression is screenshot/metric based, not pixel-perfect.
- Hosted annotation writes use same-origin browser protection and R2 compare-and-swap retries, but no user authentication or rate limiting.
- Release-event verification can block asset upload and Worker deployment, but the GitHub Release already exists when those workflows start.
