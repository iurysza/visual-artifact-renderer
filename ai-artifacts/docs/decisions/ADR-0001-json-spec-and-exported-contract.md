# ADR-0001: JSON Spec, Not Generated Code, Validated by an Exported Zod Contract

> **Quick Reference** | Status: Accepted | Date: 2026-06-11
> **Decision**: Agents emit constrained `VisualArtifactSpec` JSON; the CLI validates it against a Zod-derived contract, and a trusted renderer maps each node to a pre-registered adapter.
> **Context**: Need to let agents render polished pages without generating unsafe UI code, while keeping specs small and runtime-safe.
> **Alternatives**: LLM-generated `.tsx` per artifact, runtime `shadcn` generation, TypeScript types only, JSON Schema
> **Impact**: Agent surface, schema, manifest, contract, renderer, adapter registry, CLI validation, Pi extension

---

## Context

Visualizer was built so agents could produce polished, shareable pages without being asked to write React, JSX, or CSS. At the same time, LLM-generated JSON needs to be validated at runtime and documented for agents without reading source code.

## Decision

**Agents emit constrained JSON only; a Zod schema plus an LLM-facing manifest is exported as `artifact-contract.json` for validation and agent guidance.**

The agent returns a `VisualArtifactSpec` object with typed nodes. `skill/app/src/lib/artifact-schema.ts` defines the shape in Zod. `artifact-manifest.ts` adds LLM-facing descriptions. `pnpm export:contract` writes `skill/artifact-contract.json`, which the CLI validates against and agents read.

## Alternatives Considered

| Option | Pros | Cons | Why Not |
|--------|------|------|---------|
| LLM-generated `.tsx` per artifact | Arbitrary expressiveness | Unsafe code, versioning nightmares, no stable rendering | Violates the core safety goal |
| Runtime `shadcn` generation by LLM | Reuses components | Still requires code generation and validation | Too open-ended and brittle |
| TypeScript types only | Compile-time safety | No runtime validation for LLM output | LLM specs are untyped at runtime |
| JSON Schema | Broad tooling | Another syntax to maintain, no inference | Zod gives TypeScript inference for free |

## Consequences

- **Positive**: No unsafe code execution, smaller prompts, stable rendering, runtime validation, clear agent guidance, single contract file.
- **Negative**: Agents lose arbitrary UI expressiveness; new node types require renderer changes; the contract must be regenerated after every schema or manifest change.
- **Requires**: A strict contract, a node registry, clear adapter boundaries, and a `pnpm export:contract` step in the build process.

## Related

- [ADR-0006](./ADR-0006-adapter-registry-node-rendering.md): How nodes map to React components.
