# ADR-0002: Static Renderer with Runtime Artifact Data

> **Quick Reference** | Status: Accepted | Date: 2026-06-17
> **Decision**: Keep the renderer as a static artifact and load visual artifact JSON through a stable runtime data boundary.
> **Context**: New artifacts must become available without rebuilding the renderer, and the delivery model should not be tied to one storage backend or host runtime.
> **Alternatives**: Bundle artifacts at build time, full dynamic app server, rebuild after every artifact, pre-generate every route
> **Impact**: Build pipeline, artifact storage, data endpoints, routing, client loaders, hosting model

---

## Context

The renderer changes less often than the artifacts it displays. Artifacts are created continuously by agents, so tying artifact availability to renderer rebuilds would make local use slow and hosted use rigid.

## Decision

**Separate renderer delivery from artifact data delivery.**

The UI is delivered as a static renderer shell. Artifact specs, project indexes, and artifact indexes are loaded through stable runtime JSON paths. The storage and hosting layer behind those paths is an implementation detail, allowing local filesystem storage today and other delivery/storage models later.

## Alternatives Considered

| Option | Pros | Cons | Why Not |
|--------|------|------|---------|
| Bundle artifacts at build time | Simple static output | Every artifact change requires a rebuild | Too slow for agent-created artifacts |
| Full dynamic app server | One runtime owns routes and data | Heavier hosting/runtime requirements | Overkill for a mostly static renderer |
| Rebuild after every artifact | Clean generated routes | Slow and disruptive during agent workflows | Breaks instant creation |
| Pre-generate every route | No runtime route fallback for known artifacts | Requires complete project/slug inventory at build time; new artifacts would 404 until another build | Agents create projects and slugs after deploy, so the full route set cannot be known ahead of time |

## Consequences

- **Positive**: Artifacts can change independently from renderer deploys; hosting and storage can evolve behind a stable data boundary.
- **Negative**: The data URL contract must remain stable; route fallback and client loading behavior need careful ownership.
- **Requires**: Clear path helpers, runtime JSON validation, and an artifact data boundary that can support more than one storage or hosting adapter.

## Related

- [ADR-0001](./ADR-0001-json-spec-and-exported-contract.md): The artifact data shape loaded at runtime.
