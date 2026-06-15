# Visualizer Serving Architecture Review — Implementation Handoff

## Overall Goal (keep this in mind at all times)

Visualizer turns constrained JSON specs into polished report/plan/dashboard pages. The JSON lives in `~/.pi/artifacts/<project>/<slug>.json`. The artifact must be reachable through **three deployment shapes** without brittle path hardcoding:

1. **Local Next.js dev**: `pnpm dev` on `http://localhost:9999/artifacts/<project>/<slug>/`
2. **Local static server (+ Tailscale)**: `pnpm build && pnpm serve` on `http://localhost:9999/artifacts/<project>/<slug>/` (also directly on the Tailscale IP and proxied through `tailscale serve --set-path /artifacts/`)
3. **ThoughtBox (Gatsby) blog**: copied into `static/artifacts/` and served at `https://<blog>/artifacts/<project>/<slug>/`

The canonical public URL shape is `/artifacts/<project>/<slug>/` with a trailing slash.

## Current Architecture

```
Pi extension (~/.pi/agent/extensions/visual-artifact.ts)
  → writes ~/.pi/artifacts/<project>/<slug>.json
  → returns URL to user

Visualizer (Next.js 16, basePath: "/artifacts")
  → static export to out/
  → routes: /[project]/[slug] → rendered as /artifacts/<project>/<slug>/
  → ClientArtifactLoader fetches /artifacts/data/artifacts/<project>/<slug>.json
  → scripts/serve.mjs serves out/ under /artifacts/ (also root for Tailscale proxy)

thought-box (Gatsby)
  → scripts/visualizer-sync.ts builds visualizer, copies out/ → static/artifacts/
  → copies ~/.pi/artifacts/* → static/artifacts/data/artifacts/
  → keeps backwards-compat copy at static/visualizer/artifacts/
  → gatsby-node.ts mounts /artifacts and /visualizer in dev
```

## Issues Found

### 1. URL returned by the Pi extension is wrong for every deployment target

In `~/.pi/agent/extensions/visual-artifact.ts`:

```ts
const DEFAULT_BASE_URL = "http://localhost:9999"
const url = `${process.env.VISUAL_ARTIFACT_BASE_URL ?? DEFAULT_BASE_URL}/${projectName}/${spec.slug}`
```

This returns `http://localhost:9999/<project>/<slug>` — missing `/artifacts` basePath and missing trailing slash. Both `pnpm dev` and `pnpm serve` serve the app under `/artifacts/`, and thought-box serves it under `/artifacts/`. The returned URL is a 404 in every target environment. The README documents sample URLs with `/artifacts/.../` and a tool-returned URL without `/artifacts/.../`; these contradict each other.

### 2. Path construction is duplicated and easy to drift

The canonical path is assembled in at least five places:

- `~/.pi/agent/extensions/visual-artifact.ts` (tool-returned URL)
- `src/app/page.tsx` (project card `href`)
- `src/app/[project]/page.tsx` (artifact card `href`)
- `src/components/client-artifact-loader.tsx` (runtime fetch path)
- `scripts/visual-qa.mjs` (default QA URL)
- `scripts/serve.mjs` (mount path + data path)
- `thought-box/scripts/visualizer-sync.ts` (target dir + data dir)
- `thought-box/gatsby-node.ts` (static mount path)

There is no single source of truth. Changing the mount/base path requires touching many files across two repos.

### 3. ClientArtifactLoader hardcodes an absolute path

```ts
fetch(`/artifacts/data/artifacts/${project}/${slug}.json`)
```

This happens to work for the static server and thought-box because they serve `/artifacts/data/artifacts/...`, but it silently fails in `pnpm dev` (Next.js dev has no handler for that path). The component ignores fetch errors when `initialSpec` is present, so the bug is hidden. A relative or basePath-aware path would be more robust and would also work if the app is ever mounted under a different prefix.

### 4. serve.mjs has confusing dual-path logic

`stripMountPath` returns the path unchanged when it does not start with `MOUNT_PATH`, effectively serving the same content at both `/artifacts/...` and `/...`. The comment says this is for Tailscale Serve, but the behavior is implicit and the interaction with the client-side fetch path is fragile:

- Direct Tailscale IP access: browser hits `/artifacts/data/artifacts/...` → server strips `/artifacts` → serves `/data/artifacts/...` ✓
- Tailscale proxy (`--set-path /artifacts/`): browser hits `/artifacts/data/artifacts/...` → proxy strips `/artifacts` → backend sees `/data/artifacts/...` ✓
- Root access without prefix: browser hits `/data/artifacts/...` → server does not strip, serves `/data/artifacts/...` ✓

It works, but only by accident. The mount path and data path should be explicit, tested, and documented.

### 5. thought-box sync hardcodes the visualizer repo path

```ts
const visualizerPath = path.join(os.homedir(), 'projects', 'my-repos', 'vibe-coded', 'visualizer');
```

This breaks on any other machine or checkout location. It should be configurable (env var) with a sensible default.

### 6. Backwards-compat copy in thought-box duplicates the entire bundle

`visualizer-sync.ts` copies the built visualizer into both `static/artifacts/` and `static/visualizer/artifacts/`. This doubles deploy size and build time. The migration report says this was requested, but we should at least make it explicit and configurable, and consider redirecting old URLs instead of duplicating files.

