# ADR-0011: Separate Runtime and Agent Resource Installation

> **Quick Reference** | Status: Superseded by [ADR-0012](./ADR-0012-skill-namespace-artifact-store.md) | Date: 2026-07-10
> **Decision**: Install the CLI and renderer as runtime files; install the Pi extension and skill through package managers; store artifacts under dedicated runtime data.
> **Context**: Copying agent resources into global discovery paths duplicates Pi package ownership and couples mutable artifacts to replaceable skill files.
> **Alternatives**: Keep convenience copies, bundle resources in release archives, store artifacts under the skill
> **Impact**: Release archives, installer, bootstrap, Pi package, skill distribution, artifact defaults

---

## Context

The release installer copied the CLI, renderer, skill, and Pi extension into unrelated global paths. Official Pi packages and `npx skills` now own agent-resource lifecycle, so those copies create collisions and unclear update/removal behavior.

## Decision

**Separate runtime installation, agent-resource installation, and mutable artifact storage.**

Release archives and bootstrap install only the CLI and renderer. Pi installs the extension and skill from the repository package; other agents install the skill with `npx skills`. Installed artifacts default to `~/.local/share/visual-artifact/artifacts`.

## Alternatives Considered

| Option | Pros | Cons | Why Not |
|---|---|---|---|
| Keep convenience copies | One shell command | Duplicate extensions/skills; unmanaged removal | Conflicts with official package ownership |
| Package resources in release archives | Offline bundle | Two release channels for the same files | Drift and unclear authority |
| Store artifacts under package skill | Colocated files | Package updates may reset mutable data | Runtime data must outlive resources |

## Consequences

- **Positive**: One owner per resource; Pi can list, update, filter, and remove its package cleanly.
- **Negative**: Pi setup uses a runtime install plus `pi install`; other agents use `npx skills` separately.
- **Requires**: No legacy global copies, dedicated artifact data path, updated install and release documentation.

## Related

- [ADR-0012](./ADR-0012-skill-namespace-artifact-store.md): Replaces the dedicated runtime-data store with a stable skill-namespace store.
- [ADR-0003](./ADR-0003-self-contained-skill-directory.md): Superseded skill-owned installation model.
- [ADR-0007](./ADR-0007-artifact-bundle-storage.md): Bundle shape remains unchanged under the new artifacts root.
