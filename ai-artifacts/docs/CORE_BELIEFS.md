# Core Beliefs

> Non-negotiable principles for working on Visualizer.

## 1. JSON, not code

The LLM surface is a constrained JSON spec. Agents pick node types, fill props, and embed data. They never write React, routes, JSX, imports, CSS, or full HTML for the renderer.

Why: containment. Rich output without arbitrary code execution, repeated boilerplate, or style drift.

## 2. The contract is the handshake

`skill/app/src/lib/artifact-schema.ts` + `skill/app/src/lib/artifact-manifest.ts` export to `skill/artifact-contract.json`. The CLI, Pi extension, skill docs, and renderer all meet at that file. Inspect the live contract with `visual-artifact contract`.

Regenerate after schema or manifest changes:

```bash
cd skill/app
pnpm export:contract
pnpm verify:artifacts
```

## 3. Validate at boundaries

Validate before writing through the CLI. Parse again before rendering in the app. Prefer making illegal states unrepresentable over scattering defensive checks.

## 4. Types are documentation

Names like `VisualArtifactSpec`, `ArtifactNode`, `dataKey`, and `ArtifactManifestEntry` should explain the model without a wiki page.

## 5. Storage is runtime output

Generated artifact JSON is local output under `<skill-root>/artifacts` by default. Do not commit generated artifacts unless the user explicitly asks.

## 6. Progressive disclosure for agents

`AGENTS.md` stays short so tasks fit in context. Deeper docs live in predictable files and should be followed only when relevant.
