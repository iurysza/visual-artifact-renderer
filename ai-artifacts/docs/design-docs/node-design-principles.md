# Node Design Principles

> How to design a new artifact node type.

## Before adding a node

1. Can an existing node express it? Prefer composition over new types.
2. Does the LLM need it frequently? The catalog is intentionally small.
3. Can the renderer implement it safely without arbitrary code?

## A good node

- **Single responsibility.** A node does one visual job.
- **Typed props.** Every prop has a Zod schema branch and a clear default.
- **Data-aware or data-free.** If it uses data, it declares `requiresData: true` and resolves a `dataKey` from `spec.data`.
- **Container or leaf.** Layout nodes carry children; leaf nodes render content.
- **Theme-native.** It reads CSS variables, does not hardcode colors.

## Props to avoid

- `className`, `style`, inline CSS — breaks containment.
- Arbitrary HTML/JSX strings — except in sandboxed `svg-diagram`.
- Raw React component references — the LLM cannot provide these.

## Checklist

- [ ] Type added to `ArtifactNode` union.
- [ ] Schema branch added with appropriate helper (`leafSchema`, `containerSchema`, `optionalPropsSchema`).
- [ ] Manifest entry added with `description`, `props`, `children`, `data`, `requiresData`, `example`, `limits`.
- [ ] Adapter implemented in the right file.
- [ ] Registered in `component-registry.tsx`.
- [ ] Contract regenerated and tests pass.
