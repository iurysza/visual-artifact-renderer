# URL shape migration report

Canonical public URL is now `/artifacts/<project>/<slug>/`.

## Commands run

| Repo | Command | Exit code | Notes |
|------|---------|-----------|-------|
| visualizer | `pnpm lint` | 0 | 3 pre-existing unused-var warnings, not related to this change |
| visualizer | `pnpm build` | 0 | Static export produced expected routes |
| visualizer | `pnpm verify:artifacts` | 0 | Verified 9 specs + 22 manifest entries |
| thought-box | `npm run lint:types` | 0 | `tsc --noEmit` passed |

## Visualizer changes

- `next.config.ts`: `basePath` changed from `/visualizer` to `/artifacts`.
- Routes moved so `basePath + route` stays `/artifacts/<project>/<slug>/`:
  - `src/app/artifacts/[project]/page.tsx` → `src/app/[project]/page.tsx`
  - `src/app/artifacts/[project]/[slug]/page.tsx` → `src/app/[project]/[slug]/page.tsx`
- `src/app/page.tsx`: project card `href` changed from `/artifacts/${project.name}` to `/${project.name}` (Next.js prepends `basePath`).
- `src/app/[project]/page.tsx`: artifact card `href` changed from `/artifacts/${project}/${artifact.slug}` to `/${project}/${artifact.slug}`.
- `src/components/client-artifact-loader.tsx`: runtime fetch path changed from `/visualizer/data/artifacts/...` to `/artifacts/data/artifacts/...`.
- `scripts/visual-qa.mjs`: default URL changed to `http://localhost:9999/artifacts/visualizer/agent-stack-report/`.
- `README.md`: sample URLs and tool-returned URL updated to new canonical shape with trailing slash.

## ThoughtBox changes

- `scripts/visualizer-sync.ts`:
  - Now copies the built visualizer into `static/artifacts/`.
  - Copies Pi artifact JSON into `static/artifacts/data/artifacts/`.
  - Keeps a backwards-compat copy at `static/visualizer/artifacts/` so old `/visualizer/artifacts/...` URLs still work after deploy.
- `gatsby-node.ts`:
  - Dev server mounts `/artifacts` → `static/artifacts`.
  - Keeps `/visualizer` mount for backwards-compat alias.
- `README.md`: updated URLs and documented the backwards-compat copy.

## Other file touched

- `~/.pi/agent/extensions/visual-artifact.ts`: tool-returned URL changed from `/artifacts/${projectName}/${spec.slug}` to `/${projectName}/${spec.slug}` so it matches the new `basePath`.

## Compatibility notes

- Old `/visualizer/artifacts/<project>/<slug>/` URLs remain served after a sync/deploy because `visualizer-sync.ts` copies the same bundle into `static/visualizer/artifacts/`.
- Dev server also keeps the `/visualizer` static mount, so local Gatsby dev serves both shapes.
- No redirect is enforced; both paths serve the same content. This is the cheap copying alias approach requested.

## Known leftovers

- Goal-package docs under `ai-artifacts/goals/visual-artifact-renderer/` describe the old route layout. They have unrelated dirty changes, so I left them; they are historical planning docs, not user-facing URLs.
- Existing generated QA/debug outputs under `ai-artifacts/visual-qa/` and `ai-artifacts/mermaid-graph-debug/` still contain old URLs. They are generated artifacts, not source files, and were not rewritten.

## Resolved cleanup

- Removed stale `src/lib/create-visual-artifact.ts`; current source of truth is the Pi extension writing `~/.pi/artifacts/<project>/<slug>.json`.

## Remaining manual steps

1. Run `npm run visualizer:sync` in `thought-box` to populate `static/artifacts/` (and the backwards-compat `static/visualizer/artifacts/` copy).
2. If GitHub Pages is used, confirm `static/.nojekyll` is still committed so `/_next/**` assets are not ignored by Jekyll.
3. Verify a deployed artifact loads at the new canonical URL and that an old `/visualizer/artifacts/...` bookmark still resolves.
