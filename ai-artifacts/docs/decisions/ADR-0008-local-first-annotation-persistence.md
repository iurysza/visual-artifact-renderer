# ADR-0008: Local-First Annotation Persistence

> **Quick Reference** | Status: Accepted | Date: 2026-07-06
> **Decision**: Persist annotation threads in each bundle's `annotations.json` through local CLI mutation APIs.
> **Context**: The renderer needs Google-Docs-style comments, but browser JavaScript cannot write static files on its own.
> **Alternatives**: Store comments inside `artifact.json`, browser memory/localStorage only, hosted database, Git-backed sync first
> **Impact**: Annotation schema, CLI serve API, renderer provider, local author identity, static-hosting limitations

---

## Context

Annotations are collaboration state, not part of the visual artifact spec. Local Visualizer can persist them because the CLI server has filesystem access; a static hosted page can serve JSON but cannot write JSON back to disk.

## Decision

**Use local-first annotation persistence.**

The renderer loads `annotations.json`, posts mutations to `/api/annotations/<project>/<slug>`, and the CLI validates and writes the updated document. Authors are inferred from local git config with a local fallback.

## Alternatives Considered

| Option | Pros | Cons | Why Not |
|--------|------|------|---------|
| Embed comments in `artifact.json` | One file | Pollutes agent-facing spec | Comments should evolve independently |
| Memory/localStorage only | Very simple | Not shareable or cloneable | Loses collaborative history |
| Hosted DB first | Real multi-user writes | Auth/backend scope | V1 is local-first |
| Git-backed sync first | Reviewable history | More workflow machinery | Later option, not V1 |

## Consequences

- **Positive**: Comments are versionable JSON beside the artifact and use the same local workflow.
- **Negative**: Static deployments are read-only for comments until a writable backend or Git flow exists.
- **Requires**: Shared annotation validation, CLI mutation endpoints, optimistic UI rollback, and clear static-hosting copy.

## Related

- [ADR-0007](./ADR-0007-artifact-bundle-storage.md): `annotations.json` lives inside the artifact bundle.
- [README local-only writes](../../README.md#local-only-writes): User-facing static-hosting limitation.
- [Architecture: render annotations](../../ai-artifacts/ARCHITECTURE.md#33-render-annotations): Current read/write flow.
- [Semantic map: annotation mutation](../../ai-artifacts/SEMANTIC_MAP.md#annotation-mutation): Boundary flow.
- [Annotation interview notes](../../ai-artifacts/goals/visual-artifact-annotations/interview.md#static-hosting-write-explainer): Research/spec context.
