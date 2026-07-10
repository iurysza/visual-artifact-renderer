# P1 hardening facts

Observed 2026-07-10. Facts are parent-verified unless marked as prior-audit evidence.

## Repository state

- Branch: `main`.
- Product source started clean.
- User-authorized `npx impeccable update` changed `.agents/skills/impeccable/` and generated `.pi/skills/impeccable/` plus `.codex/hooks.json`.
- Updater output explicitly said it found `.agents` and `.pi`, updated both provider folders to v3.9.1, and installed hooks. Both `.agents/skills` and `.pi/skills` are established tracked repo conventions; `.codex/hooks.json` is an updater-owned hook target.
- Updater output will be isolated in a housekeeping commit; it must not enter P1 implementation commits.
- Accidental `context.md` is absent.
- Runtime `artifacts/` content is generated/ignored and must not be committed.

## Existing verification baseline

- Prior audit: 114 CLI tests passed.
- User confirmed app/shared/worker check panels also passed, then killed those panels.
- Passing checks do not cover the P1 behavior below.

## P1.1 — schema drift

- Renderer schema: strict Zod in `app/src/lib/contract/artifact-schema.ts` plus `schema-helpers.ts`.
- CLI schema: 483-line manual interpreter in `cli/src/validate.ts` driven by manifest strings from `shared/src/contract.ts`.
- `validatePropValue` ends without rejecting unknown signature forms.
- Prior audit reproduced CLI success for payloads the renderer rejects:
  - unknown top-level property;
  - `metadata.id: 123`;
  - `file-tree.props.gitStatus: "not-an-object"`;
  - `diff` without `content` or `before`+`after`.
- `shared/package.json` already depends on Zod and exports `./contract`, so the executable schema can live there without a new runtime dependency.
- App contract export currently calls `createArtifactContract()` from shared, but generated contract strings are documentation, not the renderer's executable schema.
- `app/scripts/verify/verify-artifacts.ts` compares node/data-node sets and parses bundle artifacts, but does not prove generated contract deep equality or all exported constraints.
- `cli/assets/contract.json` is currently ignored, so CI cannot detect an uncommitted generated-contract diff until the file becomes tracked.

## Saved-artifact resource scan

Command: `node ai-artifacts/goals/p1-hardening/scan-artifacts.mjs`

- Parseable saved specs scanned: **82** (bundle artifacts plus legacy JSON specs).
- Max raw bytes: **36,578**.
- Max datasets: **16**.
- Max top-level nodes: **29**.
- Max total nested nodes: **67**.
- Max artifact-node depth: **5**.
- Max file-tree items: **51**.
- Max file-tree depth: **4**.
- Max single embedded string: **6,527 bytes**.
- One historical saved spec retains `src: "src/button.tsx"`; its content is already inlined and the original source no longer resolves from this repo. Validation must not re-read saved artifacts.
- Fresh review parsed all 82 scanner-found specs through the current app Zod schema successfully; clean CI will use tracked representative compatibility fixtures because runtime `artifacts/` are intentionally ignored.
- Therefore the selected limits preserve all observed legitimate artifacts. The advertised 30 top-level-node cap has a one-node margin; the dataset, total-node, depth, and byte limits have larger headroom.

## P1.2 — CLI output/config

- `cli/src/main.ts` advertises global `--json`, `--plain`, `--quiet`, `--verbose`, `--no-color`, and `--no-input`.
- `--json` and `--plain` do not conflict at parse time.
- `--verbose` has no behavior.
- `Logger.output()` uses Bun object inspection in human mode and minified JSON in plain mode.
- `Logger.outputText()` suppresses human primary output under quiet.
- `Logger.color()` only checks `--no-color` and stdout TTY; it ignores `NO_COLOR` and `TERM=dumb`.
- `create --plain` prints the artifact file path while `ai-artifacts/docs/cli.md` calls plain URL-only.
- `open --json` emits a bare URL rather than a JSON document.
- `validate`, `list`, and `doctor` send objects through human-mode Bun inspection.
- `parseInt` is a Commander parser for serve ports and is also used for `VISUAL_ARTIFACT_PORT`.
- Prior audit ran `serve --port nope`: it bound with `NaN`, emitted a `127.0.0.1-NaN.json` state file, and formed a `:NaN` URL. That state was removed.
- `loadConfig()` returns unvalidated env/override values; path/base URL/boolean/host/mount/data fields have no single strict boundary.
- Pi calls `create - --project <cwd> --json` and consumes top-level `slug`, `projectName`, `path`, and `url`.

