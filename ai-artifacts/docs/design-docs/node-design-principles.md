# Node Design Principles

> How to design a new artifact node type.

## Before adding a node

1. Can an existing node express it? Prefer composition over new types.
2. Will agents need it often? The catalog is intentionally small.
3. Can the renderer implement it safely without arbitrary code?
4. Does it improve communication, or is it just visual novelty?

## A good node

- **Single responsibility.** One visual job.
- **Typed props.** Zod schema branch, clear defaults, no arbitrary styling.
- **Data-aware or data-free.** Data nodes declare `requiresData: true` in the manifest and resolve `dataKey` from `spec.data`.
- **Container or leaf.** Layout nodes carry children; leaf nodes render content.
- **Theme-native.** Uses renderer tokens, not hardcoded one-off colors.
- **Agent-friendly.** Props should be easy for an LLM to fill correctly.

## Props to avoid

- `className`, `style`, inline CSS.
- Arbitrary JSX/React references.
- HTML strings, except `svg-diagram` inside its sandbox.
- Huge freeform config objects that recreate a UI framework badly.

## Implementation checklist

- [ ] Type added to `ArtifactNode` union in `skill/app/src/lib/artifact-schema.ts`.
- [ ] Zod schema branch added.
- [ ] Manifest entry added in `skill/app/src/lib/artifact-manifest.ts`.
- [ ] Adapter implemented in `skill/app/src/components/adapters/`.
- [ ] Registered in `skill/app/src/components/component-registry.tsx`.
- [ ] Contract regenerated with `cd skill/app && pnpm export:contract`.
- [ ] Verification passes with `pnpm verify:artifacts`, `pnpm lint`, and `pnpm build`.
- [ ] `docs/nodes.md` updated if the public catalog changes.

## Design smell test

If adding the node mostly gives the LLM more styling power, don't add it. If it gives the LLM a clearer semantic primitive with safer rendering, consider it.