### 7. Path-traversal guard in serveArtifactJson is slightly off

```ts
if (!filePath.startsWith(ARTIFACTS_DIR + path.sep) && filePath !== ARTIFACTS_DIR) {
```

It works, but `path.join` + `startsWith` is easy to get wrong. Use a single `path.resolve` and a clean prefix check.

### 8. Build output can be stale

`out/` is gitignored and currently contains HTML with `/visualizer` links even though `next.config.ts` now uses `basePath: "/artifacts"`. Any future changes must force a rebuild before validating.

## Proposed Changes (pragmatic, minimal)

1. **Single source of truth for paths in visualizer**
   - Add `src/lib/paths.ts` exporting `BASE_PATH`, `ARTIFACT_DATA_PATH`, `artifactDataUrl(project, slug)`, `artifactPageUrl(project, slug)`, etc.
   - Use these helpers in pages, client loader, and QA script.

2. **Fix the Pi extension URL**
   - Change `DEFAULT_BASE_URL` to `http://localhost:9999/artifacts`.
   - Append trailing slash: `${baseUrl}/${projectName}/${spec.slug}/`.
   - Document `VISUAL_ARTIFACT_BASE_URL` semantics: it is the *root* of the visualizer deployment (e.g. `http://localhost:9999/artifacts` or `https://blog.example.com/artifacts`).

3. **Make ClientArtifactLoader basePath-aware**
   - Derive the JSON URL from `window.location` or from an injected base path, falling back to `/artifacts/data/artifacts/...`.
   - Keep the initialSpec fallback so dev mode stays fast, but surface a warning when the fetch fails.

4. **Clean up scripts/serve.mjs**
   - Keep the dual `/artifacts` + root behavior because Tailscale relies on it, but make it explicit and add tests/validation.
   - Fix path-traversal guard.
   - Add clear startup log lines showing both the `/artifacts/` URL and the root URL.

5. **Clean up thought-box visualizer-sync.ts**
   - Read visualizer path from `VISUALIZER_REPO` env var, defaulting to `~/projects/my-repos/vibe-coded/visualizer`.
   - Read target mount path from `VISUALIZER_MOUNT_PATH` env var, defaulting to `artifacts`.
   - Make the backwards-compat copy optional via `VISUALIZER_LEGACY_MOUNT_PATH=visualizer/artifacts` (default on for now to avoid breaking old URLs).
   - Use `fs.cp` with `recursive: true` instead of shelling out to `cp -R` when possible.

6. **Update README and migration doc**
   - Make the canonical URL shape consistent everywhere.
   - Document the env vars.

7. **Rebuild and validate**
   - `pnpm build` in visualizer to regenerate `out/`.
   - `pnpm serve` and hit the local `/artifacts/` URL.
   - Test Tailscale-shaped access by hitting the root path directly.
   - `npm run visualizer:sync` in thought-box and `npm run dev` to verify blog serving.

## Files to Touch

### visualizer repo

- `src/lib/paths.ts` (new)
- `src/app/page.tsx`
- `src/app/[project]/page.tsx`
- `src/components/client-artifact-loader.tsx`
- `scripts/serve.mjs`
- `scripts/visual-qa.mjs`
- `README.md`

### Pi extension (outside repo but part of the tool)

- `~/.pi/agent/extensions/visual-artifact.ts`
  - This file is outside the project directory. You have permission to read/write it for this task.

### thought-box repo

- `scripts/visualizer-sync.ts`
- `gatsby-node.ts` (minor: use env-driven mount paths if needed)
- `README.md`

## Validation Plan

1. `cd /Users/iurysouza/projects/my-repos/vibe-coded/visualizer && pnpm lint && pnpm verify:artifacts && pnpm build`
2. Start `pnpm serve` on port 9999.
3. `curl -s http://127.0.0.1:9999/artifacts/visualizer/agent-stack-report/ | head` should return HTML.
4. `curl -s http://127.0.0.1:9999/artifacts/data/artifacts/visualizer/agent-stack-report.json | jq .title` should return the artifact title.
5. Simulate Tailscale proxy by curling root paths: `curl -s http://127.0.0.1:9999/visualizer/agent-stack-report/` and `curl -s http://127.0.0.1:9999/data/artifacts/visualizer/agent-stack-report.json | jq .title`.
6. In thought-box: `npm run visualizer:sync`, then `npm run dev`, then open `http://localhost:8000/artifacts/visualizer/agent-stack-report/`.
7. Run visual QA or screenshot the final page.

## Non-Goals

- Do not switch from Next.js static export to a runtime server.
- Do not remove the backwards-compat `/visualizer/artifacts/` alias yet; just make it explicit and configurable.
- Do not add new dependencies.
- Do not change the artifact schema or node types.

## Blockers to Watch

- `out/` is stale; a rebuild is mandatory before testing.
- The Pi extension file lives outside the repo (`~/.pi/agent/extensions/visual-artifact.ts`), so changes there are not tracked by git in the visualizer repo. Note this in the final report.
- thought-box uses npm while visualizer uses pnpm; the sync script shells out to `pnpm run build` inside the visualizer dir, so `pnpm` must be available.
- Tailscale proxy behavior depends on `tailscale serve --set-path /artifacts/` stripping the prefix. Our test simulates that with direct root-path curls.
