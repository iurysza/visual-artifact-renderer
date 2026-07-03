# ADR-0004: Compiled Bun CLI Replacing Bash Wrappers

> **Quick Reference** | Status: Accepted | Date: 2026-06-27
> **Decision**: Replace bash wrappers (`vaz-serve`, `vaz-doctor`, etc.) with a single `visual-artifact` binary compiled by Bun from `skill/cli`.
> **Context**: Multiple bash wrappers duplicated logic and made Pi integration and testing inconsistent.
> **Alternatives**: Keep bash wrappers, ship both wrappers and CLI
> **Impact**: CLI code, build step, Pi extension, installation

---

## Context

The original workflow relied on several bash scripts (`vaz-serve`, `vaz-doctor`, etc.) to wrap renderer commands. These were inconsistent, hard to test, and required separate shell maintenance.

## Decision

**Implement a single compiled CLI in `skill/cli` using Bun.**

`skill/cli/src/main.ts` defines subcommands (`create`, `serve`, `validate`, `list`, `open`, `doctor`, `bootstrap`). `bun build` compiles the binary to `~/.pi/bin/visual-artifact`.

## Alternatives Considered

| Option | Pros | Cons | Why Not |
|--------|------|------|---------|
| Keep bash wrappers | No build step | Duplicated logic, fragile, hard to test | Inconsistent with the project goals |
| Ship both wrappers and CLI | Backward compatibility | Two surfaces to maintain | Not worth the overhead |

## Consequences

- **Positive**: Single tested executable, consistent interface, easy Pi integration.
- **Negative**: Requires Bun and a build step before commands work.
- **Requires**: `bootstrap` command and bundled fallback contract in the CLI.

## Related

- [ADR-0005](./ADR-0005-pi-extension-delegates-to-cli.md): Pi extension uses this CLI.
- [ADR-0003](./ADR-0003-self-contained-skill-directory.md): CLI lives inside the skill directory.
