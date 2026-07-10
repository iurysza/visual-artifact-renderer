# P1 architecture decisions

Status: accepted for this goal. Date: 2026-07-10.

## D1 — Shared executable schema

> **Decision**: `shared/` exports the sole `VisualArtifactSpecSchema`, parser, types, and resource constants; app keeps compatibility re-exports; CLI imports the same runtime schema.

**Context:** Manifest signature strings cannot encode the renderer's strict Zod semantics and already drift. Shared already ships Zod to app/CLI.

| Alternative | Rejected because |
|---|---|
| Keep/fix CLI signature interpreter | Preserves two semantic validators and an invented type language. |
| Generate JSON Schema and validate separately | Adds generation/runtime machinery while refinements still need custom code. |
| Import app source from CLI | Reverses package boundaries and couples Bun CLI to renderer internals. |

Consequences:
- Delete the handwritten semantic parser; keep only a thin `ValidationError`/Zod issue humanizer if commands need that API.
- Manifest remains the agent-facing catalog.
- Raw JSON is parsed through a shared size-aware helper at CLI and renderer fetch boundaries.
- `cli/assets/contract.json` becomes tracked generated output so export drift is reviewable and CI can fail on an uncommitted diff.
- Mermaid syntax validation remains a separate content validator; it is not an artifact-shape validator.

## D2 — Resource envelope

> **Decision**: enforce measured limits with headroom at the shared boundary and before unbounded reads.

| Resource | Limit | Observed max | Rationale |
|---|---:|---:|---|
| Raw/final serialized JSON | 2 MiB | 36,578 B | >57× current max; bounds diffs/data/HTML. |
| Top-level nodes | 30 | 29 | Makes advertised limit real; intentionally only one node of margin. |
| Datasets | 20 | 16 | Makes advertised limit real. |
| Total artifact nodes | 100 | 67 | Preserves complex reports with ~49% headroom. |
| Artifact-node depth | 8 | 5 | Preserves current nesting; prevents recursive abuse. |
| File-tree items | 500 | 51 | Prevents huge recursive explorers; ~9× headroom. |
| File-tree depth | 12 | 4 | Prevents pathological recursion; 3× headroom. |
| One sourced file | 512 KiB | no live source | Enough for source display; discourages blobs. |
| Aggregate sourced bytes | 1 MiB | no live source | Keeps final artifact inside 2 MiB after post-inline check. |

The CLI checks file/stdin bytes while reading, not after accumulation. The renderer checks fetched text bytes before `JSON.parse`. Saved artifacts are validated as saved and never re-read their historical `src` paths.

## D3 — CLI I/O and config contract

> **Decision**: one result writer selects human/JSON/plain; diagnostics are stderr-only; one Zod config parser validates env/default/CLI precedence before side effects.

### JSON

- Exactly one stdout document: `{ "schemaVersion": 1, "command": "<name>", ...existingCommandFields }`.
- Pi-required create fields remain top-level: `slug`, `projectName`, `path`, `url`.
- Errors stay on stderr with non-zero exit; no partial success JSON.

### Plain records

Fields are tab-separated; embedded tabs/newlines collapse to spaces.

| Command | Stable record(s) |
|---|---|
| `create` | URL only. |
| `open` | URL only. |
| `validate` | `VALID<TAB>slug<TAB>totalNodes<TAB>datasetCount` |
| `list` projects | `PROJECT<TAB>name<TAB>artifactCount<TAB>lastModifiedAt-or--` |
| `list <project>` | `ARTIFACT<TAB>project<TAB>slug<TAB>title<TAB>modifiedAt` |
| `doctor` | `PASS\|FAIL<TAB>check<TAB>message` |
| `serve` | URL only, emitted once after bind. |
| `serve status` | `RUNNING\|STOPPED<TAB>url<TAB>TRACKED\|UNTRACKED<TAB>pid-or--` |
| `serve stop` | `STOPPED\|NOOP\|REFUSED<TAB>url<TAB>method<TAB>pid-or--` |
| `contract` | `CONTRACT<TAB>version`, then `NODE<TAB>type` records (or one selected node record). |
| `setup cloudflare` | `PROFILE<TAB>profileName<TAB>baseUrl` |
| `bootstrap --dry-run` | `PASS\|FAIL<TAB>prerequisite<TAB>message` |
| `bootstrap` | `INSTALLED<TAB>binaryPath` |

### Other rules

