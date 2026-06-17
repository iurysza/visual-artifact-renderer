# Reliability

> How Visualizer stays correct and how to verify changes.

## Validation layers

1. **Extension pre-write** — `pi-extension/visual-artifact.ts` validates specs against `artifact-contract.json` before writing to disk.
2. **Renderer post-read** — `src/lib/artifact-schema.ts` parses with Zod on render.
3. **Contract sync** — `scripts/verify-artifacts.ts` checks that schema, manifest, and contract agree.

## Commands

Run these before any renderer/schema/extension change:

```bash
pnpm lint
pnpm export:contract
pnpm test:contract
pnpm verify:artifacts
pnpm build
```

| Command                 | Checks                                   |
| ----------------------- | ---------------------------------------- |
| `pnpm lint`             | ESLint + TypeScript                      |
| `pnpm export:contract`  | regenerates `artifact-contract.json`     |
| `pnpm test:contract`    | smoke tests for validation rules         |
| `pnpm verify:artifacts` | all saved specs + manifest/contract sync |
| `pnpm build`            | Next.js static export                    |

## Visual QA

`pnpm visual:qa` takes headless screenshots across light/dark/mobile and audits horizontal scroll. Run after adapter or styling changes.

## When to run what

| Change type       | Required                                | Optional    |
| ----------------- | --------------------------------------- | ----------- |
| Schema/manifest   | full sequence                           | `visual:qa` |
| Adapter rendering | `lint`, `build`                         | `visual:qa` |
| Extension         | reinstall + reload Pi                   | —           |
| Skill/docs        | no build required                       | spot links  |
| Pipeline          | `verify:artifacts` if artifacts changed | —           |
