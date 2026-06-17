# URL / Path Cleanup Plan

> Track work for fixing Visualizer URL and path issues.

## Issues

1. Pi extension returns wrong URL (missing `/artifacts` basePath and trailing slash).
2. Path construction duplicated across visualizer pages, loader, serve, QA, and thought-box.
3. `ClientArtifactLoader` hardcodes absolute `/artifacts/data/artifacts/...` path.
4. `serve.mjs` dual-path logic is implicit and fragile.
5. thought-box sync hardcodes visualizer repo path.
6. thought-box duplicates bundle into legacy `/visualizer/artifacts/` path.
7. Path-traversal guard in `serveArtifactJson` could be cleaner.
8. `out/` is stale and must be rebuilt.

## Steps

| # | Task | Owner | Status | Commit |
|---|---|---|---|---|
| 1 | Fix Pi extension `DEFAULT_BASE_URL` and URL shape | subagent | pending | - |
| 2 | Clean up visualizer paths (`src/lib/paths.ts`) and use everywhere | subagent | pending | - |
| 3 | Update thought-box sync to env-driven paths and optional legacy copy | subagent | pending | - |
| 4 | Verify full flow: build, serve, curl, thought-box dev | subagent | pending | - |

## Validation

- `pnpm lint && pnpm verify:artifacts && pnpm build` passes.
- `pnpm serve` serves `/artifacts/<project>/<slug>/` correctly.
- Direct root paths work for Tailscale proxy simulation.
- `create_visual_artifact` returns correct URL with `/artifacts/.../`.
- thought-box `npm run visualizer:sync && npm run dev` serves `/artifacts/.../`.
