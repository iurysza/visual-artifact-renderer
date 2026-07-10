# P1 hardening

## Outcome

Ship the prior audit's five P1s without changing Visualizer's product shape: agents still emit constrained JSON, the CLI remains the write/serve boundary, and the renderer still owns trusted UI adapters.

## Scope

1. **One executable artifact schema**
   - Export `VisualArtifactSpecSchema` and its parser/types/resource constants from `shared/`.
   - Re-export from the current app path for import stability.
   - Remove the CLI's manifest-signature interpreter; format shared Zod issues for humans.
   - Enforce input, dataset, node, nesting, and file-tree limits at CLI and renderer boundaries.
   - Add shared parity fixtures and contract consistency checks.
2. **CLI output and configuration contract**
   - Tailored human output, stable plain records, one versioned JSON document.
   - Correct stdout/stderr, quiet, verbose, color, conflict, and exit semantics.
   - One strict Zod configuration boundary; invalid config has no side effects.
   - Subprocess tests against the real CLI entrypoint and compiled binary.
3. **`file-tree.src` capability safety**
   - Canonical project containment by default.
   - Explicit repeatable `--allow-read <dir>` for outside/absolute reads.
   - Traversal/symlink denial, byte limits, dry-run parity, publish disclosure.
4. **Annotation integrity and server security**
   - Existing artifact required for annotation reads/writes.
   - Per-artifact serialization and atomic mode-0600 writes locally.
   - Method/content-type/origin/Fetch Metadata policy and explicit remote bind opt-in.
   - Serialized client mutation reconciliation using authoritative responses.
   - R2 conditional-write retry for hosted lost-update safety.
5. **Real repository verification gate**
   - One checked-in verification entrypoint for shared, CLI, app, and worker.
   - PR/main, release, and deploy reuse it with pinned runtimes and frozen installs.
   - Current-route health smoke, generated-contract diff gate, macOS/Linux x64 native binary smoke.

## Non-goals

- Bootstrap/upgrade/doctor redesign beyond required output/config correctness.
- Renderer visual redesign or unrelated React refactors.
- Playwright migration.
- Broad dependency/dead-code cleanup.
- Installer checksum/uninstall work.
- OpenSpec change packages.

## Acceptance criteria

### Schema and resources

- CLI and renderer import one shared executable schema; no second semantic validator remains.
- Unknown root keys, numeric `metadata.id`, invalid `file-tree.props.gitStatus`, and contentless `diff` fail CLI validation with exit 2 and useful paths.
- All parseable saved artifacts still validate.
- Limits are enforced and exported: 30 top-level nodes, 20 datasets, 100 total nested nodes, node depth 8, file-tree item count 500, file-tree depth 12, and 2 MiB serialized/raw artifact JSON.
- `file-tree.src`: 512 KiB per file, 1 MiB aggregate, final inlined artifact still <=2 MiB.
- Contract checks cover schema constraints, node types, manifest entries, and generated JSON equality.

### CLI

- Default output is concise human text; `--json` is one `schemaVersion: 1` object; `--plain` is documented line records.
- `create --plain` and `open --plain` print URL only.
- `--json --plain` fails during argument parsing with exit 2.
- Success/runtime/usage-validation-config exit 0/1/2 respectively.
- Primary result stays on stdout under `--quiet`; diagnostics/errors stay on stderr.
- Color is disabled by `NO_COLOR`, `TERM=dumb`, non-TTY, or `--no-color`.
- `--verbose` reports resolved paths, sourced-file metadata, and timing; unexpected failures include stack traces on stderr.
- Invalid ports/config fail before bind/spawn/open/state/file writes.
- Pi create JSON fields remain compatible.

### File reads

- Relative `src` inside canonical `--project` succeeds.
- `..`, symlink escapes, and unapproved absolute/outside paths fail with exit 2.
- Repeatable `--allow-read <dir>` authorizes only canonical descendants of those roots.
- Dry-run performs identical safety/limit checks but writes nothing.
- New saved/published specs strip create-time `src` after resolution so absolute local paths are not leaked.
- Publishing disk-sourced content warns on stderr and JSON reports non-secret source/safety metadata.
- Pi never adds `--allow-read` automatically.

### Annotations

- Missing artifact yields 404 and never creates `annotations.json`.
- Local concurrent mutations do not lose updates.
- Writes use same-directory temp files, mode 0600, atomic rename, and cleanup.
- Mutation routes return 405 for wrong methods, 415 for wrong content type, and 403 for unsafe browser origin/fetch metadata.
- Missing `Origin` is allowed for CLI/tests; same-origin and loopback dev proxy requests work.
- Non-loopback bind requires explicit `--allow-remote` or validated env equivalent.
- Client mutations execute serially, reconcile with returned documents, and cannot stale-rollback later success.
- Worker annotation reads/writes require the artifact object; writes enforce browser request policy and conditional R2 retry, including first-write races.

### Verification/release

- `./scripts/verify.sh` is the repository contract and passes from a dependency-installed clean tree.
- Shared: typecheck/build. CLI: tests/typecheck/build/native smoke. App: tests/lint/export+diff/artifact verification/build/health smoke. Worker: tests/typecheck.
- PR/main verification exists; release/deploy depend on the same reusable gate.
- Node/Bun/pnpm are exact and aligned (22.22.3/1.1.34/11.5.2); installs are frozen.
- Contract export fails CI when it changes tracked output.
- Native compiled CLI smoke runs on macOS x64 and Linux x64.

## Deliverables

- Reviewed, focused commits for every wave.
- `facts.md`, `decisions.md`, `plan.md`, `validation.md`, and continuously updated `dev-log.md` in this directory.
- Cross-surface user/maintainer docs matching shipped behavior.
- Final visual artifact with before/after evidence, architecture, tests, commits, changed subsystems, deferrals, and residual risks.

## Unresolved questions

None. Re-open only if implementation evidence invalidates a documented decision or a chosen limit would reject a legitimate saved artifact.
