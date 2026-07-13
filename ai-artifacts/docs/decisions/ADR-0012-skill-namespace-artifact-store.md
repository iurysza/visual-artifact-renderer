# ADR-0012: Skill-Namespace Artifact Store

> **Quick Reference** | Status: Accepted | Date: 2026-07-13
> **Decision**: Store local artifacts under `~/.agents/skills/visual-artifact/artifacts` for source and installed runtimes.
> **Context**: Context-sensitive source and installed stores split user output and let a healthy server expose the wrong collection.
> **Alternatives**: XDG runtime-data store, multi-root overlay server, project-local stores
> **Impact**: CLI defaults, renderer builds, installer, lifecycle state, documentation

---

## Context

Source development and installed CLI execution selected different artifact roots. Users could not see or manage one complete collection, and lifecycle health checked only the server address rather than the store it served.

## Decision

**Use `~/.agents/skills/visual-artifact/artifacts` as the single default local store.**

The skill and extension remain package-managed resources, but artifacts are user-owned output in a stable, discoverable skill namespace. `VISUAL_ARTIFACT_ARTIFACTS_DIR` remains the explicit override.

## Alternatives Considered

| Option | Pros | Cons | Why Not |
|---|---|---|---|
| XDG runtime-data store | Standard mutable-data location | Hidden from the user’s agent workspace | Poor discoverability caused split collections to go unnoticed |
| Multi-root overlay | No migration | Collision and annotation-write precedence | Complexity without user value |
| Project-local stores | Strong locality | Fragmented collection and server selection | Repeats the original failure mode |

## Consequences

- **Positive**: One visible collection for dev and installed renderers; easy backup, inspection, and selective versioning.
- **Negative**: Skill installers must preserve `artifacts/`; the data directory shares a namespace with agent resources.
- **Requires**: Record store identity in server state and never replace `artifacts/` during updates.

## Related

- [ADR-0011](./ADR-0011-separate-runtime-and-agent-resources.md): Superseded; package ownership stays separate, artifact storage does not.
- [ADR-0003](./ADR-0003-self-contained-skill-directory.md): Earlier skill-local model; runtime packages remain separate.
- [ADR-0007](./ADR-0007-artifact-bundle-storage.md): Bundle layout is unchanged.
