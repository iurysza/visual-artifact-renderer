# ADR-0003: Self-Contained Skill Directory Layout

> **Quick Reference** | Status: Accepted | Date: 2026-06-27
> **Decision**: Collapse the skill into a single `skill/{app,cli,artifacts}` directory so it is portable and self-contained.
> **Context**: The skill was previously split across repo root, `pi-skill/visual-artifact/`, and helper scripts.
> **Alternatives**: Keep scattered root layout, monorepo with shared packages
> **Impact**: Repo structure, skill installation, bootstrap, path resolution

---

## Context

Earlier versions of the tooling were spread across the repo root, a `pi-skill/visual-artifact/` folder, and standalone scripts. This made installation, versioning, and bootstrapping hard to reason about.

## Decision

**Keep the skill as one self-contained directory.**

Everything lives under `skill/`: the Next.js app (`skill/app`), the Bun CLI (`skill/cli`), stored artifacts (`skill/artifacts`), skill docs (`skill/SKILL.md`), and the exported contract (`skill/artifact-contract.json`).

## Alternatives Considered

| Option | Pros | Cons | Why Not |
|--------|------|------|---------|
| Keep scattered root layout | Existing file paths | No clear ownership, hard to install or relocate | Created friction for every change |
| Monorepo with shared packages | Reusable packages | Adds package-graph complexity for a small project | More tooling than value at this scale |

## Consequences

- **Positive**: Single installation target, clear boundaries, easy relocation and versioning.
- **Negative**: Bootstrapping must resolve paths from the skill root; relative-path logic is more constrained.
- **Requires**: `visual-artifact bootstrap` and `VISUAL_ARTIFACT_SKILL_ROOT` override.

## Related

- [ADR-0004](./ADR-0004-compiled-bun-cli.md): CLI also lives inside the skill directory.
