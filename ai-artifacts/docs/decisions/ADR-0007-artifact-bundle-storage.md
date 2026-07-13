# ADR-0007: Artifact Bundle Storage

> **Quick Reference** | Status: Accepted | Date: 2026-07-06
> **Decision**: Store each artifact as a directory bundle with `artifact.json`, `annotations.json`, and `assets/`.
> **Context**: Artifacts now need sidecar annotations and assets without mutating the core spec or rebuilding the renderer.
> **Alternatives**: Flat `<slug>.json` files, separate annotation sidecars beside flat files, external database first, backward-compatible dual reader
> **Impact**: CLI create/list/serve/open, artifact paths, annotations, assets, migrations, docs

---

## Context

The original storage shape saved each artifact as one flat JSON file. Annotation threads and sidecar assets need to travel with the artifact, but they should not be embedded in the `VisualArtifactSpec` itself.

## Decision

**Store every artifact as a bundle directory.**

The canonical layout is:

```text
<artifacts-root>/<project>/<slug>/
  artifact.json
  annotations.json
  assets/
```

Public page URLs stay `/<project>/<slug>/`; runtime data URLs point inside the bundle.

## Alternatives Considered

| Option | Pros | Cons | Why Not |
|--------|------|------|---------|
| Flat `<slug>.json` | Simple old model | No clean home for annotations/assets | Too small for collaboration |
| Flat spec + sibling sidecars | Less migration | Scatters one artifact across files | Bundle is easier to copy/share |
| External database first | Centralized writes | More infra and auth | Overkill for local-first V1 |
| Dual flat + bundle reader | Backward compatibility | More code paths and tests | User accepted no flat compatibility |

## Consequences

- **Positive**: Artifact spec, discussion, and assets are colocated; bundles are copyable and future-proof.
- **Negative**: CLI path logic and migration tooling are more complex than flat files.
- **Requires**: Bundle-aware create/list/serve/open flows, path helpers, verification, and docs.

## Related

- [ADR-0002](./ADR-0002-static-renderer-runtime-artifact-data.md): Runtime data boundary that loads bundle files.
- [README annotations](../../README.md#annotations): User-facing bundle and annotation docs.
- [Architecture: filesystem and URL contracts](../../ARCHITECTURE.md#4-filesystem-and-url-contracts): Current bundle path map.
- [ADR-0011](./ADR-0011-separate-runtime-and-agent-resources.md): Defines the installed runtime artifacts root.
- [Annotation goal](../../ai-artifacts/goals/visual-artifact-annotations/goal.md): Original bundle-storage requirement.
