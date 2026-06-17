# Core Beliefs

> Non-negotiable principles for working on Visualizer.

## 1. JSON, not code

The LLM surface is a constrained JSON spec. Agents pick node types, fill props, and embed data. They never write React, routes, JSX, imports, or CSS for the renderer.

Why: containment. Rich output without arbitrary code execution or style drift.

## 2. The contract is the handshake

`src/lib/artifact-schema.ts` + `src/lib/artifact-manifest.ts` export to `artifact-contract.json`. The Pi extension, the skill, and the renderer all agree on this file.

Regenerate it after any schema or manifest change:

```bash
pnpm export:contract
```

## 3. Parse at boundaries

Validate specs before writing (extension) and parse after reading (renderer). Prefer making illegal states unrepresentable in the type system over scattering defensive checks.

## 4. Types are documentation

Push semantic meaning into names. A type like `ArtifactNode`, `DataKey`, or `VisualArtifactSpec` should answer "what is this?" at a glance.

## 7. Progressive disclosure for agents

`AGENTS.md` is short so the task stays in context. Deeper docs live in predictable places. Agents read the map, then follow pointers.
