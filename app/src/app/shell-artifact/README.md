# shell-artifact — live-fallback shell

**Infrastructure route. Do not delete. Do not add content here.**

This page is a generic client-side shell served by `cli serve`
(`cli/src/commands/serve.ts`, `serveLiveArtifactShell`) when an artifact
JSON exists on disk but was created **after the last `pnpm build`** — so new
artifacts render without rebuilding the static export.

The client (`ClientArtifactLoader`) resolves `<project>/<slug>` from the URL
and fetches the artifact JSON at runtime.

Renaming or removing this route breaks the new-artifact-without-rebuild
feature. The folder name is reserved in the exclusion lists of
`serve.ts` (`artifactRouteFromPath`) and
`src/lib/artifacts/paths.ts` (`artifactParamsFromPath`).
