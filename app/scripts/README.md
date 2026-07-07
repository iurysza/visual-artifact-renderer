# scripts/

Dev tooling for the visualizer renderer. Grouped by concern. Run from
`app/` unless noted.

## contract/

| Script | What | Run |
|---|---|---|
| `export-contract.ts` | Export `artifact-contract.json` from the schema + manifest. | `pnpm export:contract` |

## verify/

| Script | What | Run |
|---|---|---|
| `verify-artifacts.ts` | Validate every saved artifact spec against the schema + contract sync. | `pnpm verify:artifacts` |
| `cloud-build-leaks.ts` | Ensure a Cloudflare build contains only shared shells, not local artifact routes. | `pnpm verify:cloud-build` |

## qa/

| Script | What | Run |
|---|---|---|
| `visual-qa.mjs` | Drive a headless browser through representative artifacts; report visual regressions. Needs a running server. | `pnpm visual:qa` |
| `health-check.mjs` | Ping the dev/prod server and report status. Needs a running server (`BASE_URL` override optional). | `pnpm health-check` |

## mermaid/

| Script | What | Run |
|---|---|---|
| `validate-mermaid.ts` | Validate a Mermaid diagram file or inline string. | `pnpm validate:mermaid -- <file.mmd>` or `--inline "..."` |
| `test-mermaid-validator.ts` | Ad-hoc harness: run the validator over canned valid/invalid diagrams. Not a test runner. | `pnpm test:mermaid-validator` |

## Notes

- `dev`, `build`, `start`, `lint` are standard Next.js scripts — not in this folder.
- `build:cloud` runs `next build` with `VISUAL_ARTIFACT_CLOUD_BUILD=1`, then runs the cloud leak verifier.
- `visual-qa` and `health-check` require a running renderer (`pnpm dev` or the
  static server). The other scripts are self-contained.
- Capture-screenshot scripts were removed; screenshots are now produced via
  the qa tooling or manually as sidecar images next to artifact JSON.
