# ADR-0009: Cloudflare Workers and R2 for Remote Artifact Publishing

> **Quick Reference** | Status: Proposed | Date: 2026-07-06
> **Decision**: Use Cloudflare Workers Static Assets for the renderer and R2 for remotely published artifact data.
> **Context**: Visual artifacts need durable public URLs without rebuilding the renderer or depending on localhost.
> **Alternatives**: Cloudflare Pages, KV, Vercel Blob, Netlify Blobs, S3 + CloudFront, full dynamic server
> **Impact**: Hosted deployment, CLI publish flow, artifact data URLs, R2 object layout, cache purge, auth tokens

---

## Context

The renderer is already a static export that loads artifact JSON at runtime. Remote publishing needs to preserve that URL contract while letting the CLI/Pi upload new artifacts independently from renderer deploys.

## Decision

**For hosted publishing, prefer Cloudflare Workers Static Assets plus R2.**

Workers Static Assets serves the static renderer under `/artifacts`; a Worker handles `/artifacts/data/artifacts/*` before static assets and reads artifact bundle data from R2. The CLI can publish validated artifacts directly to R2 and purge changed JSON URLs.

## Alternatives Considered

| Option | Pros | Cons | Why Not |
|--------|------|------|---------|
| Cloudflare Pages | Simple static deploys | Less clean dynamic JSON routing under same prefix | Workers route control fits better |
| Cloudflare KV | Cheap key/value reads | Eventually consistent updates | Artifact writes should be strongly consistent |
| Vercel/Netlify storage | Good platform DX | More lock-in/cost for simple JSON | Cloudflare matches desired hosting shape |
| S3 + CloudFront | Durable and mature | More setup and ops | Heavier than needed |
| Full dynamic server | Maximum flexibility | Runtime/backend overhead | Renderer is mostly static |

## Consequences

- **Positive**: Durable share URLs, no renderer rebuild per artifact, same `/artifacts` path model, cheap edge delivery.
- **Negative**: Requires Cloudflare config, R2 credentials, cache invalidation, and Worker routing knowledge.
- **Requires**: A publish command/flag, R2 object layout, scoped API tokens, index update strategy, and cache purge policy.

## Related

- [ADR-0002](./ADR-0002-static-renderer-runtime-artifact-data.md): Hosted publishing relies on static renderer + runtime data separation.
- [ADR-0007](./ADR-0007-artifact-bundle-storage.md): Remote storage should preserve bundle semantics.
- [Research: Cloudflare remote artifacts](../../ai-artifacts/goals/organization-cleanup/raw-notes/research/cloudflare-remote-artifacts.md): Detailed research, sources, and implementation plan.
- [README local-only writes](../../README.md#local-only-writes): Current local/static boundary this proposal extends.