## P1.3 — file read capability

- Shared manifest explicitly advertises repo-relative or absolute `file-tree.items[].src`.
- `create.resolveFileTreeSources()` resolves relative paths against `--project`, accepts absolute paths, follows symlinks, and calls `readFile()` with no containment or byte limit.
- Resolution occurs before dry-run return, which is correct for validation parity.
- Disk content is inlined into the saved/published spec; `src` remains as non-secret provenance.
- `--publish` can upload the inlined content without a dedicated warning/safety field.
- Pi can invoke create but does not have an independent read-approval handshake.

## P1.4 — annotations/server

### Local

- `serveApi()` accepts annotation POSTs without content-type, Origin, or Fetch Metadata checks.
- Wrong mutation-route methods fall through to 404 instead of 405.
- `readAnnotationsDocument()` returns an empty document for any missing annotations path without checking `artifact.json`.
- `writeAnnotationsDocument()` creates parent directories and directly overwrites `annotations.json`.
- Concurrent requests perform uncoordinated read→apply→write and can lose updates.
- Server lifecycle state is written only after bind, but non-loopback hosts require no explicit exposure opt-in.
- Next dev proxies `/api/annotations/*` from `localhost:9999` to the CLI at `localhost:9998`; the browser's Origin may therefore differ by loopback port while Fetch Metadata remains same-origin.
- Client applies optimistic state, ignores the authoritative returned document, and rolls back a captured older document on failure. Concurrent requests can clobber later success.

### Worker

- `worker/src/routes.ts` also performs read→apply→unconditional R2 `put`, so hosted concurrent mutations can lose updates, including two simultaneous first writes.
- It does not require the artifact object before synthesizing/reading/writing annotations.
- Worker mutation POST accepts JSON parsing without checking Content-Type, Origin, or Fetch Metadata; wrong methods are handled, but browser write policy is absent.
- Official Cloudflare R2 Workers API supports conditional `put(..., { onlyIf })`; failed conditions return `null`. R2 object operations are strongly consistent, so bounded read/apply/conditional-write retry is supported.

## P1.5 — verification/release

- Root `package.json` has no scripts, package manager pin, or engines.
- App has test files but no `test` script.
- Bare `node --import tsx --test` reports 46 passing tests because default discovery skips the `.test.tsx` provider suite. Explicit discovery of all six `.test.ts`/`.test.tsx` files reports 45 pass / 2 fail in `ai-colab-provider.dom.test.tsx`; Bun cannot run these `node:test` imports. Wave 3A must make the complete Node+tsx suite green before wiring `pnpm test`, not preserve the false-green default.
- Shared and worker have committed Bun lockfiles; app has a pnpm lockfile; CLI's existing `bun.lockb` is ignored and therefore not reproducible from git.
- No pull-request verification workflow exists.
- Release workflow uses Node 20, pnpm 9, and `bun-version: latest`.
- Deploy workflow uses Node 22, pnpm 9, and `bun-version: latest`.
- Release runs only `bun run release`; deploy duplicates a subset of checks.
- `app/scripts/qa/health-check.mjs` still expects deleted `/components` content and stale “View Components” copy.
- CLI build already compiles and smoke-tests the native binary's contract command.
- Release script cross-compiles macOS/Linux arm64/x64 and only smokes targets matching the current OS, not a guaranteed Linux x64 runner.

## Directly settled constraints

- Keep Commander and Bun; no command-tree rewrite.
- Shared executable Zod schema is authoritative; manifest signatures become documentation only.
- Relative file reads stay project-contained; outside reads need explicit repeatable allow roots; Pi never opts in.
- Default local server stays loopback.
- Long-running commands use herdr because `HERDR_ENV=1`.
- Writer parallelism requires non-overlapping files plus isolated worktrees.
