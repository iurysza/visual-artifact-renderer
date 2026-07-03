# Architectural Decision Records

Quick reference index for all architectural decisions. Read this file first to identify relevant ADRs.

## Active Decisions

| ADR | Decision | Impact | Date |
|-----|----------|--------|------|
| [0001](./ADR-0001-json-spec-and-exported-contract.md) | JSON spec and exported Zod contract | Agent surface, schema, manifest, contract, renderer | 2026-06-11 |
| [0002](./ADR-0002-static-export-live-server-fallback-shells.md) | Static export with live server and fallback shells | Build, serve, routing, static export | 2026-06-17 |
| [0003](./ADR-0003-self-contained-skill-directory.md) | Self-contained skill directory | Repo structure, installation | 2026-06-27 |
| [0004](./ADR-0004-compiled-bun-cli.md) | Compiled Bun CLI replacing bash wrappers | CLI, build, installation | 2026-06-27 |
| [0005](./ADR-0005-pi-extension-delegates-to-cli.md) | Pi extension delegates to CLI via spawn | Pi extension, CLI interface | 2026-06-27 |
| [0006](./ADR-0006-adapter-registry-node-rendering.md) | Adapter registry for node rendering | Renderer, adapters, registry | 2026-06-11 |

## Superseded Decisions

(none)

## By Category

### Agent Surface, Contract & Rendering
- [ADR-0001](./ADR-0001-json-spec-and-exported-contract.md): JSON spec and exported Zod contract
- [ADR-0006](./ADR-0006-adapter-registry-node-rendering.md): Adapter registry for node rendering

### Build, Serve & Runtime
- [ADR-0002](./ADR-0002-static-export-live-server-fallback-shells.md): Static export with live server and fallback shells

### Packaging & Tooling
- [ADR-0003](./ADR-0003-self-contained-skill-directory.md): Self-contained skill directory
- [ADR-0004](./ADR-0004-compiled-bun-cli.md): Compiled Bun CLI replacing bash wrappers
- [ADR-0005](./ADR-0005-pi-extension-delegates-to-cli.md): Pi extension delegates to CLI via spawn