- Human output can evolve but stays concise and command-specific.
- `--quiet` suppresses diagnostics/progress only, never result stdout.
- `--verbose` adds resolved paths, sourced-file metadata, and elapsed timing to stderr; unexpected errors include stack traces.
- `--json` conflicts with `--plain` in Commander before action execution.
- Exit 0 success, 1 runtime failure, 2 usage/input/schema/config failure.
- Color requires stderr/stdout TTY as applicable and is disabled by `NO_COLOR`, `TERM=dumb`, or `--no-color`.

### Config

Precedence remains CLI override > environment > detected/default. Schema validates:
- port integer 1–65535;
- host as IP/hostname without scheme/path/control characters;
- non-empty resolved artifacts/out/contract/project paths;
- normalized absolute mount/data paths;
- HTTP(S) base URL without credentials/query/hash;
- strict `0|1` env booleans;
- explicit `allowRemote` boolean.

## D4 — File read capability

> **Decision**: repeatable `create --allow-read <dir>` is the only outside-project read grant.

- Canonicalize `--project` and each allow root with `realpath` before reading.
- Reject any raw `..` path segment.
- Relative sources must canonicalize inside project root.
- Absolute sources are denied unless inside a canonical allow root (project root alone does not make absolute syntax implicit authority).
- Resolve the candidate's realpath before containment checks, which rejects symlink escapes.
- `content` still wins over `src` and causes no disk read.
- `src` is create-time capability input, so new persisted/published specs strip it after resolution; accepted saved specs may still contain historical `src`.
- Dry-run runs the same read checks and byte accounting.
- JSON includes `safety.diskSources: { included, count, totalBytes, files: [{ displayPath, bytes }] }`; `displayPath` is project-relative or allow-root-relative. Canonical absolute paths are verbose-stderr only; file content is never diagnostic output.
- Publishing any sourced content emits an actionable stderr warning. Pi does not pass allow roots.

## D5 — Annotation integrity and exposure

> **Decision**: local writes use a keyed promise queue plus atomic replace; browser mutation requests require JSON and same-origin evidence; remote bind is explicit; Worker uses R2 compare-and-swap retries.

### Local filesystem

- Artifact existence is checked before annotation GET or mutation.
- Per-artifact queue covers read→apply→write.
- Write same-directory unique temp with mode 0600, sync/close, rename, and finally unlink leftover temp.
- Mutation route methods other than POST return 405; non-JSON POST returns 415.

### Request policy

- Missing `Origin` and missing Fetch Metadata are allowed for non-browser CLI/tests.
- If `Sec-Fetch-Site` exists, only `same-origin` is accepted.
- If `Origin` exists, require exact request origin, except loopback-origin↔loopback-target is allowed for the Next dev proxy (`:9999`→`:9998`).
- Cross-origin browser requests return 403; no permissive CORS response is added.
- `serve` rejects non-loopback host unless `--allow-remote` or strict `VISUAL_ARTIFACT_ALLOW_REMOTE=1`; help/warning explains the writable API exposure.

### Client and Worker

- Client queues whole optimistic mutation transactions. One operation starts only after the prior response settles, so rollback cannot overwrite later work. Success replaces local state with the parsed authoritative response.
- Worker requires `artifact.json` for annotation GET and mutation, and applies the same method/content-type/origin policy to writes.
- Worker reads annotation object+etag and uses conditional R2 `put` with bounded retry (5 attempts). Existing objects use etag match; first creation uses the `If-None-Match: *` equivalent. A conflict re-reads and reapplies; exhaustion returns 409.

## D6 — Verification and release gate

> **Decision**: `scripts/verify.sh` is the executable repository contract; a reusable workflow runs it on pinned Linux x64 and macOS x64, and release/deploy depend on that workflow.

- Pins: Node 22.22.3, Bun 1.1.34, pnpm 11.5.2 (the locally verified versions).
- Add root package manager/runtime metadata, a committed CLI Bun lockfile, and tracked generated contract JSON.
- CI installs with `--frozen-lockfile` before invoking the entrypoint.
- App `test` uses Node's test runner with `tsx`; the current two AI Colab provider failures are fixed, not excluded; no Playwright.
- Contract export is followed by `git diff --exit-code -- cli/assets/contract.json`.
- CLI native build smoke runs on both workflow OSes.
- Replace stale health assertions with current home, artifact shell/data, and annotation request checks driven by the compiled CLI server.
- PR/main run the gate before normal release creation; release/deploy call it again before asset upload/deploy. Release publication itself already happened when the release workflow starts, so this gate protects assets, not creation.
- Manual deploy checkout falls back to the selected `github.ref` when no release tag exists; command blocks are not copied.

## Unresolved questions

None.
