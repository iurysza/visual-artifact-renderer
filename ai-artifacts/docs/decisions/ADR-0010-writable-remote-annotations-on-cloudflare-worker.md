# ADR-0010: Writable Remote Annotations on Cloudflare Worker

> **Quick Reference** | Status: Accepted | Date: 2026-07-07
> **Decision**: The Cloudflare Worker persists annotation mutations to R2 so published artifacts support remote comments.
> **Context**: ADR-0008 made annotations local-first, leaving static deployments read-only; BYO Cloudflare publishing now gives us a writable backend.
> **Alternatives**: Keep 501 read-only, require auth before writes, queue mutations for local sync
> **Impact**: Worker routes, R2 writes, annotation validation, published artifact UX

---

## Context

ADR-0008 chose local-first annotation persistence because a static export cannot write JSON back to disk. With BYO Cloudflare publishing, the Worker already has write access to the R2 bucket that stores artifact bundles, so the read-only limitation is no longer necessary for that deployment mode.

## Decision

**The Worker accepts, validates, and persists annotation mutations to R2.**

`POST /api/annotations/<project>/<slug>` reads the existing `annotations.json` (or starts from an empty document), applies the mutation array sequentially, writes the updated document back to R2, and returns it to the client. `GET /api/annotations/author` returns a local fallback author because the Worker has no access to the viewer's git identity.

## Alternatives Considered

| Option | Pros | Cons | Why Not |
|--------|------|------|---------|
| Keep 501 read-only | Simple, no write surface | Shared artifacts cannot be annotated | Defeats the purpose of shareable URLs |
| Require auth before writes | Prevents abuse | Adds identity/auth scope to a solo BYO tool | Too much for this MVP; auth can be added later |
| Queue mutations for local sync | No server writes | Complex merge, delayed persistence, poor UX | Worker + R2 already gives us immediate persistence |

## Consequences

- **Positive**: Published artifacts support threaded comments out of the box.
- **Negative**: No authentication; anyone with the URL can post, edit, or delete comments. Concurrent writes are last-write-wins.
- **Requires**: Worker-side mutation parsing/validation, R2 `put` handling, tests for each mutation type, and doc updates.

## Related

- [ADR-0008](./ADR-0008-local-first-annotation-persistence.md): Local-first annotation persistence; static deployments remain read-only unless served by this Worker.
- [ADR-0009](./ADR-0009-cloudflare-workers-r2-remote-publishing.md): BYO Cloudflare publishing provides the Worker and R2 backend that make this decision possible.
