# shell-project — live-fallback shell

**Infrastructure route. Do not delete. Do not add content here.**

This page is a generic client-side shell served by `cli serve`
(`cli/src/commands/serve.ts`, `serveLiveProjectIndexShell`) when a
project exists on disk but was created **after the last `pnpm build`** — so
new project indexes render without rebuilding the static export.

The client (`ProjectIndexLoader`) resolves the project name from the URL and
fetches the project index JSON at runtime.

Renaming or removing this route breaks the new-project-without-rebuild
feature. The folder name is reserved in the exclusion lists of
`serve.ts` (`projectIndexRouteFromPath`) and
`src/lib/artifacts/paths.ts` (`projectParamsFromPath`).
