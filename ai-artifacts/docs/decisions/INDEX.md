# Architectural Decision Records

Quick reference index for all architectural decisions. Read this file first to identify relevant ADRs.

## Active Decisions

| ADR | Decision | Impact | Date |
|-----|----------|--------|------|
| [0001](./ADR-0001-json-spec-and-exported-contract.md) | JSON spec and exported Zod contract | Agent surface, schema, manifest, contract, renderer | 2026-06-11 |
| [0010](./ADR-0010-writable-remote-annotations-on-cloudflare-worker.md) | Writable remote annotations on Cloudflare Worker | Worker routes, R2 writes, annotation validation, published artifact UX | 2026-07-07 |
| [0002](./ADR-0002-static-renderer-runtime-artifact-data.md) | Static renderer with runtime artifact data | Build, storage, routing, hosting | 2026-06-17 |
| [0004](./ADR-0004-compiled-bun-cli.md) | Compiled Bun CLI replacing bash wrappers | CLI, build, installation | 2026-06-27 |
| [0005](./ADR-0005-pi-extension-delegates-to-cli.md) | Pi extension delegates to CLI via spawn | Pi extension, CLI interface | 2026-06-27 |
| [0006](./ADR-0006-adapter-registry-node-rendering.md) | Adapter registry for node rendering | Renderer, adapters, registry | 2026-06-11 |
| [0007](./ADR-0007-artifact-bundle-storage.md) | Artifact bundle storage | CLI storage, paths, annotations, assets | 2026-07-06 |
| [0008](./ADR-0008-local-first-annotation-persistence.md) | Local-first annotation persistence | Annotation schema, CLI API, renderer, static hosting | 2026-07-06 |
| [0011](./ADR-0011-separate-runtime-and-agent-resources.md) | Separate runtime, agent-resource, and artifact-data ownership | Installer, Pi package, skill distribution, artifact paths | 2026-07-10 |

## Proposed Decisions

| ADR | Decision | Impact | Date |
|-----|----------|--------|------|
| [0009](./ADR-0009-cloudflare-workers-r2-remote-publishing.md) | Cloudflare Workers and R2 for remote artifact publishing | Hosted deployment, CLI publish, R2, cache, auth | 2026-07-06 |

## Superseded Decisions

| ADR | Was | Replaced By | Date |
|-----|-----|-------------|------|
| [0003](./ADR-0003-self-contained-skill-directory.md) | Self-contained skill-owned installation and storage | [ADR-0011](./ADR-0011-separate-runtime-and-agent-resources.md) | 2026-07-10 |

## By Category

### Agent Surface, Contract & Rendering
- [ADR-0001](./ADR-0001-json-spec-and-exported-contract.md): JSON spec and exported Zod contract
- [ADR-0006](./ADR-0006-adapter-registry-node-rendering.md): Adapter registry for node rendering

### Build, Serve & Runtime
- [ADR-0002](./ADR-0002-static-renderer-runtime-artifact-data.md): Static renderer with runtime artifact data

### Packaging & Tooling
- [ADR-0004](./ADR-0004-compiled-bun-cli.md): Compiled Bun CLI replacing bash wrappers
- [ADR-0005](./ADR-0005-pi-extension-delegates-to-cli.md): Pi extension delegates to CLI via spawn
- [ADR-0011](./ADR-0011-separate-runtime-and-agent-resources.md): Separate runtime and agent-resource installation

### Storage & Annotations
- [ADR-0007](./ADR-0007-artifact-bundle-storage.md): Artifact bundle storage
- [ADR-0008](./ADR-0008-local-first-annotation-persistence.md): Local-first annotation persistence

### Hosted Publishing
- [ADR-0009](./ADR-0009-cloudflare-workers-r2-remote-publishing.md): Cloudflare Workers and R2 for remote artifact publishing (Proposed)
- [ADR-0010](./ADR-0010-writable-remote-annotations-on-cloudflare-worker.md): Writable remote annotations on Cloudflare Worker
