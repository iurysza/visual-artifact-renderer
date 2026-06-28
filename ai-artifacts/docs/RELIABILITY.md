# Reliability

> How Visualizer stays correct and how to verify changes.

## Validation layers

1. **CLI pre-write** — `skill/cli/src/validate.ts` validates against the exported contract before writing.
2. **Renderer post-read** — `skill/app/src/lib/artifact-schema.ts` parses with Zod before render.
3. **Contract sync** — `skill/app/scripts/verify-artifacts.ts` checks schema, manifest, saved artifacts, and exported contract.
4. **Pi boundary** — `pi-extension/visual-artifact.ts` delegates to the CLI instead of duplicating validation.

## Core checks

Renderer/schema changes:

```bash
cd skill/app
pnpm lint
pnpm export:contract
pnpm verify:artifacts
pnpm build
```

CLI changes:

```bash
cd skill/cli
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
| `pnpm lint` | ESLint over renderer source. |
| `pnpm export:contract` | Regenerates `skill/artifact-contract.json` from schema + manifest. |
| `pnpm verify:artifacts` | Saved specs parse, filenames match slugs, manifest/contract node sets match. |
| `pnpm build` | Next.js static export to `skill/app/out`. |
| `bun run typecheck` | CLI TypeScript compile check. |
| `bun run build` | Bundles contract/static assets and compiles CLI binary. |
| `visual-artifact doctor` | Binary/deps/contract/out-dir/artifacts-dir/server health. |

## Visual QA

```bash
cd skill/app
pnpm visual:qa
```

Use after adapter, layout, theme, or typography changes. It captures light/dark/mobile screenshots and audits layout issues.

## Mermaid checks

```bash
cd skill/app
pnpm validate:mermaid path/to/diagram.mmd
pnpm test:mermaid-validator
```

Run when changing Mermaid rendering or authoring complex diagrams.

## When to run what

| Change type | Required | Optional |
|---|---|---|
| Docs only | path/link sanity, `git diff --check` | none |
| Schema/manifest | app full sequence | CLI build if bundled fallback matters |
| Adapter/rendering | `pnpm lint`, `pnpm build` | `pnpm visual:qa` |
| Theme/CSS | `pnpm lint`, `pnpm build` | `pnpm visual:qa` |
| CLI | CLI typecheck/build, `visual-artifact doctor` | create/validate smoke |
| Pi extension | install/reload Pi, tool smoke | none |
| Mermaid/SVG | build + Mermaid validation | visual QA |

## Known gaps

- No broad renderer unit-test suite yet.
- CLI tests exist in package wiring but are not the main safety net.
- Visual regression is screenshot/metric based, not pixel-perfect.
