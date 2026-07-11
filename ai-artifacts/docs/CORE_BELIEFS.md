# Core Beliefs

> Non-negotiable principles for working on Visualizer.

## 1. JSON, not code

The LLM surface is a constrained JSON spec. Agents pick node types, fill props, and embed data. They never write React, routes, JSX, imports, CSS, or full HTML for the renderer.

Why: containment. Rich output without arbitrary code execution, repeated boilerplate, or style drift.

## 2. The contract is the handshake

`shared/src/artifact-schema.ts` is the executable schema and resource preflight; `shared/src/contract.ts` supplies the LLM-facing manifest. They export to tracked `cli/assets/contract.json`. The CLI, Pi extension, skill docs, and renderer meet at this contract, while CLI and renderer execute the same shared Zod parser. Inspect it with `visual-artifact contract`.

Regenerate after schema or manifest changes:

```bash
cd app
pnpm export:contract
pnpm verify:artifacts
```

## 3. Validate at boundaries

Validate before writing through the CLI. Parse again before rendering in the app. Prefer making illegal states unrepresentable over scattering defensive checks.

## 4. Types are documentation

Names like `VisualArtifactSpec`, `ArtifactNode`, `dataKey`, and `ArtifactManifestEntry` should explain the model without a wiki page.

## 5. Storage is runtime output

Generated artifact bundles are local output under the source repo's `artifacts/` in development or the installed skill's `artifacts/` by default. Do not commit generated artifacts unless the user explicitly asks.

## 6. Progressive disclosure for agents

`AGENTS.md` stays short so tasks fit in context. Deeper docs live in predictable files and should be followed only when relevant.
