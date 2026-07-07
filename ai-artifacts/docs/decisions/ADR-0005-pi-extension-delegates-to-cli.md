# ADR-0005: Pi Extension Delegates to CLI via Spawn

> **Quick Reference** | Status: Accepted | Date: 2026-06-27
> **Decision**: Keep the Pi extension thin: it finds the compiled CLI and spawns it with the spec on stdin.
> **Context**: The Pi tool needs to create artifacts from inside the agent runtime without duplicating CLI logic.
> **Alternatives**: Import shared logic directly, long-running HTTP server
> **Impact**: Pi extension, CLI interface, `create` command, spawn handling

---

## Context

The Pi tool `create_visual_artifact` must validate, write, and serve artifacts from the agent runtime. Reimplementing this logic in the extension would duplicate the CLI and drift out of date.

## Decision

**The Pi extension delegates to the compiled CLI via a spawn.**

`pi-extension/visual-artifact.ts` resolves the `visual-artifact` binary, passes the spec as JSON through stdin, and returns the URL parsed from the CLI output.

## Alternatives Considered

| Option | Pros | Cons | Why Not |
|--------|------|------|---------|
| Import shared logic directly | Fewer processes | Ties extension to CLI internals and Bun runtime | Extension should not depend on CLI source |
| Long-running HTTP server | Cleaner API | Requires process management and lifecycle handling | Too much infrastructure for a local tool |

## Consequences

- **Positive**: Single implementation surface; CLI can be tested independently.
- **Negative**: Spawn interface is brittle (e.g., stdin/TTY detection, JSON output pollution, exit codes).
- **Requires**: Stable CLI output contract and careful stdout/stderr handling.

## Related

- [ADR-0004](./ADR-0004-compiled-bun-cli.md): The CLI being spawned.
