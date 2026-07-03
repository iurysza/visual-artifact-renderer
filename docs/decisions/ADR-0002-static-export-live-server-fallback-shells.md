# ADR-0002: Static Export with Live JSON Server and Fallback Shells

> **Quick Reference** | Status: Accepted | Date: 2026-06-17
> **Decision**: Build the Next.js renderer to a static `out/`, serve it with a custom server that exposes live artifact JSON from disk, and use generic fallback shells for routes created after the last build.
> **Context**: New artifacts must appear without rebuilding the renderer, and the app must work on localhost and Tailscale, but static export only knows routes that existed at build time.
> **Alternatives**: `next dev`, Next.js production server, plain static file server, rebuild after every artifact, pre-generate all possible routes
> **Impact**: Build pipeline, CLI `serve`, static export, live data endpoints, app routing, URL namespace, client loaders, `paths.ts`

---

## Context

The renderer needs to be easy to serve locally, but artifacts are created continuously by agents. Rebuilding the entire Next.js app after every artifact is too slow. At the same time, static export prerenders only the routes that existed at build time, so a new artifact created later would 404 without a fallback.

## Decision

**Static export plus a custom live-data server, with generic fallback shells for dynamic routes.**

`skill/app` builds to `out/` via `next export`. The CLI `serve` command hosts the static files and adds JSON endpoints that read the artifact store directly from disk. For routes created after the last build, `live-artifact/page.tsx` and `live-project/page.tsx` catch unknown paths, parse the project/slug from the URL, and fetch JSON from the live data endpoint.

## Alternatives Considered

| Option | Pros | Cons | Why Not |
|--------|------|------|---------|
| `next dev` | Hot reload, dynamic routes | Not suitable for production-like local use, slower startup | Needed a deployable static artifact |
| Next.js production server | Dynamic routes, API routes | Heavier, requires Node runtime, more complex | Overkill for a local presentation layer |
| Plain static file server | Simple | Cannot expose live JSON indexes or new routes | Would require a separate data API |
| Rebuild after every artifact | Clean static routes | Too slow and disruptive during agent workflows | Breaks the instant-creation promise |
| Pre-generate all possible routes | No client-side logic | Impossible; project/slug space is open-ended | Not feasible |

## Consequences

- **Positive**: New artifacts appear instantly without a rebuild; full routing control; lightweight deployment; new routes work without rebuilding.
- **Negative**: Code changes require `pnpm build` and server restart; custom server must be maintained; routing logic moves into the browser; URL namespace must remain predictable.
- **Requires**: URL parsing utilities in `paths.ts`, consistent server fallback behavior, and live-data endpoint implementation.

## Related

- [ADR-0001](./ADR-0001-json-spec-and-exported-contract.md): The data shape served by the live server.
