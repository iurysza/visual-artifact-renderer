## Context

The current Visualizer stack is local-first: Pi calls the `create_visual_artifact` tool, the tool delegates to the `visual-artifact` CLI, the CLI validates and writes an artifact bundle, and the static renderer serves it from `/artifacts`. Recent Cloudflare research already chose the right remote shape: Cloudflare Workers Static Assets for the renderer, R2 for artifact bundles, and direct CLI uploads to R2.

The missing piece is product setup. The design must work for any user with their own Cloudflare account. It must not assume a hardcoded domain, a maintainer-owned bucket, or manual env-var spelunking.

## Goals / Non-Goals

**Goals:**

- Provide one obvious setup command: `visual-artifact setup cloudflare`.
- Use user-owned Cloudflare resources.
- Make `workers.dev` work before custom domains.
- Save a local non-secret publish profile.
- Let CI and power users configure setup non-interactively.
- Make `visual-artifact create --publish --json` return a remote shareable URL.
- Keep local create/serve behavior unchanged.
- Support writable hosted annotations persisted to R2.

**Non-Goals:**

- Managed Visualizer hosting.
- Billing, accounts, auth, abuse handling, or a central service we operate.

- Multi-provider publishing in the first pass.
- Implementing Cloudflare publishing as part of this OPSX setup task.

## Decisions

### Decision: BYO Cloudflare instead of managed hosting

Users bring their own Cloudflare account, bucket, Worker, credentials, and optional domain. This avoids operating a hosted service while still solving sharing.

Alternative considered: a managed Visualizer cloud. That is a separate product with auth, billing, abuse controls, deletion semantics, and team permissions. Too much for this feature.

### Decision: setup wizard owns the hard parts

`visual-artifact setup cloudflare` validates account access, bucket configuration, Worker deploy, public URL, profile write, and optional smoke publish. Users should not need to understand every Cloudflare object before their first shared artifact.

Alternative considered: document env vars only. That is fine for maintainers, but not productized for normal users.

### Decision: publish profiles separate config from secrets

Store non-secret config under XDG config, for example `~/.config/visual-artifact/publish-profiles/cloudflare.json`. Prefer environment variables for secrets. If local secret persistence is supported, require explicit `--save-secrets` and write outside the repo with mode `0600`.

Alternative considered: store everything in one profile file. Simpler, but too easy to leak credentials.

### Decision: shell-only cloud renderer

The cloud deploy must serve renderer shells and live data from R2. It must not bake local artifact pages into `app/out`. Add a cloud build mode and a leak guard before deploy.

Alternative considered: publish the normal local export. That risks shipping private local artifact pages.

### Decision: Worker reads R2; CLI uploads R2

The CLI uploads `artifact.json`, `annotations.json`, and `assets/*` directly to R2. The Worker serves static assets, R2 JSON/assets, and generated indexes from R2 `list()`.

Alternative considered: upload through a Worker endpoint. That can come later, but it adds auth and body handling before we need it.

### Decision: hosted annotations are writable in MVP

Remote pages can load `annotations.json` and post mutations to `/api/annotations/<project>/<slug>`. The Worker reads the existing document, applies the mutations, and writes the updated document back to R2. Author identity falls back to a local anonymous author because the Worker has no access to the viewer's git config.

Alternative considered: keep hosted annotations read-only. That makes shared artifacts second-class for collaboration; writable comments are small enough to implement safely in MVP using R2 put and the existing mutation schema.

## Risks / Trade-offs

- Cloudflare permissions are confusing → setup must print exact missing permission guidance.
- `workers.dev` URL discovery can be inconsistent → allow explicit `--base-url` override.
- Local secrets can leak → keep secrets out of repos and logs; require explicit consent to save them.
- Cloud build can accidentally include local artifacts → add build mode plus leak verification.
- R2 list indexes can become slow at scale → acceptable for MVP; persisted indexes can come later.
- Pi extension may assume local URLs → keep CLI JSON `url` as the canonical public URL when publish succeeds.

## Migration Plan

1. Land OpenSpec proposal and specs.
2. Implement CLI setup/profile/publish pieces behind explicit flags.
3. Add shell-only cloud build and leak guard.
4. Add Worker package and dry-run deployment checks.
5. Wire `create --publish` to return remote `url`.
6. Update docs and Pi-facing skill notes.
7. Smoke test with one real Cloudflare account and one published artifact.

Rollback is simple before release: remove or disable `setup cloudflare` and `--publish`; local artifact creation remains unchanged.

## Open Questions

- Should local saved secrets be supported in MVP, or env-only first?
- Should setup require Wrangler, use Cloudflare APIs directly, or support both?
- Should `--publish` imply `--no-serve`, or still serve locally for debugging?
