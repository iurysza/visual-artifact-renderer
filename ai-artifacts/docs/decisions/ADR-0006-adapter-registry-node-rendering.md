# ADR-0006: Adapter Registry Pattern for Node Rendering

> **Quick Reference** | Status: Accepted | Date: 2026-06-11
> **Decision**: Maintain an explicit `componentRegistry` that maps `node.type` to a trusted adapter, with separate leaf, layout, and data-backed adapters.
> **Context**: The renderer must turn typed JSON nodes into React components safely and predictably.
> **Alternatives**: Runtime string resolution, dynamic imports, `eval`
> **Impact**: Renderer, component registry, adapters, node types

---

## Context

Each `node.type` in a spec must resolve to a concrete renderer. The mapping must be type-safe, auditable, and free from arbitrary code execution.

## Decision

**Use an explicit adapter registry.**

`componentRegistry` in `component-registry.tsx` maps each node type to a trusted adapter component. Adapters are split into leaf, layout, and data-backed categories based on their responsibilities.

## Alternatives Considered

| Option | Pros | Cons | Why Not |
|--------|------|------|---------|
| Runtime string resolution | Flexible | No type safety, easy to inject invalid components | Violates safety model |
| Dynamic imports | Lazy loading | Async complexity, harder to audit | Not needed for the current node set |
| `eval` or `new Function` | Maximum flexibility | Arbitrary code execution | Catastrophically unsafe |

## Consequences

- **Positive**: Type-safe, tree-shakeable, auditable, and easy to reason about.
- **Negative**: Adding a node type requires editing the registry, adding an adapter, and updating the contract.
- **Requires**: Strict node type definitions and a clear adapter boundary.

## Related

- [ADR-0001](./ADR-0001-json-spec-and-exported-contract.md): Why JSON-to-adapter rendering is the core model.
